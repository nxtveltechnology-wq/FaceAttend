  -- Create classes table
  CREATE TABLE public.classes (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
  );

  -- Create students table
  CREATE TABLE public.students (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    roll_number TEXT NOT NULL UNIQUE,
    class_id UUID REFERENCES public.classes(id),
    face_embedding JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
  );

  -- Create teachers table
  CREATE TABLE public.teachers (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    subject TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
  );

  -- Create profiles table for role management
  CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'teacher', 'admin')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
  );

  -- Create attendance table
  CREATE TABLE public.attendance (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    time TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'present',
    device_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(student_id, date)
  );

  -- Enable RLS
  ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

  -- RLS Policies for classes (public read, admin write)
  CREATE POLICY "Classes are viewable by everyone" ON public.classes FOR SELECT USING (true);
  CREATE POLICY "Admins can manage classes" ON public.classes FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

  -- RLS Policies for students
  CREATE POLICY "Students are viewable by authenticated users" ON public.students FOR SELECT USING (true);
  CREATE POLICY "Admins can manage students" ON public.students FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

  -- RLS Policies for teachers
  CREATE POLICY "Teachers are viewable by authenticated users" ON public.teachers FOR SELECT TO authenticated USING (true);
  CREATE POLICY "Admins can manage teachers" ON public.teachers FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

  -- RLS Policies for profiles
  CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
  CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
  CREATE POLICY "Admins can manage profiles" ON public.profiles FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

  -- RLS Policies for attendance
  CREATE POLICY "Attendance viewable by authenticated" ON public.attendance FOR SELECT TO authenticated USING (true);
  CREATE POLICY "Anyone can insert attendance" ON public.attendance FOR INSERT WITH CHECK (true);
  CREATE POLICY "Admins can manage attendance" ON public.attendance FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

  -- Enable realtime for attendance
  ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance;

  -- Create storage bucket for face images
  INSERT INTO storage.buckets (id, name, public) VALUES ('face-images', 'face-images', true);

  -- Storage policies
  CREATE POLICY "Face images are publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = 'face-images');
  CREATE POLICY "Admins can upload face images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'face-images');

  -- Create trigger for new user profiles
  CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS TRIGGER AS $$
  BEGIN
    INSERT INTO public.profiles (id, role)
    VALUES (NEW.id, 'student');
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

  CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();