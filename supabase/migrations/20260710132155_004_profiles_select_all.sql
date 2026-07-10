
/*
# Profiles — allow all authenticated users to SELECT all profiles

Employee names, grades, departments, and codes are not sensitive — 
they need to be visible to admins for dashboards and to all users 
for future collaboration features.

Update the SELECT policy to allow any authenticated user to read any profile.
Write operations remain owner-only.
*/

DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
CREATE POLICY "profiles_select_all_auth" ON profiles FOR SELECT
TO authenticated USING (true);
