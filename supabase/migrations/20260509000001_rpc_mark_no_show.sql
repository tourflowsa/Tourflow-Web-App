-- Phase 2M.1b No-Show Workflow
-- Description: Adds no-show support to bookings and creates security-hardened RPC for reporting no-shows.

BEGIN;

-- 1. Add columns to bookings
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS no_show_reason TEXT;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS no_show_reported_at TIMESTAMPTZ;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS no_show_reported_by UUID REFERENCES public.profiles(id);

-- 2. Update status constraint
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'bookings_status_check' 
        AND contype = 'c'
    ) THEN
        ALTER TABLE public.bookings DROP CONSTRAINT bookings_status_check;
    END IF;
    
    ALTER TABLE public.bookings ADD CONSTRAINT bookings_status_check 
    CHECK (status IN ('draft', 'pending', 'confirmed', 'assigned', 'in_progress', 'completed', 'cancelled', 'no_show'));
END $$;

-- 3. Create rpc_mark_booking_no_show
CREATE OR REPLACE FUNCTION public.rpc_mark_booking_no_show(
    p_booking_id UUID,
    p_reason TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_user_role TEXT;
    v_booking RECORD;
    v_payout_paid_count INT;
BEGIN
    -- Check auth
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Fetch booking
    SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Booking not found';
    END IF;

    -- Get user role
    SELECT role INTO v_user_role FROM public.profiles WHERE id = v_user_id;

    -- Permission check: Admin or Operator who owns the booking
    IF v_user_role != 'admin' AND v_booking.operator_id != v_user_id THEN
        RAISE EXCEPTION 'Unauthorized: Only admins or the booking operator can mark no-show';
    END IF;

    -- State check: Cannot mark no-show if already terminal or archived
    IF v_booking.status IN ('completed', 'cancelled', 'no_show') THEN
        RAISE EXCEPTION 'Invalid State: Booking is already %', v_booking.status;
    END IF;

    IF v_booking.archived_at IS NOT NULL THEN
        RAISE EXCEPTION 'Invalid State: Cannot mark no-show on an archived booking';
    END IF;

    -- Date check: Only allow on or after start date
    IF v_booking.start_date > (NOW() + INTERVAL '1 minute') THEN
        RAISE EXCEPTION 'Invalid Time: No-show can only be reported once the booking has reached its start date/time (%)', v_booking.start_date;
    END IF;

    -- Financial lock check
    SELECT count(*) INTO v_payout_paid_count 
    FROM public.payout_ledger 
    WHERE booking_id = p_booking_id 
    AND status = 'paid';

    IF v_payout_paid_count > 0 THEN
        RAISE EXCEPTION 'Financial Lock: Cannot mark no-show because one or more provider payouts have already been paid';
    END IF;

    -- 4. Perform Updates
    -- a. Update booking status
    UPDATE public.bookings
    SET 
        status = 'no_show',
        no_show_reason = p_reason,
        no_show_reported_at = NOW(),
        no_show_reported_by = v_user_id,
        updated_at = NOW()
    WHERE id = p_booking_id;

    -- b. Notifications for active assigned providers
    -- Only active assignments: pending, accepted
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
        'BOOKING_NO_SHOW',
        'No-Show Reported',
        'A no-show has been reported for booking ' || COALESCE(v_booking.booking_reference, 'N/A') || '.',
        '/dashboard',
        jsonb_build_object('booking_id', p_booking_id, 'booking_ref', v_booking.booking_reference)
    FROM public.booking_assignments
    WHERE booking_id = p_booking_id 
    AND status IN ('pending', 'accepted');

    -- c. Notification for Admins (if not the actor)
    INSERT INTO public.notifications (
        user_id,
        type,
        title,
        message,
        link,
        metadata
    )
    SELECT 
        p.id,
        'BOOKING_NO_SHOW',
        'No-Show Reported',
        'Operator ' || COALESCE(p_op.company_name, p_op.full_name, 'Unknown') || ' reported a no-show for booking ' || COALESCE(v_booking.booking_reference, 'N/A') || '.',
        '/admin/financials/payouts',
        jsonb_build_object('booking_id', p_booking_id, 'booking_ref', v_booking.booking_reference)
    FROM public.profiles p
    CROSS JOIN (SELECT company_name, full_name FROM public.profiles WHERE id = v_booking.operator_id) p_op
    WHERE p.role = 'admin' AND p.id != v_user_id;

    -- d. Audit Logging (REMOVED entity_table)
    BEGIN
        INSERT INTO public.system_audit_log (
            actor_id,
            actor_role,
            action,
            entity_type,
            entity_id,
            booking_id,
            metadata
        ) VALUES (
            v_user_id,
            v_user_role,
            'BOOKING_NO_SHOW',
            'booking',
            p_booking_id,
            p_booking_id,
            jsonb_build_object(
                'reason', p_reason,
                'original_status', v_booking.status,
                'booking_reference', v_booking.booking_reference,
                'reported_at', NOW()
            )
        );
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;

END;
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';
