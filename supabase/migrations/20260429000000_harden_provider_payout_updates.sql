-- Migration: Harden Provider Payout Updates
-- Description: Move provider-side withdrawal and archive actions behind SECURITY DEFINER RPCs and tighten RLS.

-- 1. Create RPC for provider withdrawal request
CREATE OR REPLACE FUNCTION public.rpc_provider_request_withdrawal(p_payout_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_updated_row jsonb;
BEGIN
    -- Verify ownership as SECURITY DEFINER
    -- Payout must be owned by the user, not paid, not on hold, and in an approved status
    UPDATE public.payout_ledger
    SET 
        withdrawal_requested_at = now(),
        withdrawal_requested_by = auth.uid(),
        withdrawal_request_status = 'requested',
        updated_at = now()
    WHERE id = p_payout_id
      AND provider_id = auth.uid()
      AND status != 'paid'
      AND is_on_hold = false
      AND (status = 'approved' OR status = 'ready_for_payout' OR status = 'resolved_approved' OR status = 'resolved_reduced')
      AND (withdrawal_request_status IS NULL OR withdrawal_request_status = 'rejected')
    RETURNING to_jsonb(payout_ledger.*) INTO v_updated_row;

    IF v_updated_row IS NULL THEN
        RAISE EXCEPTION 'Payout not found or not eligible for withdrawal request.';
    END IF;

    RETURN v_updated_row;
END;
$$;

-- 2. Create RPC for provider archiving payout
CREATE OR REPLACE FUNCTION public.rpc_provider_archive_payout(p_payout_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_updated_row jsonb;
BEGIN
    UPDATE public.payout_ledger
    SET 
        provider_archived_at = now(),
        updated_at = now()
    WHERE id = p_payout_id
      AND provider_id = auth.uid()
    RETURNING to_jsonb(payout_ledger.*) INTO v_updated_row;

    IF v_updated_row IS NULL THEN
        RAISE EXCEPTION 'Payout not found or unauthorized.';
    END IF;

    RETURN v_updated_row;
END;
$$;

-- 3. Policy Hardening
-- Remove the direct provider update policy
DROP POLICY IF EXISTS "Providers can update their own payout rows for withdrawal" ON public.payout_ledger;

-- Ensure Operators have a clear update policy for payout processing
DROP POLICY IF EXISTS "Operators can update payouts for their bookings" ON public.payout_ledger;
CREATE POLICY "Operators can update payouts for their bookings"
ON public.payout_ledger
FOR UPDATE
TO authenticated
USING (operator_id = auth.uid())
WITH CHECK (operator_id = auth.uid());
