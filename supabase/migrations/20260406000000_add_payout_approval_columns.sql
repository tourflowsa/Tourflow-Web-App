-- Add payout approval tracking columns to payout_ledger table
ALTER TABLE payout_ledger ADD COLUMN IF NOT EXISTS approved_at timestamptz;
ALTER TABLE payout_ledger ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users(id);
