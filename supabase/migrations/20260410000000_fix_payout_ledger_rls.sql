-- Enable RLS on payout_ledger
ALTER TABLE public.payout_ledger ENABLE ROW LEVEL SECURITY;

-- 1. Admin Policy: Admins can do everything
DROP POLICY IF EXISTS "Admins have full access to payout_ledger" ON public.payout_ledger;
CREATE POLICY "Admins have full access to payout_ledger"
ON public.payout_ledger
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- 2. Provider Select Policy: Providers can view their own payouts
DROP POLICY IF EXISTS "Providers can view their own payout rows" ON public.payout_ledger;
CREATE POLICY "Providers can view their own payout rows"
ON public.payout_ledger
FOR SELECT
TO authenticated
USING (provider_id = auth.uid());

-- 3. Provider Update Policy: Providers can update their own payouts (restricted to withdrawal fields in app)
DROP POLICY IF EXISTS "Providers can update their own payout rows for withdrawal" ON public.payout_ledger;
CREATE POLICY "Providers can update their own payout rows for withdrawal"
ON public.payout_ledger
FOR UPDATE
TO authenticated
USING (provider_id = auth.uid())
WITH CHECK (provider_id = auth.uid());

-- 4. Operator Select Policy: Operators can view payouts for their bookings
DROP POLICY IF EXISTS "Operators can view payouts for their bookings" ON public.payout_ledger;
CREATE POLICY "Operators can view payouts for their bookings"
ON public.payout_ledger
FOR SELECT
TO authenticated
USING (operator_id = auth.uid());
