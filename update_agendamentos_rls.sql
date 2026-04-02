-- Script para atualizar as políticas de Row Level Security (RLS) da tabela 'agendamentos'
-- Copie e cole este código no SQL Editor do seu dashboard Supabase.

-- 1. Remover políticas antigas se existirem para evitar conflitos
DROP POLICY IF EXISTS "Qualquer usuário logado pode ler agendamentos" ON agendamentos;
DROP POLICY IF EXISTS "Usuários podem criar agendamentos" ON agendamentos;
DROP POLICY IF EXISTS "Usuários podem cancelar seus próprios agendamentos" ON agendamentos;
DROP POLICY IF EXISTS "Apenas admin pode atualizar agendamentos" ON agendamentos;

-- 2. Garantir que RLS está habilitado
ALTER TABLE agendamentos ENABLE ROW LEVEL SECURITY;

-- 3. Criar novas políticas abrangentes

-- LEITURA: Qualquer usuário autenticado pode ler os agendamentos
CREATE POLICY "Leitura pública para usuários autenticados" 
ON agendamentos FOR SELECT 
TO authenticated 
USING (true);

-- INSERÇÃO: Usuário pode criar para si mesmo OU se for admin/desenvolvedor
CREATE POLICY "Inserção por dono ou admin/dev" 
ON agendamentos FOR INSERT 
TO authenticated 
WITH CHECK (
  auth.uid() = user_id OR 
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role IN ('admin', 'desenvolvedor')
  )
);

-- EXCLUSÃO: Usuário pode deletar o próprio registro OU se for admin/desenvolvedor
CREATE POLICY "Exclusão por dono ou admin/dev" 
ON agendamentos FOR DELETE 
TO authenticated 
USING (
  auth.uid() = user_id OR 
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role IN ('admin', 'desenvolvedor')
  )
);

-- ATUALIZAÇÃO: Apenas administradores ou desenvolvedores podem atualizar registros de qualquer um (concluir, mudar serviço, etc.)
CREATE POLICY "Atualização exclusiva para admin/dev" 
ON agendamentos FOR UPDATE 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role IN ('admin', 'desenvolvedor')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role IN ('admin', 'desenvolvedor')
  )
);
