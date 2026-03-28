-- ==========================================
-- SCRIPT DE CORREÇÃO - Execute este AGORA
-- ==========================================
-- Este script corrige APENAS as políticas da tabela profiles
-- Não vai dar erro mesmo que outras coisas já existam

-- ==========================================
-- PASSO 1: Criar tabela profiles (se não existir)
-- ==========================================

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'cliente')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- PASSO 2: Recriar função is_admin
-- ==========================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- PASSO 3: Recriar trigger de novo usuário
-- ==========================================

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
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      role = EXCLUDED.role;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==========================================
-- PASSO 4: DELETAR todas as policies antigas de profiles
-- ==========================================

DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Allow view profiles" ON profiles;
DROP POLICY IF EXISTS "Allow update profiles" ON profiles;
DROP POLICY IF EXISTS "Allow insert profiles" ON profiles;

-- ==========================================
-- PASSO 5: CRIAR as policies corretas
-- ==========================================

-- Policy 1: Admins podem ver TODOS os perfis, usuários veem apenas o próprio
CREATE POLICY "Allow view profiles" ON profiles
  FOR SELECT 
  USING (
    auth.uid() = id OR public.is_admin()
  );

-- Policy 2: Admins podem atualizar QUALQUER perfil, usuários apenas o próprio
CREATE POLICY "Allow update profiles" ON profiles
  FOR UPDATE 
  USING (
    auth.uid() = id OR public.is_admin()
  )
  WITH CHECK (
    auth.uid() = id OR public.is_admin()
  );

-- Policy 3: Permitir criação de perfis
CREATE POLICY "Allow insert profiles" ON profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ==========================================
-- PASSO 6: Garantir permissões
-- ==========================================

GRANT ALL ON profiles TO authenticated;
GRANT ALL ON profiles TO service_role;

-- ==========================================
-- PASSO 7: Criar perfis para usuários existentes
-- ==========================================

-- Inserir perfis para usuários que já existem mas não têm perfil
INSERT INTO profiles (id, email, role)
SELECT 
  id,
  email,
  CASE 
    WHEN email IN ('cliente@gmail.com', 'abacaxi@abacaxi') THEN 'cliente'
    WHEN email = 'rafaeldesjapp@gmail.com' THEN 'admin'
    ELSE 'admin'
  END
FROM auth.users
WHERE id NOT IN (SELECT id FROM profiles)
ON CONFLICT (id) DO NOTHING;

-- ==========================================
-- PASSO 8: Atualizar roles dos usuários teste
-- ==========================================

UPDATE profiles SET role = 'cliente' WHERE email IN ('cliente@gmail.com', 'abacaxi@abacaxi');
UPDATE profiles SET role = 'admin' WHERE email = 'rafaeldesjapp@gmail.com';

-- ==========================================
-- VERIFICAÇÃO FINAL
-- ==========================================

-- Mostrar todos os perfis
SELECT id, email, role, created_at FROM profiles ORDER BY created_at DESC;

-- Mostrar as policies da tabela profiles
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'profiles';

-- ==========================================
-- SUCESSO!
-- ==========================================
-- Se você vê os perfis e as 3 policies acima, está tudo OK!
-- Agora faça logout e login novamente na aplicação
