-- Migration: Backfill Booking Platform Fee Snapshot
-- Description: Populates applied_fee_percent, applied_platform_fee, and applied_net_amount for existing bookings.

BEGIN;

UPDATE public.bookings b
SET 
  applied_fee_percent = sub.resolved_fee,
  applied_platform_fee = b.total_amount * sub.resolved_fee / 100,
  applied_net_amount = b.total_amount - (b.total_amount * sub.resolved_fee / 100),
  updated_at = NOW()
FROM (
  SELECT 
    bk.id as booking_id,
    COALESCE(
      -- 1. Try to find the assignment at creation time
      (
        SELECT t.fee_percent 
        FROM public.operator_fee_assignments a
        JOIN public.platform_fee_tiers t ON t.id = a.fee_tier_id
        WHERE a.operator_id = bk.operator_id
        AND a.effective_from <= bk.created_at
        ORDER BY a.effective_from DESC, a.created_at DESC
        LIMIT 1
      ),
      -- 2. Try to find the assignment created after but maybe it was meant for it
      (
        SELECT t.fee_percent 
        FROM public.operator_fee_assignments a
        JOIN public.platform_fee_tiers t ON t.id = a.fee_tier_id
        WHERE a.operator_id = bk.operator_id
        ORDER BY a.effective_from ASC
        LIMIT 1
      ),
      -- 3. Try to find Bronze tier
      (
        SELECT fee_percent FROM public.platform_fee_tiers WHERE UPPER(tier_code) = 'BRONZE' LIMIT 1
      ),
      -- 4. Try highest tier
      (
        SELECT MAX(fee_percent) FROM public.platform_fee_tiers
      ),
      -- 5. Hardcoded default
      15
    ) as resolved_fee
  FROM public.bookings bk
  WHERE bk.applied_fee_percent IS NULL OR bk.applied_fee_percent = 0
) sub
WHERE b.id = sub.booking_id;

COMMIT;

NOTIFY pgrst, 'reload schema';
