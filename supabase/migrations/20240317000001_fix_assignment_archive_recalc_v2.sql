-- Migration: Fix provider-side assignment archiving recalc lock (Full Fix)
-- Description: Prevents booking recalculation when only archiving fields are updated on booking_assignments.
-- This version removes assigned_at check as it's confirmed to be missing from the schema.

CREATE OR REPLACE FUNCTION public.tf_booking_assignments_recalc_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    -- Check if this is an archive-only update from the provider side.
    -- Archive-only means ONLY archived_by_resource, resource_archived_at, or updated_at changed.
    -- If any "business" fields changed, we must proceed with recalculation.
    IF (TG_OP = 'UPDATE') THEN
        IF (
            OLD.booking_id IS NOT DISTINCT FROM NEW.booking_id AND
            OLD.resource_id IS NOT DISTINCT FROM NEW.resource_id AND
            OLD.resource_type IS NOT DISTINCT FROM NEW.resource_type AND
            OLD.status IS NOT DISTINCT FROM NEW.status AND
            OLD.rate_type IS NOT DISTINCT FROM NEW.rate_type AND
            OLD.rate_amount IS NOT DISTINCT FROM NEW.rate_amount AND
            OLD.rate_overridden IS NOT DISTINCT FROM NEW.rate_overridden AND
            -- Include units and cost fields if they exist (they are usually calculated but can be updated)
            OLD.units IS NOT DISTINCT FROM NEW.units AND
            OLD.cost_total IS NOT DISTINCT FROM NEW.cost_total AND
            OLD.cost_currency IS NOT DISTINCT FROM NEW.cost_currency AND
            -- Check if at least one of the archive fields DID change (to confirm it's an archive action)
            -- Note: updated_at is allowed to change as it's updated on every write.
            (OLD.archived_by_resource IS DISTINCT FROM NEW.archived_by_resource OR 
             OLD.resource_archived_at IS DISTINCT FROM NEW.resource_archived_at)
        ) THEN
            -- It's an archive-only update. Skip recalculation and return NEW.
            -- This prevents updates to the bookings table, avoiding the completed-booking lock.
            RETURN NEW;
        END IF;
    END IF;

    -- Proceed with recalculation for all other changes.
    -- This function should exist and handle the actual logic.
    PERFORM public.recalculate_booking_financials(NEW.booking_id);
    
    RETURN NEW;
END;
$function$;

-- Ensure the trigger is correctly attached (assuming it already is, but we want to be sure)
-- DROP TRIGGER IF EXISTS trg_booking_assignments_recalc ON public.booking_assignments;
-- CREATE TRIGGER trg_booking_assignments_recalc
-- AFTER INSERT OR UPDATE OR DELETE ON public.booking_assignments
-- FOR EACH ROW EXECUTE FUNCTION public.tf_booking_assignments_recalc_trigger();
