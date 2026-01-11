-- Allow teachers to manage students (Insert/Update/Delete) based on the user requirement

-- Drop existing admin-only policy for students if it exists (or just add a new one, but let's check)
-- We previously had: CREATE POLICY "Admins can manage students" ...

-- We can create a new policy for Teachers specifically
CREATE POLICY "Teachers can manage students" ON public.students
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role = 'teacher'
  )
);

-- Alternatively, we could update the "Admins can manage students" to include teachers, but separate is clearer.
