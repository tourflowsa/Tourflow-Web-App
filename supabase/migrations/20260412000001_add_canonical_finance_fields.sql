-- Migration: Finance Schema Standardization
-- Goal: Add missing canonical columns to ensure consistency across the app.
-- Legacy columns are NOT dropped to maintain backward compatibility.

-- 1. payout_ledger canonical columns
ALTER TABLE payout_ledger 
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS paid_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS withdrawal_request_status TEXT,
ADD COLUMN IF NOT EXISTS withdrawal_requested_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS withdrawal_approved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS withdrawal_rejected_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS withdrawal_processed_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS withdrawal_notes TEXT,
ADD COLUMN IF NOT EXISTS is_on_hold BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS hold_reason TEXT,
ADD COLUMN IF NOT EXISTS hold_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS released_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS released_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES payout_batches(id);

-- 2. system_audit_log canonical columns
ALTER TABLE system_audit_log
ADD COLUMN IF NOT EXISTS entity_table TEXT;

-- 3. payout_batches canonical columns
-- Note: processed_at and processed_by are acceptable here per requirement.
ALTER TABLE payout_batches
ADD COLUMN IF NOT EXISTS batch_reference TEXT;

-- Reload schema for PostgREST
NOTIFY pgrst, 'reload schema';
