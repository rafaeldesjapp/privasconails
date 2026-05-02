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

    console.log(`[ActionV7] Recebido: ${action} | Ag: ${appointmentId}`);

    // 1. Atualizar agendamento
    const { error: apError } = await supabaseAdmin
      .from('agendamentos')
      .update({ status: statusResult })
      .eq('id', appointmentId);

    if (apError) {
      return NextResponse.json({ error: 'Erro ao atualizar agendamento' }, { status: 500 });
    }

    // 2. Atualizar solicitação
    let solToUpdateId = solicitationId;
    if (!solToUpdateId) {
      const { data: sols } = await supabaseAdmin
        .from('solicitacoes')
        .select('id, data')
        .eq('status', 'pendente')
        .contains('data', { appointment_id: appointmentId });
      
      if (sols && sols.length > 0) {
        solToUpdateId = sols[0].id;
      }
    }

    if (solToUpdateId) {
      // Buscar dados atuais para não perder campos
      const { data: currentSol } = await supabaseAdmin
        .from('solicitacoes')
        .select('data')
        .eq('id', solToUpdateId)
        .single();

      await supabaseAdmin
        .from('solicitacoes')
        .update({ 
          status: solicitacaoResult,
          data: {
            ...(currentSol?.data || {}),
            resolved_at: new Date().toISOString(),
            resolved_by: 'Action Push v7',
            resolve_comment: isApprove ? 'Aprovado via Push v7' : 'Recusado via Push v7'
          }
        })
        .eq('id', solToUpdateId);
    }

    return NextResponse.json({ 
      success: true, 
      receivedAction: action,
      appliedStatus: isApprove ? 'APROVADO' : 'RECUSADO' 
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
