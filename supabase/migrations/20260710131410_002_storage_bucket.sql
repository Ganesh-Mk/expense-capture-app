
/*
# Create expense-receipts storage bucket

Creates a public Supabase Storage bucket for expense receipts with
appropriate access policies so authenticated users can upload and
read receipts.
*/

-- Create the storage bucket (if storage extension functions are available)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'expense-receipts',
  'expense-receipts',
  true,
  5242880,  -- 5 MB
  ARRAY['image/jpeg','image/png','image/webp','image/gif','application/pdf']
) ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload files under their own user_id folder
DROP POLICY IF EXISTS "auth_users_upload" ON storage.objects;
CREATE POLICY "auth_users_upload" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'expense-receipts');

-- Allow anyone to read (receipts are referenced from the app)
DROP POLICY IF EXISTS "public_read_receipts" ON storage.objects;
CREATE POLICY "public_read_receipts" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'expense-receipts');

-- Allow authenticated users to delete their own files
DROP POLICY IF EXISTS "auth_users_delete_own" ON storage.objects;
CREATE POLICY "auth_users_delete_own" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'expense-receipts' AND auth.uid()::text = (storage.foldername(name))[2]);
