-- Create platform_bank_details table
CREATE TABLE IF NOT EXISTS platform_bank_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_holder_name text NOT NULL,
  bank_name text NOT NULL,
  account_number text NOT NULL,
  account_type text NOT NULL,
  branch_code text NOT NULL,
  country text NOT NULL DEFAULT 'South Africa',
  currency text NOT NULL DEFAULT 'ZAR',
  is_primary boolean DEFAULT true,
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE platform_bank_details ENABLE ROW LEVEL SECURITY;

-- Policies: Only admins can view/edit
CREATE POLICY "Admins can manage platform bank details"
  ON platform_bank_details
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Index
CREATE INDEX IF NOT EXISTS idx_platform_bank_details_is_primary ON platform_bank_details(is_primary);
