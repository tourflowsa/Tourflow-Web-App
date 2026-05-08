-- supabase/migrations/20260502041312_add_rpc_check_vehicle_assignment_compliance.sql

CREATE OR REPLACE FUNCTION public.rpc_check_vehicle_assignment_compliance(p_vehicle_id uuid)
RETURNS TABLE (
  can_assign boolean,
  blockers text[],
  warnings text[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_requester_role text;
  v_vehicle record;
  v_owner record;
  v_doc record;
  v_missing_docs text[];
  v_blockers text[] := '{}';
  v_warnings text[] := '{}';
  v_required_docs constant text[] := ARRAY['vehicle_registration', 'insurance_certificate', 'operating_license'];
  v_req_doc text;
  v_now_utc timestamp with time zone := now();
  v_warning_interval interval := interval '30 days';
BEGIN
  -- 1. Check requester role
  SELECT role::text INTO v_requester_role
  FROM public.profiles
  WHERE id = auth.uid();

  IF v_requester_role NOT IN ('admin', 'operator') THEN
    RETURN QUERY SELECT false, ARRAY['Access denied. Operator or admin role required.']::text[], ARRAY[]::text[];
    RETURN;
  END IF;

  -- 2. Load vehicle
  SELECT * INTO v_vehicle
  FROM public.vehicles
  WHERE id = p_vehicle_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, ARRAY['Vehicle not found.']::text[], ARRAY[]::text[];
    RETURN;
  END IF;

  IF v_vehicle.status != 'active' THEN
    v_blockers := array_append(v_blockers, 'Vehicle status is ' || v_vehicle.status || ', must be active.');
  END IF;

  -- 3. Load owner profile
  SELECT * INTO v_owner
  FROM public.profiles
  WHERE id = v_vehicle.owner_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, ARRAY['Vehicle owner profile not found.']::text[], ARRAY[]::text[];
    RETURN;
  END IF;

  IF v_owner.role != 'vehicle_owner' THEN
    v_blockers := array_append(v_blockers, 'Vehicle owner profile has invalid role: ' || v_owner.role);
  END IF;

  IF v_owner.verification_status != 'verified' THEN
    v_blockers := array_append(v_blockers, 'Vehicle owner is not verified.');
  END IF;

  IF v_owner.is_active != true THEN
    v_blockers := array_append(v_blockers, 'Vehicle owner profile is not active.');
  END IF;

  -- 4. Check documents
  v_missing_docs := v_required_docs;
  
  FOR v_doc IN
    SELECT DISTINCT ON (document_type) document_type, status, expiry_date
    FROM public.documents
    WHERE user_id = v_owner.id
      AND document_type = ANY(v_required_docs)
    ORDER BY document_type, created_at DESC
  LOOP
    -- Remove from missing list
    v_missing_docs := array_remove(v_missing_docs, v_doc.document_type::text);

    IF v_doc.status NOT IN ('valid', 'approved') THEN
       v_blockers := array_append(v_blockers, 'Document ' || v_doc.document_type || ' is ' || v_doc.status);
    END IF;

    IF v_doc.expiry_date IS NOT NULL THEN
      IF v_doc.expiry_date::date < v_now_utc::date THEN
         v_blockers := array_append(v_blockers, 'Document ' || v_doc.document_type || ' is expired.');
      ELSIF v_doc.expiry_date::date <= (v_now_utc + v_warning_interval)::date THEN
         v_warnings := array_append(v_warnings, 'Document ' || v_doc.document_type || ' is expiring soon.');
      END IF;
    END IF;
  END LOOP;

  FOREACH v_req_doc IN ARRAY v_missing_docs
  LOOP
     v_blockers := array_append(v_blockers, 'Missing required document: ' || v_req_doc);
  END LOOP;

  -- 5. Return result
  RETURN QUERY
  SELECT
    (array_length(v_blockers, 1) IS NULL),
    v_blockers,
    v_warnings;

END;
$function$;
