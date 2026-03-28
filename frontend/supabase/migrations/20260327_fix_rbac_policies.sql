-- Fix RBAC policies to allow admins to manage all profiles

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;

-- Create comprehensive policies for profiles

-- Policy 1: Admins can view ALL profiles, users can view their own
CREATE POLICY "Allow view profiles" ON profiles
  FOR SELECT 
  USING (
    auth.uid() = id OR public.is_admin()
  );

-- Policy 2: Admins can update ANY profile, users can update their own
CREATE POLICY "Allow update profiles" ON profiles
  FOR UPDATE 
  USING (
    auth.uid() = id OR public.is_admin()
  )
  WITH CHECK (
    auth.uid() = id OR public.is_admin()
  );

-- Policy 3: Allow profile creation
CREATE POLICY "Allow insert profiles" ON profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Grant necessary permissions
GRANT ALL ON profiles TO authenticated;
GRANT ALL ON profiles TO service_role;
