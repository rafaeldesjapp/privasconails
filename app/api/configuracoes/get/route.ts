import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Usamos a Service Role Key para ignorar todas as regras RLS do Supabase,
// pois precisamos garantir que CLIENTES consigam ler essas configurações 
// livremente sem serem bloqueados pelo banco (evita RLS nulo para public select).
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { data: configs, error } = await supabaseAdmin
      .from('configuracoes')
      .select('id, valor')
      .in('id', [
        'tabela_precos',
        'whatsapp_studio',
        'ACTIVE_GATEWAY',
        'MERCADO_PAGO_ACCESS_TOKEN',
        'MERCADO_PAGO_PUBLIC_KEY',
        'MERCADO_PAGO_SELLER_ACCESS_TOKEN',
        'MERCADO_PAGO_SELLER_PUBLIC_KEY',
        'ASAAS_API_KEY'
      ]);

    if (error) {
       console.error("Erro RLS/Admin ao buscar configurações:", error);
       return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const payload: Record<string, any> = {};
    let hasMercadoPagoAppToken = false;
    let hasMercadoPagoSellerToken = false;
    let hasAsaas = false;
    let devPublicKey = '';
    let sellerPublicKey = '';

    if (configs) {
      for (const c of configs) {
         if (c.id === 'MERCADO_PAGO_ACCESS_TOKEN') {
           hasMercadoPagoAppToken = !!c.valor;
         } else if (c.id === 'MERCADO_PAGO_SELLER_ACCESS_TOKEN') {
           hasMercadoPagoSellerToken = !!c.valor;
         } else if (c.id === 'ASAAS_API_KEY') {
           hasAsaas = !!c.valor;
         } else if (c.id === 'MERCADO_PAGO_PUBLIC_KEY') {
           devPublicKey = c.valor || '';
         } else if (c.id === 'MERCADO_PAGO_SELLER_PUBLIC_KEY') {
           sellerPublicKey = c.valor || '';
         } else {
           payload[c.id] = c.valor;
         }
      }
    }
    
    payload.hasMercadoPago = hasMercadoPagoAppToken || hasMercadoPagoSellerToken;
    payload.hasAsaas = hasAsaas;
    payload.mpPublicKey = sellerPublicKey || devPublicKey || process.env.NEXT_PUBLIC_MP_PUBLIC_KEY || '';

    return NextResponse.json({ success: true, data: payload }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
