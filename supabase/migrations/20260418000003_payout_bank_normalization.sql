-- Final migration for dedicated operator bank details table
CREATE TABLE IF NOT EXISTS operator_bank_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id uuid NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  account_holder_name text NOT NULL,
  bank_name text NOT NULL,
  account_number text NOT NULL,
  account_type text,
  branch_code text NOT NULL,
  country text DEFAULT 'South Africa',
  currency text DEFAULT 'ZAR',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE operator_bank_details ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Operators can manage their own bank details" ON operator_bank_details;
CREATE POLICY "Operators can manage their own bank details"
  ON operator_bank_details
  FOR ALL
  TO authenticated
  USING (operator_id = auth.uid())
  WITH CHECK (operator_id = auth.uid());

DROP POLICY IF EXISTS "Admins can view all operator bank details" ON operator_bank_details;
CREATE POLICY "Admins can view all operator bank details"
  ON operator_bank_details
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_operator_bank_details_operator_id ON operator_bank_details(operator_id);
