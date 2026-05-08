-- Re-create reviews table with correct columns
DROP TABLE IF EXISTS public.reviews CASCADE;
CREATE TABLE public.reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
    provider_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    operator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    provider_type TEXT NOT NULL CHECK (provider_type IN ('driver', 'guide', 'vehicle_owner')),
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    review_text TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(booking_id, provider_id, operator_id)
);

-- Enable RLS
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Operators can insert reviews" 
ON public.reviews FOR INSERT 
WITH CHECK (
    auth.uid() = operator_id AND 
    EXISTS (
        SELECT 1 FROM public.bookings 
        WHERE id = booking_id AND operator_id = auth.uid() AND status = 'completed'
    )
);

CREATE POLICY "Providers can read own reviews" 
ON public.reviews FOR SELECT 
USING (auth.uid() = provider_id);

CREATE POLICY "Operators can read own reviews" 
ON public.reviews FOR SELECT 
USING (auth.uid() = operator_id);

CREATE POLICY "Admins can read all reviews"
ON public.reviews FOR SELECT
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Notify schema reload
NOTIFY pgrst, 'reload schema';
