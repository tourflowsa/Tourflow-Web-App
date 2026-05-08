-- Add batch_ref column to payout_batches
ALTER TABLE payout_batches ADD COLUMN IF NOT EXISTS batch_ref TEXT UNIQUE;

-- Backfill batch_ref from batch_reference if it exists and matches the format
-- If batch_reference is null or doesn't look like BATCH-..., we'll generate a new one in the next step
UPDATE payout_batches 
SET batch_ref = batch_reference 
WHERE batch_reference IS NOT NULL AND batch_reference LIKE 'BATCH-%';

-- For those that still don't have a batch_ref, generate one
-- Format: BATCH-YYYYMMDD-XXXX (using first 4 chars of ID as random part for backfill)
UPDATE payout_batches
SET batch_ref = 'BATCH-' || to_char(created_at, 'YYYYMMDD') || '-' || upper(substring(id::text from 1 for 4))
WHERE batch_ref IS NULL;
