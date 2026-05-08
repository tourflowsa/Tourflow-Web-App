-- Migration: secure_payout_disputes
-- Description: Enable RLS and secure payout_disputes table

ALTER TABLE public.payout_disputes ENABLE ROW LEVEL SECURITY;

-- 1. Admins have full access
DROP POLICY IF EXISTS "Admins have full access to payout disputes" ON public.payout_disputes;
CREATE POLICY "Admins have full access to payout disputes"
ON public.payout_disputes
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- 2. Operators can view their own disputes
DROP POLICY IF EXISTS "Operators can view their own disputes" ON public.payout_disputes;
CREATE POLICY "Operators can view their own disputes"
ON public.payout_disputes
FOR SELECT
TO authenticated
USING (
  operator_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.id = payout_disputes.booking_id AND b.operator_id = auth.uid()
  )
);

-- 3. Providers can view their own disputes
DROP POLICY IF EXISTS "Providers can view their own disputes" ON public.payout_disputes;
CREATE POLICY "Providers can view their own disputes"
ON public.payout_disputes
FOR SELECT
TO authenticated
USING (provider_id = auth.uid());

-- 4. Operators can insert own disputes
DROP POLICY IF EXISTS "Operators can insert disputes for their bookings" ON public.payout_disputes;
CREATE POLICY "Operators can insert disputes for their bookings"
ON public.payout_disputes
FOR INSERT
TO authenticated
WITH CHECK (
  operator_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.id = payout_disputes.booking_id AND b.operator_id = auth.uid()
  )
);

-- 5. Providers can insert own disputes
DROP POLICY IF EXISTS "Providers can insert own disputes" ON public.payout_disputes;
CREATE POLICY "Providers can insert own disputes"
ON public.payout_disputes
FOR INSERT
TO authenticated
WITH CHECK (provider_id = auth.uid());

-- Notify PostgREST of schema changes
NOTIFY pgrst, 'reload schema';
