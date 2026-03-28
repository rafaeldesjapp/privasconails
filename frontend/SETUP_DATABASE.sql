-- ==========================================
-- INSTRUÇÕES DE SETUP DO BANCO DE DADOS
-- Priscila Vasconcelos - Nail Designer CRM
-- ==========================================

-- Execute os comandos abaixo no SQL Editor do Supabase
-- URL: https://supabase.com/dashboard/project/fxoysrviojbyygelgjln/sql/new

-- ==========================================
-- PASSO 1: CRIAR TABELAS (Schema Inicial)
-- ==========================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Contacts Table
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  company TEXT NOT NULL,
  status TEXT DEFAULT 'Lead' CHECK (status IN ('Key Account', 'Follow-up Pendente', 'Lead', 'Customer')),
  health_score INTEGER DEFAULT 100,
  open_value DECIMAL(12, 2) DEFAULT 0,
  last_interaction TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  email TEXT,
  phone TEXT,
  location TEXT,
  photo_url TEXT,
  uid UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Appointments Table
CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  type TEXT DEFAULT 'Call' CHECK (type IN ('Google Meet', 'Presencial', 'Call')),
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  uid UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Opportunities Table
CREATE TABLE IF NOT EXISTS opportunities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  value DECIMAL(12, 2) NOT NULL,
  status TEXT DEFAULT 'QUALIFICAÇÃO' CHECK (status IN ('NEGOCIAÇÃO', 'QUALIFICAÇÃO', 'FECHADO')),
  pipeline TEXT DEFAULT 'Sales',
  closing_date DATE,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  uid UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Timeline Table
CREATE TABLE IF NOT EXISTS timeline (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL CHECK (type IN ('call', 'mail', 'note')),
  title TEXT NOT NULL,
  description TEXT,
  date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  uid UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Notes Table
CREATE TABLE IF NOT EXISTS notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content TEXT NOT NULL,
  color TEXT DEFAULT 'amber' CHECK (color IN ('amber', 'blue', 'green')),
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  uid UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Row Level Security (RLS)

-- Enable RLS on all tables
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

-- Policies for contacts
CREATE POLICY "Users can manage their own contacts" ON contacts
  FOR ALL USING (auth.uid() = uid);

-- Policies for appointments
CREATE POLICY "Users can manage their own appointments" ON appointments
  FOR ALL USING (auth.uid() = uid);

-- Policies for opportunities
CREATE POLICY "Users can manage their own opportunities" ON opportunities
  FOR ALL USING (auth.uid() = uid);

-- Policies for timeline
CREATE POLICY "Users can manage their own timeline events" ON timeline
  FOR ALL USING (auth.uid() = uid);

-- Policies for notes
CREATE POLICY "Users can manage their own notes" ON notes
  FOR ALL USING (auth.uid() = uid);


-- ==========================================
-- PASSO 2: ADICIONAR RBAC (Roles e Permissões)
-- ==========================================

-- Add profiles table for RBAC
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'cliente')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Function to check if a user is an admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (
    new.id, 
    new.email, 
    CASE 
      WHEN new.email IN ('cliente@gmail.com', 'abacaxi@abacaxi') THEN 'cliente'
      WHEN new.email = 'rafaeldesjapp@gmail.com' THEN 'admin'
      ELSE 'admin'
    END
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to call the function on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update existing profiles to correct roles
UPDATE public.profiles 
SET role = 'cliente' 
WHERE email IN ('cliente@gmail.com', 'abacaxi@abacaxi');

UPDATE public.profiles 
SET role = 'admin' 
WHERE email NOT IN ('cliente@gmail.com', 'abacaxi@abacaxi');


-- ==========================================
-- PASSO 3: CORRIGIR POLÍTICAS RLS (CRÍTICO!)
-- ==========================================

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


-- ==========================================
-- VERIFICAÇÃO
-- ==========================================

-- Verifique se as tabelas foram criadas
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('profiles', 'contacts', 'appointments', 'opportunities', 'timeline', 'notes');

-- Verifique as policies
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE tablename = 'profiles';

-- ==========================================
-- FIM DO SETUP
-- ==========================================
-- Após executar estes comandos, faça logout e login novamente na aplicação
