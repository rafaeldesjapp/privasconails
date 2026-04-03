import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Rota de Callback para a InfinitePay
// O aplicativo da InfinitePay abre esta URL após a venda ser concluída.
// Ex: /api/pagamentos/infinitepay-callback?ids=id1,id2&status=success
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const appointmentIdsStr = searchParams.get('ids');
    const status = searchParams.get('status'); // Alguns apps passam status

    if (!appointmentIdsStr) {
      return NextResponse.json({ error: 'Faltam IDs das comandas para atualização.' }, { status: 400 });
    }

    const appointmentIds = appointmentIdsStr.split(',');

    // Inicializa Supabase Admin (Bypass RLS)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (supabaseUrl && supabaseServiceKey) {
      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false }
      });

      // Atualiza os agendamentos para concluído
      const { error } = await supabaseAdmin
        .from('agendamentos')
        .update({ 
          status: 'concluido', 
          payment_method: 'card_infinitepay' 
        })
        .in('id', appointmentIds);

      if (error) {
        console.error("Erro ao atualizar agendamentos via InfinitePay Callback:", error);
      } else {
         // Registro na tabela de transações para auditoria
         // Se tivermos o valor, poderíamos registrar, mas o Deep Link comum não traz o valor no retorno de forma garantida sem API Key.
         // Vamos registrar o evento básico.
         await supabaseAdmin.from('transacoes').insert({
            client_name: 'PWA InfinitePay Tap',
            amount: 0, // Valor viria da API se fosse integrado via Webhook
            payment_method: 'card_infinitepay',
            status: 'approved',
            services_desc: 'Recebimento via Aproximação (Tap)'
         });
      }
    }

    // Redireciona o usuário de volta para a tela de Conta com sucesso
    // Usamos um parâmetro de sucesso para o frontend dar feedback visual
    return NextResponse.redirect(new URL('/conta?payment=success', req.url));

  } catch (error: any) {
    console.error('Erro no Callback da InfinitePay:', error);
    return NextResponse.json({ error: error.message || 'Erro Interno no Callback' }, { status: 500 });
  }
}
