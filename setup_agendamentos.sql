-- Execute este script no SQL Editor do Supabase

CREATE TABLE agendamentos (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  client_name text NOT NULL,
  service text NOT NULL,
  date date NOT NULL,
  time text NOT NULL,
  status text DEFAULT 'agendado', -- agendado, concluido, cancelado
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS (Row Level Security)
ALTER TABLE agendamentos ENABLE ROW LEVEL SECURITY;

-- Políticas de Segurança (Policies)

-- Todos os usuários autenticados podem ver os agendamentos (para saber quais horários estão ocupados)
CREATE POLICY "Qualquer usuário logado pode ler agendamentos" 
ON agendamentos FOR SELECT 
TO authenticated 
USING (true);

-- Clientes podem criar seus próprios agendamentos
CREATE POLICY "Usuários podem criar agendamentos" 
ON agendamentos FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

-- Clientes podem deletar (cancelar) seus próprios agendamentos
CREATE POLICY "Usuários podem cancelar seus próprios agendamentos" 
ON agendamentos FOR DELETE 
TO authenticated 
USING (auth.uid() = user_id);

-- Apenas admins podem atualizar os agendamentos de todos (marcar como concluído, etc.)
CREATE POLICY "Apenas admin pode atualizar agendamentos" 
ON agendamentos FOR UPDATE 
TO authenticated 
USING ( 
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);
-- (Nota: a última policy assume que você tem a coluna role 'admin' no banco,
-- o que validei que existe no profiles)
