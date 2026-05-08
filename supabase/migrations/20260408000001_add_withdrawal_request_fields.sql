-- Add withdrawal request fields to payout_ledger
ALTER TABLE payout_ledger 
ADD COLUMN IF NOT EXISTS withdrawal_requested_at timestamptz DEFAULT NULL,
ADD COLUMN IF NOT EXISTS withdrawal_requested_by uuid REFERENCES profiles(id) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS withdrawal_request_status text DEFAULT NULL;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_payout_ledger_withdrawal_status ON payout_ledger(withdrawal_request_status);
