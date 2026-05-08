-- Add adjustment fields to payout_ledger
ALTER TABLE payout_ledger 
ADD COLUMN original_amount numeric,
ADD COLUMN adjusted_amount numeric,
ADD COLUMN adjustment_reason text,
ADD COLUMN adjusted_by uuid REFERENCES profiles(id),
ADD COLUMN adjusted_at timestamp with time zone;

-- Initialize existing rows
UPDATE payout_ledger 
SET original_amount = amount_net,
    adjusted_amount = amount_net
WHERE original_amount IS NULL;
