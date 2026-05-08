-- Create payout statement context RPC
CREATE OR REPLACE FUNCTION get_payout_statement_context(p_payout_id uuid)
RETURNS TABLE (
  payout_id uuid,
  payout_reference text,
  booking_id uuid,
  booking_reference text,
  service_date date,
  tour_title text,
  operator_display_name text,
  provider_display_name text
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    pl.id,
    pl.payout_reference,
    pl.booking_id,
    b.booking_reference,
    b.start_date::date,
    t.title,
    COALESCE(op.company_name, op.full_name, 'Unknown Operator'),
    COALESCE(pr.company_name, pr.full_name, 'Unknown Provider')
  FROM payout_ledger pl
  JOIN bookings b ON pl.booking_id = b.id
  LEFT JOIN tours t ON b.tour_id = t.id
  JOIN profiles op ON pl.operator_id = op.id
  JOIN profiles pr ON pl.provider_id = pr.id
  WHERE pl.id = p_payout_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
