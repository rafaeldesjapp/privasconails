import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Configuração do servidor Supabase ausente.');
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

export async function POST(req: Request) {
  try {
    const { date, status, user_id, client_name, service } = await req.json();

    if (!date || !status) {
      return NextResponse.json({ error: 'Dados incompletos.' }, { status: 400 });
    }

    // Tentar encontrar um registro existente para o dia e atualizar se necessário, ou inserir novo
    // Mas para simplicidade, vamos apenas inserir (ou atualizar se já existir um registro de ALL para este dia)
    const { error: upsertError } = await supabaseAdmin
      .from('agendamentos')
      .upsert({
        date,
        time: 'ALL',
        status,
        user_id,
        client_name: client_name || (status === 'aberto' ? 'Manual Override' : 'Dia Fechado'),
        service: service || (status === 'aberto' ? 'Abertura Manual' : 'Dia Indisponível')
      }, { onConflict: 'date,time' }); // Assume que temos unique constraint em (date, time) ou tratamos aqui

    // Se houver erro de constraint, tentamos deletar e inserir
    if (upsertError) {
      await supabaseAdmin.from('agendamentos').delete().match({ date, time: 'ALL' });
      const { error: insertError } = await supabaseAdmin.from('agendamentos').insert({
        date,
        time: 'ALL',
        status,
        user_id,
        client_name: client_name || (status === 'aberto' ? 'Manual Override' : 'Dia Fechado'),
        service: service || (status === 'aberto' ? 'Abertura Manual' : 'Dia Indisponível')
      });
      if (insertError) throw insertError;
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Exception on admin/manage-day (POST):', error);
    return NextResponse.json({ error: error.message || 'Erro interno do servidor.' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { date } = await req.json();

    if (!date) {
      return NextResponse.json({ error: 'Passe a data para remover o override.' }, { status: 400 });
    }

    // Remove todos os registros de override (time = 'ALL') para este dia
    const { error } = await supabaseAdmin
      .from('agendamentos')
      .delete()
      .match({ date, time: 'ALL' });

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Exception on admin/manage-day (DELETE):', error);
    return NextResponse.json({ error: error.message || 'Erro interno do servidor.' }, { status: 500 });
  }
}
