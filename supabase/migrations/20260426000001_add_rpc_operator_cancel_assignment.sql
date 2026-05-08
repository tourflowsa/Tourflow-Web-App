-- Update RPC for operator to cancel/remove an assignment
-- Bypasses RLS for the lookup to avoid "0 rows returned" issues for operators
-- and allows admins to perform the action.
CREATE OR REPLACE FUNCTION public.rpc_operator_cancel_assignment(
    p_assignment_id uuid
)
RETURNS public.booking_assignments AS $$
DECLARE
    v_assignment public.booking_assignments;
    v_booking_id uuid;
    v_resource_id uuid;
    v_operator_id uuid;
    v_is_admin boolean;
BEGIN
    -- 1. Lookup assignment data (Bypassing RLS)
    SELECT ba.booking_id, ba.resource_id, b.operator_id 
    INTO v_booking_id, v_resource_id, v_operator_id
    FROM public.booking_assignments ba
    JOIN public.bookings b ON ba.booking_id = b.id
    WHERE ba.id = p_assignment_id;

    IF v_booking_id IS NULL THEN
        RAISE EXCEPTION 'Assignment not found';
    END IF;

    -- 2. Check Role
    SELECT (role = 'admin') INTO v_is_admin FROM public.profiles WHERE id = auth.uid();
    
    IF NOT COALESCE(v_is_admin, false) AND v_operator_id != auth.uid() THEN
        RAISE EXCEPTION 'Unauthorized: You do not own this booking';
    END IF;

    -- 3. Check Financial Integrity
    -- a. Global lock for booking (any payout paid)
    IF EXISTS (
        SELECT 1 FROM public.payout_ledgers 
        WHERE booking_id = v_booking_id AND status = 'paid'
    ) THEN
        RAISE EXCEPTION 'BOOKING_FINANCIALLY_LOCKED';
    END IF;

    -- b. Specific lock for this resource (payout approved or paid)
    IF EXISTS (
        SELECT 1 FROM public.payout_ledgers
        WHERE booking_id = v_booking_id 
          AND provider_id = v_resource_id 
          AND status IN ('approved', 'paid')
    ) THEN
        RAISE EXCEPTION 'PAYOUT_ALREADY_PROCESSED';
    END IF;

    -- 4. Update Status to 'cancelled'
    -- We use text cast for safety if it's an enum
    UPDATE public.booking_assignments
    SET 
        status = 'cancelled',
        updated_at = now()
    WHERE id = p_assignment_id
    RETURNING * INTO v_assignment;

    RETURN v_assignment;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
