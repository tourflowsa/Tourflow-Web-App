CREATE TABLE public.driver_availability_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id uuid NOT NULL REFERENCES public.profiles(id),
  driver_id uuid NOT NULL REFERENCES public.profiles(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined','cancelled')),
  start_date timestamp with time zone NOT NULL,
  end_date timestamp with time zone NOT NULL,
  notes text NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  responded_at timestamp with time zone NULL,
  responded_by uuid NULL REFERENCES public.profiles(id),
  converted_booking_id uuid NULL REFERENCES public.bookings(id)
);

-- RLS
ALTER TABLE public.driver_availability_requests ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Operators can view their own driver requests"
  ON public.driver_availability_requests FOR SELECT
  USING (auth.uid() = operator_id);

CREATE POLICY "Operators can insert their own driver requests"
  ON public.driver_availability_requests FOR INSERT
  WITH CHECK (auth.uid() = operator_id);

CREATE POLICY "Operators can update their own driver requests"
  ON public.driver_availability_requests FOR UPDATE
  USING (auth.uid() = operator_id);

CREATE POLICY "Drivers can view requests for themselves"
  ON public.driver_availability_requests FOR SELECT
  USING (auth.uid() = driver_id);

CREATE POLICY "Drivers can update requests for themselves"
  ON public.driver_availability_requests FOR UPDATE
  USING (auth.uid() = driver_id);

-- Add updated_at trigger
CREATE TRIGGER handle_updated_at_driver_requests
  BEFORE UPDATE ON public.driver_availability_requests
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
