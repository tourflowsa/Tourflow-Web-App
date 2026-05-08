-- Migration: Fix rpc_complete_booking execution order
-- Description: Ensures all booking updates happen BEFORE the status is set to 'completed' to avoid trigger locks.

CREATE OR REPLACE FUNCTION public.rpc_complete_booking(p_booking_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_status text;
BEGIN
    -- 1. Check current status
    SELECT status INTO v_status FROM public.bookings WHERE id = p_booking_id;
    
    IF v_status = 'completed' THEN
        RETURN;
    END IF;

    -- 2. Perform all calculations and updates BEFORE setting status to completed.
    -- This ensures triggers (like the one that locks completed bookings) don't block these updates.
    
    -- Recalculate financials one last time before locking
    PERFORM public.recalculate_booking_financials(p_booking_id);

    -- Any other derived fields or assignments should be finalized here.
    -- (Add specific logic if there are other fields that need explicit setting)

    -- 3. FINAL update to bookings: Set status to 'completed'
    UPDATE public.bookings
    SET status = 'completed',
        updated_at = now()
    WHERE id = p_booking_id;

    -- 3.b Update assignments to completed
    UPDATE public.booking_assignments
    SET status = 'completed',
        updated_at = now()
    WHERE booking_id = p_booking_id
      AND status IN ('accepted', 'assigned');

    -- 4. After this point, NO further updates to the bookings table for this ID should occur.
    -- Payout ledger creation happens in the application layer (bookingService.ts) AFTER this RPC returns.
END;
$$;
