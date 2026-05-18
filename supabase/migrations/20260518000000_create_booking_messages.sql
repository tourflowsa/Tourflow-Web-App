-- Migration: Create booking chat messages table
-- Description: Adds a table for booking-scoped messaging between operators, providers, and admins.

CREATE TABLE public.booking_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
    sender_id uuid NOT NULL REFERENCES public.profiles(id),
    sender_role_snapshot text NOT NULL,
    sender_name_snapshot text NOT NULL,
    content text NOT NULL CHECK (char_length(content) >= 1 AND char_length(content) <= 2000),
    metadata jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_booking_messages_booking_id_created_at ON public.booking_messages(booking_id, created_at DESC);
CREATE INDEX idx_booking_messages_sender_id ON public.booking_messages(sender_id);

-- Enable RLS
ALTER TABLE public.booking_messages ENABLE ROW LEVEL SECURITY;

-- SELECT Policy
-- Allowed for: Admins, Booking Operator, Assigned Providers (pending/accepted/completed/no_show)
CREATE POLICY "Booking chat visibility" ON public.booking_messages
    FOR SELECT
    USING (
        EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin') OR
        EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_messages.booking_id AND b.operator_id = auth.uid()) OR
        EXISTS (
            SELECT 1 FROM public.booking_assignments ba 
            WHERE ba.booking_id = booking_messages.booking_id 
            AND ba.resource_id = auth.uid() 
            AND ba.status IN ('pending', 'accepted', 'completed', 'no_show')
        )
    );

-- INSERT Policy
-- Allowed for: Same participants as SELECT, ensuring sender_id matches current user
CREATE POLICY "Booking chat insertion" ON public.booking_messages
    FOR INSERT
    WITH CHECK (
        sender_id = auth.uid() AND (
            EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin') OR
            EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_id AND b.operator_id = auth.uid()) OR
            EXISTS (
                SELECT 1 FROM public.booking_assignments ba 
                WHERE ba.booking_id = booking_id 
                AND ba.resource_id = auth.uid() 
                AND ba.status IN ('pending', 'accepted', 'completed', 'no_show')
            )
        )
    );

-- UPDATE and DELETE blocked by default as no policies are defined for them.
-- To be explicit, we can add a policy that always returns false or just rely on RLS default deny.
