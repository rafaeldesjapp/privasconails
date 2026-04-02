import { NextResponse } from 'next/server';
import { MercadoPagoConfig, Payment } from 'mercadopago';

// Note: The MercadoPago v2 SDK currently doesn't have a specific "Point" class in the high-level API.
// We'll use traditional fetch to call the Point API endpoints as per documented best practices.

const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN || '';

export async function POST(req: Request) {
  try {
    const { amount, device_id, description, appointmentIds, userId, clientName } = await req.json();

    if (!amount || !device_id || !appointmentIds) {
      return NextResponse.json({ error: 'Faltam parâmetros: amount, device_id ou appointmentIds' }, { status: 400 });
    }

    // Create Payment Intent for the Specific Device
    // Documentation: https://www.mercadopago.com.br/developers/pt/reference/integrations_api_point/_pos_device_id_payment-intents/post
    const response = await fetch(`https://api.mercadopago.com/point/integrations/payment-intents/${device_id}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': crypto.randomUUID()
      },
      body: JSON.stringify({
        amount: Number(amount),
        description: description || 'Recebimento por Aproximação',
        payment: {
          installments: 1,
          type: 'credit_card', // Focus on credit for approximation
        },
        // We can pass metadata to track the appointmentIds later via webhook
        additional_info: {
             external_reference: appointmentIds.join(','),
             print_on_terminal: true
        }
      })
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('Erro Point API:', result);
      return NextResponse.json({ error: result.message || 'Falha ao criar intenção no Point' }, { status: response.status });
    }

    // Returns the intent data. The user's phone/machine should now be active.
    return NextResponse.json({
        id: result.id,
        status: result.status,
    });

  } catch (error: any) {
    console.error('Erro no Point API Route:', error);
    return NextResponse.json({ error: error.message || 'Erro Interno' }, { status: 500 });
  }
}
