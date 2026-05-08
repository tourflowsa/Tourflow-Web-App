-- Migration: fix_finance_view_disputes
-- Objective: Ensure operator_booking_financials view uses the correct is_on_hold and hold_reason logic.

BEGIN;

CREATE OR REPLACE VIEW public.operator_booking_financials AS
WITH booking_payout_stats AS (
    SELECT 
        booking_id,
        SUM(COALESCE(original_amount, amount_net, 0)) as original_provider_cost,
        SUM(COALESCE(adjusted_amount, amount_net, 0)) as adjusted_provider_cost,
        SUM(COALESCE(platform_fee, 0)) as platform_fee_total,
        SUM(CASE 
            WHEN status IN ('approved', 'available', 'requested') AND (is_on_hold = false OR is_on_hold IS NULL) AND paid_at IS NULL 
            THEN COALESCE(adjusted_amount, amount_net, 0) 
            ELSE 0 
        END) as pending_payout_amount,
        SUM(CASE 
            WHEN is_on_hold = true AND hold_reason = 'dispute'
            THEN COALESCE(adjusted_amount, amount_net, original_amount, 0) 
            ELSE 0 
        END) as on_hold_amount,
        SUM(GREATEST(0, COALESCE(original_amount, amount_net, 0) - COALESCE(adjusted_amount, amount_net, 0))) as dispute_adjustment
    FROM public.payout_ledger
    GROUP BY booking_id
)
SELECT 
    b.id as booking_id,
    b.booking_reference as booking_ref,
    b.operator_id,
    b.start_date,
    b.created_at,
    COALESCE(b.escrow_total, 0) as revenue,
    COALESCE(ps.original_provider_cost, 0) as original_provider_cost,
    COALESCE(ps.adjusted_provider_cost, 0) as adjusted_provider_cost,
    COALESCE(ps.platform_fee_total, 0) as platform_fee,
    (COALESCE(b.escrow_total, 0) - COALESCE(ps.original_provider_cost, 0)) as original_margin,
    (COALESCE(b.escrow_total, 0) - COALESCE(ps.adjusted_provider_cost, 0)) as adjusted_margin,
    COALESCE(ps.pending_payout_amount, 0) as pending_payout_amount,
    COALESCE(ps.on_hold_amount, 0) as on_hold_amount,
    COALESCE(ps.dispute_adjustment, 0) as dispute_adjustment,
    b.status,
    -- Enhanced Validation Flags
    ((COALESCE(b.escrow_total, 0) - COALESCE(ps.adjusted_provider_cost, 0)) < 0) as negative_margin,
    ((COALESCE(b.escrow_total, 0) - COALESCE(ps.adjusted_provider_cost, 0)) >= 0 
     AND (COALESCE(b.escrow_total, 0) - COALESCE(ps.adjusted_provider_cost, 0)) / NULLIF(COALESCE(b.escrow_total, 0), 0) < 0.05) as low_margin,
    (COALESCE(ps.dispute_adjustment, 0) > 0) as high_dispute_impact,
    CASE 
        WHEN (COALESCE(b.escrow_total, 0) - COALESCE(ps.adjusted_provider_cost, 0)) < 0 THEN 'critical'
        WHEN (COALESCE(b.escrow_total, 0) - COALESCE(ps.adjusted_provider_cost, 0)) / NULLIF(COALESCE(b.escrow_total, 0), 0) < 0.05 THEN 'warning'
        ELSE 'ok'
    END as financial_status
FROM public.bookings b
LEFT JOIN booking_payout_stats ps ON b.id = ps.booking_id;

COMMIT;

NOTIFY pgrst, 'reload schema';
