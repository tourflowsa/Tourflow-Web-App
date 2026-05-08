CREATE TABLE public.vehicle_availability_requests (
    id uuid primary key default gen_random_uuid(),
    operator_id uuid not null references public.profiles(id),
    vehicle_id uuid not null references public.vehicles(id),
    status text not null default 'pending' check (status in ('pending','accepted','declined','cancelled')),
    start_date timestamp with time zone not null,
    end_date timestamp with time zone not null,
    rate_type text not null check (rate_type in ('day','hour')),
    notes text null,
    created_at timestamp with time zone not null default now(),
    updated_at timestamp with time zone not null default now(),
    responded_at timestamp with time zone null,
    responded_by uuid null references public.profiles(id),
    converted_booking_id uuid null references public.bookings(id)
);

-- RLS
ALTER TABLE public.vehicle_availability_requests ENABLE ROW LEVEL SECURITY;

-- Operator can insert and view own requests
CREATE POLICY "Operators can view their own requests"
    ON public.vehicle_availability_requests
    FOR SELECT
    USING (auth.uid() = operator_id);

CREATE POLICY "Operators can insert their own requests"
    ON public.vehicle_availability_requests
    FOR INSERT
    WITH CHECK (auth.uid() = operator_id);

CREATE POLICY "Operators can update their own requests"
    ON public.vehicle_availability_requests
    FOR UPDATE
    USING (auth.uid() = operator_id);

-- Fleet owner can view and update requests for vehicles they own
CREATE POLICY "Fleet owners can view requests for their vehicles"
    ON public.vehicle_availability_requests
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.vehicles v
            WHERE v.id = vehicle_availability_requests.vehicle_id
            AND v.owner_id = auth.uid()
        )
    );

CREATE POLICY "Fleet owners can update requests for their vehicles"
    ON public.vehicle_availability_requests
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.vehicles v
            WHERE v.id = vehicle_availability_requests.vehicle_id
            AND v.owner_id = auth.uid()
        )
    );

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.vehicle_availability_requests
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
