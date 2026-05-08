-- Migration: Operator Archive Payout RPC
-- Description: Create safe RPCs for operator archive actions

CREATE OR REPLACE FUNCTION public.rpc_operator_archive_payout(p_payout_id uuid)
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
        operator_archived_at = now(),
        updated_at = now()
    WHERE id = p_payout_id
      AND operator_id = auth.uid()
    RETURNING to_jsonb(payout_ledger.*) INTO v_updated_row;

    IF v_updated_row IS NULL THEN
        RAISE EXCEPTION 'Payout not found or unauthorized.';
    END IF;

    RETURN v_updated_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_operator_unarchive_payout(p_payout_id uuid)
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
        operator_archived_at = NULL,
        updated_at = now()
    WHERE id = p_payout_id
      AND operator_id = auth.uid()
    RETURNING to_jsonb(payout_ledger.*) INTO v_updated_row;

    IF v_updated_row IS NULL THEN
        RAISE EXCEPTION 'Payout not found or unauthorized.';
    END IF;

    RETURN v_updated_row;
END;
$$;
