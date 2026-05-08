-- Add RPC for operator assignment creation
CREATE OR REPLACE FUNCTION public.rpc_operator_assign_resource(
    p_booking_id uuid,
    p_resource_id uuid,
    p_resource_type text,
    p_rate_type text default null,
    p_rate_amount numeric default null,
    p_rate_overridden boolean default false
)
RETURNS public.booking_assignments AS $$
DECLARE
    v_assignment public.booking_assignments;
BEGIN
    -- Verify auth.uid() owns the booking
    IF NOT EXISTS (
        SELECT 1 FROM public.bookings
        WHERE id = p_booking_id AND operator_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Unauthorized: Booking not found or not owned by operator';
    END IF;

    -- Allow only driver or guide
    IF p_resource_type NOT IN ('driver', 'guide') THEN
        RAISE EXCEPTION 'Invalid resource type: %', p_resource_type;
    END IF;

    -- Insert assignment
    INSERT INTO public.booking_assignments (
        booking_id,
        resource_id,
        resource_type,
        status,
        rate_type,
        rate_amount,
        rate_overridden
    ) VALUES (
        p_booking_id,
        p_resource_id,
        p_resource_type,
        'pending',
        p_rate_type,
        p_rate_amount,
        p_rate_overridden
    )
    RETURNING * INTO v_assignment;

    RETURN v_assignment;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
