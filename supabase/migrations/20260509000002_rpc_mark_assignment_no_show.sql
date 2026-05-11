-- Phase 2M.1c: Provider No-Show / Assignment Incident Workflow
-- Description: Adds no-show support to specific assignments and creates an RPC for reporting provider-level no-shows.

BEGIN;

-- 1. Add columns to booking_assignments
ALTER TABLE public.booking_assignments ADD COLUMN IF NOT EXISTS no_show_reason TEXT;
ALTER TABLE public.booking_assignments ADD COLUMN IF NOT EXISTS no_show_reported_at TIMESTAMPTZ;
ALTER TABLE public.booking_assignments ADD COLUMN IF NOT EXISTS no_show_reported_by UUID REFERENCES public.profiles(id);

-- 2. Update status constraint for booking_assignments
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'booking_assignments_status_check' 
        OR conname = 'assignments_status_check'
    ) THEN
        -- Try to find the exact name if multiple possibilities
        -- In some environments it might be booking_assignments_status_check
        ALTER TABLE public.booking_assignments DROP CONSTRAINT IF EXISTS booking_assignments_status_check;
        ALTER TABLE public.booking_assignments DROP CONSTRAINT IF EXISTS assignments_status_check;
    END IF;
    
    ALTER TABLE public.booking_assignments ADD CONSTRAINT booking_assignments_status_check 
    CHECK (status IN ('pending', 'accepted', 'rejected', 'completed', 'cancelled', 'no_show'));
END $$;

-- 3. Create rpc_mark_assignment_no_show
CREATE OR REPLACE FUNCTION public.rpc_mark_assignment_no_show(
    p_assignment_id UUID,
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
    v_assignment RECORD;
    v_booking RECORD;
BEGIN
    -- Check auth
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Fetch assignment
    SELECT * INTO v_assignment FROM public.booking_assignments WHERE id = p_assignment_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Assignment not found';
    END IF;

    -- Fetch booking for parent context and permissions
    SELECT * INTO v_booking FROM public.bookings WHERE id = v_assignment.booking_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Associated booking not found';
    END IF;

    -- Get user role
    SELECT role INTO v_user_role FROM public.profiles WHERE id = v_user_id;

    -- Permission check: Admin or Operator who owns the booking
    IF v_user_role != 'admin' AND v_booking.operator_id != v_user_id THEN
        RAISE EXCEPTION 'Unauthorized: Only admins or the booking operator can report an assignment no-show';
    END IF;

    -- State check: Cannot mark no-show if already terminal or archived
    IF v_assignment.status IN ('completed', 'rejected', 'cancelled', 'no_show') THEN
        RAISE EXCEPTION 'Invalid State: Assignment is already %', v_assignment.status;
    END IF;

    IF v_booking.archived_at IS NOT NULL THEN
        RAISE EXCEPTION 'Invalid State: Cannot report no-show on an archived booking context';
    END IF;

    -- Date check: Only allow on or after booking start date
    IF v_booking.start_date > (NOW() + INTERVAL '1 minute') THEN
        RAISE EXCEPTION 'Invalid Time: Provider no-show can only be reported once the booking has reached its start date/time (%)', v_booking.start_date;
    END IF;

    -- 4. Perform Updates
    -- a. Update assignment status
    UPDATE public.booking_assignments
    SET 
        status = 'no_show',
        no_show_reason = p_reason,
        no_show_reported_at = NOW(),
        no_show_reported_by = v_user_id,
        updated_at = NOW()
    WHERE id = p_assignment_id;

    -- b. Notification for the provider
    IF v_assignment.resource_type IN ('driver', 'guide') THEN
        INSERT INTO public.notifications (
            user_id,
            type,
            title,
            message,
            link,
            metadata
        ) VALUES (
            v_assignment.resource_id,
            'ASSIGNMENT_NO_SHOW',
            'No-Show Reported',
            'A no-show has been reported for your assignment on booking ' || COALESCE(v_booking.booking_reference, 'N/A') || '.',
            '/dashboard',
            jsonb_build_object(
                'assignment_id', p_assignment_id, 
                'booking_id', v_assignment.booking_id, 
                'booking_ref', v_booking.booking_reference
            )
        );
    ELSIF v_assignment.resource_type = 'vehicle' THEN
        INSERT INTO public.notifications (
            user_id,
            type,
            title,
            message,
            link,
            metadata
        )
        SELECT 
            owner_id,
            'ASSIGNMENT_NO_SHOW',
            'No-Show Reported',
            'A no-show has been reported for your vehicle (' || make || ' ' || model || ') on booking ' || COALESCE(v_booking.booking_reference, 'N/A') || '.',
            '/owner/earnings',
            jsonb_build_object(
                'assignment_id', p_assignment_id, 
                'booking_id', v_assignment.booking_id, 
                'booking_ref', v_booking.booking_reference,
                'vehicle_id', v_assignment.resource_id
            )
        FROM public.vehicles
        WHERE id = v_assignment.resource_id;
    END IF;

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
        'ASSIGNMENT_NO_SHOW',
        'No-Show Reported',
        'Operator ' || COALESCE(p_op.company_name, p_op.full_name, 'Unknown') || ' reported a no-show for ' || v_assignment.resource_type || ' on booking ' || v_booking.booking_reference || '.',
        '/admin/financials/payouts',
        jsonb_build_object(
            'assignment_id', p_assignment_id,
            'booking_id', v_assignment.booking_id, 
            'booking_ref', v_booking.booking_reference
        )
    FROM public.profiles p
    CROSS JOIN (SELECT company_name, full_name FROM public.profiles WHERE id = v_booking.operator_id) p_op
    WHERE p.role = 'admin' AND p.id != v_user_id;

    -- d. Audit Logging
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
        'ASSIGNMENT_NO_SHOW',
        'assignment',
        p_assignment_id,
        v_assignment.booking_id,
        jsonb_build_object(
            'reason', p_reason,
            'resource_type', v_assignment.resource_type,
            'resource_id', v_assignment.resource_id,
            'original_status', v_assignment.status,
            'booking_reference', v_booking.booking_reference,
            'reported_at', NOW()
        )
    );

END;
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';
