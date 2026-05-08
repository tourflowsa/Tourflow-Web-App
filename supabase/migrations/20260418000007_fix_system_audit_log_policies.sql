-- Fix policies for system_audit_log to ensure operators can read and write audit logs for their bookings
-- This ensures the Assignment Timeline correctly displays events logged via logAuditEvent.

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_tables 
        WHERE schemaname = 'public' AND tablename = 'system_audit_log'
    ) THEN
        CREATE TABLE public.system_audit_log (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            created_at timestamptz DEFAULT now(),
            actor_id uuid REFERENCES auth.users(id),
            actor_role text,
            action text NOT NULL,
            entity_type text NOT NULL,
            entity_id uuid,
            metadata jsonb DEFAULT '{}'::jsonb,
            entity_table text
        );
        ALTER TABLE public.system_audit_log ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- Drop existing policies if any to avoid conflicts
DROP POLICY IF EXISTS "Anyone can insert audit logs" ON public.system_audit_log;
DROP POLICY IF EXISTS "Operators can read audit logs for their bookings" ON public.system_audit_log;
DROP POLICY IF EXISTS "Admins can read all audit logs" ON public.system_audit_log;

-- Allow authenticated users to insert audit logs (logging is usually allowed for all users)
CREATE POLICY "Anyone can insert audit logs"
ON public.system_audit_log FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow operators to read audit logs where they are the actor or it's a booking they own
CREATE POLICY "Operators can read audit logs for their bookings"
ON public.system_audit_log FOR SELECT
TO authenticated
USING (
    actor_id = auth.uid() OR 
    (entity_type = 'booking' AND EXISTS (
        SELECT 1 FROM public.bookings b 
        WHERE b.id = entity_id AND b.operator_id = auth.uid()
    ))
);

-- Allow admins full read access
CREATE POLICY "Admins can read all audit logs"
ON public.system_audit_log FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    )
);
