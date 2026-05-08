-- Migration: Create get_booking_provider_display_names RPC

CREATE OR REPLACE FUNCTION public.get_booking_provider_display_names(p_booking_id uuid)
RETURNS TABLE (
  provider_id uuid,
  provider_type text,
  provider_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking record;
  v_is_admin boolean;
  v_is_operator boolean;
BEGIN
  -- 1. Get booking
  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- 2. Auth check
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
  ) INTO v_is_admin;
  
  v_is_operator := (v_booking.operator_id = auth.uid());
  
  IF NOT (v_is_admin OR v_is_operator) THEN
    -- If neither, return empty instead of exception to gracefully handle some cases
    RETURN;
  END IF;

  -- 3. Return results
  RETURN QUERY
  WITH vars AS (
    -- Get driver/guide from assignments
    SELECT ba.resource_id as p_id, ba.resource_type as p_type
    FROM booking_assignments ba
    WHERE ba.booking_id = p_booking_id 
      AND ba.status IN ('pending', 'accepted', 'completed', 'assigned', 'active', 'confirmed', 'invited', 'requested')
    
    UNION ALL
    
    -- Get vehicle owner
    SELECT v.owner_id as p_id, 'fleet' as p_type
    FROM vehicles v
    WHERE v.id = v_booking.vehicle_id AND v.owner_id IS NOT NULL
  )
  SELECT 
    v.p_id, 
    v.p_type::text,
    COALESCE(p.company_name, p.full_name, p.email, 'Unknown')::text as p_name
  FROM vars v
  LEFT JOIN profiles p ON p.id = v.p_id;

END;
$$;

GRANT EXECUTE ON FUNCTION public.get_booking_provider_display_names(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
