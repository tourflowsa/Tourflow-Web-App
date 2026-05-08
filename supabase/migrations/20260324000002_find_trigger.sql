DO $$
DECLARE
    v_func text;
    v_source text;
BEGIN
    SELECT proname, prosrc INTO v_func, v_source
    FROM pg_proc
    WHERE prosrc ILIKE '%completed bookings are locked%';
    
    RAISE NOTICE 'Function: %, Source: %', v_func, v_source;
END;
$$;
