import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const requestUrl = new URL(req.url);
    const userId = requestUrl.searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'Parâmetro userId é obrigatório' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Erro de infraestrutura (Supabase)' }, { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // 1. Buscar mp_customer_id no perfil do usuário
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('mp_customer_id, email')
      .eq('id', userId)
      .single();

    if (profileError || !profile || !profile.mp_customer_id) {
      return NextResponse.json({ cardsIds: [] });
    }

    // 2. Buscar as chaves do Mercado Pago nas configurações
    const { data: configs } = await supabaseAdmin.from('configuracoes').select('id, valor');
    const sellerAccessToken = configs?.find((c: any) => c.id === 'MERCADO_PAGO_SELLER_ACCESS_TOKEN')?.valor 
      || process.env.MP_ACCESS_TOKEN;

    if (!sellerAccessToken) {
      return NextResponse.json({ cardsIds: [] });
    }

    // 3. Buscar os cartões cadastrados para esse cliente no Mercado Pago
    const cardsResponse = await fetch(`https://api.mercadopago.com/v1/customers/${profile.mp_customer_id}/cards`, {
      headers: {
        'Authorization': `Bearer ${sellerAccessToken}`
      }
    });

    if (cardsResponse.ok) {
      const cards = await cardsResponse.json();
      if (Array.isArray(cards)) {
        const cardsIds = cards.map((c: any) => c.id);
        return NextResponse.json({ cardsIds, mpCustomerId: profile.mp_customer_id });
      }
    }

    return NextResponse.json({ cardsIds: [], mpCustomerId: profile.mp_customer_id });
  } catch (err: any) {
    console.error('Erro ao buscar cartões salvos do cliente:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
