-- Add escrow simulation fields to bookings table
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'payment_pending',
ADD COLUMN IF NOT EXISTS funds_received_amount numeric(12,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS funds_held_amount numeric(12,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS funds_released_amount numeric(12,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS funds_remaining_amount numeric(12,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS payment_received_at timestamptz NULL;

-- Add constraint for payment_status values
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookings_payment_status_check') THEN
        ALTER TABLE bookings 
        ADD CONSTRAINT bookings_payment_status_check 
        CHECK (payment_status IN ('payment_pending', 'funds_received', 'funds_held', 'payout_ready', 'payout_completed'));
    END IF;
END $$;
