-- Add profile_image_url and company_logo_url to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS profile_image_url TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS company_logo_url TEXT;

-- Create storage bucket for profiles if it doesn't exist
-- Note: This might require extensions or specific permissions, 
-- but usually we can at least try to insert into storage.buckets
INSERT INTO storage.buckets (id, name, public)
SELECT 'profiles', 'profiles', true
WHERE NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'profiles'
);

-- Set up storage policies for the profiles bucket
-- Allow public read access
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'profiles');

-- Allow authenticated users to upload their own files
CREATE POLICY "Authenticated Upload" ON storage.objects FOR INSERT 
WITH CHECK (
    bucket_id = 'profiles' AND 
    auth.role() = 'authenticated' AND
    (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to update/delete their own files
CREATE POLICY "Authenticated Update" ON storage.objects FOR UPDATE
USING (
    bucket_id = 'profiles' AND 
    auth.role() = 'authenticated' AND
    (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Authenticated Delete" ON storage.objects FOR DELETE
USING (
    bucket_id = 'profiles' AND 
    auth.role() = 'authenticated' AND
    (storage.foldername(name))[1] = auth.uid()::text
);
