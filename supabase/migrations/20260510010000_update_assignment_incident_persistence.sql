-- Phase 2M.1c-A: Assignment Incident Persistence (Corrected Consistency)
-- Description: Adds incident reporting columns to booking_assignments and updates the assignment no-show RPC.

-- 1. Try to add 'no_show' to assignment_status enum if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'assignment_status') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid WHERE pg_type.typname = 'assignment_status' AND pg_enum.enumlabel = 'no_show') THEN
            EXECUTE 'ALTER TYPE public.assignment_status ADD VALUE ''no_show''';
        END IF;
    END IF;
END $$;

BEGIN;

-- 2. Add incident columns to booking_assignments if missing
ALTER TABLE public.booking_assignments ADD COLUMN IF NOT EXISTS incident_reason TEXT;
ALTER TABLE public.booking_assignments ADD COLUMN IF NOT EXISTS incident_reported_at TIMESTAMPTZ;
ALTER TABLE public.booking_assignments ADD COLUMN IF NOT EXISTS incident_reported_by UUID REFERENCES public.profiles(id);

-- 3. Update/Re-add status check constraint to ensure 'no_show' is permitted even for text columns
ALTER TABLE public.booking_assignments DROP CONSTRAINT IF EXISTS booking_assignments_status_check;
ALTER TABLE public.booking_assignments DROP CONSTRAINT IF EXISTS assignments_status_check;
ALTER TABLE public.booking_assignments ADD CONSTRAINT booking_assignments_status_check 
CHECK (status::text IN ('pending', 'accepted', 'rejected', 'completed', 'cancelled', 'no_show'));

-- 4. Update rpc_mark_assignment_no_show with hardened logic
DROP FUNCTION IF EXISTS public.rpc_mark_assignment_no_show(UUID, TEXT);

CREATE OR REPLACE FUNCTION public.rpc_mark_assignment_no_show(
    p_assignment_id UUID,
    p_reason TEXT DEFAULT NULL
)
RETURNS public.booking_assignments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_assignment public.booking_assignments%ROWTYPE;
    v_booking public.bookings%ROWTYPE;
    v_op public.profiles%ROWTYPE;
    v_original_status TEXT;
BEGIN
    -- 1. Fetch data and check auth
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: User must be signed in';
    END IF;

    -- Fetch assignment
    SELECT * INTO v_assignment FROM public.booking_assignments WHERE id = p_assignment_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Not Found: Assignment % not found', p_assignment_id;
    END IF;

    -- Store original status for audit logging
    v_original_status := v_assignment.status::text;

    -- Fetch booking
    SELECT * INTO v_booking FROM public.bookings WHERE id = v_assignment.booking_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Not Found: Booking for assignment % not found', v_assignment.booking_id;
    END IF;

    -- Authorization: Only admins or the booking operator
    IF NOT (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user_id AND is_admin = true) OR
        v_booking.operator_id = v_user_id
    ) THEN
        RAISE EXCEPTION 'Unauthorized: Only admins or the booking operator can report an assignment incident';
    END IF;

    -- 2. Validations
    -- Booking state check: Do not allow reporting on terminal bookings
    IF v_booking.status IN ('completed', 'cancelled') THEN
        RAISE EXCEPTION 'Invalid State: Cannot report assignment no-show on a % booking', v_booking.status;
    END IF;

    -- Assignment state check: Only pending or accepted assignments can be marked as no-show
    IF v_original_status NOT IN ('pending', 'accepted') THEN
        RAISE EXCEPTION 'Invalid State: Only pending or accepted assignments can be marked as no-show. Current status: %', v_original_status;
    END IF;

    -- Time guard: Provider no-show can only be reported once the booking is starting (within 5 minutes of start_date) or has started
    IF v_booking.start_date > (NOW() + interval '5 minutes') THEN
        RAISE EXCEPTION 'Invalid Time: Provider no-show can only be reported once the booking is starting (within 5 minutes of %) or has already started.', v_booking.start_date;
    END IF;

    -- 3. Perform Updates
    -- a. Update assignment status and incident fields
    UPDATE public.booking_assignments
    SET 
        status = 'no_show',
        incident_reason = p_reason,
        incident_reported_at = NOW(),
        incident_reported_by = v_user_id,
        updated_at = NOW()
    WHERE id = p_assignment_id
    RETURNING * INTO v_assignment;

    -- 4. Audit Log
    BEGIN
        INSERT INTO public.system_audit_log (
            actor_id,
            action,
            entity_type,
            entity_id,
            booking_id,
            metadata
        ) VALUES (
            v_user_id,
            'ASSIGNMENT_NO_SHOW',
            'assignment',
            p_assignment_id,
            v_assignment.booking_id,
            jsonb_build_object(
                'reason', p_reason,
                'original_status', v_original_status,
                'resource_type', v_assignment.resource_type,
                'resource_id', v_assignment.resource_id
            )
        );
    EXCEPTION WHEN OTHERS THEN
        -- Non-blocking audit log failure
        NULL;
    END;

    -- 5. Notifications
    -- a. Notify the provider if it's a driver or guide
    IF v_assignment.resource_type IN ('driver', 'guide') AND v_assignment.resource_id IS NOT NULL THEN
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
            CASE 
                WHEN v_assignment.resource_type = 'driver' THEN '/driver/assignments/' || v_assignment.id
                ELSE '/guide/assignments/' || v_assignment.id 
            END,
            jsonb_build_object(
                'assignment_id', p_assignment_id, 
                'booking_id', v_assignment.booking_id,
                'reason', p_reason
            )
        );
    END IF;

    -- b. Notify platform admins
    SELECT * INTO v_op FROM public.profiles WHERE id = v_booking.operator_id;
    
    INSERT INTO public.notifications (
        user_id,
        type,
        title,
        message,
        link,
        metadata
    )
    SELECT 
        id,
        'ADMIN_ASSIGNMENT_NO_SHOW',
        'Provider No-Show Reported',
        'Operator ' || COALESCE(v_op.company_name, v_op.full_name, 'Unknown') || ' reported a no-show for ' || v_assignment.resource_type || ' on booking ' || COALESCE(v_booking.booking_reference, 'N/A') || '.',
        '/admin/bookings/' || v_booking.id,
        jsonb_build_object(
            'assignment_id', p_assignment_id,
            'booking_id', v_assignment.booking_id,
            'operator_id', v_booking.operator_id,
            'resource_type', v_assignment.resource_type,
            'resource_id', v_assignment.resource_id,
            'reason', p_reason
        )
    FROM public.profiles
    WHERE is_admin = true;

    RETURN v_assignment;
END;
$$;

COMMIT;
