-- Migration: Add reconcile_booking_financials RPC
-- Description: Allows admins to manually reconcile booking financials and fix mismatches.

CREATE OR REPLACE FUNCTION public.reconcile_booking_financials(p_booking_id uuid, p_actor_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_booking record;
    v_expected_total numeric;
    v_actual_paid numeric;
    v_approved_total numeric;
    v_mismatch boolean := false;
    v_fixes_applied boolean := false;
    v_before_metadata jsonb;
    v_after_metadata jsonb;
    v_mismatch_type text;
    v_actor_role text;
BEGIN
    -- 1. Fetch booking
    SELECT 
        id, 
        escrow_total, 
        escrow_released, 
        funds_held_amount, 
        funds_released_amount,
        internal_cost_total
    INTO v_booking 
    FROM public.bookings 
    WHERE id = p_booking_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Booking not found';
    END IF;

    -- Store before state for audit
    v_before_metadata := jsonb_build_object(
        'escrow_total', v_booking.escrow_total,
        'escrow_released', v_booking.escrow_released,
        'funds_held_amount', v_booking.funds_held_amount,
        'funds_released_amount', v_booking.funds_released_amount
    );

    -- 2. Fetch all payout_ledger rows for booking
    -- 3. Calculate
    SELECT COALESCE(SUM(amount_net), 0) INTO v_actual_paid
    FROM public.payout_ledger 
    WHERE booking_id = p_booking_id AND status = 'paid';

    SELECT COALESCE(SUM(amount_net), 0) INTO v_approved_total
    FROM public.payout_ledger 
    WHERE booking_id = p_booking_id AND status = 'approved';

    v_expected_total := COALESCE(v_booking.internal_cost_total, 0);

    -- 4. Detect mismatches
    IF v_actual_paid > v_booking.escrow_total AND v_booking.escrow_total > 0 THEN
        v_mismatch := true;
        v_mismatch_type := 'CRITICAL: Paid > Escrow';
    ELSIF ABS((v_approved_total + v_actual_paid) - v_expected_total) > 0.01 THEN
        v_mismatch := true;
        v_mismatch_type := 'Mismatch: Approved + Paid != Expected';
    ELSIF ABS(v_booking.funds_released_amount - v_actual_paid) > 0.01 OR ABS(v_booking.escrow_released - v_actual_paid) > 0.01 THEN
        v_mismatch := true;
        v_mismatch_type := 'Sync Issue: Booking released != Actual paid';
    END IF;

    -- 5. Fix logic
    IF v_mismatch THEN
        -- update bookings: ONLY sync totals, never reduce paid payouts
        UPDATE public.bookings
        SET funds_released_amount = v_actual_paid,
            escrow_released = v_actual_paid,
            funds_remaining_amount = GREATEST(0, v_expected_total - v_actual_paid),
            updated_at = now()
        WHERE id = p_booking_id;

        -- Sync escrow_status if clearly inconsistent
        IF v_actual_paid >= v_booking.escrow_total AND v_booking.escrow_total > 0 THEN
            UPDATE public.bookings SET escrow_status = 'fully_released' WHERE id = p_booking_id AND escrow_status != 'fully_released';
        ELSIF v_actual_paid > 0 AND v_actual_paid < v_booking.escrow_total THEN
            UPDATE public.bookings SET escrow_status = 'partially_released' WHERE id = p_booking_id AND escrow_status NOT IN ('partially_released', 'fully_released');
        END IF;
        
        v_fixes_applied := true;
    END IF;

    -- 6. Audit Log
    SELECT role INTO v_actor_role FROM public.profiles WHERE id = p_actor_id;
    
    v_after_metadata := jsonb_build_object(
        'expected_total', v_expected_total,
        'actual_paid', v_actual_paid,
        'approved_total', v_approved_total,
        'mismatch_type', v_mismatch_type,
        'fixes_applied', v_fixes_applied
    );

    INSERT INTO public.system_audit_log (
        actor_id,
        actor_role,
        action,
        entity_type,
        entity_id,
        metadata,
        created_at
    ) VALUES (
        p_actor_id,
        COALESCE(v_actor_role, 'admin'),
        'reconcile_booking',
        'reconciliation',
        p_booking_id,
        jsonb_build_object(
            'before', v_before_metadata,
            'after', v_after_metadata,
            'mismatch_type', v_mismatch_type
        ),
        now()
    );

    RETURN json_build_object(
        'bookingId', p_booking_id,
        'expected_total', v_expected_total,
        'actual_paid', v_actual_paid,
        'approved_total', v_approved_total,
        'mismatch', v_mismatch,
        'fixes_applied', v_fixes_applied
    );
END;
$$;
