import { NextResponse } from 'next/server';
import { MercadoPagoConfig, Preference } from 'mercadopago';

// Instância do MP
const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN || '',
});

export async function POST(req: Request) {
  try {
    const { items, payerEmail, appointmentIds } = await req.json();

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'Nenhum item na comanda.' }, { status: 400 });
    }

    const preference = new Preference(client);

    // Mapeia os items do carrinho para o formato do MP super estrito
    const mpItems = items.map((item: any) => ({
      id: "1",
      title: "Serviço",
      quantity: 1, 
      unit_price: Number(item.price),
      currency_id: 'BRL'
    }));

    const body = {
      items: mpItems,
    };

    const response = await preference.create({ body });

    return NextResponse.json({ id: response.id });
  } catch (error: any) {
    console.error('Erro ao criar preferência:', error);
    return NextResponse.json({ error: error.message || error.toString() || 'Internal server error' }, { status: 500 });
  }
}
