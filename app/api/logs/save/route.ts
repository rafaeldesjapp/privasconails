import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { action, target_info, description, admin_email, admin_id } = await req.json();

    if (!action || !admin_email) {
      return NextResponse.json({ error: 'Dados incompletos para o log.' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ 
        error: `Configuração do servidor Supabase ausente.` 
      }, { status: 500 });
    }

    // Criar cliente com Service Role para bypass RLS na tabela de logs
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { error: logError } = await supabaseAdmin
      .from('logs')
      .insert({
        action,
        target_info,
        description,
        admin_email,
        admin_id
      });

    if (logError) {
      console.error('Erro ao gravar log no servidor:', logError);
      return NextResponse.json({ error: 'Falha ao gravar log no banco.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Exception on logs/save API:', error);
    return NextResponse.json({ error: error.message || 'Erro interno do servidor.' }, { status: 500 });
  }
}
