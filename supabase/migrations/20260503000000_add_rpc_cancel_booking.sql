-- Add booking cancellation RPC and associated schema updates
-- 1. Ensure cancellation_reason exists on bookings
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS cancellation_reason text;

-- 2. Ensure booking_id exists on system_audit_log for easier filtering
-- This was identified as a gap in clean environment setup
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'system_audit_log' AND column_name = 'booking_id') THEN
        ALTER TABLE public.system_audit_log ADD COLUMN booking_id uuid REFERENCES public.bookings(id);
    END IF;
END $$;

-- 3. Create the cancellation RPC
CREATE OR REPLACE FUNCTION public.rpc_cancel_booking(
    p_booking_id uuid,
    p_reason text default null
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id uuid;
    v_user_role text;
    v_booking record;
    v_payout_paid_count int;
BEGIN
    -- Get current user context
    v_user_id := auth.uid();
    
    -- Check if booking exists and get info
    SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Booking not found %', p_booking_id;
    END IF;

    -- Get user role
    SELECT role INTO v_user_role FROM public.profiles WHERE id = v_user_id;

    -- Validate authorization: Operator who owns it or Admin
    IF v_user_role != 'admin' AND v_booking.operator_id != v_user_id THEN
        RAISE EXCEPTION 'Unauthorized: Only the booking operator or an admin can cancel this booking';
    END IF;

    -- Validate state: Cannot cancel if already terminal or archived
    -- Note: archived bookings are technically terminal in this UI flow
    IF v_booking.status IN ('completed', 'cancelled', 'paid') THEN
        RAISE EXCEPTION 'Invalid State: Booking is already %', v_booking.status;
    END IF;
    
    IF v_booking.archived_at IS NOT NULL THEN
        RAISE EXCEPTION 'Invalid State: Cannot cancel an archived booking';
    END IF;

    -- Financial Safety: Check if any payouts have been paid
    -- Using payout_ledger as the source of truth for financial lockdown
    SELECT count(*) INTO v_payout_paid_count 
    FROM public.payout_ledger 
    WHERE booking_id = p_booking_id 
    AND status = 'paid';

    IF v_payout_paid_count > 0 THEN
        RAISE EXCEPTION 'Financial Lock: Cannot cancel booking because one or more provider payouts have already been paid';
    END IF;

    -- 4. Perform Updates
    -- a. Update booking status
    UPDATE public.bookings 
    SET 
        status = 'cancelled',
        cancellation_reason = p_reason,
        updated_at = now()
    WHERE id = p_booking_id;

    -- b. Cancel associated assignments (only those that aren't already terminal)
    -- This ensures providers currently assigned (in any active status) are notified
    INSERT INTO public.notifications (
        user_id,
        type,
        title,
        message,
        link,
        metadata
    )
    SELECT 
        resource_id,
        'BOOKING_CANCELLED',
        'Booking Cancelled',
        'Booking ' || COALESCE(v_booking.booking_reference, 'N/A') || ' has been cancelled by the operator.',
        '/dashboard',
        jsonb_build_object('booking_id', p_booking_id, 'booking_ref', v_booking.booking_reference)
    FROM public.booking_assignments
    WHERE booking_id = p_booking_id 
    AND status NOT IN ('completed', 'rejected', 'cancelled');

    UPDATE public.booking_assignments
    SET 
        status = 'cancelled',
        updated_at = now()
    WHERE booking_id = p_booking_id 
    AND status NOT IN ('completed', 'rejected', 'cancelled');

    -- c. Audit Logging
    INSERT INTO public.system_audit_log (
        actor_id,
        actor_role,
        action,
        entity_type,
        entity_id,
        entity_table,
        booking_id,
        metadata
    ) VALUES (
        v_user_id,
        v_user_role,
        'BOOKING_CANCELLED',
        'booking',
        p_booking_id,
        'bookings',
        p_booking_id,
        jsonb_build_object(
            'reason', p_reason,
            'original_status', v_booking.status,
            'booking_reference', v_booking.booking_reference
        )
    );

END;
$$;
