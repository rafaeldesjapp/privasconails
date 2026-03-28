-- ==========================================
-- FIX: Alterar trigger para criar usuários como CLIENTE por padrão
-- ==========================================
-- Execute este script no SQL Editor do Supabase:
-- https://supabase.com/dashboard/project/fxoysrviojbyygelgjln/sql/new

-- Passo 1: Recriar a função handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (
    new.id, 
    new.email, 
    CASE 
      WHEN new.email = 'rafaeldesjapp@gmail.com' THEN 'admin'
      ELSE 'cliente'  -- AGORA novos usuários são CLIENTE por padrão!
    END
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Passo 2: Atualizar usuários existentes (que não são o admin)
UPDATE public.profiles 
SET role = 'cliente' 
WHERE email != 'rafaeldesjapp@gmail.com';

-- Verificar mudança
SELECT email, role FROM profiles ORDER BY created_at DESC;
