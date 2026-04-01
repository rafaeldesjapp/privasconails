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

    if (!paymentId || !appointmentIdsStr) {
      return NextResponse.json({ error: 'Faltam parâmetros de consulta.' }, { status: 400 });
    }

    const appointmentIds = appointmentIdsStr.split(',');

    // Instancia Pagamento no Mercado Pago
    const payment = new Payment(client);
    
    // Busca informações do Pagamento via ID
    const result = await payment.get({ id: paymentId });

    if (result.status === 'approved') {
       const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
       const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

       if (supabaseUrl && supabaseServiceKey) {
           // Usando o supabaseAdmin para bypass de RLS pois o hook do MercadoPago precisa fechar a conta do cliente garantidamente
           const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
             auth: { autoRefreshToken: false, persistSession: false }
           });
           
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
               // Mesmo com erro de bd ainda retornará o payload para notificar cliente
           }
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
