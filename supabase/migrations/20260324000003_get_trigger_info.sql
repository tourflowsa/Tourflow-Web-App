CREATE OR REPLACE FUNCTION public.get_trigger_info()
RETURNS TABLE(proname name, prosrc text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT p.proname, p.prosrc
    FROM pg_proc p
    WHERE p.prosrc ILIKE '%completed bookings are locked%';
END;
$$;

NOTIFY pgrst, 'reload schema';
