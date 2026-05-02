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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && user) {
      checkSubscription();
    }
  }, [user]);

  async function checkSubscription() {
    try {
      // FORÇAR LIMPEZA: Remover qualquer Service Worker antigo
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (let reg of registrations) {
        if (!reg.active?.scriptURL.includes('sw-v8.js')) {
          console.log('Limpando SW antigo:', reg.active?.scriptURL);
          await reg.unregister();
        }
      }

      // Registrar o NOVO Service Worker V8
      const reg = await navigator.serviceWorker.register('/sw-v8.js', {
        scope: '/'
      });
      
      await reg.update();
      setRegistration(reg);
      
      const sub = await reg.pushManager.getSubscription();
      setSubscription(sub);
      setIsSubscribed(!!sub);
    } catch (err: any) {
      console.error('Erro ao verificar Service Worker:', err);
      setError('Erro ao carregar notificações V8.');
    }
  }

  async function toggleNotifications() {
    if (isSubscribed) {
      await unsubscribe();
    } else {
      await subscribe();
    }
  }

  async function subscribe() {
    if (!registration || !user) {
      alert('Aguarde o carregamento do sistema V8...');
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        alert('Permissão Negada.');
        setLoading(false);
        return;
      }

      if (!VAPID_PUBLIC_KEY) throw new Error('VAPID missing');

      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });

      const res = await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub, userId: user.id })
      });

      if (!res.ok) throw new Error('Erro no servidor');

      setIsSubscribed(true);
      setSubscription(sub);
      
      alert('Notificações V8 Ativadas!');
    } catch (err: any) {
      alert('Erro: ' + err.message);
      setError(err.message);
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
      alert('Erro: ' + err.message);
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

  return (
    <div className="bg-white p-4 rounded-2xl border-2 border-pink-100 shadow-sm mb-6 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isSubscribed ? 'bg-pink-100 text-pink-600' : 'bg-slate-100 text-slate-400'}`}>
          {isSubscribed ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
        </div>
        <div>
          <h4 className="font-black text-slate-800 text-sm uppercase tracking-tight">Notificações Push (V8)</h4>
          <p className="text-xs text-slate-500 font-medium">Versão forçada de alta estabilidade</p>
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
