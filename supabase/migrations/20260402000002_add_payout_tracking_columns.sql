-- Add payout tracking columns to payout_ledger table
ALTER TABLE payout_ledger ADD COLUMN IF NOT EXISTS paid_at timestamptz;
ALTER TABLE payout_ledger ADD COLUMN IF NOT EXISTS paid_by uuid REFERENCES auth.users(id);
ALTER TABLE payout_ledger ADD COLUMN IF NOT EXISTS payout_method text;
