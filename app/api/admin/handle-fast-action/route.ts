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

    console.log(`[FastAction] Iniciando ${action} para Agendamento: ${appointmentId}, Sol: ${solicitationId}`);

    // 1. Atualizar agendamento
    const { error: apError } = await supabaseAdmin
      .from('agendamentos')
      .update({ status: statusResult })
      .eq('id', appointmentId);

    if (apError) {
      console.error('[FastAction] Erro no agendamento:', apError);
      return NextResponse.json({ error: 'Erro ao atualizar agendamento' }, { status: 500 });
    }

    // 2. Atualizar solicitação vinculada
    if (solicitationId) {
      // Se temos o ID direto, usamos ele (mais rápido e seguro)
      const { data: sol, error: fetchError } = await supabaseAdmin
        .from('solicitacoes')
        .select('id, data')
        .eq('id', solicitationId)
        .single();

      if (sol) {
        await supabaseAdmin
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
          .eq('id', solicitationId);
      }
    } else {
      // Backup: buscar por appointment_id se o solicitationId não veio (para compatibilidade)
      const { data: sols } = await supabaseAdmin
        .from('solicitacoes')
        .select('id, data')
        .eq('status', 'pendente')
        .contains('data', { appointment_id: appointmentId });

      if (sols && sols.length > 0) {
        const sol = sols[0];
        await supabaseAdmin
          .from('solicitacoes')
          .update({ 
            status: solicitacaoResult,
            data: {
              ...sol.data,
              resolved_at: new Date().toISOString(),
              resolved_by: 'Action Push',
              resolve_comment: isApprove ? 'Aprovado via Push (Fallback)' : 'Recusado via Push (Fallback)'
            }
          })
          .eq('id', sol.id);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[FastAction] Erro fatal:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
