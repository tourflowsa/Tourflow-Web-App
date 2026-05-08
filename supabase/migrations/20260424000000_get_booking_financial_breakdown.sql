-- Migration: Create Booking Financial Breakdown RPC

CREATE OR REPLACE FUNCTION public.get_booking_financial_breakdown(p_booking_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking record;
  v_providers jsonb := '[]'::jsonb;
  v_total_revenue numeric;
  v_platform_fee numeric;
  v_total_provider_cost numeric := 0;
  v_total_paid_out numeric := 0;
  v_outstanding_payout numeric := 0;
  v_escrow_amount numeric := 0;
  v_dispute_amount numeric := 0;
  v_net_margin numeric;
  v_driver record;
  v_guide record;
  v_fleet_owner record;
  v_ledger_driver record;
  v_ledger_guide record;
  v_ledger_vehicle record;
  elem jsonb;
BEGIN
  -- 1. Get Booking Data
  SELECT * INTO v_booking
  FROM bookings
  WHERE id = p_booking_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  v_total_revenue := COALESCE(v_booking.total_amount, 0);
  v_platform_fee := COALESCE(v_booking.applied_platform_fee, 0);
  v_escrow_amount := COALESCE(v_booking.escrow_total, 0);

  -- 2. Extract assignments
  -- Driver
  SELECT ba.*, p.full_name, p.company_name, p.email 
  INTO v_driver
  FROM booking_assignments ba
  LEFT JOIN profiles p ON p.id = ba.resource_id
  WHERE ba.booking_id = p_booking_id AND ba.resource_type = 'driver'
    AND ba.status IN ('accepted', 'completed', 'pending', 'invited', 'requested', 'assigned', 'active', 'confirmed')
  ORDER BY ba.created_at DESC
  LIMIT 1;

  -- Guide
  SELECT ba.*, p.full_name, p.company_name, p.email 
  INTO v_guide
  FROM booking_assignments ba
  LEFT JOIN profiles p ON p.id = ba.resource_id
  WHERE ba.booking_id = p_booking_id AND ba.resource_type = 'guide'
    AND ba.status IN ('accepted', 'completed', 'pending', 'invited', 'requested', 'assigned', 'active', 'confirmed')
  ORDER BY ba.created_at DESC
  LIMIT 1;

  -- Fleet (Vehicle Owner)
  IF v_booking.vehicle_id IS NOT NULL THEN
    SELECT v.owner_id, p.full_name, p.company_name, p.email
    INTO v_fleet_owner
    FROM vehicles v
    LEFT JOIN profiles p ON p.id = v.owner_id
    WHERE v.id = v_booking.vehicle_id;
  END IF;

  -- 3. Extract Ledgers
  -- Driver Ledger
  IF v_driver.resource_id IS NOT NULL THEN
    SELECT * INTO v_ledger_driver
    FROM payout_ledger
    WHERE booking_id = p_booking_id AND provider_id = v_driver.resource_id AND payout_reference LIKE '%DRIVER%'
    ORDER BY created_at DESC LIMIT 1;
  END IF;

  -- Guide Ledger
  IF v_guide.resource_id IS NOT NULL THEN
    SELECT * INTO v_ledger_guide
    FROM payout_ledger
    WHERE booking_id = p_booking_id AND provider_id = v_guide.resource_id AND payout_reference LIKE '%GUIDE%'
    ORDER BY created_at DESC LIMIT 1;
  END IF;

  -- Vehicle Ledger
  IF v_fleet_owner.owner_id IS NOT NULL THEN
    SELECT * INTO v_ledger_vehicle
    FROM payout_ledger
    WHERE booking_id = p_booking_id AND provider_id = v_fleet_owner.owner_id AND payout_reference LIKE '%VEHICLE%'
    ORDER BY created_at DESC LIMIT 1;
  END IF;

  -- 4. Build Provider Array
  -- Driver Row
  IF v_driver.resource_id IS NOT NULL THEN
    v_providers := v_providers || jsonb_build_object(
      'provider_id', v_driver.resource_id,
      'provider_name', COALESCE(v_driver.company_name, v_driver.full_name, v_driver.email, 'Unknown'),
      'provider_type', 'Driver',
      'agreed_rate', COALESCE(v_driver.cost_total, v_booking.internal_cost_driver, 0),
      'payout_amount', CASE WHEN v_ledger_driver.id IS NOT NULL THEN COALESCE(v_ledger_driver.adjusted_amount, v_ledger_driver.amount_net, 0) ELSE COALESCE(v_driver.cost_total, v_booking.internal_cost_driver, 0) END,
      'payout_status', COALESCE(v_ledger_driver.status, CASE WHEN v_driver.status = 'accepted' THEN 'pending' ELSE v_driver.status END, 'pending'),
      'is_disputed', COALESCE(v_ledger_driver.is_disputed, false)
    );
  END IF;

  -- Guide Row
  IF v_guide.resource_id IS NOT NULL THEN
    v_providers := v_providers || jsonb_build_object(
      'provider_id', v_guide.resource_id,
      'provider_name', COALESCE(v_guide.company_name, v_guide.full_name, v_guide.email, 'Unknown'),
      'provider_type', 'Guide',
      'agreed_rate', COALESCE(v_guide.cost_total, v_booking.internal_cost_guide, 0),
      'payout_amount', CASE WHEN v_ledger_guide.id IS NOT NULL THEN COALESCE(v_ledger_guide.adjusted_amount, v_ledger_guide.amount_net, 0) ELSE COALESCE(v_guide.cost_total, v_booking.internal_cost_guide, 0) END,
      'payout_status', COALESCE(v_ledger_guide.status, CASE WHEN v_guide.status = 'accepted' THEN 'pending' ELSE v_guide.status END, 'pending'),
      'is_disputed', COALESCE(v_ledger_guide.is_disputed, false)
    );
  END IF;

  -- Fleet Row
  IF v_fleet_owner.owner_id IS NOT NULL THEN
    v_providers := v_providers || jsonb_build_object(
      'provider_id', v_fleet_owner.owner_id,
      'provider_name', COALESCE(v_fleet_owner.company_name, v_fleet_owner.full_name, v_fleet_owner.email, 'Unknown'),
      'provider_type', 'Fleet',
      'agreed_rate', COALESCE(v_booking.internal_cost_vehicle, 0),
      'payout_amount', CASE WHEN v_ledger_vehicle.id IS NOT NULL THEN COALESCE(v_ledger_vehicle.adjusted_amount, v_ledger_vehicle.amount_net, 0) ELSE COALESCE(v_booking.internal_cost_vehicle, 0) END,
      'payout_status', COALESCE(v_ledger_vehicle.status, 'pending'),
      'is_disputed', COALESCE(v_ledger_vehicle.is_disputed, false)
    );
  END IF;

  -- 5. Calculate Totals
  FOR elem IN SELECT * FROM jsonb_array_elements(v_providers)
  LOOP
    v_total_provider_cost := v_total_provider_cost + (elem->>'agreed_rate')::numeric;
  END LOOP;
  
  -- If total cost from providers is 0, fallback to internal_cost_total
  IF v_total_provider_cost = 0 THEN
    v_total_provider_cost := COALESCE(v_booking.internal_cost_total, 0);
  END IF;

  -- paid out calculation 
  SELECT 
    COALESCE(SUM(COALESCE(adjusted_amount, amount_net)), 0) INTO v_total_paid_out
  FROM payout_ledger
  WHERE booking_id = p_booking_id AND status = 'paid';

  -- dispute calculation
  SELECT 
    COALESCE(SUM(amount_net - COALESCE(adjusted_amount, amount_net)), 0) INTO v_dispute_amount
  FROM payout_ledger
  WHERE booking_id = p_booking_id AND is_disputed = true;

  v_outstanding_payout := v_total_provider_cost - v_total_paid_out;
  v_net_margin := v_total_revenue - v_total_provider_cost - v_platform_fee;

  RETURN json_build_object(
    'booking_id', v_booking.id,
    'booking_ref', v_booking.booking_reference,
    'total_revenue', v_total_revenue,
    'platform_fee', v_platform_fee,
    'net_margin', v_net_margin,
    'total_provider_cost', v_total_provider_cost,
    'escrow_amount', v_escrow_amount,
    'total_paid_out', v_total_paid_out,
    'outstanding_payout', v_outstanding_payout,
    'dispute_amount', v_dispute_amount,
    'currency', COALESCE(v_booking.currency, 'ZAR'),
    'providers', v_providers
  );
END;
$$;
