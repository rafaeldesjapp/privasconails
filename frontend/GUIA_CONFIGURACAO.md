# 🔧 GUIA COMPLETO: Configurar "Tornar Admin" e "Tornar Cliente"

## ❗ PROBLEMA IDENTIFICADO

A funcionalidade de "Tornar Admin" e "Tornar Cliente" não está funcionando porque:
1. As tabelas do banco de dados (incluindo `profiles`) não foram criadas no Supabase
2. As políticas RLS (Row Level Security) não estão configuradas corretamente

## ✅ SOLUÇÃO PASSO A PASSO

### PASSO 1: Executar Scripts SQL no Supabase

1. **Acesse o SQL Editor do Supabase:**
   - URL: https://supabase.com/dashboard/project/fxoysrviojbyygelgjln/sql/new

2. **Copie TODO o conteúdo do arquivo:**
   - `/app/SETUP_DATABASE.sql`

3. **Cole no SQL Editor e clique em "RUN"**

4. **Aguarde a execução (pode levar alguns segundos)**

### PASSO 2: Criar Usuário Admin

Você tem duas opções:

#### Opção A: Usar seu email (rafaeldesjapp@gmail.com)
1. Na tela de login, clique em "Cadastre-se"
2. Use: rafaeldesjapp@gmail.com
3. Defina uma senha
4. O sistema automaticamente tornará você admin

#### Opção B: Tornar um usuário existente admin
1. Execute no SQL Editor do Supabase:
```sql
-- Ver todos os usuários
SELECT id, email FROM auth.users;

-- Tornar o primeiro usuário admin (ajuste o email)
UPDATE profiles 
SET role = 'admin' 
WHERE email = 'cliente@gmail.com';
```

### PASSO 3: Verificar Funcionamento

1. **Faça logout e login novamente** com o usuário admin
2. No sidebar, você verá:
   - "Usuários" (link novo)
   - "Setup DB" (link novo)
3. Clique em "Usuários"
4. Teste os botões "Tornar Admin" e "Tornar Cliente"

## 🎯 O QUE FOI CORRIGIDO NO CÓDIGO

### 1. Arquivo: `/app/supabase/migrations/20260327_fix_rbac_policies.sql`
**Problema:** Políticas RLS incompletas
**Solução:** Adicionadas políticas corretas com `USING` e `WITH CHECK`

### 2. Arquivo: `/app/app/usuarios/page.tsx`
**Status:** ✅ Já estava correto
- Função `toggleRole` atualiza o role no banco
- Verifica se usuário é admin antes de mostrar a página
- Desabilita botão para o próprio usuário

### 3. Arquivo: `/app/hooks/use-supabase.ts`
**Status:** ✅ Já estava correto
- Hook com real-time updates
- Cria perfil automaticamente no primeiro login
- Email rafaeldesjapp@gmail.com sempre é admin

### 4. Novo: `/app/app/setup/page.tsx`
- Página de diagnóstico e instruções
- Testa permissões
- Mostra status das tabelas

### 5. Atualizado: `/app/components/Sidebar.tsx`
- Adicionado link "Setup DB" para admins
- Adicionado link "Usuários" para admins

## 📋 CHECKLIST DE VERIFICAÇÃO

Marque conforme for completando:

- [ ] Acessei o SQL Editor do Supabase
- [ ] Copiei e colei o conteúdo de `/app/SETUP_DATABASE.sql`
- [ ] Executei o script com sucesso
- [ ] Criei ou atualizei um usuário para admin
- [ ] Fiz logout e login novamente
- [ ] Consigo ver "Usuários" e "Setup DB" no menu
- [ ] Acessei a página "Usuários"
- [ ] Os botões "Tornar Admin" e "Tornar Cliente" aparecem
- [ ] Testei mudar o role de um usuário
- [ ] A mudança apareceu imediatamente na tela (real-time)

## 🔍 COMO TESTAR SE ESTÁ FUNCIONANDO

### Teste 1: Ver todos os usuários
```sql
SELECT * FROM profiles;
```
Deve mostrar todos os perfis com seus roles.

### Teste 2: Verificar policies
```sql
SELECT policyname, cmd, qual 
FROM pg_policies 
WHERE tablename = 'profiles';
```
Deve mostrar 3 policies:
- Allow view profiles (SELECT)
- Allow update profiles (UPDATE)
- Allow insert profiles (INSERT)

### Teste 3: Função is_admin
```sql
SELECT public.is_admin();
```
Se você for admin, deve retornar `true`.

## 🆘 PROBLEMAS COMUNS

### Problema 1: "Erro ao atualizar papel"
**Causa:** Policies RLS não permitem update
**Solução:** Execute o PASSO 3 do `/app/SETUP_DATABASE.sql`

### Problema 2: Não vejo link "Usuários"
**Causa:** Seu usuário não é admin
**Solução:** Execute no SQL:
```sql
UPDATE profiles SET role = 'admin' WHERE email = 'SEU@EMAIL.com';
```
Depois faça logout e login.

### Problema 3: Tabela profiles não existe
**Causa:** Scripts SQL não foram executados
**Solução:** Execute TODO o `/app/SETUP_DATABASE.sql`

## 📞 SUPORTE

Se após seguir todos os passos ainda não funcionar:
1. Acesse `/setup` na aplicação
2. Clique em "Verificar Setup"
3. Clique em "Testar Permissões Admin"
4. Copie a mensagem de erro e me envie

## 🎉 FUNCIONAMENTO ESPERADO

Depois de tudo configurado:

1. **Admin vê:**
   - Todos os usuários na página /usuarios
   - Botão "Tornar Cliente" para admins
   - Botão "Tornar Admin" para clientes
   - Não pode mudar seu próprio role

2. **Cliente vê:**
   - Mensagem "Acesso Negado" ao tentar acessar /usuarios
   - Apenas suas próprias funcionalidades no menu

3. **Mudanças em tempo real:**
   - Ao clicar no botão, o role muda instantaneamente
   - Outros admins veem a mudança sem precisar recarregar
   - O usuário afetado precisa fazer logout/login para ver as novas permissões
