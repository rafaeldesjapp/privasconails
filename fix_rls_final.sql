-- SCRIPT DEFINITIVO PARA CORRIGIR RLS DA TABELA 'AGENDAMENTOS'
-- Copie e cole este código no SQL Editor do seu dashboard Supabase.

-- 1. Limpeza total de políticas antigas para evitar conflitos
DROP POLICY IF EXISTS "Qualquer usuário logado pode ler agendamentos" ON agendamentos;
DROP POLICY IF EXISTS "Usuários podem criar agendamentos" ON agendamentos;
DROP POLICY IF EXISTS "Usuários podem cancelar seus próprios agendamentos" ON agendamentos;
DROP POLICY IF EXISTS "Apenas admin pode atualizar agendamentos" ON agendamentos;
DROP POLICY IF EXISTS "Leitura pública para usuários autenticados" ON agendamentos;
DROP POLICY IF EXISTS "Inserção por dono ou admin/dev" ON agendamentos;
DROP POLICY IF EXISTS "Exclusão por dono ou admin/dev" ON agendamentos;
DROP POLICY IF EXISTS "Atualização exclusiva para admin/dev" ON agendamentos;

-- 2. Garantir que RLS está habilitado e definir valor padrão para user_id
ALTER TABLE agendamentos ENABLE ROW LEVEL SECURITY;

-- Isso garante que, se o frontend não enviar o user_id, o banco usa o ID de quem está logado.
-- Evita erros de "RLS Policy Violation" por incompatibilidade de IDs.
ALTER TABLE agendamentos ALTER COLUMN user_id SET DEFAULT auth.uid();

-- 3. Criar Políticas Robustas

-- LEITURA (SELECT)
-- Qualquer usuário autenticado (cliente ou admin) pode ver os agendamentos.
-- Isso é necessário para que os clientes saibam quais horários estão ocupados.
CREATE POLICY "agendamentos_select_policy" 
ON agendamentos FOR SELECT 
TO authenticated 
USING (true);

-- INSERÇÃO (INSERT)
-- 1. O cliente pode inserir se o user_id for o dele.
-- 2. Admins/Desenvolvedores podem inserir para qualquer um.
CREATE POLICY "agendamentos_insert_policy" 
ON agendamentos FOR INSERT 
TO authenticated 
WITH CHECK (
  auth.uid() = user_id OR 
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role IN ('admin', 'desenvolvedor')
  )
);

-- ATUALIZAÇÃO (UPDATE)
-- Apenas admins e desenvolvedores podem atualizar registros (ex: concluir, mudar status).
CREATE POLICY "agendamentos_update_policy" 
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

-- EXCLUSÃO (DELETE)
-- 1. O cliente pode deletar (cancelar) seu próprio agendamento.
-- 2. Admins/Desenvolvedores podem deletar qualquer um.
CREATE POLICY "agendamentos_delete_policy" 
ON agendamentos FOR DELETE 
TO authenticated 
USING (
  auth.uid() = user_id OR 
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role IN ('admin', 'desenvolvedor')
  )
);

-- 4. Garantir permissões de acesso
GRANT ALL ON agendamentos TO authenticated;
GRANT ALL ON agendamentos TO service_role;
