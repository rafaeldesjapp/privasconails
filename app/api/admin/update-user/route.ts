import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { userId, email, phone, fullName, username } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: 'ID do usuário é obrigatório' }, { status: 400 });
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

    // 1. Atualizar no Supabase Auth (se o email foi enviado)
    const trimmedEmail = email?.trim();
    if (trimmedEmail) {
      // Validação básica de formato de email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmedEmail)) {
        return NextResponse.json({ error: 'Formato de email inválido.' }, { status: 400 });
      }

      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
        userId,
        { email: trimmedEmail }
      );
      if (authError) {
        console.error('Erro ao atualizar Auth:', authError);
        return NextResponse.json({ error: `Erro no Auth: ${authError.message}` }, { status: 400 });
      }
    }

    // 2. Atualizar na tabela public.profiles
    const updateData: any = {};
    if (trimmedEmail) updateData.email = trimmedEmail;
    if (phone !== undefined) updateData.phone = phone?.trim();
    if (fullName !== undefined) updateData.full_name = fullName?.trim();
    if (username !== undefined) updateData.username = username?.trim().toLowerCase().replace(/\s/g, '');

    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update(updateData)
      .eq('id', userId);

    if (profileError) {
      console.error('Erro ao atualizar Perfil:', profileError);
      return NextResponse.json({ error: `Erro no Perfil: ${profileError.message}` }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Erro na API update-user:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
