-- Add missing audit tracking columns to payout_ledger
ALTER TABLE payout_ledger 
ADD COLUMN IF NOT EXISTS requested_at timestamptz,
ADD COLUMN IF NOT EXISTS requested_by uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS processed_at timestamptz,
ADD COLUMN IF NOT EXISTS processed_by uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS hold_at timestamptz,
ADD COLUMN IF NOT EXISTS released_at timestamptz,
ADD COLUMN IF NOT EXISTS released_by uuid REFERENCES auth.users(id);

-- Create payout_events table for audit tracking
CREATE TABLE IF NOT EXISTS payout_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_id uuid REFERENCES payout_ledger(id) ON DELETE CASCADE,
  booking_id uuid REFERENCES bookings(id) ON DELETE CASCADE,
  provider_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  previous_state jsonb,
  new_state jsonb,
  triggered_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  triggered_role text,
  created_at timestamptz DEFAULT now()
);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_payout_events_payout_id ON payout_events(payout_id);
CREATE INDEX IF NOT EXISTS idx_payout_events_booking_id ON payout_events(booking_id);
