import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseKey);
    
    // Check the data
    const { data: configData, error: configError } = await configDataPromise(supabaseAdmin);
    
    // Attempt an upsert to see if it allows the service role
    const { data: upsertData, error: upsertError } = await supabaseAdmin
      .from('configuracoes')
      .upsert({ id: 'tabela_precos_test', valor: { test: true } }, { onConflict: 'id' })
      .select();

    // Trying to get policies by doing RPC or raw SQL? 
    // Usually only service_role can rpc, but maybe we can query pg_policies using rpc if we have one, otherwise we just try it directly.

    return NextResponse.json({
      configData,
      configError,
      upsertData,
      upsertError
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function configDataPromise(supabase: any) {
    return supabase.from('configuracoes').select('*').limit(5);
}
