import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { appointmentId, solicitationId, action } = await req.json();

    if (!appointmentId) {
      return NextResponse.json({ error: 'Nenhum agendamento selecionado' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const isApprove = action === 'approve';
    const statusResult = isApprove ? 'agendado' : 'cancelado';
    const solicitacaoResult = isApprove ? 'aprovado' : 'rejeitado';

    console.log(`[ActionV5] Iniciando: ${action} | Ag: ${appointmentId} | Sol: ${solicitationId}`);

    // 1. Atualizar agendamento
    const { error: apError } = await supabaseAdmin
      .from('agendamentos')
      .update({ status: statusResult })
      .eq('id', appointmentId);

    if (apError) {
      console.error('[ActionV5] Erro agendamento:', apError);
      return NextResponse.json({ error: 'Erro ao atualizar agendamento' }, { status: 500 });
    }

    // 2. Atualizar solicitação (Tentamos por ID direto, depois por vínculo)
    let solToUpdateId = solicitationId;

    if (!solToUpdateId) {
      const { data: sols } = await supabaseAdmin
        .from('solicitacoes')
        .select('id')
        .eq('status', 'pendente')
        .contains('data', { appointment_id: appointmentId });
      
      if (sols && sols.length > 0) solToUpdateId = sols[0].id;
    }

    if (solToUpdateId) {
      const { data: solData } = await supabaseAdmin
        .from('solicitacoes')
        .select('data')
        .eq('id', solToUpdateId)
        .single();

      const { error: solUpdateError } = await supabaseAdmin
        .from('solicitacoes')
        .update({ 
          status: solicitacaoResult,
          data: {
            ...(solData?.data || {}),
            resolved_at: new Date().toISOString(),
            resolved_by: 'Action Push v5',
            resolve_comment: isApprove ? 'Aprovado via Push v5' : 'Recusado via Push v5'
          }
        })
        .eq('id', solToUpdateId);

      if (solUpdateError) console.error('[ActionV5] Erro sol update:', solUpdateError);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[ActionV5] Erro fatal:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
