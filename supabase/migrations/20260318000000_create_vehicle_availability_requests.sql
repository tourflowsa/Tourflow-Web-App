-- Create vehicle_availability_requests table
CREATE TABLE IF NOT EXISTS public.vehicle_availability_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id uuid NOT NULL REFERENCES public.profiles(id),
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined','cancelled')),
  start_date timestamp with time zone NOT NULL,
  end_date timestamp with time zone NOT NULL,
  rate_type text NOT NULL CHECK (rate_type IN ('day','hour')),
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  responded_at timestamp with time zone,
  responded_by uuid REFERENCES public.profiles(id),
  converted_booking_id uuid REFERENCES public.bookings(id)
);

-- Enable RLS
ALTER TABLE public.vehicle_availability_requests ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Operators can insert own requests" ON public.vehicle_availability_requests
  FOR INSERT WITH CHECK (auth.uid() = operator_id);

CREATE POLICY "Operators can view own requests" ON public.vehicle_availability_requests
  FOR SELECT USING (auth.uid() = operator_id);

CREATE POLICY "Fleet owners can view requests for their vehicles" ON public.vehicle_availability_requests
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.vehicles v
      WHERE v.id = vehicle_availability_requests.vehicle_id
      AND v.owner_id = auth.uid()
    )
  );

CREATE POLICY "Fleet owners can update requests for their vehicles" ON public.vehicle_availability_requests
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.vehicles v
      WHERE v.id = vehicle_availability_requests.vehicle_id
      AND v.owner_id = auth.uid()
    )
  );

-- Trigger for updated_at
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.vehicle_availability_requests
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();
