-- Create a function to check if the user is an admin
-- SECURITY DEFINER allows this function to run with the privileges of the creator (postgres/superuser)
-- bypassing RLS on the profiles table to avoid infinite recursion
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update RLS Policies for profiles to use the new function
-- First drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can manage profiles" ON public.profiles;

-- Re-create policies using the non-recursive function
CREATE POLICY "Admins can view all profiles" ON public.profiles
FOR SELECT USING (
  public.is_admin()
);

CREATE POLICY "Admins can manage profiles" ON public.profiles
FOR ALL USING (
  public.is_admin()
);

-- Update other tables to use the helper function for consistency and better performance
-- Classes
DROP POLICY IF EXISTS "Admins can manage classes" ON public.classes;
CREATE POLICY "Admins can manage classes" ON public.classes
FOR ALL USING (
  public.is_admin()
);

-- Students
DROP POLICY IF EXISTS "Admins can manage students" ON public.students;
CREATE POLICY "Admins can manage students" ON public.students
FOR ALL USING (
  public.is_admin()
);

-- Teachers
DROP POLICY IF EXISTS "Admins can manage teachers" ON public.teachers;
CREATE POLICY "Admins can manage teachers" ON public.teachers
FOR ALL USING (
  public.is_admin()
);

-- Attendance
DROP POLICY IF EXISTS "Admins can manage attendance" ON public.attendance;
CREATE POLICY "Admins can manage attendance" ON public.attendance
FOR ALL USING (
  public.is_admin()
);
