-- Migration: Add Financial Dashboard Data Layer
-- Description: Adds financial tracking columns to bookings and creates views/RPCs for operator dashboards.

-- 1. Schema Additions
ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS original_margin numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS adjusted_margin numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_provider_cost numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_adjusted_payout_cost numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_dispute_adjustment numeric DEFAULT 0;

-- 2. View for per-booking financial rows
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

-- 3. RPC for per-operator summary
CREATE OR REPLACE FUNCTION public.get_operator_financial_summary(p_operator_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_summary json;
BEGIN
    SELECT json_build_object(
        'total_revenue', SUM(revenue),
        'total_provider_cost', SUM(original_provider_cost),
        'total_adjusted_payout_cost', SUM(adjusted_provider_cost),
        'total_platform_fees', SUM(platform_fee),
        'original_margin', SUM(original_margin),
        'adjusted_margin', SUM(adjusted_margin),
        'pending_payouts', SUM(pending_payout_amount),
        'on_hold_amount', SUM(on_hold_amount),
        'dispute_adjustments', SUM(dispute_adjustment),
        'booking_count', COUNT(*),
        'negative_margin_count', COUNT(*) FILTER (WHERE negative_margin),
        'low_margin_count', COUNT(*) FILTER (WHERE low_margin)
    ) INTO v_summary
    FROM public.operator_booking_financials
    WHERE operator_id = p_operator_id;

    RETURN v_summary;
END;
$$;

-- 4. Sync function and triggers
CREATE OR REPLACE FUNCTION public.refresh_booking_financials(p_booking_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_stats record;
BEGIN
    SELECT 
        SUM(COALESCE(original_amount, amount_net, 0)) as original_provider_cost,
        SUM(COALESCE(adjusted_amount, amount_net, 0)) as adjusted_provider_cost,
        SUM(GREATEST(0, COALESCE(original_amount, amount_net, 0) - COALESCE(adjusted_amount, amount_net, 0))) as dispute_adjustment
    INTO v_stats
    FROM public.payout_ledger
    WHERE booking_id = p_booking_id;

    UPDATE public.bookings b
    SET 
        total_provider_cost = COALESCE(v_stats.original_provider_cost, 0),
        total_adjusted_payout_cost = COALESCE(v_stats.adjusted_provider_cost, 0),
        total_dispute_adjustment = COALESCE(v_stats.dispute_adjustment, 0),
        original_margin = COALESCE(b.escrow_total, 0) - COALESCE(v_stats.original_provider_cost, 0),
        adjusted_margin = COALESCE(b.escrow_total, 0) - COALESCE(v_stats.adjusted_provider_cost, 0),
        updated_at = now()
    WHERE id = p_booking_id;
END;
$$;

-- Trigger on payout_ledger
CREATE OR REPLACE FUNCTION public.trig_refresh_booking_financials()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        IF OLD.booking_id IS NOT NULL THEN
            PERFORM public.refresh_booking_financials(OLD.booking_id);
        END IF;
        RETURN OLD;
    ELSE
        IF NEW.booking_id IS NOT NULL THEN
            PERFORM public.refresh_booking_financials(NEW.booking_id);
        END IF;
        RETURN NEW;
    END IF;
END;
$$;

DROP TRIGGER IF EXISTS refresh_booking_financials_trigger ON public.payout_ledger;
CREATE TRIGGER refresh_booking_financials_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.payout_ledger
FOR EACH ROW
EXECUTE FUNCTION public.trig_refresh_booking_financials();

-- Trigger on bookings (to handle revenue changes)
CREATE OR REPLACE FUNCTION public.trig_refresh_booking_financials_on_booking_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF (OLD.escrow_total IS DISTINCT FROM NEW.escrow_total) THEN
        NEW.original_margin := COALESCE(NEW.escrow_total, 0) - COALESCE(NEW.total_provider_cost, 0);
        NEW.adjusted_margin := COALESCE(NEW.escrow_total, 0) - COALESCE(NEW.total_adjusted_payout_cost, 0);
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS refresh_booking_financials_on_booking_change_trigger ON public.bookings;
CREATE TRIGGER refresh_booking_financials_on_booking_change_trigger
BEFORE UPDATE ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.trig_refresh_booking_financials_on_booking_change();

-- 5. Allow financial field updates on completed bookings
DO $$
DECLARE
    v_record record;
    v_new_source text;
BEGIN
    FOR v_record IN 
        SELECT DISTINCT p.proname, p.prosrc, p.prosecdef
        FROM pg_trigger t
        JOIN pg_proc p ON t.tgfoid = p.oid
        JOIN pg_class c ON t.tgrelid = c.oid
        WHERE c.relname = 'bookings' AND p.prosrc ILIKE '%completed bookings are locked%'
    LOOP
        -- Check if we already added financial fields
        IF v_record.prosrc NOT ILIKE '%original_margin%' THEN
            -- We replace the previous "Allow archive transitions" or just inject at BEGIN
            -- If "Allow archive transitions" exists, we'll replace it with a more comprehensive one
            IF v_record.prosrc ILIKE '%Allow archive transitions%' THEN
                v_new_source := regexp_replace(
                    v_record.prosrc,
                    '(?is)-- Allow archive transitions.*?END IF;',
                    '-- Allow archive and financial transitions
    IF (TG_OP = ''UPDATE'') THEN
        IF (to_jsonb(OLD) - ''archived_at'' - ''archived_by'' - ''original_margin'' - ''adjusted_margin'' - ''total_provider_cost'' - ''total_adjusted_payout_cost'' - ''total_dispute_adjustment'' - ''updated_at'') = 
           (to_jsonb(NEW) - ''archived_at'' - ''archived_by'' - ''original_margin'' - ''adjusted_margin'' - ''total_provider_cost'' - ''total_adjusted_payout_cost'' - ''total_dispute_adjustment'' - ''updated_at'') THEN
            RETURN NEW;
        END IF;
    END IF;'
                );
            ELSE
                v_new_source := regexp_replace(
                    v_record.prosrc,
                    '(?is)^(.*?)\bBEGIN\b',
                    '\1BEGIN
    -- Allow financial field updates
    IF (TG_OP = ''UPDATE'') THEN
        IF (to_jsonb(OLD) - ''original_margin'' - ''adjusted_margin'' - ''total_provider_cost'' - ''total_adjusted_payout_cost'' - ''total_dispute_adjustment'' - ''updated_at'') = 
           (to_jsonb(NEW) - ''original_margin'' - ''adjusted_margin'' - ''total_provider_cost'' - ''total_adjusted_payout_cost'' - ''total_dispute_adjustment'' - ''updated_at'') THEN
            RETURN NEW;
        END IF;
    END IF;
'
                );
            END IF;
            
            IF v_record.prosecdef THEN
                EXECUTE 'CREATE OR REPLACE FUNCTION public.' || v_record.proname || '() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $func$' || v_new_source || '$func$;';
            ELSE
                EXECUTE 'CREATE OR REPLACE FUNCTION public.' || v_record.proname || '() RETURNS trigger LANGUAGE plpgsql AS $func$' || v_new_source || '$func$;';
            END IF;
        END IF;
    END LOOP;
END;
$$;

-- 6. Backfill
DO $$
DECLARE
    v_booking_id uuid;
BEGIN
    FOR v_booking_id IN SELECT id FROM public.bookings LOOP
        PERFORM public.refresh_booking_financials(v_booking_id);
    END LOOP;
END $$;

-- Reload schema for PostgREST
NOTIFY pgrst, 'reload schema';
