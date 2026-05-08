-- Migration: Fix provider-side assignment archiving recalc lock (Final Fix)
-- Description: Prevents booking recalculation when only archiving fields are updated on booking_assignments.

CREATE OR REPLACE FUNCTION public.tf_booking_assignments_recalc_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_booking_id uuid;
BEGIN
    IF (TG_OP = 'DELETE') THEN
        v_booking_id := OLD.booking_id;
    ELSE
        v_booking_id := NEW.booking_id;
    END IF;

    -- Check if this is an archive-only update from the provider side.
    -- Archive-only means ONLY archived_by_resource, resource_archived_at, or updated_at changed.
    IF (TG_OP = 'UPDATE') THEN
        IF (
            (OLD.archived_by_resource IS DISTINCT FROM NEW.archived_by_resource OR 
             OLD.resource_archived_at IS DISTINCT FROM NEW.resource_archived_at)
            AND
            (to_jsonb(OLD) - 'updated_at' - 'archived_by_resource' - 'resource_archived_at') = 
            (to_jsonb(NEW) - 'updated_at' - 'archived_by_resource' - 'resource_archived_at')
        ) THEN
            -- It's an archive-only update. Skip recalculation and return NEW.
            -- This prevents updates to the bookings table, avoiding the completed-booking lock.
            RETURN NEW;
        END IF;
    END IF;

    -- Proceed with recalculation for all other changes.
    PERFORM public.recalculate_booking_financials(v_booking_id);
    
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trg_booking_assignments_recalc()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_booking_id uuid;
BEGIN
    IF (TG_OP = 'DELETE') THEN
        v_booking_id := OLD.booking_id;
    ELSE
        v_booking_id := NEW.booking_id;
    END IF;

    IF (TG_OP = 'UPDATE') THEN
        IF (
            (OLD.archived_by_resource IS DISTINCT FROM NEW.archived_by_resource OR 
             OLD.resource_archived_at IS DISTINCT FROM NEW.resource_archived_at)
            AND
            (to_jsonb(OLD) - 'updated_at' - 'archived_by_resource' - 'resource_archived_at') = 
            (to_jsonb(NEW) - 'updated_at' - 'archived_by_resource' - 'resource_archived_at')
        ) THEN
            RETURN NEW;
        END IF;
    END IF;

    PERFORM public.recalculate_booking_financials(v_booking_id);
    
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trg_recalculate_booking_financials()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_booking_id uuid;
BEGIN
    IF (TG_OP = 'DELETE') THEN
        v_booking_id := OLD.booking_id;
    ELSE
        v_booking_id := NEW.booking_id;
    END IF;

    IF (TG_OP = 'UPDATE') THEN
        IF (
            (OLD.archived_by_resource IS DISTINCT FROM NEW.archived_by_resource OR 
             OLD.resource_archived_at IS DISTINCT FROM NEW.resource_archived_at)
            AND
            (to_jsonb(OLD) - 'updated_at' - 'archived_by_resource' - 'resource_archived_at') = 
            (to_jsonb(NEW) - 'updated_at' - 'archived_by_resource' - 'resource_archived_at')
        ) THEN
            RETURN NEW;
        END IF;
    END IF;

    PERFORM public.recalculate_booking_financials(v_booking_id);
    
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$function$;
