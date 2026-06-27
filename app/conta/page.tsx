'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSupabaseAuth } from '@/hooks/use-supabase';
import { useSearchParams, useRouter } from 'next/navigation';
import { AnimatePresence } from 'framer-motion';
import Auth from '@/components/Auth';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import { supabase } from '@/lib/supabase';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import PaymentModal from '@/components/PaymentModal';
import { 
  Receipt, 
  Users, 
  AlertCircle,
  Banknote,
  Search,
  MessageCircleQuestion,
  X,
  CreditCard,
  CheckCircle2,
  Wallet as WalletIcon,
  Smartphone,
  History,
  Zap,
  RotateCcw,
  RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { initMercadoPago, Payment, Wallet } from '@mercadopago/sdk-react';

// Inicializa o Mercado Pago SDK dinamicamente no cliente via useEffect quando a chave pública é carregada.
// initMercadoPago(process.env.NEXT_PUBLIC_MP_PUBLIC_KEY || 'TEST-33923f17-b080-455b-bfb3-cd98decf5960', { locale: 'pt-BR' });

// Utilizando a engine do Planner
const parseServicesObj = (str: string) => {
  const parts = str.split(' + ');
  return parts.map(p => {
    const match = p.match(/^(\d+)x\s+(.*)$/);
    if (match) {
      return { qty: Number(match[1]), name: match[2] };
    }
    return { qty: 1, name: p };
  });
};

export default function ContaPage() {
  return (
    <Suspense fallback={null}>
      <ContaContent />
    </Suspense>
  );
}

function ContaContent() {
  const { user, role, loading: authLoading } = useSupabaseAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const isStaff = role === 'admin' || role === 'desenvolvedor';
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  const [viewState, setViewState] = useState<'loading'|'select_client'|'bill'>('loading');
  const [clients, setClients] = useState<any[]>([]);
  const [selectedClient, setSelectedClient] = useState<{id: string, name: string} | null>(null);
  const [search, setSearch] = useState('');
  
  const [billingItems, setBillingItems] = useState<any[]>([]);
  const [pricesLookup, setPricesLookup] = useState<Record<string, number>>({});
  
  const [total, setTotal] = useState(0);

  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [disputeMessage, setDisputeMessage] = useState('');
  const [submittingDispute, setSubmittingDispute] = useState(false);
  const [selectedDisputeItems, setSelectedDisputeItems] = useState<string[]>([]);
  
  const [paymentAppointmentId, setPaymentAppointmentId] = useState<string | null>(null);

  // Novos Estados de Pagamento
  const [allowTab, setAllowTab] = useState(false);
  const [showPaymentOptions, setShowPaymentOptions] = useState(false);
  const [pixData, setPixData] = useState<{qr_code: string, qr_code_base64: string, payment_id?: string, gateway?: string} | null>(null);
  const [creatingPreference, setCreatingPreference] = useState(false);
  const [walletPreferenceId, setWalletPreferenceId] = useState<string | null>(null);
  const [selectedInstallments, setSelectedInstallments] = useState(1);
  const [activeGateway, setActiveGateway] = useState('mercado_pago');
  const [selectedGateway, setSelectedGateway] = useState<'mercado_pago' | 'asaas'>('mercado_pago');
  const [hasMercadoPago, setHasMercadoPago] = useState(false);
  const [hasAsaas, setHasAsaas] = useState(false);
  const [mpPublicKey, setMpPublicKey] = useState('');
  const showGatewaySwitcher = activeGateway === 'parallel' && hasMercadoPago && hasAsaas;
  const currentGateway = showGatewaySwitcher ? selectedGateway : activeGateway;
  const [isPointLoading, setIsPointLoading] = useState(false);
  const [showSmartModal, setShowSmartModal] = useState(false);
  const [smartPayData, setSmartPayData] = useState<{
    amountDisplay: string;      // "R$ 1,00"
    amountRaw: string;          // "1,00" (para colar no campo)
    amountCents: number;        // 100 (centavos)
    detectedOS: 'ios' | 'android' | 'unknown';
    // Links baseados no novo path /infinitetap-app
    universalLink: string;      // https://app.infinitepay.io/infinitetap-app?...
    // Android: intents específicos para abertura forçada
    android_intent_a: string;
    android_intent_b: string;
    android_intent_c: string;
  } | null>(null);
  const [showOverrideOS, setShowOverrideOS] = useState(false); // Alternar visualização entre iOS/Android se falhar

  const [isPolling, setIsPolling] = useState(false);
  const [showManualSteps, setShowManualSteps] = useState(false);

  // Estados do formulário de cartão de crédito transparente Asaas
  const [cardHolderName, setCardHolderName] = useState('');
  const [savedCpf, setSavedCpf] = useState('');
  const [savedCardToken, setSavedCardToken] = useState('');
  const [savedCardBrand, setSavedCardBrand] = useState('');
  const [savedCardLastDigits, setSavedCardLastDigits] = useState('');
  const [useSavedCard, setUseSavedCard] = useState(false);
  const [saveNewCard, setSaveNewCard] = useState(true);
  const [mpCardsIds, setMpCardsIds] = useState<string[]>([]);
  const [mpCustomerId, setMpCustomerId] = useState('');
  
  useEffect(() => {
    if (mpPublicKey) {
      initMercadoPago(mpPublicKey, { locale: 'pt-BR' });
    }
  }, [mpPublicKey]);
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardCpf, setCardCpf] = useState('');
  const [cardCep, setCardCep] = useState('');
  const [cardAddressNum, setCardAddressNum] = useState('');
  const [cardPhone, setCardPhone] = useState('');

  const handlePointPayment = async () => {
    try {
        setIsPointLoading(true);
        setShowManualSteps(false);
        
        const amountDisplay = total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const amountRaw = total.toFixed(2).replace('.', ',');
        const amountCents = Math.round(total * 100);
        
        const baseUrl = window.location.origin;
        const billingIds = billingItems.map(b => b.id).join(',');
        const resultUrl = `${baseUrl}/conta?payment=success&ids=${billingIds}`;
        const encodedResult = encodeURIComponent(resultUrl);
        
        // ── DETECÇÃO DE SISTEMA ────────────────────────────────────────────────
        const ua = navigator.userAgent.toLowerCase();
        let detectedOS: 'ios' | 'android' | 'unknown' = 'unknown';
        if (/iphone|ipad|ipod/.test(ua)) detectedOS = 'ios';
        else if (/android/.test(ua)) detectedOS = 'android';

        // ── LINKS UNIFICADOS (/infinitetap-app) ───────────────────────────────
        // Este path foi descoberto como o ponto oficial de entrada do Tap to Pay
        const tapBase = `https://app.infinitepay.io/infinitetap-app`;
        const universalLink = `${tapBase}?amount=${amountCents}&result_url=${encodedResult}`;
        
        // ── ANDROID: Intensificados (Intents) ──────────────────────────────────
        const pkg = 'io.cloudwalk.infinitepaydash';
        const fallback = encodeURIComponent('https://play.google.com/store/apps/details?id=' + pkg);
        
        const android_intent_a = `intent://infinitetap-app?amount=${amountCents}&result_url=${encodedResult}#Intent;scheme=https;package=${pkg};S.browser_fallback_url=${fallback};end;`;
        const android_intent_b = `intent://vender?amount=${amountCents}&result_url=${encodedResult}#Intent;scheme=infinitepay;package=${pkg};S.browser_fallback_url=${fallback};end;`;
        const android_intent_c = `intent://charge?amount=${amountCents}&result_url=${encodedResult}#Intent;scheme=infinitepay;package=${pkg};S.browser_fallback_url=${fallback};end;`;

        setSmartPayData({ 
            amountDisplay,
            amountRaw,
            amountCents,
            detectedOS,
            universalLink,
            android_intent_a,
            android_intent_b,
            android_intent_c,
        });
        
        setShowOverrideOS(false); // Resetar se abrir novo modal

        
        setShowSmartModal(true);
        startPolling(); 
    } catch (error: any) {
        alert("Erro no Recebimento: " + (error.message || "Erro desconhecido"));
    } finally {
        setIsPointLoading(false);
    }
  };

  const handleManualConfirm = async () => {
    if (!confirm("Confirmar que você já recebeu o pagamento no seu aplicativo da InfinitePay?")) return;
    
    try {
        const billingIds = billingItems.map(b => b.id);
        const { error } = await supabase
            .from('agendamentos')
            .update({ status: 'concluido', payment_method: 'card_infinitepay' })
            .in('id', billingIds);
            
        if (error) throw error;
        
        setShowSmartModal(false);
        setSmartPayData(null);
        alert("Comanda encerrada com sucesso!");
        if (role === 'admin' || role === 'desenvolvedor') {
            setSelectedClient(null);
            setViewState('select_client');
        } else {
            fetchBill(user!.id);
        }
    } catch (e: any) {
        alert("Erro ao confirmar manualmente: " + e.message);
    }
  };

  const startPolling = () => {
    if (isPolling) return;
    setIsPolling(true);
    const billingIds = billingItems.map(b => b.id);
    
    const interval = setInterval(async () => {
        // Consultar status atualizado no banco
        const { data, error } = await supabase
            .from('agendamentos')
            .select('status')
            .in('id', billingIds);
            
        if (data && data.every((a: any) => a.status === 'concluido' || a.status === 'pago')) {
            clearInterval(interval);
            setIsPolling(false);
            setShowSmartModal(false);
            setSmartPayData(null);
            alert("Recebimento Confirmado com Sucesso!");
            if (role === 'admin' || role === 'desenvolvedor') {
                setSelectedClient(null);
                setViewState('select_client');
            } else {
                fetchBill(user!.id);
            }
        }
        if (error) console.error("Erro polling:", error);
    }, 5000);

    // Timeout de 10 min p/ parar polling
    setTimeout(() => {
        clearInterval(interval);
        setIsPolling(false);
    }, 600000);
  };


  const loadWalletPreference = async () => {
    try {
      setCreatingPreference(true);
      const req = await fetch('/api/pagamentos/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ total, items: billingItems, customerEmail: user?.email })
      });
      const data = await req.json();
      if (data.id) setWalletPreferenceId(data.id);
      else alert("Falha ao gerar link Mercado Pago: " + (data.error || "Erro"));
    } catch (e: any) {
      alert("Erro ao conectar com Mercado Pago.");
    } finally {
      setCreatingPreference(false);
    }
  };

  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    if (pixData?.payment_id && billingItems.length > 0) {
      intervalId = setInterval(async () => {
        try {
          const apIds = billingItems.map(b => b.id).join(',');
          const req = await fetch(`/api/pagamentos/check-status?paymentId=${pixData.payment_id}&appointmentIds=${apIds}&gateway=${pixData.gateway || currentGateway}`);
          
          if (req.ok) {
            const res = await req.json();
            
            if (res.status === 'approved') {
               clearInterval(intervalId);
               alert('Pagamento Confirmado com Sucesso!');
               setPixData(null);
               
               if (role === 'admin' || role === 'desenvolvedor') {
                 setSelectedClient(null);
                 setViewState('select_client');
               } else {
                 if (user) fetchBill(user.id);
               }
            }
          }
        } catch(e) {
          console.error("Erro automação PIX", e);
        }
      }, 5000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [pixData, billingItems, role, user, currentGateway]);

  useEffect(() => {
    if (!user) return;
    
    // Detecta se o usuário voltou da InfinitePay com sucesso
    const paymentStatus = searchParams.get('payment');
    if (paymentStatus === 'success') {
       alert("Pagamento InfinitePay Confirmado com Sucesso!");
       // Limpa a URL para não repetir o alerta
       router.replace('/conta');
       if (role === 'admin' || role === 'desenvolvedor') {
          setSelectedClient(null);
          setViewState('select_client');
       } else {
          fetchBill(user.id);
       }
    }

    loadPrices();
    
    if (role === 'admin' || role === 'desenvolvedor') {
      loadClients();
      setViewState('select_client');
    } else if (role === 'cliente') {
      setSelectedClient({ id: user.id, name: user.user_metadata?.full_name || user.email });
      setViewState('bill');
      fetchBill(user.id);
    }
  }, [user, role, searchParams, router]);

  const loadPrices = async () => {
    // Categorias padrão servindo como fallback caso ocorra erro
    const DEFAULT_CATEGORIES = [
      { category: 'Unhas Simples', items: [{name: 'Mão', price: 30}, {name: 'Pé', price: 30}, {name: 'Pé e Mão Simples', price: 50}, {name: 'Pé e Mão Decorado', price: 55}] },
      { category: 'Alongamento', items: [{name: 'Postiça Realista', price: 60}, {name: 'Banho de Gel', price: 80}, {name: 'Acrigel', price: 129}, {name: 'Fibra de Vidro', price: 160}] },
      { category: 'Manutenções e Extra', items: [{name: 'Manutenção em Gel', price: 50}, {name: 'Manutenção em Acrigel', price: 90}, {name: 'Manutenção em Fibra', price: 130}, {name: 'Reposição de Unha (UN)', price: 15}] }
    ];

    const lookup: Record<string, number> = {};
    const processCategories = (cats: any[]) => {
      cats.forEach((cat: any) => {
        if (cat.items) {
          cat.items.forEach((it: any) => { lookup[it.name] = Number(it.price); });
        } else if (cat.itens) {
          cat.itens.forEach((it: any) => { lookup[it.nome] = Number(it.preco); });
        }
      });
    };

    try {
      const response = await fetch('/api/configuracoes/get', { cache: 'no-store' });
      const res = await response.json();

      let dataValor = res?.data?.tabela_precos;
      const activeGateVal = res?.data?.ACTIVE_GATEWAY;
      if (activeGateVal) {
         setActiveGateway(activeGateVal);
         if (activeGateVal === 'asaas' || activeGateVal === 'mercado_pago') {
            setSelectedGateway(activeGateVal);
         }
      }
      setHasMercadoPago(!!res?.data?.hasMercadoPago);
      setHasAsaas(!!res?.data?.hasAsaas);
      setMpPublicKey(res?.data?.mpPublicKey || '');
      
      if (typeof dataValor === 'string') {
         try {
           dataValor = JSON.parse(dataValor);
         } catch(e) {}
      }

      if (dataValor && Array.isArray(dataValor)) {
        processCategories(dataValor);
      } else {
        processCategories(DEFAULT_CATEGORIES);
      }
    } catch(err) {
      console.error('Erro ao buscar tabela:', err);
      processCategories(DEFAULT_CATEGORIES);
    }
    
    setPricesLookup(lookup);
  };

  const loadClients = async () => {
    const { data } = await supabase.from('profiles').select('id, full_name, email').eq('role', 'cliente').order('full_name');
    if (data) setClients(data);
  };

  const fetchBill = async (targetId: string) => {
    setViewState('loading');
    
    // Busca a permissão de fiado, CPF e dados de cartão salvo do usuário
    const { data: profile } = await supabase
      .from('profiles')
      .select('allow_tab, cpf, asaas_card_token, asaas_card_brand, asaas_card_last_digits, mp_customer_id')
      .eq('id', targetId)
      .single();
      
    if (profile) {
      if (profile.allow_tab) setAllowTab(true);
      else setAllowTab(false);
      
      setSavedCpf(profile.cpf || '');
      setSavedCardToken(profile.asaas_card_token || '');
      setSavedCardBrand(profile.asaas_card_brand || '');
      setSavedCardLastDigits(profile.asaas_card_last_digits || '');
      
      if (profile.asaas_card_token) {
        setUseSavedCard(true);
      } else {
        setUseSavedCard(false);
      }
      
      if (profile.cpf) {
        setCardCpf(profile.cpf);
      } else {
        setCardCpf('');
      }

      let mpId = profile.mp_customer_id || '';
      setMpCustomerId(mpId);
      
      if (mpId) {
        try {
          const cardsRes = await fetch(`/api/pagamentos/get-customer-cards?userId=${targetId}`);
          if (cardsRes.ok) {
            const cardsData = await cardsRes.json();
            setMpCardsIds(cardsData.cardsIds || []);
          } else {
            setMpCardsIds([]);
          }
        } catch (e) {
          console.error("Erro ao buscar cartões MP:", e);
          setMpCardsIds([]);
        }
      } else {
        setMpCardsIds([]);
      }
    } else {
      setAllowTab(false);
      setSavedCpf('');
      setSavedCardToken('');
      setSavedCardBrand('');
      setSavedCardLastDigits('');
      setUseSavedCard(false);
      setCardCpf('');
      setMpCustomerId('');
      setMpCardsIds([]);
    }
    
    // Pegando todos da agenda que estao agendados ou pendentes
    const { data, error } = await supabase
      .from('agendamentos')
      .select('*')
      .eq('user_id', targetId)
      .in('status', ['agendado', 'pendente_dinheiro', 'pendente_aproximacao'])
      .is('payment_method', null);

    if (error) {
      console.error(error);
      setViewState('bill');
      return;
    }
    
    setBillingItems(data || []);
    setViewState('bill');
    setShowPaymentOptions(false);
  };

  // Calcula os precos recursivamente apenas quando o pricesLookup atualiza ou os billingItems
  useEffect(() => {
    if (billingItems.length === 0) {
      setTotal(0);
      return;
    }
    let gmSum = 0;
    billingItems.forEach(item => {
      let coreStr = item.service;
      if (coreStr.includes(' | ')) coreStr = coreStr.split(' | ')[0];
      const parsedArray = parseServicesObj(coreStr);
      parsedArray.forEach(sub => {
        const precoItem = pricesLookup[sub.name] || 0;
        gmSum += (precoItem * sub.qty);
      });
    });
    setTotal(gmSum);
  }, [billingItems, pricesLookup]);

  const handleManualPayment = async (overrideMethod?: string | React.MouseEvent) => {
    const methodString = typeof overrideMethod === 'string' ? overrideMethod : 'dinheiro_caixa';
    if (!window.confirm('Confirmar baixa imediata desta comanda?')) return;
    try {
      const billingIds = billingItems.map(b => b.id);
      const { error } = await supabase
        .from('agendamentos')
        .update({ 
          status: 'concluido', 
          payment_method: methodString 
        })
        .in('id', billingIds);

      if (error) throw error;
      
      const transacaoLog = {
         user_id: selectedClient?.id || user?.id,
         client_name: selectedClient?.name || user?.user_metadata?.full_name || 'Desconhecido',
         amount: total,
         payment_method: methodString,
         status: 'approved',
         services_desc: billingItems.map(b => {
             let svc = b.service;
             if (svc.includes(' | ')) svc = svc.split(' | ')[0];
             return svc;
         }).join(' + ')
      };
      await supabase.from('transacoes').insert(transacaoLog);

      alert('Baixa concluída com sucesso.');
      if (role === 'admin' || role === 'desenvolvedor') {
        setSelectedClient(null);
        setViewState('select_client');
      } else {
        fetchBill(user!.id);
      }
    } catch(err: any) {
      alert(err.message);
    }
  };

  const handlePendingRequest = async (statusTag: string, successMessage: string) => {
    try {
      setCreatingPreference(true);
      const ids = billingItems.map((b: any) => b.id);
      const req = await fetch('/api/admin/update-agendamento-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentIds: ids, status: statusTag })
      });
      const resData = await req.json();
      
      if (!req.ok) {
         alert("Falha: " + resData.error);
      } else {
         alert(successMessage);
         if (role === 'admin' || role === 'desenvolvedor') {
            setSelectedClient(null);
            setViewState('select_client');
         } else {
            fetchBill(user!.id);
         }
      }
    } catch (err: any) {
      alert("Erro: " + err.message);
    } finally {
      setCreatingPreference(false);
    }
  };

  const handleSubmitDispute = async () => {
    if (!disputeMessage.trim()) return alert('Escreva o motivo da sua discordância.');
    if (selectedDisputeItems.length === 0) return alert('Selecione pelo menos um item para contestar.');
    setSubmittingDispute(true);
    try {
      const contestedItemsData = billingItems.filter(b => selectedDisputeItems.includes(b.id));
      let contestedTotal = 0;
      const names: string[] = [];
      
      contestedItemsData.forEach(item => {
        let coreStr = item.service;
        if (coreStr.includes(' | ')) coreStr = coreStr.split(' | ')[0];
        const parsedArray = parseServicesObj(coreStr);
        parsedArray.forEach(sub => {
          const precoItem = pricesLookup[sub.name] || 0;
          contestedTotal += (precoItem * sub.qty);
          names.push(`${sub.qty}x ${sub.name}`);
        });
      });

      const payload = {
        user_id: user?.id,
        type: 'question_charge',
        status: 'pendente',
        data: {
          message: disputeMessage,
          appointment_ids: selectedDisputeItems,
          total_claimed: contestedTotal,
          contested_services_names: names
        }
      };
      
      const { error } = await supabase.from('solicitacoes').insert(payload);
      if (error) throw error;
      
      // Disparar Notificação Push para Admins
      fetch('/api/notifications/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: '🚨 Questionamento de Fatura',
          body: `${user?.user_metadata?.full_name || user?.email} contestou um item da comanda.`,
          url: '/solicitacoes'
        })
      }).catch(err => console.error('Erro ao disparar notificação:', err));
      
      alert('Questão enviada com sucesso ao financeiro!');
      setShowDisputeModal(false);
      setDisputeMessage('');
    } catch(err:any) {
      alert('Erro: ' + err.message);
    } finally {
      setSubmittingDispute(false);
    }
  };

  if (authLoading) return null;
  if (!user) return <Auth />;

  const filteredClients = clients.filter(c => 
    c.full_name?.toLowerCase().includes(search.toLowerCase()) || 
    c.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      <div className="lg:ml-64 flex flex-col min-h-screen">
        <Header onMenuClick={() => setIsSidebarOpen(true)} />
        
        <main className="flex-1 p-4 lg:p-8 flex justify-center">
          <div className="max-w-md w-full relative">
            

            {/* SELECIONADOR ADMIN */}
            {viewState === 'select_client' && (
              <div className="bg-white p-6 rounded-2xl shadow-xl w-full border border-slate-100">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-rose-100 rounded-xl text-rose-600">
                    <Receipt className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black font-headline text-slate-800">Receber de...</h2>
                    <p className="text-sm text-slate-500">Selecione o cliente para visualizar e dar baixa na comanda.</p>
                  </div>
                </div>

                <div className="relative mb-4">
                  <Search className="w-5 h-5 absolute left-3 top-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar cliente..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-rose-400 outline-none"
                  />
                </div>

                <div className="max-h-96 overflow-y-auto space-y-2 pr-1">
                  {filteredClients.map(c => (
                    <button
                      key={c.id}
                      onClick={() => {
                        setSelectedClient({ id: c.id, name: c.full_name || c.email });
                        fetchBill(c.id);
                      }}
                      className="w-full text-left p-4 rounded-xl border border-slate-100 hover:border-rose-300 hover:bg-rose-50 transition-all flex items-center gap-3"
                    >
                      <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-500 shrink-0">
                        {c.full_name?.charAt(0).toUpperCase() || '?'}
                      </div>
                      <div className="font-medium text-slate-700 truncate">
                        {c.full_name || c.email}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}


            {/* COMANDA PAPEL */}
            {viewState === 'bill' && selectedClient && (
              <div className="relative animate-in fade-in slide-in-from-bottom-4 duration-500">
                
                {/* Botao voltar se Admin */}
                {(role === 'admin' || role === 'desenvolvedor') && (
                  <button 
                    onClick={() => { setViewState('select_client'); setSelectedClient(null); }}
                    className="mb-4 text-sm font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1"
                  >
                    ← Voltar para Busca
                  </button>
                )}

                {/* Comanda Card */}
                <div className="bg-[#fcfbf7] shadow-xl border border-[#e8e4d3] border-x-8 border-x-[#e8e4d3] p-8 pb-12 w-full mx-auto" 
                     style={{
                       backgroundImage: 'repeating-linear-gradient(transparent, transparent 27px, #e8e4d3 28px)',
                       backgroundSize: '100% 28px',
                       backgroundPosition: '0 3.5rem'
                     }}>
                  
                  <div className="text-center mb-10 pb-6 border-b-2 border-dashed border-slate-300 relative bg-[#fcfbf7] z-10 pt-2">
                    <h1 className="text-3xl font-black font-dancing tracking-tight text-slate-800">Priscila Nails Designer</h1>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400 mt-2 font-bold font-mono">Comanda do Cliente</p>
                    <p className="font-bold text-slate-700 mt-2">{selectedClient.name}</p>
                  </div>

                  <div className="space-y-6 min-h-[200px]">
                    {billingItems.length === 0 ? (
                      <div className="bg-[#fcfbf7] flex flex-col items-center justify-center text-center py-10 opacity-70">
                        <CheckCircle2 className="w-10 h-10 text-green-500 mb-2" />
                        <p className="font-bold text-slate-600">Nenhum consumo em aberto!</p>
                        <p className="text-sm font-mono text-slate-400">0 débitos neste momento.</p>
                      </div>
                    ) : (
                      billingItems.map((item, index) => {
                        let coreStr = item.service;
                        let msg = '';
                        if (coreStr.includes(' | ')) {
                          const splitStr = coreStr.split(' | ');
                          coreStr = splitStr[0];
                          msg = splitStr[1];
                        }
                        
                        const parsed = parseServicesObj(coreStr);

                        return (
                          <div key={item.id} className="relative z-10 bg-[#fcfbf7]">
                             <div className="flex font-mono text-[10px] text-slate-400 mb-1">
                               <span>{item.date.split('-').reverse().join('/')} - {item.time}</span>
                             </div>

                             {parsed.map((sub, sIdx) => {
                               const unitPrice = pricesLookup[sub.name] || 0;
                               const lineTotal = unitPrice * sub.qty;
                               return (
                               <div key={sIdx} className="flex items-baseline w-full mb-1 text-slate-700 font-bold font-mono text-xs sm:text-sm">
                                 <div className="shrink-0 whitespace-nowrap overflow-hidden text-ellipsis max-w-[60%]">
                                   {sub.qty}x {sub.name}
                                 </div>
                                 <div className="flex-grow border-b-2 border-dotted border-slate-300 mx-2 opacity-50 relative top-[-4px]"></div>
                                 <div className="shrink-0 bg-[#fcfbf7] pl-1">
                                   {lineTotal > 0 ? `R$ ${lineTotal.toFixed(2).replace('.', ',')}` : '--'}
                                 </div>
                               </div>
                             )
                           })}
                           
                           {msg && (
                             <p className="text-[10px] sm:text-xs text-rose-500 font-mono mt-1 font-bold">*{msg}*</p>
                           )}
                          </div>
                        )
                      })
                    )}
                  </div>

                  <div className="mt-12 pt-6 border-t-2 border-slate-800 bg-[#fcfbf7] relative z-10">
                    <div className="flex justify-between items-center text-lg sm:text-xl font-black font-mono text-slate-800 tracking-tight">
                       <span>TOTAL</span>
                       <span>R$ {total.toFixed(2).replace('.',',')}</span>
                    </div>
                  </div>
                </div>

                {/* Acões Finais */}
                {billingItems.length > 0 && (() => {
                  const isPendingApproval = billingItems.some(b => ['pendente_dinheiro', 'pendente_aproximacao'].includes(b.status));

                  if (isPendingApproval) {
                    return (
                      <div className="mt-8 bg-amber-50/80 rounded-2xl p-6 border-2 border-amber-300 border-dashed text-center shadow-sm relative z-10 w-full animate-in fade-in slide-in-from-bottom-2">
                        <div className="w-12 h-12 bg-amber-100 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-3">
                          <History className="w-6 h-6 animate-pulse" />
                        </div>
                        <h4 className="font-black text-amber-800 text-lg uppercase tracking-tight mb-1">Aguardando Baixa...</h4>
                        <p className="text-amber-700 text-sm font-medium">
                          Identificamos sua solicitação. O caixa validará o recebimento físico e sua conta sumirá em breve.
                        </p>
                      </div>
                    );
                  }

                  return (
                    <div className="mt-8 space-y-3">
                    {!showPaymentOptions ? (
                      <button 
                        onClick={() => setShowPaymentOptions(true)}
                        className="w-full flex items-center justify-center gap-2 bg-[#009EE3] text-white font-bold py-4 rounded-xl shadow-lg hover:bg-blue-600 transition-colors"
                      >
                        <CreditCard className="w-6 h-6" />
                        Tudo Certo, {isStaff ? 'Receber' : 'Pagar'} Agora!
                      </button>
                    ) : (
                      <div className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 shadow-sm animate-fade-in space-y-3">
                        <h3 className="text-center font-bold text-slate-800 border-b border-slate-200 pb-2 mb-4 text-sm">Como você deseja {isStaff ? 'receber' : 'pagar'}?</h3>
                        
                        {showGatewaySwitcher && !pixData && (
                           <div className="flex gap-2 p-1 bg-slate-100/80 rounded-xl mb-4 border border-slate-200 shadow-inner">
                             <button 
                               type="button"
                               onClick={() => setSelectedGateway('mercado_pago')}
                               className={cn(
                                 "flex-1 py-2 text-xs font-black rounded-lg transition-all capitalize tracking-wide shadow-sm flex items-center justify-center gap-1.5",
                                 selectedGateway === 'mercado_pago' ? "bg-white text-blue-700 border border-slate-200/50" : "text-slate-500 hover:text-slate-800 bg-transparent shadow-none"
                               )}
                             >
                               Mercado Pago
                             </button>
                             <button 
                               type="button"
                               onClick={() => setSelectedGateway('asaas')}
                               className={cn(
                                 "flex-1 py-2 text-xs font-black rounded-lg transition-all capitalize tracking-wide shadow-sm flex items-center justify-center gap-1.5",
                                 selectedGateway === 'asaas' ? "bg-white text-blue-700 border border-slate-200/50" : "text-slate-500 hover:text-slate-800 bg-transparent shadow-none"
                               )}
                             >
                               Asaas
                             </button>
                           </div>
                         )}

                        {/* CHECKOUT TRANSPARENTE: MERCADO PAGO PAYMENT BRICK */}
                        {pixData && (
                           <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col items-center gap-4 text-center my-4 relative z-10 w-full animate-in fade-in zoom-in duration-300">
                              <h4 className="font-bold text-lg text-slate-800">{isStaff ? 'Recebimento' : 'Pagamento'} via PIX gerado!</h4>
                              <p className="text-sm text-slate-500">Escaneie o QR Code abaixo com o aplicativo do seu banco:</p>
                              
                              <div className="p-2 bg-white rounded-xl border-2 border-[#009EE3]/20 shadow-sm">
                                 <img src={`data:image/jpeg;base64,${pixData.qr_code_base64}`} alt="QR Code PIX" className="w-48 h-48 rounded-lg" />
                              </div>

                              <p className="text-sm text-slate-500 font-bold mt-2">Ou copie o código abaixo:</p>
                              <div className="w-full relative">
                                <input 
                                  type="text" 
                                  readOnly 
                                  value={pixData.qr_code} 
                                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 pr-24 focus:outline-none" 
                                />
                                <button 
                                  onClick={() => { 
                                      navigator.clipboard.writeText(pixData.qr_code); 
                                      alert('Código Pix Copiado com Sucesso!'); 
                                  }}
                                  className="absolute right-2 top-2 bottom-2 bg-[#009EE3] text-white px-4 py-1 rounded-lg text-xs font-bold hover:bg-[#0080B7] transition-colors"
                                >
                                  Copiar
                                </button>
                              </div>
                              
                              <div className="flex flex-col sm:flex-row w-full gap-2 mt-4">
                                 <button 
                                    onClick={() => { 
                                       setPixData(null); 
                                       if (role === 'admin' || role === 'desenvolvedor') {
                                          setSelectedClient(null);
                                          setViewState('select_client');
                                       } else {
                                          fetchBill(user!.id); 
                                       }
                                    }} 
                                    className="flex-1 p-3 bg-green-50 text-green-700 font-bold rounded-xl hover:bg-green-100 transition-colors"
                                 >
                                   {isStaff ? '✓ Já recebi' : '✓ Já paguei'}
                                 </button>

                                 <button 
                                    onClick={() => setPixData(null)} 
                                    className="flex-1 p-3 border border-slate-200 text-slate-500 font-bold rounded-xl hover:bg-slate-50 transition-colors"
                                 >
                                   Outra forma
                                 </button>
                              </div>
                           </div>
                        )}

                        {!pixData && (
                              <button
                                type="button"
                                onClick={async (e) => {
                                  e.preventDefault();
                                  try {
                                    setCreatingPreference(true);
                                    const payload = {
                                      transaction_amount: Number(total.toFixed(2)),
                                      payment_method_id: 'pix',
                                      payer: { email: user?.email || 'cliente@privasconails.com' },
                                      appointmentIds: billingItems.map((b: any) => b.id),
                                      userId: selectedClient?.id || user?.id,
                                      clientName: selectedClient?.name || user?.user_metadata?.full_name || 'Desconhecido',
                                      gateway: currentGateway,
                                    };
                                    
                                    const req = await fetch("/api/pagamentos/process-payment", {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify(payload),
                                    });
                                    const response = await req.json();
                                    
                                    if (response.error) {
                                       alert("Falha ao gerar PIX: " + response.error);
                                    } else if (response.status === 'pending' && response.qr_code) {
                                       setPixData({ qr_code: response.qr_code, qr_code_base64: response.qr_code_base64, payment_id: response.id, gateway: currentGateway });
                                    } else {
                                       alert("Status Inesperado: " + response.status);
                                    }
                                  } catch (err: any) {
                                    alert("Falha de rede ao tentar gerar PIX.");
                                  } finally {
                                    setCreatingPreference(false);
                                  }
                                }}
                                className="w-full p-4 border border-[#32BCAD]/40 bg-[#32BCAD]/10 text-[#32BCAD] font-black rounded-xl flex items-center justify-center gap-2 hover:bg-[#32BCAD]/20 transition-colors uppercase tracking-tight text-sm my-4 shadow-sm"
                              >
                                <Smartphone className="w-5 h-5" />
                                Gerar PIX Rápido
                              </button>
                        )}

                        {currentGateway === 'asaas' ? (
                          <div className="w-full">
                            <div className="text-center text-xs font-bold text-slate-400 mb-2 mt-4 uppercase tracking-widest opacity-60">— Cartão de Crédito / Asaas —</div>
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col gap-4 my-4 relative z-10 w-full animate-in fade-in zoom-in duration-300">
                              <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-2 justify-center">
                                <CreditCard className="w-6 h-6 text-indigo-600" />
                                <h4 className="font-bold text-slate-800">Checkout Transparente</h4>
                              </div>

                              {savedCardToken && (
                                <label className="flex items-center gap-3 p-3 bg-indigo-50/50 border border-indigo-200/50 rounded-xl cursor-pointer hover:bg-indigo-50 transition-colors mb-3">
                                  <input
                                    type="checkbox"
                                    checked={useSavedCard}
                                    onChange={(e) => setUseSavedCard(e.target.checked)}
                                    className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                                  />
                                  <div className="text-left">
                                    <p className="text-xs font-black text-slate-800">Usar cartão de crédito salvo</p>
                                    <p className="text-[10px] text-indigo-600 font-bold uppercase tracking-wider">
                                      {savedCardBrand} final **** {savedCardLastDigits}
                                    </p>
                                  </div>
                                </label>
                              )}

                              {!useSavedCard ? (
                                <div className="space-y-3 text-left">
                                  <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase">Nome no Cartão</label>
                                    <input 
                                      type="text" 
                                      placeholder="NOME IMPRESSO NO CARTÃO"
                                      value={cardHolderName}
                                      onChange={(e) => setCardHolderName(e.target.value.toUpperCase())}
                                      className="w-full mt-1 p-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none text-sm font-semibold uppercase placeholder:text-slate-300"
                                    />
                                  </div>

                                  <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase">Número do Cartão</label>
                                    <input 
                                      type="text" 
                                      placeholder="0000 0000 0000 0000"
                                      value={cardNumber}
                                      onChange={(e) => {
                                        const val = e.target.value.replace(/\D/g, '').substring(0, 16);
                                        const formatted = val.replace(/(\d{4})(?=\d)/g, '$1 ');
                                        setCardNumber(formatted);
                                      }}
                                      className="w-full mt-1 p-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none text-sm font-semibold placeholder:text-slate-300"
                                    />
                                  </div>

                                  <div className="grid grid-cols-2 gap-3">
                                    <div>
                                      <label className="text-xs font-bold text-slate-500 uppercase">Validade</label>
                                      <input 
                                        type="text" 
                                        placeholder="MM/AA"
                                        value={cardExpiry}
                                        onChange={(e) => {
                                          const val = e.target.value.replace(/\D/g, '').substring(0, 4);
                                          let formatted = val;
                                          if (val.length > 2) {
                                            formatted = `${val.substring(0, 2)}/${val.substring(2)}`;
                                          }
                                          setCardExpiry(formatted);
                                        }}
                                        className="w-full mt-1 p-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none text-sm font-semibold placeholder:text-slate-300 text-center"
                                      />
                                    </div>
                                    <div>
                                      <label className="text-xs font-bold text-slate-500 uppercase">CVC / CVV</label>
                                      <input 
                                        type="password" 
                                        placeholder="123"
                                        value={cardCvv}
                                        onChange={(e) => {
                                          const val = e.target.value.replace(/\D/g, '').substring(0, 4);
                                          setCardCvv(val);
                                        }}
                                        className="w-full mt-1 p-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none text-sm font-semibold placeholder:text-slate-300 text-center"
                                      />
                                    </div>
                                  </div>

                                  <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase">CPF ou CNPJ do Titular</label>
                                    <input 
                                      type="text" 
                                      placeholder="000.000.000-00"
                                      value={cardCpf}
                                      onChange={(e) => {
                                        const val = e.target.value.replace(/\D/g, '').substring(0, 14);
                                        setCardCpf(val);
                                      }}
                                      className="w-full mt-1 p-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none text-sm font-semibold placeholder:text-slate-300"
                                    />
                                  </div>

                                  <div className="grid grid-cols-2 gap-3">
                                    <div>
                                      <label className="text-xs font-bold text-slate-500 uppercase">CEP</label>
                                      <input 
                                        type="text" 
                                        placeholder="00000-000"
                                        value={cardCep}
                                        onChange={(e) => {
                                          const val = e.target.value.replace(/\D/g, '').substring(0, 8);
                                          let formatted = val;
                                          if (val.length > 5) {
                                            formatted = `${val.substring(0, 5)}-${val.substring(5)}`;
                                          }
                                          setCardCep(formatted);
                                        }}
                                        className="w-full mt-1 p-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none text-sm font-semibold placeholder:text-slate-300 text-center"
                                      />
                                    </div>
                                    <div>
                                      <label className="text-xs font-bold text-slate-500 uppercase">Número Res.</label>
                                      <input 
                                        type="text" 
                                        placeholder="123"
                                        value={cardAddressNum}
                                        onChange={(e) => setCardAddressNum(e.target.value)}
                                        className="w-full mt-1 p-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none text-sm font-semibold placeholder:text-slate-300 text-center"
                                      />
                                    </div>
                                  </div>

                                  <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase">Telefone / Celular</label>
                                    <input 
                                      type="text" 
                                      placeholder="(00) 00000-0000"
                                      value={cardPhone}
                                      onChange={(e) => {
                                        const val = e.target.value.replace(/\D/g, '').substring(0, 11);
                                        let formatted = val;
                                        if (val.length > 2) {
                                          formatted = `(${val.substring(0, 2)}) ${val.substring(2)}`;
                                        }
                                        if (val.length > 7) {
                                          formatted = `(${val.substring(0, 2)}) ${val.substring(2, 7)}-${val.substring(7)}`;
                                        }
                                        setCardPhone(formatted);
                                      }}
                                      className="w-full mt-1 p-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none text-sm font-semibold placeholder:text-slate-300"
                                    />
                                  </div>

                                  {/* Checkbox para salvar o cartão */}
                                  <label className="flex items-center gap-2 pt-2 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={saveNewCard}
                                      onChange={(e) => setSaveNewCard(e.target.checked)}
                                      className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                                    />
                                    <span className="text-xs font-black text-slate-600">salvar meus dados de pagamento para usar novamente na proxima vez</span>
                                  </label>
                                </div>
                              ) : (
                                <div className="p-5 bg-slate-50 rounded-2xl border border-dashed border-indigo-200 text-center flex flex-col items-center gap-2">
                                  <div className="w-10 h-10 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 border border-indigo-100">
                                    <CreditCard className="w-5 h-5" />
                                  </div>
                                  <p className="text-xs text-slate-700 font-bold">Cartão de Crédito Salvo Selecionado</p>
                                  <p className="text-[10px] text-slate-400 max-w-[80%] mx-auto">
                                    O pagamento será processado de forma segura e imediata utilizando a bandeira {savedCardBrand}.
                                  </p>
                                </div>
                              )}

                              <button
                                type="button"
                                disabled={creatingPreference}
                                onClick={async (e) => {
                                   e.preventDefault();
                                   
                                   if (!useSavedCard && (!cardHolderName || !cardNumber || !cardExpiry || !cardCvv || !cardCpf || !cardCep || !cardAddressNum || !cardPhone)) {
                                     alert('Por favor, preencha todos os campos do cartão.');
                                     return;
                                   }

                                   let expiryParts = ['', ''];
                                   if (!useSavedCard) {
                                     expiryParts = cardExpiry.split('/');
                                     if (expiryParts.length !== 2) {
                                       alert('Data de validade inválida. Use o formato MM/AA.');
                                       return;
                                     }
                                   }

                                   const cleanCardNumber = cardNumber.replace(/\s/g, '');
                                   const cleanCpf = cardCpf.replace(/\D/g, '');
                                   const cleanCep = cardCep.replace(/\D/g, '');
                                   const cleanPhone = cardPhone.replace(/\D/g, '');

                                   try {
                                     setCreatingPreference(true);
                                     const payload: any = {
                                       transaction_amount: Number(total.toFixed(2)),
                                       payment_method_id: 'credit_card',
                                       payer: { email: user?.email || 'cliente@privasconails.com' },
                                       appointmentIds: billingItems.map((b: any) => b.id),
                                       userId: selectedClient?.id || user?.id,
                                       clientName: selectedClient?.name || user?.user_metadata?.full_name || 'Desconhecido',
                                       gateway: currentGateway,
                                       saveCard: saveNewCard
                                     };

                                     if (useSavedCard) {
                                       payload.creditCardToken = savedCardToken;
                                     } else {
                                       payload.creditCard = {
                                         holderName: cardHolderName,
                                         number: cleanCardNumber,
                                         expiryMonth: expiryParts[0],
                                         expiryYear: '20' + expiryParts[1],
                                         ccv: cardCvv
                                       };
                                       payload.creditCardHolderInfo = {
                                         name: cardHolderName,
                                         email: user?.email || 'cliente@privasconails.com',
                                         cpfCnpj: cleanCpf,
                                         postalCode: cleanCep,
                                         addressNumber: cardAddressNum,
                                         phone: cleanPhone
                                       };
                                     }
                                     
                                     const req = await fetch("/api/pagamentos/process-payment", {
                                         method: "POST",
                                         headers: { "Content-Type": "application/json" },
                                         body: JSON.stringify(payload),
                                     });
                                     const response = await req.json();
                                     
                                     if (response.error) {
                                        alert("Falha no pagamento: " + response.error);
                                     } else if (response.status === 'approved') {
                                        alert("Pagamento por Cartão Aprovado com Sucesso!");
                                        
                                        // Resetar form
                                        setCardHolderName('');
                                        setCardNumber('');
                                        setCardExpiry('');
                                        setCardCvv('');
                                        setCardCpf('');
                                        setCardCep('');
                                        setCardAddressNum('');
                                        setCardPhone('');

                                        if (role === 'admin' || role === 'desenvolvedor') {
                                           setSelectedClient(null);
                                           setViewState('select_client');
                                        } else {
                                           fetchBill(user!.id);
                                        }
                                     } else {
                                        alert("Aviso: Status do pagamento é " + (response.status_detail || response.status));
                                     }
                                   } catch (err: any) {
                                     alert("Falha de rede ao tentar processar o cartão.");
                                   } finally {
                                     setCreatingPreference(false);
                                   }
                                }}
                                className="w-full p-4 bg-indigo-600 text-white font-black rounded-xl flex items-center justify-center gap-2 hover:bg-indigo-700 transition-colors uppercase tracking-tight text-sm shadow-sm mt-4"
                              >
                                {creatingPreference ? <RefreshCw className="w-5 h-5 animate-spin" /> : <CreditCard className="w-5 h-5" />}
                                Pagar com Cartão (Asaas)
                              </button>
                            </div>
                          </div>
                        ) : (
                          mpPublicKey ? (
                            <>
                              <div className="text-center text-xs font-bold text-slate-400 mb-2 uppercase tracking-widest opacity-60">— {isStaff ? 'Receba' : 'Pague'} com Cartão —</div>

                              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-4 relative z-10 w-full">
                                {/* Seletor de parcelas customizado - visível imediatamente */}
                                {(() => {
                                  const feeTable: Record<number, number> = {
                                    1: 4.99,   // à vista (4.99% processamento)
                                    2: 9.08,   // 4.99% + 4.09%
                                    3: 10.40,  // 4.99% + 5.41%
                                    4: 11.69,  // 4.99% + 6.70%
                                    5: 12.95,  // 4.99% + 7.96%
                                    6: 14.19,  // 4.99% + 9.20%
                                    7: 15.40,  // 4.99% + 10.41%
                                    8: 16.59,  // 4.99% + 11.60%
                                    9: 17.76,  // 4.99% + 12.77%
                                    10: 18.91, // 4.99% + 13.92%
                                    11: 20.04, // 4.99% + 15.05%
                                    12: 21.14, // 4.99% + 16.15%
                                  };
                                  return (
                                    <div className="px-4 pt-3 pb-2">
                                      <p className="text-xs font-semibold text-slate-600 mb-2">Selecione o número de parcelas:</p>
                                      <div className="grid grid-cols-3 gap-1.5">
                                        {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => {
                                          const fee = feeTable[n] ?? 21.14;
                                          // Cobrado = Original / (1 - Taxa%)
                                          const totalN = Number((total / (1 - fee / 100)).toFixed(2));
                                          const perN = Number((totalN / n).toFixed(2));
                                          const isSelected = selectedInstallments === n;
                                          return (
                                            <button
                                              key={n}
                                              type="button"
                                              onClick={() => setSelectedInstallments(n)}
                                              className={`rounded-lg border p-2 text-left transition-all text-[11px] leading-tight ${
                                                isSelected
                                                  ? 'border-[#009EE3] bg-[#009EE3]/10 text-[#007bb5] font-bold shadow-sm'
                                                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                                              }`}
                                            >
                                              <span className="block font-bold text-sm">{n}x</span>
                                              <span className="block">R$ {perN.toFixed(2).replace('.', ',')}</span>
                                              <span className="block text-[10px] text-slate-500 mt-0.5">Total R$ {totalN.toFixed(2).replace('.', ',')}</span>
                                              <span className={`block text-[10px] ${isSelected ? 'text-[#007bb5]' : 'text-slate-400'}`}>
                                                {n === 1 ? 'à vista' : `+${(fee - 4.99).toFixed(2)}%`}
                                              </span>
                                            </button>
                                          );
                                        })}
                                      </div>
                                      <p className="text-[10px] text-amber-600 mt-2">* Taxas de cartão de crédito repassadas ao cliente.</p>
                                      
                                      <label className="flex items-center gap-2 mt-3 pt-2 border-t border-slate-100 cursor-pointer text-left">
                                        <input
                                          type="checkbox"
                                          checked={saveNewCard}
                                          onChange={(e) => setSaveNewCard(e.target.checked)}
                                          className="w-4 h-4 text-[#009EE3] rounded border-slate-300 focus:ring-[#009EE3]"
                                        />
                                        <span className="text-xs font-black text-slate-600">salvar meus dados de pagamento para usar novamente na proxima vez</span>
                                      </label>
                                    </div>
                                  );
                                })()}
                                {/* @ts-ignore */}
                                 <Payment
                                    key={`${selectedInstallments}_${savedCpf}_${mpCardsIds.join(',')}`}
                                    initialization={{
                                      amount: Number((total / (1 - ({1:4.99,2:9.08,3:10.40,4:11.69,5:12.95,6:14.19,7:15.40,8:16.59,9:17.76,10:18.91,11:20.04,12:21.14}[selectedInstallments]??21.14) / 100)).toFixed(2)),
                                      payer: {
                                        email: user?.email || 'cliente@privasconails.com',
                                        identification: savedCpf ? {
                                          type: 'CPF',
                                          number: savedCpf
                                        } : undefined,
                                        customerId: mpCustomerId || undefined,
                                        cardsIds: mpCardsIds.length > 0 ? mpCardsIds : undefined
                                      },
                                      // @ts-ignore
                                      installments: selectedInstallments,
                                    }}
                                  customization={{
                                    paymentMethods: {
                                      creditCard: "all",
                                      maxInstallments: selectedInstallments,
                                      minInstallments: selectedInstallments,
                                    },
                                    visual: {
                                      texts: {
                                        // @ts-ignore
                                        formSubmit: isStaff ? 'receber' : 'pagar'
                                      }
                                    }
                                  }}
                                  onSubmit={async (param: any) => {
                                    return new Promise<void>((resolve, reject) => {
                                      const feeT: Record<number, number> = {
                                        1: 4.99,   // à vista (4.99% processamento)
                                        2: 9.08,   // 4.99% + 4.09%
                                        3: 10.40,  // 4.99% + 5.41%
                                        4: 11.69,  // 4.99% + 6.70%
                                        5: 12.95,  // 4.99% + 7.96%
                                        6: 14.19,  // 4.99% + 9.20%
                                        7: 15.40,  // 4.99% + 10.41%
                                        8: 16.59,  // 4.99% + 11.60%
                                        9: 17.76,  // 4.99% + 12.77%
                                        10: 18.91, // 4.99% + 13.92%
                                        11: 20.04, // 4.99% + 15.05%
                                        12: 21.14, // 4.99% + 16.15%
                                      };
                                      const np = selectedInstallments;
                                      const tp = feeT[np] ?? 21.14;
                                      const ta = Number((total / (1 - tp / 100)).toFixed(2));
                                      const pp = Number((ta / np).toFixed(2));
                                      const msg = np === 1
                                        ? 'Total com taxa de 4,99% (cartao credito): R$ ' + ta.toFixed(2).replace('.', ',') + '. Confirmar pagamento?'
                                        : 'Total com taxa de ' + tp + '% (' + np + 'x no cartao): R$ ' + ta.toFixed(2).replace('.', ',') + ' = ' + np + 'x de R$ ' + pp.toFixed(2).replace('.', ',') + '. Confirmar?';
                                      if (!window.confirm(msg)) { reject(); return; }
                                      const payload = {
                                        ...param.formData,
                                        installments: np,
                                        transaction_amount: total,
                                        appointmentIds: billingItems.map((b: any) => b.id),
                                        userId: selectedClient?.id || user?.id,
                                        clientName: selectedClient?.name || user?.user_metadata?.full_name || 'Desconhecido',
                                        gateway: currentGateway,
                                        saveCard: saveNewCard
                                      };
                                      fetch("/api/pagamentos/process-payment", {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify(payload),
                                      })
                                        .then((res) => res.json())
                                        .then((response) => {
                                          if (response.error) {
                                            alert("Falha no pagamento: " + response.error);
                                            reject();
                                          } else if (response.status === 'approved') {
                                            alert("Pagamento Aprovado com Sucesso!");
                                            resolve();
                                            if (role === 'admin' || role === 'desenvolvedor') {
                                              setSelectedClient(null);
                                              setViewState('select_client');
                                            } else {
                                              fetchBill(user!.id);
                                            }
                                          } else if (response.status === 'pending' && response.qr_code) {
                                            setPixData({ qr_code: response.qr_code, qr_code_base64: response.qr_code_base64, payment_id: response.id });
                                            resolve();
                                          } else {
                                            alert("Aviso: " + (response.status_detail || response.status));
                                            reject();
                                          }
                                        })
                                        .catch(() => { alert("Falha de rede."); reject(); });
                                    });
                                  }}
                                  onError={async (error) => {
                                    console.error("Erro no Brick do MP:", error);
                                  }}
                                  onReady={async () => {
                                    console.log("Payment Brick Carregado");
                                  }}
                                 />
                         </div>
                            </>
                          ) : (
                            <div className="text-center p-6 text-sm font-bold text-slate-400">
                              Carregando formulário do Mercado Pago...
                            </div>
                          )
                        )}

                        {!isStaff && (
                          <div className="w-full">
                            <div className="text-center text-xs font-bold text-slate-400 mb-2 mt-6 uppercase tracking-widest opacity-60">— Carteiras Digitais (Google Pay) —</div>
                            <div className="mb-6 w-full">
                              {!walletPreferenceId ? (
                                <button
                                  type="button"
                                  onClick={(e) => { e.preventDefault(); loadWalletPreference(); }}
                                  className="w-full p-4 border border-[#009EE3]/40 bg-[#009EE3]/10 text-[#009EE3] font-black rounded-xl flex items-center justify-center gap-2 hover:bg-[#009EE3]/20 transition-colors uppercase tracking-tight text-sm shadow-sm"
                                >
                                  <Smartphone className="w-5 h-5" />
                                  Pagar com Google Pay / MP
                                </button>
                              ) : (
                                <div className="bg-white rounded-xl shadow-sm border border-[#009EE3]/30 overflow-hidden relative z-10 w-full animate-in fade-in zoom-in duration-300">
                                   <Wallet initialization={{ preferenceId: walletPreferenceId }} />
                                </div>
                              )}
                            </div>
                          </div>
                        )}


                        <div className="text-center text-xs font-bold text-slate-400 mb-2 mt-6 uppercase tracking-widest opacity-60">— {isStaff ? 'Recebimento Físico (Loja)' : 'Pagamento Físico (Loja)'} —</div>

                        <button 
                          type="button"
                          disabled={isPointLoading}
                          onClick={(e) => {
                            e.preventDefault();
                            if (role === 'admin' || role === 'desenvolvedor') {
                              handlePointPayment();
                            } else {
                              handlePendingRequest('pendente_aproximacao', 'Pendente de pagamento por Aproximação!');
                            }
                          }}
                          className={cn(
                            "w-full p-4 border border-indigo-200 bg-indigo-50 text-indigo-700 font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-indigo-100 transition-colors",
                            isPointLoading && "opacity-50 cursor-wait"
                          )}
                        >
                           <Smartphone className="w-5 h-5" />
                           {isStaff ? (isPointLoading ? 'Gerando cobrança...' : 'RECEBER COM INFINITY') : 'Pagar com Infinity'}
                        </button>
                        
                        {isStaff && (
                          <div className="text-center opacity-50">
                            <span className="text-[10px] text-slate-400">
                                Fluxo inteligente via QR/NFC habilitado.
                            </span>
                          </div>
                        )}

                        <button 
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            if (role === 'admin' || role === 'desenvolvedor') {
                              handleManualPayment('dinheiro_caixa');
                            } else {
                              handlePendingRequest('pendente_dinheiro', 'Pendente de pagamento no Caixa Físico!');
                            }
                          }}
                          className="w-full p-4 border border-green-200 bg-green-50 text-green-700 font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-green-100 transition-colors"
                        >
                           <Banknote className="w-5 h-5" />
                           Dinheiro em Espécie (No Caixa)
                        </button>

                        {allowTab && (
                          <button 
                            type="button"
                            onClick={(e) => {
                                e.preventDefault();
                                handlePendingRequest('fiado', 'Adicionado à sua conta com sucesso!');
                            }}
                            className="w-full p-4 border border-amber-200 bg-amber-50 text-amber-700 font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-amber-100 transition-colors"
                          >
                             <History className="w-5 h-5" />
                             Pendurar / Colocar na Minha Conta
                          </button>
                        )}
                        
                        <button onClick={() => setShowPaymentOptions(false)} className="w-full mt-2 text-xs text-slate-400 font-medium py-2 hover:text-slate-600">
                           Voltar
                        </button>
                      </div>
                    )}
                    
                    {!showPaymentOptions && (
                      <button 
                        onClick={() => {
                          setSelectedDisputeItems(billingItems.map(b => b.id));
                          setDisputeMessage('');
                          setShowDisputeModal(true);
                        }}
                        className="w-full flex justify-center text-sm font-bold text-slate-400 hover:text-rose-500 py-3"
                      >
                        Encontrou um erro na comanda? Clique aqui.
                      </button>
                    )}
                  </div>
                  );
                })()}
              </div>
            )}
            
          </div>
        </main>
      </div>

      {/* DISPUTE MODAL */}
      <AnimatePresence>
        {showDisputeModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-xl relative">
              <button 
                onClick={() => setShowDisputeModal(false)}
                className="absolute top-4 right-4 p-1 text-slate-400 hover:bg-slate-100 rounded-full"
              >
                <X className="w-5 h-5"/>
              </button>
              
              <div className="w-12 h-12 bg-rose-100 rounded-full flex items-center justify-center text-rose-500 mx-auto mb-4">
                <MessageCircleQuestion className="w-6 h-6" />
              </div>
              
              <h3 className="text-xl font-black text-center text-slate-800 mb-2">Constestar Fatura</h3>
              <p className="text-sm text-center text-slate-500 mb-4">Selecione os itens que deseja contestar e descreva o motivo.</p>
              
              <div className="max-h-40 overflow-y-auto mb-4 bg-slate-50 border border-slate-200 rounded-xl p-2 space-y-1">
                {billingItems.map(item => {
                  let coreStr = item.service;
                  if (coreStr.includes(' | ')) coreStr = coreStr.split(' | ')[0];
                  return (
                    <label key={item.id} className="flex items-center gap-3 p-2 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 text-rose-500 rounded border-slate-300 focus:ring-rose-500"
                        checked={selectedDisputeItems.includes(item.id)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedDisputeItems([...selectedDisputeItems, item.id]);
                          else setSelectedDisputeItems(selectedDisputeItems.filter(id => id !== item.id));
                        }}
                      />
                      <span className="text-sm text-slate-700 font-medium truncate">{coreStr}</span>
                    </label>
                  );
                })}
              </div>

              <textarea
                value={disputeMessage}
                onChange={e => setDisputeMessage(e.target.value)}
                placeholder="Exemplo: Cancelei esse serviço antes do início e ainda está cobrando."
                className="w-full h-24 bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-700 outline-none focus:border-rose-400 resize-none mb-4"
              />
              
              <button 
                onClick={handleSubmitDispute}
                disabled={submittingDispute || selectedDisputeItems.length === 0 || !disputeMessage.trim()}
                className="w-full bg-rose-500 hover:bg-rose-600 text-white font-bold py-3 rounded-xl shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submittingDispute ? 'Enviando...' : 'Enviar Questionamento'}
              </button>
            </div>
          </div>
        )}
      </AnimatePresence>
      {/* Modal de Pagamento Inteligente — iOS/Android */}
      <AnimatePresence>
        {showSmartModal && smartPayData && (
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[100] flex items-center justify-center p-2 overflow-y-auto">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-300 border-t-8 border-indigo-600 my-4">

              {/* Header */}
              <div className="p-5 text-center relative border-b border-slate-100">
                <button 
                  onClick={() => setShowSmartModal(false)}
                  className="absolute right-4 top-4 hover:bg-slate-100 p-1.5 rounded-full transition-colors text-slate-400"
                >
                  <X className="w-4 h-4" />
                </button>
                <div className="w-12 h-12 mx-auto mb-2 bg-indigo-50 rounded-2xl flex items-center justify-center border border-indigo-100">
                  <Smartphone className="w-6 h-6 text-indigo-600" />
                </div>
                <h3 className="text-lg font-black text-slate-800 uppercase tracking-tighter">RECEBER COM INFINITY</h3>
                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Processo Manual Otimizado</p>

              </div>

              {/* Valor */}
              <div className="px-5 pt-4 pb-2">
                <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-200 rounded-2xl p-4">
                  <div className="flex-1">
                    <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest">Valor a cobrar</p>
                    <p className="text-3xl font-black text-indigo-700">{smartPayData.amountDisplay}</p>
                  </div>
                </div>
              </div>

              <div className="px-5 pb-5 space-y-4">
                
                {/* PASSO 1: COPIAR VALOR */}
                <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 text-left shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs font-black shrink-0">1</div>
                    <p className="text-sm font-bold text-slate-700">Copie o valor da venda</p>
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-3 text-indigo-700 font-black text-lg text-center">
                      {smartPayData.amountDisplay}
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(smartPayData.amountRaw);
                        alert('✅ Valor copiado! Agora abra o app InfinitePay e cole.');
                      }}
                      className="px-6 bg-indigo-600 text-white font-black rounded-xl text-xs shrink-0 active:scale-95 transition-all shadow-md"
                    >
                      Copiar
                    </button>
                  </div>
                </div>

                {/* PASSO 2: ABRIR APP MANUALMENTE */}
                <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 text-left shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs font-black shrink-0">2</div>
                    <p className="text-sm font-bold text-slate-700 uppercase tracking-tighter">Abra o InfinitePay e faça a venda</p>
                  </div>
                  
                  <div className="py-4 bg-white/50 border border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center gap-2">
                    <Smartphone className="w-8 h-8 text-slate-300" />
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest text-center px-4">
                      Abra o app no seu celular e use a função <span className="text-indigo-600">InfiniteTap</span>
                    </p>
                  </div>

                  <div className="mt-3 bg-indigo-50/50 rounded-xl p-3 border border-indigo-100/50">
                    <p className="text-[10px] text-indigo-700 font-bold leading-relaxed text-center italic">
                      Vender → InfiniteTap → Cole o valor → Cobrar
                    </p>
                  </div>
                </div>

                {/* PASSO 3: CONFIRMAR */}
                <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 text-left shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 bg-emerald-600 text-white rounded-full flex items-center justify-center text-xs font-black shrink-0">3</div>
                    <p className="text-sm font-bold text-slate-700">Após a batida do cartão, confirme aqui</p>
                  </div>
                  <button 
                    onClick={handleManualConfirm}
                    className="w-full py-4 bg-emerald-500 text-white font-black rounded-xl flex items-center justify-center gap-3 hover:bg-emerald-600 transition-all shadow-lg active:scale-95 text-base uppercase tracking-tight"
                  >
                    <CheckCircle2 className="w-5 h-5" />
                    CONFIRMAR RECEBIMENTO
                  </button>
                </div>

                <div className="flex items-center justify-end">
                    <div className="flex items-center gap-1.5 opacity-40">
                      <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                      <span className="text-[9px] font-bold text-slate-500 uppercase">Automated v2.0</span>
                    </div>
                </div>

              </div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

