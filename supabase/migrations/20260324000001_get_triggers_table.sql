CREATE TABLE IF NOT EXISTS public.temp_triggers (
    id serial primary key,
    tgname text,
    proname text,
    prosrc text
);

TRUNCATE TABLE public.temp_triggers;

INSERT INTO public.temp_triggers (tgname, proname, prosrc)
SELECT t.tgname, p.proname, p.prosrc
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
JOIN pg_class c ON t.tgrelid = c.oid
WHERE c.relname = 'bookings';

-- Also get functions
INSERT INTO public.temp_triggers (tgname, proname, prosrc)
SELECT 'function', proname, prosrc
FROM pg_proc
WHERE proname LIKE '%archive_booking%';
