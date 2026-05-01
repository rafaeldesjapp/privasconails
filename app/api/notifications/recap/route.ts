import { NextResponse } from 'next/server';
import { notifyUser, notifyAdminsOfPending } from '@/lib/notifications';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    
    // Vercel envia o segredo no cabeçalho Authorization: Bearer <SECRET>
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new Response('Unauthorized', { status: 401 });
    }

    await notifyAdminsOfPending();
    return NextResponse.json({ success: true, mode: 'cron_daily' });
  } catch (err: any) {
    console.error('Error in recap GET API:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, secret } = body;

    // Se for uma chamada de CRON (automática)
    if (secret && secret === process.env.CRON_SECRET) {
      await notifyAdminsOfPending();
      return NextResponse.json({ success: true, mode: 'cron' });
    }

    // Se for uma chamada manual de um usuário específico
    if (userId) {
      const { count, error } = await supabase
        .from('solicitacoes')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pendente');

      if (error) throw error;

      if (count && count > 0) {
        await notifyUser(userId, {
          title: '📢 Pendências Encontradas',
          body: `Você possui ${count} solicitações aguardando resposta no sistema.`,
          url: '/solicitacoes'
        });
      }
      return NextResponse.json({ success: true, count: count || 0 });
    }

    return NextResponse.json({ error: 'Unauthorized or missing parameters' }, { status: 401 });
  } catch (err: any) {
    console.error('Error in recap API:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
