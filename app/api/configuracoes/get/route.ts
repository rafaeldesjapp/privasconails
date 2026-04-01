import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Usamos a Service Role Key para ignorar todas as regras RLS do Supabase,
// pois precisamos garantir que CLIENTES consigam ler essas configurações 
// livremente sem serem bloqueados pelo banco (evita RLS nulo para public select).
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function GET() {
  try {
    const { data: configs, error } = await supabaseAdmin
      .from('configuracoes')
      .select('id, valor')
      .in('id', ['tabela_precos', 'whatsapp_studio']);

    if (error) {
       console.error("Erro RLS/Admin ao buscar configurações:", error);
       return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const payload: Record<string, any> = {};
    if (configs) {
      for (const c of configs) {
         payload[c.id] = c.valor;
      }
    }

    return NextResponse.json({ success: true, data: payload }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
