import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { targetUserId, adminEmail, adminPassword } = await req.json();

    if (!targetUserId || !adminEmail || !adminPassword) {
      return NextResponse.json({ error: 'Dados incompletos para a exclusão do usuário.' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
      return NextResponse.json({ 
        error: `Configuração do Supabase ausente. Por favor, verifique as variáveis de ambiente.` 
      }, { status: 500 });
    }

    // 1. Validar a identidade do Admin tentando fazer login
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { data: authData, error: authError } = await supabaseClient.auth.signInWithPassword({
      email: adminEmail,
      password: adminPassword,
    });

    if (authError || !authData.user) {
      console.error('Falha na validação do admin:', authError);
      return NextResponse.json({ error: 'Senha de administrador incorreta ou usuário inválido.' }, { status: 401 });
    }

    // Opcional: Validar se o usuário que validou a senha é realmente admin
    // Isso seria checar a tabela profiles, mas já sabemos pelo frontend, porém é bom checar no backend
    const { data: adminProfile } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('id', authData.user.id)
      .single();

    if (adminProfile?.role !== 'admin') {
      return NextResponse.json({ error: 'Apenas administradores podem excluir usuários.' }, { status: 403 });
    }

    // 2. Criar cliente com Service Role para bypass RLS e deletar o user
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Obter infos básicas do alvo antes de excluir para o log
    const { data: targetProfile } = await supabaseAdmin
      .from('profiles')
      .select('email, full_name, username')
      .eq('id', targetUserId)
      .single();

    const targetInfo = targetProfile ? (targetProfile.full_name || targetProfile.username || targetProfile.email) : targetUserId;

    // 3. Deletar usuário do Auth global do Supabase
    // Isso automaticamente aciona triggers ou constraints On Delete Cascade (se existirem)
    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(targetUserId);

    if (deleteAuthError && !deleteAuthError.message.includes("User not found")) {
      console.error('Erro ao deletar do auth:', deleteAuthError);
      return NextResponse.json({ error: `Erro na exclusão do sistema de autenticação: ${deleteAuthError.message}` }, { status: 500 });
    }

    // 4. Deletar do Profiles manualmente por garantia (caso não haja cascade)
    const { error: deleteProfileError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', targetUserId);

    if (deleteProfileError) {
      console.warn('Alerta ao deletar do profile:', deleteProfileError);
      // Não falharemos se apenas o profile falhar, visto que o principal (Auth) já excluiu.
    }

    // 5. Salvar log de auditoria na tabela 'logs'
    const { error: logError } = await supabaseAdmin
      .from('logs')
      .insert({
        action: 'DELETE_USER',
        admin_id: authData.user.id,
        admin_email: adminEmail,
        target_info: `ID: ${targetUserId} | Dados antigos: ${targetInfo}`,
        description: `O administrador deletou permanentemente a conta do usuário.`,
      });

    if (logError) {
      console.error('Aviso: Erro ao preencher tabela logs (A tabela existe?):', logError);
      // Nós não falhamos a request inteira porque a exclusão já ocorreu, 
      // mas alertamos no console do servidor.
    }

    return NextResponse.json({ message: 'Usuário excluído com sucesso.' });
  } catch (error: any) {
    console.error('Exception on delete-user API:', error);
    return NextResponse.json({ error: error.message || 'Erro interno do servidor.' }, { status: 500 });
  }
}
