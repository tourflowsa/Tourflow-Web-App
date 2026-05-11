-- Rollback for Phase 2M.1b No-Show Workflow
BEGIN;

-- 1. Remove RPC
DROP FUNCTION IF EXISTS public.rpc_mark_booking_no_show(UUID, TEXT);

-- 2. Restore status constraint (Removing 'no_show')
-- Be careful: If any bookings are currently 'no_show', this will fail unless they are updated first.
UPDATE public.bookings SET status = 'cancelled' WHERE status = 'no_show';

ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_status_check 
CHECK (status IN ('draft', 'pending', 'confirmed', 'assigned', 'in_progress', 'completed', 'cancelled'));

-- 3. Remove columns
ALTER TABLE public.bookings DROP COLUMN IF EXISTS no_show_reason;
ALTER TABLE public.bookings DROP COLUMN IF EXISTS no_show_reported_at;
ALTER TABLE public.bookings DROP COLUMN IF EXISTS no_show_reported_by;

COMMIT;
