-- Migration: Fix archive transition for completed bookings
-- Description: Modifies the booking lock trigger to allow archive-only updates on completed/cancelled bookings.

DO $$
DECLARE
    v_record record;
    v_new_source text;
BEGIN
    -- 1. Find the trigger function that locks completed bookings and inject an early return
    FOR v_record IN 
        SELECT DISTINCT p.proname, p.prosrc, p.prosecdef
        FROM pg_trigger t
        JOIN pg_proc p ON t.tgfoid = p.oid
        JOIN pg_class c ON t.tgrelid = c.oid
        WHERE c.relname = 'bookings' AND p.prosrc ILIKE '%completed bookings are locked%'
    LOOP
        IF v_record.prosrc NOT ILIKE '%Allow archive transitions%' THEN
            v_new_source := regexp_replace(
                v_record.prosrc,
                '(?is)^(.*?)\bBEGIN\b',
                '\1BEGIN
    -- Allow archive transitions
    IF (TG_OP = ''UPDATE'') THEN
        IF (OLD.archived_at IS DISTINCT FROM NEW.archived_at OR OLD.archived_by IS DISTINCT FROM NEW.archived_by) AND
           (to_jsonb(OLD) - ''archived_at'' - ''archived_by'' - ''updated_at'') = (to_jsonb(NEW) - ''archived_at'' - ''archived_by'' - ''updated_at'') THEN
            RETURN NEW;
        END IF;
    END IF;
'
            );
            
            IF v_record.prosecdef THEN
                EXECUTE 'CREATE OR REPLACE FUNCTION public.' || v_record.proname || '() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $func$' || v_new_source || '$func$;';
            ELSE
                EXECUTE 'CREATE OR REPLACE FUNCTION public.' || v_record.proname || '() RETURNS trigger LANGUAGE plpgsql AS $func$' || v_new_source || '$func$;';
            END IF;
        END IF;
    END LOOP;

    -- 2. If rpc_archive_booking itself has the lock check, we need to bypass it.
    -- Since rpc_archive_booking only does archiving, it's safe to comment out the exception inside it.
    FOR v_record IN 
        SELECT proname, prosrc, prosecdef, 
               pg_get_function_identity_arguments(oid) as args,
               pg_get_function_result(oid) as rettype
        FROM pg_proc
        WHERE proname IN ('rpc_archive_booking', 'rpc_unarchive_booking')
    LOOP
        IF v_record.prosrc ILIKE '%completed bookings are locked%' AND v_record.prosrc NOT ILIKE '%Allow archive transitions%' THEN
            v_new_source := regexp_replace(
                v_record.prosrc,
                '(?i)(RAISE\s+EXCEPTION\s+[^;]+completed[^;]+;)',
                '-- \1 /* Allow archive transitions */',
                'g'
            );
            
            IF v_record.prosecdef THEN
                EXECUTE 'CREATE OR REPLACE FUNCTION public.' || v_record.proname || '(' || v_record.args || ') RETURNS ' || v_record.rettype || ' LANGUAGE plpgsql SECURITY DEFINER AS $func$' || v_new_source || '$func$;';
            ELSE
                EXECUTE 'CREATE OR REPLACE FUNCTION public.' || v_record.proname || '(' || v_record.args || ') RETURNS ' || v_record.rettype || ' LANGUAGE plpgsql AS $func$' || v_new_source || '$func$;';
            END IF;
        END IF;
    END LOOP;
END;
$$;
