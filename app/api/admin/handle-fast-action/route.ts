import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { appointmentId, action } = await req.json();

    if (!appointmentId) {
      return NextResponse.json({ error: 'Nenhum agendamento selecionado' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    
    if (!supabaseServiceKey) {
      console.error('[FastAction] SERVICE_ROLE_KEY não configurada!');
      return NextResponse.json({ error: 'Configuração de servidor incompleta' }, { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const isApprove = action === 'approve';
    const statusResult = isApprove ? 'agendado' : 'cancelado';
    const solicitacaoResult = isApprove ? 'aprovado' : 'rejeitado';

    console.log(`[FastAction] Iniciando ${action} para ${appointmentId}`);

    // 1. Atualizar agendamento
    const { data: updatedAg, error: apError } = await supabaseAdmin
      .from('agendamentos')
      .update({ status: statusResult })
      .eq('id', appointmentId)
      .select();

    if (apError) {
      console.error('[FastAction] Erro no agendamento:', apError);
      return NextResponse.json({ error: 'Erro ao atualizar agendamento' }, { status: 500 });
    }

    // 2. Buscar solicitação vinculada
    // Tentamos buscar por appointment_id dentro do JSONB de várias formas
    const { data: sols, error: fetchError } = await supabaseAdmin
      .from('solicitacoes')
      .select('id, data')
      .eq('status', 'pendente')
      .contains('data', { appointment_id: appointmentId });

    if (fetchError) {
      console.error('[FastAction] Erro ao buscar solicitação:', fetchError);
    }

    let updatedSolId = null;
    if (sols && sols.length > 0) {
      const sol = sols[0];
      updatedSolId = sol.id;
      
      const { error: solUpdateError } = await supabaseAdmin
        .from('solicitacoes')
        .update({ 
          status: solicitacaoResult,
          data: {
            ...sol.data,
            resolved_at: new Date().toISOString(),
            resolved_by: 'Action Push',
            resolve_comment: isApprove ? 'Aprovado via Push' : 'Recusado via Push'
          }
        })
        .eq('id', sol.id);

      if (solUpdateError) console.error('[FastAction] Erro no update da sol:', solUpdateError);
    } else {
      console.warn('[FastAction] Nenhuma solicitação pendente encontrada para este ID.');
      
      // Tentativa de backup: buscar sem o filtro de status pendente caso já tenha sido processada ou o status esteja diferente
      const { data: solsBackup } = await supabaseAdmin
        .from('solicitacoes')
        .select('id')
        .filter('data->>appointment_id', 'eq', appointmentId);
        
      if (solsBackup && solsBackup.length > 0) {
         updatedSolId = solsBackup[0].id + ' (backup)';
      }
    }

    return NextResponse.json({ 
      success: true, 
      action, 
      agUpdated: (updatedAg?.length || 0) > 0,
      solId: updatedSolId
    });
  } catch (error: any) {
    console.error('[FastAction] Erro fatal:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
