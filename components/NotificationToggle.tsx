'use client';

import { useEffect, useState } from 'react';
import { useSupabaseAuth } from '@/hooks/use-supabase';
import { Bell, BellOff, Loader2 } from 'lucide-react';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

export default function NotificationToggle() {
  const { user, role } = useSupabaseAuth();
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && user) {
      // Registro permanente do Service Worker consolidado
      navigator.serviceWorker.register('/sw.js')
        .then(reg => {
          setRegistration(reg);
          return reg.pushManager.getSubscription();
        })
        .then(sub => {
          setSubscription(sub);
          setIsSubscribed(!!sub);
        })
        .catch(err => console.error('Erro ao registrar notificações:', err));
    }
  }, [user]);

  async function toggleNotifications() {
    if (isSubscribed) {
      await unsubscribe();
    } else {
      await subscribe();
    }
  }

  async function subscribe() {
    if (!registration || !user) return;
    setLoading(true);

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        alert('Permissão de notificação negada.');
        setLoading(false);
        return;
      }

      if (!VAPID_PUBLIC_KEY) throw new Error('VAPID_PUBLIC_KEY não configurada');

      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });

      const res = await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub, userId: user.id })
      });

      if (!res.ok) throw new Error('Erro ao salvar no servidor');

      setIsSubscribed(true);
      setSubscription(sub);
      alert('Notificações ativadas com sucesso!');
    } catch (err: any) {
      console.error(err);
      alert('Erro: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function unsubscribe() {
    if (!subscription) return;
    setLoading(true);
    try {
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();
      await fetch('/api/notifications/subscribe', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint })
      });
      setIsSubscribed(false);
      setSubscription(null);
      alert('Notificações desativadas.');
    } catch (err: any) {
      alert('Erro ao desativar.');
    } finally {
      setLoading(false);
    }
  }

  function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  if (!user || (role !== 'admin' && role !== 'desenvolvedor')) return null;

  return (
    <div className="bg-white p-4 rounded-2xl border-2 border-pink-100 shadow-sm mb-6 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isSubscribed ? 'bg-pink-100 text-pink-600' : 'bg-slate-100 text-slate-400'}`}>
          {isSubscribed ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
        </div>
        <div>
          <h4 className="font-black text-slate-800 text-sm uppercase tracking-tight">Notificações Push</h4>
          <p className="text-xs text-slate-500 font-medium">Alertas em tempo real no celular</p>
        </div>
      </div>

      <button
        onClick={toggleNotifications}
        disabled={loading}
        className={`relative inline-flex h-7 w-12 items-center rounded-full transition-all ${isSubscribed ? 'bg-pink-500' : 'bg-slate-200'}`}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin mx-auto text-white" />
        ) : (
          <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform ${isSubscribed ? 'translate-x-6' : 'translate-x-1'}`} />
        )}
      </button>
    </div>
  );
}
