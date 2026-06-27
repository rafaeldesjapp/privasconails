import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const requestUrl = new URL(req.url);
  const code = requestUrl.searchParams.get('code');
  const errorParam = requestUrl.searchParams.get('error');

  const baseRedirectUrl = `${requestUrl.origin}/pagamentos`;

  if (errorParam || !code) {
    console.error('Erro de autorização Mercado Pago OAuth:', errorParam);
    return NextResponse.redirect(`${baseRedirectUrl}?mp_oauth=error&error_msg=${encodeURIComponent(errorParam || 'Código de autorização ausente.')}`);
  }

  try {
    // 1. Buscar as chaves Client ID e Client Secret do banco de dados
    const { data: configs, error: configError } = await supabaseAdmin
      .from('configuracoes')
      .select('id, valor')
      .in('id', ['MERCADO_PAGO_CLIENT_ID', 'MERCADO_PAGO_CLIENT_SECRET']);

    if (configError) {
      throw new Error(`Erro ao buscar credenciais do app no banco de dados: ${configError.message}`);
    }

    const clientId = configs?.find(c => c.id === 'MERCADO_PAGO_CLIENT_ID')?.valor;
    const clientSecret = configs?.find(c => c.id === 'MERCADO_PAGO_CLIENT_SECRET')?.valor;

    if (!clientId || !clientSecret) {
      throw new Error('As credenciais do aplicativo Mercado Pago (Client ID ou Client Secret) não estão cadastradas nas configurações.');
    }

    // Como a única URL de redirecionamento permitida no painel do Mercado Pago é a de produção do Vercel,
    // nós forçamos o redirect_uri do fluxo OAuth a ser sempre a de produção, tanto no local quanto em produção.
    const redirectUri = 'https://privasconails.vercel.app/api/pagamentos/mp-oauth';


    // 2. Fazer a chamada de troca de token para o Mercado Pago
    const tokenResponse = await fetch('https://api.mercadopago.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri
      })
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      throw new Error(`Erro na troca de token do Mercado Pago: ${errorText}`);
    }

    const tokenData = await tokenResponse.json();
    const sellerAccessToken = tokenData.access_token;
    const sellerPublicKey = tokenData.public_key;

    if (!sellerAccessToken || !sellerPublicKey) {
      throw new Error('Resposta de tokens vazia ou inválida do Mercado Pago.');
    }

    // 3. Salvar os tokens do vendedor no banco de dados
    const updates = [
      { id: 'MERCADO_PAGO_SELLER_ACCESS_TOKEN', valor: sellerAccessToken },
      { id: 'MERCADO_PAGO_SELLER_PUBLIC_KEY', valor: sellerPublicKey }
    ];

    for (const update of updates) {
      const { error: saveError } = await supabaseAdmin
        .from('configuracoes')
        .upsert(update);

      if (saveError) {
        throw new Error(`Erro ao salvar credenciais do vendedor no banco: ${saveError.message}`);
      }
    }

    return NextResponse.redirect(`${baseRedirectUrl}?mp_oauth=success`);
  } catch (err: any) {
    console.error('Erro no fluxo de redirecionamento Mercado Pago OAuth:', err);
    return NextResponse.redirect(`${baseRedirectUrl}?mp_oauth=error&error_msg=${encodeURIComponent(err.message || 'Erro inesperado')}`);
  }
}
