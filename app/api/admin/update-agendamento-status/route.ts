import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { appointmentIds, status, paymentMethod } = await req.json();

    if (!appointmentIds || !appointmentIds.length) {
      return NextResponse.json({ error: 'Nenhum agendamento selecionado' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ 
        error: 'Chave de serviço Supabase ausente. O sistema não pode dar bypass no RLS.' 
      }, { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const updatePayload: any = {};
    if (status) updatePayload.status = status;
    if (paymentMethod) updatePayload.payment_method = paymentMethod;

    const { error } = await supabaseAdmin
      .from('agendamentos')
      .update(updatePayload)
      .in('id', appointmentIds);

    if (error) {
       console.error("Erro no supabase Admin update:", error);
       return NextResponse.json({ error: 'Falha no banco de dados', details: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Erro na API interna de status:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
