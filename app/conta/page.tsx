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
  History
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { initMercadoPago, Payment, Wallet } from '@mercadopago/sdk-react';

// Inicializa o Mercado Pago SDK com uma chave pública embutida ou de env
initMercadoPago(process.env.NEXT_PUBLIC_MP_PUBLIC_KEY || 'TEST-33923f17-b080-455b-bfb3-cd98decf5960', { locale: 'pt-BR' });

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
  const [pixData, setPixData] = useState<{qr_code: string, qr_code_base64: string, payment_id?: string} | null>(null);
  const [creatingPreference, setCreatingPreference] = useState(false);
  const [walletPreferenceId, setWalletPreferenceId] = useState<string | null>(null);
  const [isPointLoading, setIsPointLoading] = useState(false);
  const [showSmartModal, setShowSmartModal] = useState(false);
  const [smartPayData, setSmartPayData] = useState<{
    init_point: string, 
    id: string, 
    link_a: string, 
    link_b: string,
    link_c: string,
    link_d: string,
    link_e: string,
    link_f: string
  } | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [showManualSteps, setShowManualSteps] = useState(false);

  const handlePointPayment = async () => {
    try {
        setIsPointLoading(true);
        setShowManualSteps(false);
        
        const amountCents = Math.round(total * 100);
        const cleanDesc = `Venda`;
        
        // Exaustão de Possibilidades (A-F)
        const linkA = `cloudwalk-pay://vender?amount=${amountCents}&description=${cleanDesc}`;
        const linkB = `cloudwalk-pos://vender?amount=${amountCents}&description=${cleanDesc}`;
        const linkC = `infinite-pay://vender?amount=${amountCents}&description=${cleanDesc}`;
        const linkD = `cloudwalk-venda://valor=${amountCents}&descricao=${cleanDesc}`;
        const linkE = `https://link.infinitepay.io/tap-to-pay?amount=${amountCents}&description=${cleanDesc}`;
        const linkF = `https://infinitepay.io/venda?valor=${amountCents}&descricao=${cleanDesc}`;

        setSmartPayData({ 
            init_point: '', 
            id: 'infinitepay', 
            link_a: linkA,
            link_b: linkB,
            link_c: linkC,
            link_d: linkD,
            link_e: linkE,
            link_f: linkF
        });
        
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
          const req = await fetch(`/api/pagamentos/check-status?paymentId=${pixData.payment_id}&appointmentIds=${apIds}`);
          
          if (req.ok) {
            const res = await req.json();
            
            if (res.status === 'approved') {
               clearInterval(intervalId);
               alert('Pagamento Automático via PIX Confirmado com Sucesso!');
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
  }, [pixData, billingItems, role, user]);

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
    
    // Busca a permissão de fiado do usuário
    if (role === 'cliente') {
       const { data: profile } = await supabase.from('profiles').select('allow_tab').eq('id', targetId).single();
       if (profile?.allow_tab) setAllowTab(true);
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
      const updates = billingItems.map(b => ({
         id: b.id,
         status: 'concluido',
         payment_method: methodString
      }));
      // Ideally an RPC or bulk upsert. Supabase `upsert` can work if we provide id cleanly.
      const { error } = await supabase.from('agendamentos').upsert(updates);
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
                                      clientName: selectedClient?.name || user?.user_metadata?.full_name || 'Desconhecido'
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
                                       setPixData({ qr_code: response.qr_code, qr_code_base64: response.qr_code_base64, payment_id: response.id });
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

                              <div className="text-center text-xs font-bold text-slate-400 mb-2 uppercase tracking-widest opacity-60">— {isStaff ? 'Receba' : 'Pague'} com Cartão —</div>

                              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-4 relative z-10 w-full">
                               <Payment
                                 initialization={{
                                   amount: Number(total.toFixed(2)),
                                   payer: {
                                     email: user?.email || 'cliente@privasconails.com'
                                   }
                                 }}
                                 customization={{
                                   paymentMethods: {
                                     creditCard: "all",
                                     debitCard: "all"
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
                                 const payload = {
                                   ...param.formData,
                                   appointmentIds: billingItems.map((b: any) => b.id),
                                   userId: selectedClient?.id || user?.id,
                                   clientName: selectedClient?.name || user?.user_metadata?.full_name || 'Desconhecido'
                                 };
                                 
                                 fetch("/api/pagamentos/process-payment", {
                                   method: "POST",
                                   headers: {
                                     "Content-Type": "application/json",
                                   },
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
                                        alert("Aviso: Status do pagamento é " + response.status_detail || response.status);
                                        reject();
                                     }
                                   })
                                   .catch((error) => {
                                     alert("Falha de rede ao tentar processar cartão.");
                                     reject();
                                   });
                               });
                             }}
                             onError={async (error) => {
                               console.error("Erro interno no Brick do MP:", error);
                             }}
                             onReady={async () => {
                               console.log("Payment Brick Carregado com Sucesso");
                             }}
                           />
                        </div>

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
                           {isStaff ? (isPointLoading ? 'Gerando cobrança...' : 'Receber por Aproximação') : 'Aproximação Celular / Maquininha'}
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
      {/* Modal de Pagamento Inteligente (QR / NFC) */}
      <AnimatePresence>
        {showSmartModal && smartPayData && (
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-300 border-t-8 border-indigo-600">
              <div className="p-6 text-center relative">
                <button 
                  onClick={() => setShowSmartModal(false)}
                  className="absolute right-4 top-0 hover:bg-slate-100 p-2 rounded-full transition-colors text-slate-400"
                >
                  <X className="w-5 h-5" />
                </button>
                
                <div className="w-20 h-20 mx-auto mb-4 bg-indigo-50 rounded-2xl flex items-center justify-center p-4 border border-indigo-100">
                  <svg viewBox="0 0 24 24" className="text-indigo-600 w-full h-full fill-current">
                    <path d="M17 2H7c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 18H7V4h10v16zm-5-1c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zM8 6h8v2H8V6z" />
                  </svg>
                </div>
                
                <h3 className="text-2xl font-black text-slate-800">InfinitePay</h3>
                <p className="text-slate-500 text-sm">Recebimento por Aproximação</p>
              </div>

              <div className="px-8 pb-8 text-center">
                <div className="mb-8 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <span className="text-slate-400 text-[10px] font-bold uppercase block mb-1 tracking-widest">Valor da Comanda</span>
                  <span className="text-4xl font-black text-indigo-600">
                    {total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                </div>

                <>
                  {!showManualSteps ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <button 
                          onClick={() => { if (smartPayData) window.location.assign(smartPayData.link_a); }}
                          className="py-4 bg-indigo-600 text-white font-bold rounded-2xl shadow-md active:scale-95 text-sm"
                        >
                          POSSIB. A
                        </button>
                        <button 
                          onClick={() => { if (smartPayData) window.location.assign(smartPayData.link_b); }}
                          className="py-4 bg-indigo-500 text-white font-bold rounded-2xl shadow-md active:scale-95 text-sm"
                        >
                          POSSIB. B
                        </button>
                        <button 
                          onClick={() => { if (smartPayData) window.location.assign(smartPayData.link_c); }}
                          className="py-4 bg-slate-600 text-white font-bold rounded-2xl shadow-md active:scale-95 text-sm"
                        >
                          POSSIB. C
                        </button>
                        <button 
                          onClick={() => { if (smartPayData) window.location.assign(smartPayData.link_d); }}
                          className="py-4 bg-slate-500 text-white font-bold rounded-2xl shadow-md active:scale-95 text-sm"
                        >
                          POSSIB. D
                        </button>
                        <button 
                          onClick={() => { if (smartPayData) window.location.assign(smartPayData.link_e); }}
                          className="py-4 bg-emerald-600 text-white font-bold rounded-2xl shadow-md active:scale-95 text-sm"
                        >
                          POSSIB. E
                        </button>
                        <button 
                          onClick={() => { if (smartPayData) window.location.assign(smartPayData.link_f); }}
                          className="py-4 bg-emerald-500 text-white font-bold rounded-2xl shadow-md active:scale-95 text-sm"
                        >
                          POSSIB. F
                        </button>
                      </div>

                      <button 
                        onClick={() => setShowManualSteps(true)}
                        className="w-full py-3 text-slate-500 font-bold hover:text-slate-800 transition-colors text-sm"
                      >
                        O app não abriu? Ver passos manuais
                      </button>
                    </div>
                  ) : (
                    <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100 text-left space-y-4 animate-in slide-in-from-right-4">
                      <h4 className="font-black text-indigo-900 text-base mb-2">Siga estes passos:</h4>
                      <div className="space-y-3">
                        <div className="flex gap-4">
                          <div className="w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs font-bold shrink-0">1</div>
                          <p className="text-sm text-indigo-800 leading-snug">Abra o aplicativo <b>InfinitePay</b> no seu celular.</p>
                        </div>
                        <div className="flex gap-4">
                          <div className="w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs font-bold shrink-0">2</div>
                          <p className="text-sm text-indigo-800 leading-snug">Toque em <b>'Vender'</b> e informe o valor de <b>{total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</b>.</p>
                        </div>
                        <div className="flex gap-4">
                          <div className="w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs font-bold shrink-0">3</div>
                          <p className="text-sm text-indigo-800 leading-snug">Clique em <b>'Receber Agora'</b> e peça para a cliente aproximar o cartão.</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => setShowManualSteps(false)}
                        className="w-full mt-4 py-3 bg-white text-indigo-600 font-black rounded-xl border border-indigo-200 text-xs uppercase tracking-widest"
                      >
                        Voltar para os Links
                      </button>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-4 py-4">
                    <div className="h-px bg-slate-200 flex-1" />
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Após Batida do Cartão</span>
                    <div className="h-px bg-slate-200 flex-1" />
                  </div>

                  <button 
                    onClick={handleManualConfirm}
                    className="w-full py-4 bg-emerald-500 text-white font-bold rounded-2xl flex items-center justify-center gap-3 hover:bg-emerald-600 transition-all shadow-md active:scale-95"
                  >
                    <CheckCircle2 className="w-5 h-5" />
                    CONFIRMAR RECEBIMENTO
                  </button>
                </>

                <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-between opacity-60 grayscale">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Integrado via Deep Link</span>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400">P2 SMART COMPATÍVEL</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
