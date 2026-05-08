-- Migration: add_operator_archived_at
-- Description: Add operator_archived_at tracking for operators on payout_ledger

ALTER TABLE public.payout_ledger ADD COLUMN IF NOT EXISTS operator_archived_at timestamptz;

-- Notify PostgREST of schema changes
NOTIFY pgrst, 'reload schema';
