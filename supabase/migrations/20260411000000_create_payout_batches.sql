-- Create payout_batches table
CREATE TABLE IF NOT EXISTS payout_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_reference text UNIQUE,
  total_amount numeric NOT NULL DEFAULT 0,
  total_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'created', -- created, processing, completed
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  processed_at timestamptz,
  operator_id uuid REFERENCES profiles(id)
);

-- Ensure batch_id exists in payout_ledger
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payout_ledger' AND column_name = 'batch_id') THEN
    ALTER TABLE payout_ledger ADD COLUMN batch_id uuid REFERENCES payout_batches(id);
  END IF;
END $$;

-- Add bank details to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bank_name text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS account_number text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS account_holder text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS branch_code text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS account_type text;

-- Enable RLS
ALTER TABLE payout_batches ENABLE ROW LEVEL SECURITY;

-- Policies for payout_batches
CREATE POLICY "Admins can do everything on payout_batches"
  ON payout_batches
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Operators can view their own batches"
  ON payout_batches
  FOR SELECT
  TO authenticated
  USING (
    operator_id = auth.uid()
  );
