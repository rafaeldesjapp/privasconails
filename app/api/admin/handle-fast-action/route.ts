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
    const { error: apError } = await supabaseAdmin
      .from('agendamentos')
      .update({ status: statusResult })
      .eq('id', appointmentId);

    if (apError) throw apError;

    // 2. Atualizar solicitação relacionada
    const { error: solError } = await supabaseAdmin
      .from('solicitacoes')
      .update({ 
        status: solicitacaoResult,
        data: {
          resolved_at: new Date().toISOString(),
          resolved_by: 'Action Push',
          resolve_comment: isApprove ? 'Aprovado via Notificação Push' : 'Recusado via Notificação Push'
        }
      })
      .filter('data->>appointment_id', 'eq', appointmentId);

    if (solError) console.error("Erro ao atualizar solicitação:", solError);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Erro na ação rápida:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
