-- Add guest_phone to bookings table
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS guest_phone text;
