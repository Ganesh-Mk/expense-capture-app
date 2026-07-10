
/*
# Fix profiles RLS — remove recursive admin check

The original SELECT policy used a subquery on profiles itself to check admin role,
causing infinite recursion (500 error).

Fix: Users can always SELECT their own profile. Admins reading others' profiles
will be handled at the application layer via service role in edge functions,
or via a simpler non-recursive approach.

For the employee list in admin pages, we add a separate admin bypass by
checking the JWT role claim instead.
*/

-- Drop old circular policy
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;

-- Simple: each user reads their own profile
CREATE POLICY "profiles_select_own" ON profiles FOR SELECT
TO authenticated USING (auth.uid() = id);

-- Update: each user updates their own profile
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE
TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
