ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS escrow_status TEXT DEFAULT 'pending_payment';

ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS escrow_total NUMERIC DEFAULT 0;

ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS escrow_held NUMERIC DEFAULT 0;

ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS escrow_released NUMERIC DEFAULT 0;

ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS escrow_remaining NUMERIC GENERATED ALWAYS AS (escrow_held - escrow_released) STORED;

-- Add constraint for valid statuses
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'escrow_status_check'
  ) THEN
    ALTER TABLE bookings
    ADD CONSTRAINT escrow_status_check
    CHECK (escrow_status IN (
      'pending_payment',
      'funds_received',
      'partially_released',
      'fully_released',
      'refunded',
      'disputed'
    ));
  END IF;
END $$;
