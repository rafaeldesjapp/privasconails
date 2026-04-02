import { NextResponse } from 'next/server';
import { MercadoPagoConfig, Preference } from 'mercadopago';

// Inicializa SDK do Mercado Pago
const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN || '',
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { total, items, customerEmail } = body;

    if (!total || !items || items.length === 0) {
      return NextResponse.json({ error: 'Faltam parâmetros essenciais para gerar a preferência' }, { status: 400 });
    }

    const preference = new Preference(client);

    // Build items array for Mercado Pago preference
    const preferenceItems = items.map((item: any) => ({
      id: item.id,
      title: item.service || 'Serviço de Salão',
      quantity: 1,
      unit_price: Number(item.price), // We receive price per item from frontend, or just a total. Let's rely on total for simplicity.
    }));

    // Or just a single consolidated item to avoid floating point math mismatch with frontend.
    const consolidatedItem = {
      id: 'comanda',
      title: 'Comanda de Serviços - Privasco Nails',
      quantity: 1,
      unit_price: Number(total),
    };

    const host = process.env.NEXT_PUBLIC_BASE_URL || 'https://privasconails.vercel.app';

    const result = await preference.create({
      body: {
        items: [consolidatedItem],
        payer: {
          email: customerEmail || 'cliente@privasconails.com'
        },
        external_reference: Array.isArray(body.appointmentIds) ? body.appointmentIds.join(',') : body.appointmentIds,
        metadata: {
          appointment_ids: body.appointmentIds,
          user_id: body.userId
        },
        back_urls: {
          success: `${host}/conta?status=approved`,
          failure: `${host}/conta?status=failure`,
          pending: `${host}/conta?status=pending`
        },
        auto_return: 'approved',
        statement_descriptor: 'PRIVASCO NAILS',
      }
    });

    return NextResponse.json({
      id: result.id,
      init_point: result.init_point,
    });

  } catch (error: any) {
    console.error('Erro ao gerar Preferência do MP:', error);
    return NextResponse.json({ error: error.message || 'Erro Interno ao gerar Preferência' }, { status: 500 });
  }
}
