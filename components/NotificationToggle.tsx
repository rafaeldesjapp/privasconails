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
      // Registrar Service Worker explicitamente (V8 para forçar atualização)
      const reg = await navigator.serviceWorker.register('/sw-v8.js', {
        scope: '/'
      });
      reg.update(); // Forçar verificação de atualização do SW
      setRegistration(reg);
      
      // Verificar se já existe inscrição
      const sub = await reg.pushManager.getSubscription();
      setSubscription(sub);
      setIsSubscribed(!!sub);
    } catch (err: any) {
      console.error('Erro ao verificar Service Worker:', err);
      setError('Service Worker não suportado ou bloqueado.');
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
      alert('O sistema de notificações ainda está carregando ou não é suportado neste navegador.');
      return;
    }
    setLoading(true);
    setError(null);

    try {
      // 1. Solicitar permissão de notificação explicitamente
      console.log('Solicitando permissão de notificação...');
      const permission = await Notification.requestPermission();
      
      if (permission !== 'granted') {
        alert('Permissão Negada: Para receber alertas, você precisa permitir as notificações nas configurações do seu navegador ou celular.');
        setLoading(false);
        return;
      }

      // 2. Gerar nova inscrição push
      console.log('Gerando inscrição push com VAPID...');
      if (!VAPID_PUBLIC_KEY) {
        throw new Error('Chave VAPID pública não encontrada no ambiente.');
      }

      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });

      // 3. Enviar para o servidor
      console.log('Enviando inscrição para o servidor...');
      const res = await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: sub,
          userId: user.id
        })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Erro ao salvar inscrição no banco de dados.');
      }

      setIsSubscribed(true);
      setSubscription(sub);
      
      // Chamar recap para enviar notificações de itens já pendentes
      fetch('/api/notifications/recap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      }).catch(err => console.error('Erro ao chamar recap:', err));

      alert('Sucesso! Você receberá alertas de novas solicitações diretamente no seu dispositivo.');
      
    } catch (err: any) {
      console.error('Erro na inscrição push:', err);
      alert('Erro: ' + (err.message || 'Não foi possível ativar as notificações. Tente novamente.'));
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
      alert('Notificações desativadas para este dispositivo.');
    } catch (err: any) {
      console.error('Erro ao desativar push:', err);
      alert('Erro ao desativar: ' + err.message);
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
  // Disparar recap ao entrar no sistema (apenas uma vez por sessão)
  useEffect(() => {
    if (user && (role === 'admin' || role === 'desenvolvedor') && isSubscribed) {
      const sessionKey = `recap_sent_${user.id}`;
      const alreadySent = sessionStorage.getItem(sessionKey);
      
      if (!alreadySent) {
        fetch('/api/notifications/recap', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id })
        })
        .then(() => {
          sessionStorage.setItem(sessionKey, 'true');
        })
        .catch(err => console.error('Erro ao disparar recap inicial:', err));
      }
    }
  }, [user, role, isSubscribed]);

  if (!user || (role !== 'admin' && role !== 'desenvolvedor')) return null;

  return (
    <div className="bg-white p-4 rounded-2xl border-2 border-pink-100 shadow-sm mb-6 flex items-center justify-between animate-in fade-in slide-in-from-top-2 duration-500">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${isSubscribed ? 'bg-pink-100 text-pink-600' : 'bg-slate-100 text-slate-400'}`}>
          {isSubscribed ? <Bell className="w-5 h-5 animate-bounce-slow" /> : <BellOff className="w-5 h-5" />}
        </div>
        <div>
          <h4 className="font-black text-slate-800 text-sm uppercase tracking-tight">Notificações Push</h4>
          <p className="text-xs text-slate-500 font-medium">Alertas em tempo real no seu celular</p>
        </div>
      </div>

      <button
        onClick={toggleNotifications}
        disabled={loading}
        className={`relative inline-flex h-7 w-12 items-center rounded-full transition-all focus:outline-none ring-offset-2 focus:ring-2 focus:ring-pink-500 ${
          isSubscribed ? 'bg-pink-500 shadow-inner' : 'bg-slate-200 shadow-inner'
        }`}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin mx-auto text-white" />
        ) : (
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-200 ease-in-out ${
              isSubscribed ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        )}
      </button>

      {error && (
        <div className="absolute -bottom-5 left-4">
           <p className="text-[10px] text-red-500 font-bold uppercase tracking-widest">{error}</p>
        </div>
      )}
    </div>
  );
}
