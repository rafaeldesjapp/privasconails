import { NextResponse } from 'next/server';

const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN || '';

export async function GET() {
  try {
    if (!MP_ACCESS_TOKEN) {
      return NextResponse.json({ error: 'MP_ACCESS_TOKEN não configurado no servidor (.env.local)' }, { status: 500 });
    }

    // Tentamos múltiplos endpoints para encontrar onde os dispositivos estão registrados
    const endpoints = [
      'https://api.mercadopago.com/point/devices',
      'https://api.mercadopago.com/point/integrations/devices',
      'https://api.mercadopago.com/pos',
      'https://api.mercadopago.com/v1/devices'
    ];

    let allDevices: any[] = [];
    let diagnostic: any = {};

    for (const url of endpoints) {
        try {
            const resp = await fetch(url, {
                headers: { 'Authorization': `Bearer ${MP_ACCESS_TOKEN}` }
            });
            const data = await resp.json();
            diagnostic[url] = { status: resp.status, data };
            
            if (resp.ok) {
                const found = data.devices || data.results || (Array.isArray(data) ? data : null);
                if (found) {
                    const list = Array.isArray(found) ? found : [found];
                    allDevices = [...allDevices, ...list];
                }
            }
        } catch (e: any) {
            diagnostic[url] = { error: e.message };
        }
    }

    if (allDevices.length === 0) {
        return NextResponse.json({ 
            success: false,
            message: 'Nenhum dispositivo encontrado automaticamente.',
            diagnostic,
            tip: 'Certifique-se de que o "Point Tap" está ativo no seu App do Mercado Pago. O Device ID também pode ser encontrado no App em: Configurações > Point.'
        }, { status: 200 });
    }

    return NextResponse.json({
        success: true,
        devices: allDevices
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
