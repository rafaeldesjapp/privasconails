import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, valor } = body;

    if (!id || valor === undefined) {
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    
    // Usando o service_role para ignorar o RLS
    const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

    // Tentamos fazer o update primeiro
    const { data: updateData, error: updateError } = await supabaseAdmin
      .from('configuracoes')
      .update({ valor })
      .eq('id', id)
      .select();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Se o update não afetou nenhuma linha (a linha não existe), fazemos o insert
    if (!updateData || updateData.length === 0) {
      const { data: insertData, error: insertError } = await supabaseAdmin
        .from('configuracoes')
        .insert({ id, valor })
        .select();

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, data: insertData });
    }

    return NextResponse.json({ success: true, data: updateData });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
