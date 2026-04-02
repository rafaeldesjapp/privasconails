import { NextResponse } from 'next/server';

const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN || '';

export async function GET() {
  try {
    if (!MP_ACCESS_TOKEN) {
      return NextResponse.json({ error: 'MP_ACCESS_TOKEN não configurado no servidor (.env.local)' }, { status: 500 });
    }

    // Lista de endpoints p/ encontrar dispositivos Point, Terminais e POS
    const endpoints = [
      'https://api.mercadopago.com/point/terminals',
      'https://api.mercadopago.com/v1/terminals',
      'https://api.mercadopago.com/point/devices',
      'https://api.mercadopago.com/point/integrations/devices',
      'https://api.mercadopago.com/pos'
    ];

    let allDevices: any[] = [];
    let diagnostic: any = {};

    for (const url of endpoints) {
        try {
            const resp = await fetch(url, {
                headers: { 'Authorization': `Bearer ${MP_ACCESS_TOKEN}` }
            });
            const data = await resp.json();
            diagnostic[url] = { status: resp.status };
            
            if (resp.ok) {
                // Mapear diferentes formatos de resposta (devices, results, data, arrays)
                const found = data.devices || data.results || data.data || (Array.isArray(data) ? data : (data.id ? [data] : null));
                if (found) {
                    const list = Array.isArray(found) ? found : [found];
                    // Adicionar origem p/ ajudar o usuário a identificar
                    const listWithSource = list.map((d: any) => ({ ...d, source_url: url }));
                    allDevices = [...allDevices, ...listWithSource];
                }
            } else {
                diagnostic[url].error = data.message || 'Erro desconhecido';
            }
        } catch (e: any) {
            diagnostic[url] = { error: e.message };
        }
    }

    // Filtrar duplicados por ID
    const uniqueDevices = Array.from(new Map(allDevices.map(d => [d.id, d])).values());

    if (uniqueDevices.length === 0) {
        return NextResponse.json({ 
            success: false,
            message: 'Nenhum dispositivo de Terminal ou Point encontrado.',
            diagnostic,
            tip: 'Verifique se você ativou o "Point Tap" (Venda por aproximação no celular) no seu App do Mercado Pago. O ID deve ser de um Terminal ou Point, não de um QR Code.'
        }, { status: 200 });
    }

    return NextResponse.json({
        success: true,
        devices: uniqueDevices
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
