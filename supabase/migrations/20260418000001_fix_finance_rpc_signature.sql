-- Migration: Fix RPC signature mismatch for Financial Dashboard
-- Description: Ensures get_operator_financial_summary supports optional date range filters with text inputs for better compatibility.

BEGIN;

-- 1. Drop all potential existing signatures to avoid ambiguity
DROP FUNCTION IF EXISTS public.get_operator_financial_summary(uuid);
DROP FUNCTION IF EXISTS public.get_operator_financial_summary(uuid, timestamptz, timestamptz);
DROP FUNCTION IF EXISTS public.get_operator_financial_summary(uuid, text, text);

-- 2. Create the unified function with optional parameters and text types
CREATE OR REPLACE FUNCTION public.get_operator_financial_summary(
    p_operator_id uuid,
    p_start_date text DEFAULT NULL,
    p_end_date text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_summary json;
    v_start_date timestamptz;
    v_end_date timestamptz;
BEGIN
    -- Cast text inputs to timestamptz safely
    v_start_date := CASE WHEN p_start_date IS NOT NULL AND p_start_date <> '' THEN p_start_date::timestamptz ELSE NULL END;
    v_end_date := CASE WHEN p_end_date IS NOT NULL AND p_end_date <> '' THEN p_end_date::timestamptz ELSE NULL END;

    SELECT json_build_object(
        'total_revenue', COALESCE(SUM(revenue), 0),
        'total_provider_cost', COALESCE(SUM(original_provider_cost), 0),
        'total_adjusted_payout_cost', COALESCE(SUM(adjusted_provider_cost), 0),
        'total_platform_fees', COALESCE(SUM(platform_fee), 0),
        'original_margin', COALESCE(SUM(original_margin), 0),
        'adjusted_margin', COALESCE(SUM(adjusted_margin), 0),
        'pending_payouts', COALESCE(SUM(pending_payout_amount), 0),
        'on_hold_amount', COALESCE(SUM(on_hold_amount), 0),
        'dispute_adjustments', COALESCE(SUM(dispute_adjustment), 0),
        'booking_count', COUNT(*),
        'negative_margin_count', COUNT(*) FILTER (WHERE negative_margin),
        'low_margin_count', COUNT(*) FILTER (WHERE low_margin)
    ) INTO v_summary
    FROM public.operator_booking_financials
    WHERE operator_id = p_operator_id
    AND (v_start_date IS NULL OR start_date >= v_start_date)
    AND (v_end_date IS NULL OR start_date <= v_end_date);

    RETURN v_summary;
END;
$$;

-- 4. Grant access to authenticated users
GRANT EXECUTE ON FUNCTION public.get_operator_financial_summary(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_operator_financial_summary(uuid, text, text) TO service_role;

-- 5. Ensure the view exists and has the correct columns (start_date)
-- We re-verify the view structure to be safe
CREATE OR REPLACE VIEW public.operator_booking_financials AS
WITH booking_payout_stats AS (
    SELECT 
        booking_id,
        SUM(COALESCE(original_amount, amount_net, 0)) as original_provider_cost,
        SUM(COALESCE(adjusted_amount, amount_net, 0)) as adjusted_provider_cost,
        SUM(CASE 
            WHEN status IN ('approved', 'available', 'requested') AND paid_at IS NULL 
            THEN COALESCE(adjusted_amount, amount_net, 0) 
            ELSE 0 
        END) as pending_payout_amount,
        SUM(CASE 
            WHEN is_on_hold = true OR status = 'disputed' 
            THEN COALESCE(adjusted_amount, amount_net, 0) 
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
    (COALESCE(b.escrow_total, 0) - COALESCE(ps.original_provider_cost, 0)) as platform_fee,
    (COALESCE(b.escrow_total, 0) - COALESCE(ps.original_provider_cost, 0)) as original_margin,
    (COALESCE(b.escrow_total, 0) - COALESCE(ps.adjusted_provider_cost, 0)) as adjusted_margin,
    COALESCE(ps.pending_payout_amount, 0) as pending_payout_amount,
    COALESCE(ps.on_hold_amount, 0) as on_hold_amount,
    COALESCE(ps.dispute_adjustment, 0) as dispute_adjustment,
    b.status,
    -- Derived flags
    ((COALESCE(b.escrow_total, 0) - COALESCE(ps.adjusted_provider_cost, 0)) < 0) as negative_margin,
    ((COALESCE(b.escrow_total, 0) - COALESCE(ps.adjusted_provider_cost, 0)) > 0 
     AND (COALESCE(b.escrow_total, 0) - COALESCE(ps.adjusted_provider_cost, 0)) / NULLIF(COALESCE(b.escrow_total, 0), 0) < 0.10) as low_margin,
    (COALESCE(ps.dispute_adjustment, 0) > 0) as high_dispute_impact
FROM public.bookings b
LEFT JOIN booking_payout_stats ps ON b.id = ps.booking_id;

COMMIT;

-- Reload schema for PostgREST
NOTIFY pgrst, 'reload schema';
