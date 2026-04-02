import { NextResponse } from 'next/server';

const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN || '';

export async function POST(req: Request) {
  try {
    const { amount, device_id, description, appointmentIds, userId, clientName } = await req.json();

    if (!amount || !device_id || !appointmentIds) {
      return NextResponse.json({ error: 'Faltam parâmetros: amount, device_id ou appointmentIds' }, { status: 400 });
    }

    // Version 3 (Common): POST to root and device_id in body
    // Some documentation suggests this is the most compatible version for Cloud Point
    const response = await fetch(`https://api.mercadopago.com/point/integrations/payment-intents`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': crypto.randomUUID()
      },
      body: JSON.stringify({
        amount: Number(amount),
        description: description || 'Recebimento por Aproximação',
        device_id: device_id, // Passed in Body
        payment: {
          installments: 1,
          type: 'credit_card',
        },
        additional_info: {
             external_reference: appointmentIds.join(','),
             print_on_terminal: true
        }
      })
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('Erro Point API (V2):', result);
      // If it fails with 404, we try the URL version as backup
      if (response.status === 404) {
          const fallback = await fetch(`https://api.mercadopago.com/point/integrations/devices/${device_id}/payment-intents`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
              'Content-Type': 'application/json',
              'X-Idempotency-Key': crypto.randomUUID()
            },
            body: JSON.stringify({
              amount: Number(amount),
              description: description || 'Recebimento por Aproximação',
              payment: { installments: 1, type: 'credit_card' },
              additional_info: { external_reference: appointmentIds.join(','), print_on_terminal: true }
            })
          });
          const fallbackResult = await fallback.json();
          if (fallback.ok) return NextResponse.json(fallbackResult);
          return NextResponse.json({ error: fallbackResult.message || 'ID de dispositivo não reconhecido pelo Mercado Pago como Point/Tap.' }, { status: fallback.status });
      }
      return NextResponse.json({ error: result.message || 'Falha ao criar intenção no Point' }, { status: response.status });
    }

    return NextResponse.json({ id: result.id, status: result.status });

  } catch (error: any) {
    console.error('Erro no Point API Route:', error);
    return NextResponse.json({ error: error.message || 'Erro Interno' }, { status: 500 });
  }
}
