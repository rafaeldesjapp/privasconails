-- 1. Desabilita RLS temporariamente para limpar tudo
ALTER TABLE agendamentos DISABLE ROW LEVEL SECURITY;

-- 2. Deleta ABSOLUTAMENTE TODAS as políticas da tabela agendamentos
DO $$ 
DECLARE 
    pol record;
BEGIN 
    FOR pol IN (SELECT policyname FROM pg_policies WHERE tablename = 'agendamentos') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON agendamentos', pol.policyname);
    END LOOP;
END $$;

-- 3. Garante que a coluna user_id aceite o ID automático
ALTER TABLE agendamentos ALTER COLUMN user_id SET DEFAULT auth.uid();

-- 4. Reabilita o RLS com uma única política simples e poderosa
ALTER TABLE agendamentos ENABLE ROW LEVEL SECURITY;

-- Esta política permite operações para usuários autenticados,
-- mas restringe a leitura e escrita de registros com status 'nota' apenas para Admin/Dev.
CREATE POLICY "permissao_total_agendamentos" 
ON agendamentos FOR ALL 
TO authenticated 
USING (
  (status != 'nota') OR 
  (EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.role = 'desenvolvedor')
  ))
) 
WITH CHECK (
  (status != 'nota') OR 
  (EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.role = 'desenvolvedor')
  ))
);

-- 5. Dá as permissões finais
GRANT ALL ON agendamentos TO authenticated;
GRANT ALL ON agendamentos TO service_role;
GRANT ALL ON agendamentos TO postgres;
