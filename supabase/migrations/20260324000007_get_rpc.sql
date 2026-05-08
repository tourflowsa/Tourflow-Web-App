CREATE OR REPLACE FUNCTION public.get_rpc_complete_booking()
RETURNS TABLE(proname name, prosrc text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT p.proname, p.prosrc
    FROM pg_proc p
    WHERE p.proname = 'rpc_complete_booking';
END;
$$;
