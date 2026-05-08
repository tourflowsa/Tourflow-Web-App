-- Migration: Add Trip Information fields and RPC
-- Description: Adds pickup/dropoff/special requests fields to bookings and a security definer RPC for safe updates.

BEGIN;

-- 1. Add missing columns to bookings table
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS pickup_location TEXT,
ADD COLUMN IF NOT EXISTS dropoff_location TEXT,
ADD COLUMN IF NOT EXISTS special_requests TEXT,
ADD COLUMN IF NOT EXISTS internal_notes TEXT;

-- 2. Create the RPC function
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
    v_is_locked BOOLEAN;
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

    -- Financial lock check
    -- A booking is "financially locked" if status is completed AND has paid payouts.
    SELECT EXISTS (
        SELECT 1 FROM public.payout_ledger 
        WHERE booking_id = p_booking_id AND status = 'paid'
    ) INTO v_is_locked;

    IF v_is_locked THEN
        -- Strictly follow user's instruction: Completed bookings are locked from trip edits
        -- We check if ANY restricted field is being changed.
        -- "only allow notes/internal non-financial fields if that is already allowed by the app."
        -- Since the app currently blocks everything, we block everything here too if locked.
        RAISE EXCEPTION 'Completed bookings are locked from trip edits';
    END IF;

    -- Update allowed fields only
    UPDATE public.bookings
    SET 
        start_date = p_start_date,
        end_date = p_end_date,
        pickup_location = p_pickup_location,
        dropoff_location = p_dropoff_location,
        guest_name = p_guest_name,
        guest_email = p_guest_email,
        guest_phone = p_guest_phone,
        num_guests = p_number_of_guests,
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
            'guest_email', p_guest_email,
            'guest_phone', p_guest_phone,
            'num_guests', p_number_of_guests,
            'pickup_location', p_pickup_location,
            'dropoff_location', p_dropoff_location
        ),
        v_user_id,
        CASE WHEN v_is_admin THEN 'admin' ELSE 'operator' END
    );

    RETURN v_booking;
END;
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';
