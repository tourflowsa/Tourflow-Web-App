-- Add withdrawal approval tracking columns to payout_ledger table
ALTER TABLE payout_ledger 
ADD COLUMN IF NOT EXISTS withdrawal_approved_at timestamptz DEFAULT NULL,
ADD COLUMN IF NOT EXISTS withdrawal_rejected_at timestamptz DEFAULT NULL,
ADD COLUMN IF NOT EXISTS withdrawal_processed_by uuid REFERENCES profiles(id) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS withdrawal_notes text DEFAULT NULL;

-- Ensure withdrawal_requested_at exists (from previous migrations but adding here for safety as per request)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payout_ledger' AND column_name = 'withdrawal_requested_at') THEN
        ALTER TABLE payout_ledger ADD COLUMN withdrawal_requested_at timestamptz DEFAULT NULL;
    END IF;
END $$;
