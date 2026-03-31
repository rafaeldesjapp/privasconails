import { NextResponse } from 'next/server';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { createClient } from '@supabase/supabase-js';

// Inicializa SDK do Mercado Pago
const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN || '',
});

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const { 
      transaction_amount, 
      token, 
      description, 
      installments, 
      payment_method_id, 
      issuer_id, 
      payer, 
      appointmentIds 
    } = body;

    // Validate request
    if (!transaction_amount || !appointmentIds || appointmentIds.length === 0) {
      return NextResponse.json({ error: 'Faltam parâmetros essenciais (Preço ou Comandas)' }, { status: 400 });
    }

    // Instancia Pagamento no Mercado Pago
    const payment = new Payment(client);
    
    // Configura idempotency para segurança do Cartão
    // Vamos gerar uma chave aleatória se não for repassada pelo header
    const idempotencyKey = req.headers.get('x-idempotency-key') || crypto.randomUUID();

    const requestBody: any = {
      transaction_amount: Number(transaction_amount),
      description: description || 'Serviços de Salão de Beleza',
      payment_method_id: payment_method_id,
      payer: {
        email: payer?.email || 'cliente@privasconails.com',
      }
    };

    if (token) requestBody.token = token;
    if (installments && !isNaN(Number(installments))) requestBody.installments = Number(installments);
    if (issuer_id) requestBody.issuer_id = issuer_id;
    if (payer?.identification && payer.identification.type && payer.identification.number) {
        requestBody.payer.identification = payer.identification;
    }

    const result = await payment.create({
      body: requestBody,
      requestOptions: {
        idempotencyKey: idempotencyKey
      }
    });

    // Validar aprovação MP
    if (result.status === 'approved') {
       // Se o pagamento no cartão for Aprovado na hora, baixamos a comanda imediatamente!
       const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
       const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

       if (supabaseUrl && supabaseServiceKey) {
           const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
             auth: { autoRefreshToken: false, persistSession: false }
           });
           
           await supabaseAdmin
            .from('agendamentos')
            .update({ 
               status: 'concluido', 
               payment_method: 'online' 
            })
            .in('id', appointmentIds);
       }
    }

    // Extrair dados do PIX se existirem
    const qr_code = result.point_of_interaction?.transaction_data?.qr_code;
    const qr_code_base64 = result.point_of_interaction?.transaction_data?.qr_code_base64;

    // Retorna para o Frontend reagir (seja approved, in_process, rejected, ou PIX pending)
    return NextResponse.json({
        id: result.id,
        status: result.status,
        status_detail: result.status_detail,
        qr_code: qr_code,
        qr_code_base64: qr_code_base64
    });

  } catch (error: any) {
    console.error('Erro no processamento do MercadoPago Brick:', error);
    return NextResponse.json({ error: error.message || 'Erro Interno no Processamento' }, { status: 500 });
  }
}
