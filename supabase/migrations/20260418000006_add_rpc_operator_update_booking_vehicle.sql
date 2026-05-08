-- Migration to fix vehicle assignment RLS issue
-- This migration adds an RPC that allows operators to update vehicle snapshots on their bookings
-- primarily to bypass direct table update RLS restrictions.

CREATE OR REPLACE FUNCTION public.rpc_operator_update_booking_vehicle(
    p_booking_id uuid,
    p_vehicle_id uuid,
    p_vehicle_rate_type text,
    p_vehicle_rate_amount numeric,
    p_vehicle_rate_overridden boolean
)
RETURNS public.bookings AS $$
DECLARE
    v_booking public.bookings;
    v_vehicle_name text := NULL;
BEGIN
    -- Verify auth.uid() owns the booking
    IF NOT EXISTS (
        SELECT 1 FROM public.bookings
        WHERE id = p_booking_id AND operator_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Unauthorized: Booking not found or not owned by operator';
    END IF;

    -- Resolve vehicle name from the vehicles table if provided
    IF p_vehicle_id IS NOT NULL THEN
        SELECT trim(concat_ws(' ', make, model)) INTO v_vehicle_name
        FROM public.vehicles
        WHERE id = p_vehicle_id;
    END IF;

    -- Update the booking with EXACTLY the specified columns
    UPDATE public.bookings
    SET 
        vehicle_id = p_vehicle_id,
        vehicle_name = v_vehicle_name,
        vehicle_rate_type = p_vehicle_rate_type,
        vehicle_rate_amount = p_vehicle_rate_amount,
        vehicle_rate_overridden = p_vehicle_rate_overridden,
        updated_at = now()
    WHERE id = p_booking_id
    RETURNING * INTO v_booking;

    -- Insert the audit event for timeline reading
    INSERT INTO public.system_audit_log (
        action,
        entity_type,
        entity_id,
        metadata,
        actor_id,
        actor_role
    )
    VALUES (
        'BOOKING_VEHICLE_SNAPSHOT_UPDATED',
        'booking',
        p_booking_id,
        jsonb_build_object(
            'vehicle_id', p_vehicle_id,
            'vehicle_name', v_vehicle_name
        ),
        auth.uid(),
        'operator'
    );

    RETURN v_booking;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
