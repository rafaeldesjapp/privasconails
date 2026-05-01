import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Usar service role key para bypass RLS se necessário ao enviar notificações
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;

if (publicKey && privateKey) {
  webpush.setVapidDetails(
    'mailto:contato@privasconails.app',
    publicKey,
    privateKey
  );
}

export async function sendPushNotification(subscription: any, payload: any) {
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
    return { success: true };
  } catch (error: any) {
    console.error('Error sending push notification:', error);
    if (error.statusCode === 404 || error.statusCode === 410) {
      return { success: false, expired: true };
    }
    return { success: false, error: error.message };
  }
}

export async function notifyAdmins(payload: { title: string; body: string; url?: string }) {
  if (!publicKey || !privateKey) {
    console.error('VAPID keys not configured');
    return;
  }

  try {
    // 1. Buscar todos os admins/desenvolvedores
    const { data: admins } = await supabase
      .from('profiles')
      .select('id')
      .in('role', ['admin', 'desenvolvedor']);

    if (!admins || admins.length === 0) return;

    const adminIds = admins.map(a => a.id);

    // 2. Buscar inscrições desses admins
    const { data: subscriptions } = await supabase
      .from('push_subscriptions')
      .select('*')
      .in('user_id', adminIds);

    if (!subscriptions || subscriptions.length === 0) {
      console.log('No admin subscriptions found');
      return;
    }

    // 3. Enviar notificações em paralelo
    const results = await Promise.all(subscriptions.map(async (sub) => {
      const pushSub = {
        endpoint: sub.endpoint,
        keys: {
          auth: sub.auth,
          p256dh: sub.p256dh
        }
      };
      const res = await sendPushNotification(pushSub, payload);
      if (res.expired) {
        await supabase.from('push_subscriptions').delete().eq('id', sub.id);
      }
      return res;
    }));

    return results;
  } catch (err) {
    console.error('Error in notifyAdmins:', err);
  }
}

export async function notifyUser(userId: string, payload: { title: string; body: string; url?: string }) {
  if (!publicKey || !privateKey) return;

  try {
    const { data: subscriptions } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', userId);

    if (!subscriptions || subscriptions.length === 0) return;

    const results = await Promise.all(subscriptions.map(async (sub) => {
      const pushSub = {
        endpoint: sub.endpoint,
        keys: {
          auth: sub.auth,
          p256dh: sub.p256dh
        }
      };
      const res = await sendPushNotification(pushSub, payload);
      if (res.expired) {
        await supabase.from('push_subscriptions').delete().eq('id', sub.id);
      }
      return res;
    }));

    return results;
  } catch (err) {
    console.error('Error in notifyUser:', err);
  }
}

export async function notifyAdminsOfPending() {
  try {
    const { count, error } = await supabase
      .from('solicitacoes')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pendente');

    if (error) throw error;
    if (!count || count === 0) return;

    await notifyAdmins({
      title: '📢 Solicitações Pendentes',
      body: `Você possui ${count} solicitações aguardando resposta no sistema.`,
      url: '/solicitacoes'
    });
  } catch (err) {
    console.error('Error in notifyAdminsOfPending:', err);
  }
}
