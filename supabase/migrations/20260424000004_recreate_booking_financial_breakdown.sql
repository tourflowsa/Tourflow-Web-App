-- Migration: recreate_booking_financial_breakdown

DROP FUNCTION IF EXISTS public.get_booking_financial_breakdown(uuid);

CREATE OR REPLACE FUNCTION public.get_booking_financial_breakdown(p_booking_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking record;
  v_is_admin boolean;
  v_is_operator boolean;
  v_is_assigned boolean;
  v_revenue numeric;
  v_platform_fee numeric;
  v_total_provider_cost numeric := 0;
  v_total_paid_out numeric := 0;
  v_dispute_amount numeric := 0;
  v_providers jsonb := '[]'::jsonb;
  
  provider_record record;
  v_payout numeric;
  v_payout_status text;
  
  v_owner_record record;
BEGIN
  -- 1. Fetch booking
  SELECT * INTO v_booking
  FROM bookings
  WHERE id = p_booking_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  -- 2. Auth checks
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
  ) INTO v_is_admin;
  
  v_is_operator := (v_booking.operator_id = auth.uid());
  
  SELECT EXISTS (
    SELECT 1 FROM booking_assignments
    WHERE booking_id = p_booking_id
      AND resource_id = auth.uid()
      AND status::text IN ('pending', 'accepted', 'completed', 'assigned', 'active', 'confirmed', 'invited', 'requested')
  ) INTO v_is_assigned;

  -- Allow if fleet owner
  IF NOT v_is_assigned AND v_booking.vehicle_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM vehicles 
      WHERE id = v_booking.vehicle_id AND owner_id = auth.uid()
    ) INTO v_is_assigned;
  END IF;

  IF NOT (v_is_admin OR v_is_operator OR v_is_assigned) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- 3. Calculate Driver and Guide Rows
  FOR provider_record IN 
    SELECT 
      ba.resource_id,
      ba.resource_type,
      ba.cost_total,
      ba.rate_amount,
      p.company_name,
      p.full_name,
      p.email
    FROM booking_assignments ba
    LEFT JOIN profiles p ON p.id = ba.resource_id
    WHERE ba.booking_id = p_booking_id
      AND ba.resource_type IN ('driver', 'guide')
      AND ba.status::text IN ('pending', 'accepted', 'completed', 'assigned', 'active', 'confirmed', 'invited', 'requested')
  LOOP
    DECLARE
      v_agreed_rate numeric := COALESCE(provider_record.cost_total, provider_record.rate_amount, 0);
      v_provider_name text := COALESCE(provider_record.company_name, provider_record.full_name, provider_record.email, INITCAP(provider_record.resource_type));
      v_ledger record;
    BEGIN
      -- find ledger
      SELECT * INTO v_ledger 
      FROM payout_ledger 
      WHERE booking_id = p_booking_id 
        AND provider_id = provider_record.resource_id 
        AND payout_reference ILIKE '%' || UPPER(provider_record.resource_type) || '%'
      LIMIT 1;

      IF FOUND THEN
        v_payout := COALESCE(v_ledger.adjusted_amount, v_ledger.amount_net, 0);
        v_payout_status := v_ledger.status;
      ELSE
        v_payout := v_agreed_rate;
        v_payout_status := 'pending';
      END IF;

      v_providers := v_providers || jsonb_build_object(
        'provider_id', provider_record.resource_id,
        'provider_name', v_provider_name,
        'provider_type', INITCAP(provider_record.resource_type),
        'agreed_rate', v_agreed_rate,
        'payout_amount', v_payout,
        'payout_status', v_payout_status,
        'is_disputed', false
      );

      v_total_provider_cost := v_total_provider_cost + v_agreed_rate;
      IF v_payout_status = 'paid' THEN
        v_total_paid_out := v_total_paid_out + v_payout;
      END IF;
    END;
  END LOOP;

  -- 4. Calculate Fleet Row
  IF v_booking.vehicle_id IS NOT NULL THEN
    SELECT 
      v.owner_id, 
      p.company_name, 
      p.full_name, 
      p.email 
    INTO v_owner_record
    FROM vehicles v
    LEFT JOIN profiles p ON p.id = v.owner_id
    WHERE v.id = v_booking.vehicle_id
      AND v.owner_id IS NOT NULL;

    IF FOUND THEN
      DECLARE
        v_agreed_rate numeric := COALESCE(v_booking.internal_cost_vehicle, v_booking.vehicle_rate_amount, 0);
        v_provider_name text := COALESCE(v_owner_record.company_name, v_owner_record.full_name, v_owner_record.email, 'Fleet Owner');
        v_ledger record;
      BEGIN
        SELECT * INTO v_ledger 
        FROM payout_ledger 
        WHERE booking_id = p_booking_id 
          AND provider_id = v_owner_record.owner_id 
          AND payout_reference ILIKE '%VEHICLE%'
        LIMIT 1;

        IF FOUND THEN
          v_payout := COALESCE(v_ledger.adjusted_amount, v_ledger.amount_net, 0);
          v_payout_status := v_ledger.status;
        ELSE
          v_payout := v_agreed_rate;
          v_payout_status := 'pending';
        END IF;

        v_providers := v_providers || jsonb_build_object(
          'provider_id', v_owner_record.owner_id,
          'provider_name', v_provider_name,
          'provider_type', 'Fleet',
          'agreed_rate', v_agreed_rate,
          'payout_amount', v_payout,
          'payout_status', v_payout_status,
          'is_disputed', false
        );

        v_total_provider_cost := v_total_provider_cost + v_agreed_rate;
        IF v_payout_status = 'paid' THEN
          v_total_paid_out := v_total_paid_out + v_payout;
        END IF;
      END;
    END IF;
  END IF;

  -- 5. Totals
  v_revenue := COALESCE(v_booking.total_amount, 0);
  v_platform_fee := COALESCE(v_booking.applied_platform_fee, 0);

  RETURN jsonb_build_object(
    'booking_id', v_booking.id,
    'booking_ref', v_booking.booking_reference,
    'total_revenue', v_revenue,
    'platform_fee', v_platform_fee,
    'net_margin', v_revenue - v_platform_fee - v_total_provider_cost,
    'total_provider_cost', v_total_provider_cost,
    'escrow_amount', COALESCE(v_booking.escrow_total, 0),
    'total_paid_out', v_total_paid_out,
    'outstanding_payout', v_total_provider_cost - v_total_paid_out,
    'dispute_amount', v_dispute_amount,
    'currency', COALESCE(v_booking.currency, 'ZAR'),
    'providers', v_providers
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_booking_financial_breakdown(uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';
