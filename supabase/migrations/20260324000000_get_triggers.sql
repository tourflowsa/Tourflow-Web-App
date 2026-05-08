CREATE OR REPLACE FUNCTION public.get_booking_triggers()
RETURNS TABLE(tgname name, proname name, prosrc text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT t.tgname, p.proname, p.prosrc
    FROM pg_trigger t
    JOIN pg_proc p ON t.tgfoid = p.oid
    JOIN pg_class c ON t.tgrelid = c.oid
    WHERE c.relname = 'bookings';
END;
$$;
