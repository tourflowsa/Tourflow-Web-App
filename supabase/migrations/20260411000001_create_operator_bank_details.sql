-- Create operator_bank_details table
CREATE TABLE IF NOT EXISTS operator_bank_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  account_holder_name text NOT NULL,
  bank_name text NOT NULL,
  account_number text NOT NULL,
  account_type text NOT NULL,
  branch_code text NOT NULL,
  country text NOT NULL DEFAULT 'South Africa',
  currency text NOT NULL DEFAULT 'ZAR',
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE operator_bank_details ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Operators can manage their own bank details"
  ON operator_bank_details
  FOR ALL
  TO authenticated
  USING (operator_id = auth.uid())
  WITH CHECK (operator_id = auth.uid());

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

-- Index
CREATE INDEX IF NOT EXISTS idx_operator_bank_details_operator_id ON operator_bank_details(operator_id);
