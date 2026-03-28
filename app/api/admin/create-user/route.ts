import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { email, password, fullName, phone, role } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email e senha são obrigatórios' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ 
        error: 'Configuração administrativa do Supabase ausente.' 
      }, { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // 1. Criar no Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        phone: phone
      }
    });

    if (authError) {
      console.error('Erro ao criar usuário no Auth:', authError);
      return NextResponse.json({ error: `Erro no Auth: ${authError.message}` }, { status: 400 });
    }

    // 2. Criar/Atualizar na tabela public.profiles
    // O trigger handle_new_user pode já ter criado o perfil, então usamos upsert
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: authData.user.id,
        email: email,
        full_name: fullName,
        phone: phone,
        role: role || 'cliente'
      });

    if (profileError) {
      console.error('Erro ao criar perfil:', profileError);
      return NextResponse.json({ error: `Erro no Perfil: ${profileError.message}` }, { status: 400 });
    }

    return NextResponse.json({ success: true, user: authData.user });
  } catch (error: any) {
    console.error('Erro na API create-user:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
