import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { userId, newPassword } = await req.json();

    if (!userId || !newPassword) {
      return NextResponse.json({ error: 'ID do usuário e nova senha são obrigatórios' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    console.log('API: Supabase URL presente:', !!supabaseUrl);
    console.log('API: Supabase Service Key presente:', !!supabaseServiceKey);

    if (!supabaseUrl || !supabaseServiceKey) {
      const missing = [];
      if (!supabaseUrl) missing.push('NEXT_PUBLIC_SUPABASE_URL');
      if (!supabaseServiceKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
      
      return NextResponse.json({ 
        error: `Configuração do Supabase ausente: ${missing.join(', ')}. Por favor, defina estas variáveis de ambiente.` 
      }, { status: 500 });
    }

    // Check if the service key is the same as the anon key
    if (supabaseAnonKey && supabaseServiceKey === supabaseAnonKey) {
      return NextResponse.json({ 
        error: 'A SUPABASE_SERVICE_ROLE_KEY é idêntica à NEXT_PUBLIC_SUPABASE_ANON_KEY. Você DEVE usar a chave "service_role" para ações administrativas, não a chave "anon". Verifique as configurações de API do seu projeto no Supabase.' 
      }, { status: 500 });
    }

    // Basic check for JWT format (Supabase keys are JWTs starting with eyJ)
    if (!supabaseServiceKey.startsWith('eyJ')) {
      return NextResponse.json({ 
        error: 'A SUPABASE_SERVICE_ROLE_KEY não parece ser uma chave de API válida do Supabase (deve ser uma string longa começando com "eyJ"). Verifique as configurações de API do seu projeto no Supabase.' 
      }, { status: 500 });
    }

    let supabaseAdmin;
    try {
      supabaseAdmin = createClient(
        supabaseUrl,
        supabaseServiceKey,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        }
      );
    } catch (err: any) {
      console.error('API: Erro ao criar cliente Supabase:', err);
      return NextResponse.json({ error: `Erro ao inicializar cliente Supabase: ${err.message}` }, { status: 500 });
    }

    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { password: newPassword }
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
