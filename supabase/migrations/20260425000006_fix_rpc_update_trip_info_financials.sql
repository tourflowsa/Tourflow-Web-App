-- Migration: Refine RPC Trip Info Financial Recalculation
-- Description: Updates public.rpc_update_booking_trip_info to recalculate financials based on total_amount / num_guests ratio.

BEGIN;

CREATE OR REPLACE FUNCTION public.rpc_update_booking_trip_info(
    p_booking_id UUID,
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ,
    p_pickup_location TEXT,
    p_dropoff_location TEXT,
    p_guest_name TEXT,
    p_guest_email TEXT,
    p_guest_phone TEXT,
    p_number_of_guests INTEGER,
    p_special_requests TEXT,
    p_internal_notes TEXT
)
RETURNS public.bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_booking public.bookings;
    v_user_id UUID := auth.uid();
    v_is_admin BOOLEAN;
    v_payouts_started BOOLEAN;
    
    -- Recalculation vars
    v_price_per_person DECIMAL;
    v_new_total DECIMAL;
    v_fee_percent DECIMAL;
    v_new_platform_fee DECIMAL;
    v_new_net_amount DECIMAL;
    v_new_margin DECIMAL;
BEGIN
    -- Auth check
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Get user role
    SELECT (role = 'admin') INTO v_is_admin FROM public.profiles WHERE id = v_user_id;

    -- Fetch current booking
    SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id;

    IF v_booking.id IS NULL THEN
        RAISE EXCEPTION 'Booking not found';
    END IF;

    -- Permission check: Admin or Operator who owns the booking
    IF NOT v_is_admin AND v_booking.operator_id != v_user_id THEN
        RAISE EXCEPTION 'Unauthorized: Only admins or the booking operator can update trip info';
    END IF;

    -- Archive check
    IF v_booking.archived_at IS NOT NULL THEN
        RAISE EXCEPTION 'Cannot update an archived booking';
    END IF;

    -- Status lock check
    IF v_booking.status = 'completed' THEN
        RAISE EXCEPTION 'Completed bookings are locked from trip edits';
    END IF;

    -- Financial safety check: Block if any payout is already paid
    SELECT EXISTS (
        SELECT 1 FROM public.payout_ledger 
        WHERE booking_id = p_booking_id AND status = 'paid'
    ) INTO v_payouts_started;

    -- If guest count changes, apply strict checks and recalculations
    IF p_number_of_guests != v_booking.num_guests THEN
        -- 1. Payout block
        IF v_payouts_started THEN
            RAISE EXCEPTION 'Guest count cannot be changed after provider payouts have started.';
        END IF;

        -- 2. Derive Rate and Recalculate Booking Totals
        -- derive price per person from current total_amount / current num_guests
        IF v_booking.num_guests > 0 THEN
            v_price_per_person := v_booking.total_amount / v_booking.num_guests;
        ELSE
            -- Fallback to subtotal or tour price if num_guests was 0
            v_price_per_person := COALESCE(v_booking.total_amount, 0); 
        END IF;

        v_new_total := ROUND(v_price_per_person * p_number_of_guests, 2);
        
        -- 3. Resolve Platform Fee
        -- "If applied_fee_percent is 0 or null: do not invent a new percentage"
        v_fee_percent := COALESCE(v_booking.applied_fee_percent, 0);
        
        IF v_fee_percent > 0 THEN
            v_new_platform_fee := ROUND(v_new_total * v_fee_percent / 100, 2);
        ELSE
            -- keep applied_platform_fee at existing value if it exists, otherwise calculate with 0
            -- TODO: In a more robust implementation, we might want to re-snapshot the fee tier here.
            v_new_platform_fee := COALESCE(v_booking.applied_platform_fee, 0);
        END IF;

        v_new_net_amount := v_new_total - v_new_platform_fee;
        v_new_margin := v_new_net_amount - COALESCE(v_booking.internal_cost_total, 0);

        -- Hydrate record with new values for the UPDATE
        v_booking.total_amount := v_new_total;
        v_booking.escrow_total := v_new_total;
        v_booking.applied_platform_fee := v_new_platform_fee;
        v_booking.applied_net_amount := v_new_net_amount;
        v_booking.internal_margin := v_new_margin;
        v_booking.num_guests := p_number_of_guests;
    END IF;

    -- Update allowed fields
    UPDATE public.bookings
    SET 
        start_date = p_start_date,
        end_date = p_end_date,
        pickup_location = p_pickup_location,
        dropoff_location = p_dropoff_location,
        guest_name = p_guest_name,
        guest_email = p_guest_email,
        guest_phone = p_guest_phone,
        num_guests = v_booking.num_guests,
        total_amount = v_booking.total_amount,
        escrow_total = v_booking.escrow_total,
        applied_platform_fee = v_booking.applied_platform_fee,
        applied_net_amount = v_booking.applied_net_amount,
        internal_margin = v_booking.internal_margin,
        special_requests = p_special_requests,
        internal_notes = p_internal_notes,
        updated_at = NOW()
    WHERE id = p_booking_id
    RETURNING * INTO v_booking;

    -- Log audit event
    INSERT INTO public.system_audit_log (
        action,
        entity_type,
        entity_id,
        metadata,
        actor_id,
        actor_role
    )
    VALUES (
        'BOOKING_TRIP_INFO_UPDATED',
        'booking',
        p_booking_id,
        jsonb_build_object(
            'booking_reference', v_booking.booking_reference,
            'start_date', p_start_date,
            'end_date', p_end_date,
            'guest_name', p_guest_name,
            'new_num_guests', v_booking.num_guests,
            'new_total_amount', v_booking.total_amount,
            'new_platform_fee', v_booking.applied_platform_fee,
            'new_net_amount', v_booking.applied_net_amount
        ),
        v_user_id,
        CASE WHEN v_is_admin THEN 'admin' ELSE 'operator' END
    );

    RETURN v_booking;
END;
$$;

COMMIT;
