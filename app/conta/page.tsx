'use client';

import React, { useState, useEffect } from 'react';
import { useSupabaseAuth } from '@/hooks/use-supabase';
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
import { initMercadoPago, Payment } from '@mercadopago/sdk-react';

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
  const { user, role, loading: authLoading } = useSupabaseAuth();
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
  
  const [paymentAppointmentId, setPaymentAppointmentId] = useState<string | null>(null);

  // Novos Estados de Pagamento
  const [allowTab, setAllowTab] = useState(false);
  const [showPaymentOptions, setShowPaymentOptions] = useState(false);
  const [pixData, setPixData] = useState<{qr_code: string, qr_code_base64: string} | null>(null);
  const [creatingPreference, setCreatingPreference] = useState(false);

  useEffect(() => {
    if (!user) return;
    loadPrices();
    
    if (role === 'admin' || role === 'desenvolvedor') {
      loadClients();
      setViewState('select_client');
    } else if (role === 'cliente') {
      setSelectedClient({ id: user.id, name: user.user_metadata?.full_name || user.email });
      setViewState('bill');
      fetchBill(user.id);
    }
  }, [user, role]);

  const loadPrices = async () => {
    const { data } = await supabase.from('configuracoes').select('valor').eq('id', 'tabela_precos').maybeSingle();
    
    // Categorias padrão servindo como fallback caso RLS bloqueie a query da tabela configuracoes
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

    if (data?.valor && Array.isArray(data.valor)) {
      processCategories(data.valor);
    } else {
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
    
    // Pegando todos da agenda que estao agendados e sem pagamento
    const { data, error } = await supabase
      .from('agendamentos')
      .select('*')
      .eq('user_id', targetId)
      .eq('status', 'agendado')
      .is('payment_method', null);

    if (error) {
      console.error(error);
      setViewState('bill');
      return;
    }
    
    setBillingItems(data || []);
    setViewState('bill');
    setShowPaymentOptions(false);
    setPreferenceId(null);
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

  const handleManualPayment = async () => {
    if (!window.confirm('Confirmar baixa manual desta comanda no caixa?')) return;
    try {
      const updates = billingItems.map(b => ({
         id: b.id,
         status: 'concluido',
         payment_method: 'dinheiro_caixa'
      }));
      // Ideally an RPC or bulk upsert. Supabase `upsert` can work if we provide id cleanly.
      const { error } = await supabase.from('agendamentos').upsert(updates);
      if (error) throw error;
      alert('Comanda baixada com sucesso.');
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

  const handleSubmitDispute = async () => {
    if (!disputeMessage.trim()) return alert('Escreva o motivo da sua discordância.');
    setSubmittingDispute(true);
    try {
      const payload = {
        user_id: user?.id,
        type: 'question_charge',
        status: 'pendente',
        data: {
          message: disputeMessage,
          appointment_ids: billingItems.map(b => b.id),
          total_claimed: total
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
                    <h1 className="text-3xl font-black font-dancing tracking-tight text-slate-800">Priscila Vasconcelos</h1>
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
                                   {lineTotal > 0 ? `R$ ${lineTotal},00` : '--'}
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
                {billingItems.length > 0 && (
                  <div className="mt-8 space-y-3">
                    {(role === 'admin' || role === 'desenvolvedor') ? (
                       <button 
                         onClick={handleManualPayment}
                         className="w-full flex items-center justify-center gap-2 bg-green-600 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-green-700 transition-colors"
                       >
                         <Banknote className="w-6 h-6" />
                         Dar Baixa (Recebido Dinheiro/Físico)
                       </button>
                    ) : (
                      <>
                        {!showPaymentOptions ? (
                          <button 
                            onClick={() => setShowPaymentOptions(true)}
                            className="w-full flex items-center justify-center gap-2 bg-[#009EE3] text-white font-bold py-4 rounded-xl shadow-lg hover:bg-blue-600 transition-colors"
                          >
                            <CreditCard className="w-6 h-6" />
                            Tudo Certo, Pagar Agora!
                          </button>
                        ) : (
                          <div className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 shadow-sm animate-fade-in space-y-3">
                            <h3 className="text-center font-bold text-slate-800 border-b border-slate-200 pb-2 mb-4 text-sm">Como você deseja pagar?</h3>
                            
                            {/* CHECKOUT TRANSPARENTE: MERCADO PAGO PAYMENT BRICK */}
                            {pixData ? (
                               <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col items-center gap-4 text-center my-4 relative z-10 w-full animate-in fade-in zoom-in duration-300">
                                  <h4 className="font-bold text-lg text-slate-800">Pagamento via PIX gerado!</h4>
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
                                     className="mt-4 text-[#009EE3] font-bold text-sm hover:underline"
                                  >
                                    Já paguei (Voltar)
                                  </button>
                               </div>
                            ) : (
                               <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden my-4 relative z-10 w-full">
                                  <Payment
                                    initialization={{
                                      amount: Number(total.toFixed(2))
                                    }}
                                    customization={{
                                      paymentMethods: {
                                        creditCard: "all",
                                        debitCard: "all",
                                        ticket: "all",
                                        bankTransfer: "all",
                                        mercadoPago: "all",
                                      },
                                    }}
                                    onSubmit={async (param: any) => {
                                  return new Promise<void>((resolve, reject) => {
                                    const payload = {
                                      ...param.formData,
                                      appointmentIds: billingItems.map((b: any) => b.id)
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
                                           setPixData({ qr_code: response.qr_code, qr_code_base64: response.qr_code_base64 });
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

                            <button 
                              type="button"
                              onClick={async (e) => {
                                e.preventDefault();
                                try {
                                  // Substitui window.confirm para evitar bloqueios silenciosos de navegadores!
                                  setCreatingPreference(true); // Reusando estado de load para travar tela
                                  const ids = billingItems.map((b: any) => b.id);
                                  const req = await fetch('/api/admin/update-agendamento-status', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ appointmentIds: ids, status: 'pendente_dinheiro' })
                                  });
                                  const resData = await req.json();
                                  
                                  if (!req.ok) {
                                     alert("Falha no Banco: " + resData.error);
                                  } else {
                                     alert('Pendente de pagamento no Caixa Físico!');
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
                              }}
                              className="w-full p-4 border border-green-200 bg-green-50 text-green-700 font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-green-100 transition-colors"
                            >
                               <Banknote className="w-5 h-5" />
                               Dinheiro em Espécie (No Caixa)
                            </button>

                            {allowTab && (
                              <button 
                                type="button"
                                onClick={async (e) => {
                                    e.preventDefault();
                                    try {
                                      setCreatingPreference(true);
                                      const ids = billingItems.map((b:any) => b.id);
                                      const req = await fetch('/api/admin/update-agendamento-status', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ appointmentIds: ids, status: 'concluido', paymentMethod: 'fiado' })
                                      });
                                      const resData = await req.json();

                                      if (!req.ok) {
                                         alert("Falha: " + resData.error);
                                      } else {
                                         alert('Adicionado à sua conta com sucesso!');
                                         if (role === 'admin' || role === 'desenvolvedor') {
                                            setSelectedClient(null);
                                            setViewState('select_client');
                                         } else {
                                            fetchBill(user!.id);
                                         }
                                      }
                                    } catch(err:any) {
                                       alert("Erro fatal: " + err.message);
                                    } finally {
                                      setCreatingPreference(false);
                                    }
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
                            onClick={() => setShowDisputeModal(true)}
                            className="w-full flex justify-center text-sm font-bold text-slate-400 hover:text-rose-500 py-3"
                          >
                            Encontrou um erro na comanda? Clique aqui.
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )}
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
              <p className="text-sm text-center text-slate-500 mb-6">Descreva no campo abaixo o que está diferente do que você consumiu presencialmente.</p>
              
              <textarea
                value={disputeMessage}
                onChange={e => setDisputeMessage(e.target.value)}
                placeholder="Exemplo: Faltou descontar 30 reais do que paguei adiantado."
                className="w-full h-32 bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-700 outline-none focus:border-rose-400 resize-none mb-4"
              />
              
              <button 
                onClick={handleSubmitDispute}
                disabled={submittingDispute}
                className="w-full bg-rose-500 hover:bg-rose-600 text-white font-bold py-3 rounded-xl shadow-md transition-colors disabled:opacity-50"
              >
                {submittingDispute ? 'Enviando...' : 'Enviar Questionamento'}
              </button>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
