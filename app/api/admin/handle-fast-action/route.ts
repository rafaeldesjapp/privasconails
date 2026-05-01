import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { appointmentId, action } = await req.json();

    console.log(`[FastAction] Recebido: ${action} para agendamento ${appointmentId}`);

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

    // 1. Atualizar agendamento
    const { data: updatedAgendamento, error: apError } = await supabaseAdmin
      .from('agendamentos')
      .update({ status: statusResult })
      .eq('id', appointmentId)
      .select();

    if (apError) {
      console.error('[FastAction] Erro ao atualizar agendamento:', apError);
      throw apError;
    }
    
    console.log('[FastAction] Agendamento atualizado:', updatedAgendamento);

    // 2. Buscar e Atualizar solicitação relacionada
    const { data: existingSols, error: fetchError } = await supabaseAdmin
      .from('solicitacoes')
      .select('id, data')
      .filter('data->>appointment_id', 'eq', appointmentId);

    if (fetchError) {
      console.error("[FastAction] Erro ao buscar solicitação:", fetchError);
    } else if (existingSols && existingSols.length > 0) {
      for (const sol of existingSols) {
        const newData = {
          ...sol.data,
          resolved_at: new Date().toISOString(),
          resolved_by: 'Action Push',
          resolve_comment: isApprove ? 'Aprovado via Notificação Push' : 'Recusado via Notificação Push'
        };

        const { error: solUpdateError } = await supabaseAdmin
          .from('solicitacoes')
          .update({ 
            status: solicitacaoResult,
            data: newData
          })
          .eq('id', sol.id);

        if (solUpdateError) {
          console.error(`[FastAction] Erro ao atualizar sol ${sol.id}:`, solUpdateError);
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[FastAction] Erro crítico:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
