import { NextResponse } from 'next/server';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { createClient } from '@supabase/supabase-js';

// Inicializa SDK do Mercado Pago
const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN || '',
});

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const paymentId = searchParams.get('paymentId');
    const appointmentIdsStr = searchParams.get('appointmentIds');
    const queryGateway = searchParams.get('gateway');

    if (!paymentId || !appointmentIdsStr) {
      return NextResponse.json({ error: 'Faltam parâmetros de consulta.' }, { status: 400 });
    }

    const appointmentIds = appointmentIdsStr.split(',');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Erro de infraestrutura (Supabase não configurado)' }, { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Buscar configs do banco
    const { data: configs } = await supabaseAdmin.from('configuracoes').select('id, valor');
    const activeGatewayObj = configs?.find((c: any) => c.id === 'ACTIVE_GATEWAY');
    const activeGateway = queryGateway || activeGatewayObj?.valor || 'mercado_pago';

    if (activeGateway === 'asaas') {
      const asaasApiKeyObj = configs?.find((c: any) => c.id === 'ASAAS_API_KEY');
      const asaasEnvObj = configs?.find((c: any) => c.id === 'ASAAS_ENV');

      const asaasApiKey = asaasApiKeyObj?.valor;
      const asaasEnv = asaasEnvObj?.valor || 'sandbox';

      if (!asaasApiKey) {
        return NextResponse.json({ error: 'Integração do Asaas não configurada.' }, { status: 400 });
      }

      const asaasBaseUrl = asaasEnv === 'production' 
        ? 'https://api.asaas.com/v3' 
        : 'https://api-sandbox.asaas.com/v3';

      const asaasHeaders = {
        'Content-Type': 'application/json',
        'access_token': asaasApiKey
      };

      const res = await fetch(`${asaasBaseUrl}/payments/${paymentId}`, {
        method: 'GET',
        headers: asaasHeaders
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Falha ao obter status do pagamento no Asaas: ${errText}`);
      }

      const result = await res.json();
      const isApproved = ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(result.status);

      if (isApproved) {
         const { error } = await supabaseAdmin
          .from('agendamentos')
          .update({ 
             status: 'concluido', 
             payment_method: 'online_asaas' 
          })
          .in('id', appointmentIds);

         await supabaseAdmin
          .from('transacoes')
          .update({ status: 'approved' })
          .eq('mp_id', paymentId);

         if (error) {
             console.error("Erro ao atualizar agendamentos no banco após aprovação Asaas:", error);
         }
      }

      return NextResponse.json({
          id: result.id,
          status: isApproved ? 'approved' : 'pending',
          status_detail: result.status
      });
    }

    // Instancia Pagamento no Mercado Pago
    const payment = new Payment(client);
    
    // Busca informações do Pagamento via ID
    const result = await payment.get({ id: paymentId });

    if (result.status === 'approved') {
        const { error } = await supabaseAdmin
         .from('agendamentos')
         .update({ 
            status: 'concluido', 
            payment_method: 'pix_online' 
         })
         .in('id', appointmentIds);

        await supabaseAdmin
         .from('transacoes')
         .update({ status: 'approved' })
         .eq('mp_id', paymentId);

        if (error) {
            console.error("Erro ao atualizar agendamentos no banco após aprovação PIX:", error);
        }
    }

    // Retorna o status validado para o Frontend do cliente reagir
    return NextResponse.json({
        id: result.id,
        status: result.status,
        status_detail: result.status_detail
    });

  } catch (error: any) {
    console.error('Erro na Checagem PIX do MercadoPago:', error);
    return NextResponse.json({ error: error.message || 'Erro na verificação' }, { status: 500 });
  }
}
