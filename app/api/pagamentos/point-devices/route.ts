import { NextResponse } from 'next/server';

const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN || '';

export async function GET() {
  try {
    if (!MP_ACCESS_TOKEN) {
      return NextResponse.json({ error: 'MP_ACCESS_TOKEN não configurado no servidor (.env)' }, { status: 500 });
    }

    const response = await fetch('https://api.mercadopago.com/point/devices', {
      headers: { 
        'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json({ error: data.message || 'Falha ao buscar dispositivos no Mercado Pago' }, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Erro Point Discovery:', error);
    return NextResponse.json({ error: error.message || 'Erro Interno' }, { status: 500 });
  }
}
