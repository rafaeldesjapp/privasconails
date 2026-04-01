'use client';

import React, { useState, useEffect } from 'react';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import { useSupabaseAuth } from '@/hooks/use-supabase';
import Auth from '@/components/Auth';
import { 
  CreditCard, Wallet, Smartphone, ShieldCheck, 
  Settings, LineChart, FileText, CheckCircle2, 
  ShieldAlert, RefreshCw, Key, Info, Save, Banknote, QrCode, Lock
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function PagamentosPage() {
  const { user, role, loading } = useSupabaseAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'extrato' | 'configs'>('extrato');
  
  const [extrato, setExtrato] = useState<any[]>([]);
  const [pendentes, setPendentes] = useState<any[]>([]);
  const [pricesLookup, setPricesLookup] = useState<Record<string, number>>({});
  const [isLoadingData, setIsLoadingData] = useState(true);

  // Configurações (Admin)
  const [mpAccess, setMpAccess] = useState('');
  const [mpPublic, setMpPublic] = useState('');
  const [isSavingKeys, setIsSavingKeys] = useState(false);

  useEffect(() => {
    if (!user) return;
    
    let isMounted = true;
    async function fetchData() {
      try {
        setIsLoadingData(true);
        // Busca o extrato de transacoes
        let q = supabase
          .from('transacoes')
          .select('*')
          .order('created_at', { ascending: false });
          
        if (role === 'cliente') {
           q = q.eq('user_id', user!.id);
        }
        
        const { data, error } = await q;
        if (error) throw error;
        
        if (isMounted && data) {
           setExtrato(data);
        }

        // Se for admin ou desenvolvedor, tenta buscar as chaves da tabela configuracoes
        if (role === 'admin' || role === 'desenvolvedor') {
           try {
             const { data: configData, error: configErr } = await supabase
                .from('configuracoes')
                .select('id, valor');
             
             if (!configErr && configData && isMounted) {
                const acc = configData.find((c: any) => c.id === 'MERCADO_PAGO_ACCESS_TOKEN');
                const pub = configData.find((c: any) => c.id === 'MERCADO_PAGO_PUBLIC_KEY');
                if (acc) setMpAccess(acc.valor);
                if (pub) setMpPublic(pub.valor);

                const tab = configData.find((c: any) => c.id === 'tabela_precos');
                if (tab) {
                    let dataValor = tab.valor;
                    if (typeof dataValor === 'string') try { dataValor = JSON.parse(dataValor); } catch(e){}
                    const lookup: Record<string, number> = {};
                    if (Array.isArray(dataValor)) {
                        dataValor.forEach((cat: any) => {
                            if (cat.items) cat.items.forEach((it: any) => { lookup[it.name] = Number(it.price); });
                            else if (cat.itens) cat.itens.forEach((it: any) => { lookup[it.nome] = Number(it.preco); });
                        });
                    }
                    setPricesLookup(lookup);
                }
             }

             // Busca agendamentos pendentes
             const { data: pendData } = await supabase
               .from('agendamentos')
               .select('*')
               .in('status', ['pendente_dinheiro', 'pendente_aproximacao'])
               .order('date', { ascending: false });
               
             if (pendData && isMounted) setPendentes(pendData);

           } catch(e) {}
        }
        
      } catch (err) {
        console.error("Erro ao buscar extrato", err);
      } finally {
        if (isMounted) setIsLoadingData(false);
      }
    }
    
    fetchData();
    return () => { isMounted = false; };
  }, [user, role]);

  const handleSaveKeys = async () => {
    setIsSavingKeys(true);
    try {
       // Primeiro tentamos inserir na tabela configuracoes
       // Note: Essa tabela precisa existir no banco. 
       // Se der erro 'relation does not exist', pedimos para o usuário criar via SQL.
       const updates = [
         { id: 'MERCADO_PAGO_ACCESS_TOKEN', valor: mpAccess },
         { id: 'MERCADO_PAGO_PUBLIC_KEY', valor: mpPublic }
       ];
       
       for (const update of updates) {
         const { error } = await supabase.from('configuracoes').upsert(update);
         if (error) {
           if (error.code === '42P01') {
             throw new Error("A tabela 'configuracoes' não existe. Por favor, rode o script SQL para criá-la (Veja as instruções no plano).");
           }
           throw error;
         }
       }
       alert("✅ Chaves salvas com sucesso no Cofre!");
    } catch (err: any) {
       alert(`⚠️ Atenção: ${err.message}`);
    } finally {
       setIsSavingKeys(false);
    }
  };

  const parseServicesObj = (str: string) => {
    if (!str) return [{ qty: 1, name: '' }];
    return str.split(' + ').map(p => {
      const match = p.match(/^(\d+)x\s+(.*)$/);
      if (match) return { qty: Number(match[1]), name: match[2] };
      return { qty: 1, name: p };
    });
  };

  const handleApprovePending = async (p: any) => {
    setIsLoadingData(true);
    try {
      let total = 0;
      let coreStr = p.service;
      if (coreStr.includes(' | ')) coreStr = coreStr.split(' | ')[0];
      const parsed = parseServicesObj(coreStr);
      parsed.forEach(sub => {
        total += (pricesLookup[sub.name] || 0) * sub.qty;
      });

      const pm = p.status === 'pendente_dinheiro' ? 'dinheiro_caixa' : 'aproximacao_celular';

      const { error: err1 } = await supabase.from('agendamentos').update({ status: 'concluido', payment_method: pm }).eq('id', p.id);
      if (err1) throw err1;
      
      const { error: err2 } = await supabase.from('transacoes').insert({
         user_id: p.user_id,
         client_name: p.client_name,
         amount: total,
         payment_method: pm,
         status: 'approved',
         services_desc: coreStr
      });
      if (err2) throw err2;

      window.location.reload();
    } catch (err: any) {
      console.error(err);
      alert("Erro ao aprovar: " + (err.message || 'Erro desconhecido.'));
      setIsLoadingData(false);
    }
  };

  const calcularMetricas = () => {
     let pix = 0;
     let cartao = 0;
     let dinheiro = 0;
     
     extrato.forEach(e => {
       if (e.status !== 'approved') return;
       const p = e.payment_method?.toLowerCase() || '';
       if (p.includes('pix')) pix++;
       else if (p.includes('dinheiro') || p.includes('espécie')) dinheiro++;
       else cartao++; // Maquininha, Mercado Pago, PicPay, Crédito, Débito caem aqui
     });
     
     const approvedTotal = extrato.filter(e => e.status === 'approved').length;
     return { total: approvedTotal, pix, cartao, dinheiro };
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  const m = calcularMetricas();

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      
      <div className="lg:ml-64 flex flex-col min-h-screen">
        <Header onMenuClick={() => setIsSidebarOpen(true)} />
        
        <main className="flex-1 p-4 lg:p-8">
          <div className="max-w-6xl mx-auto space-y-6">
            
            {/* Cabecalho da Tela */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                 <h1 className="text-2xl sm:text-3xl font-black text-slate-800 font-headline flex items-center gap-3">
                   <Wallet className="w-8 h-8 text-blue-600" />
                   {(role === 'admin' || role === 'desenvolvedor') ? 'Dashboard Financeiro' : 'Meus Recibos'}
                 </h1>
                 <p className="text-slate-500 mt-1">
                   {(role === 'admin' || role === 'desenvolvedor') ? 'Acompanhe as entradas de caixa e pagamentos.' : 'Histórico de todos os seus pagamentos confirmados.'}
                 </p>
              </div>

              {/* Tabs do Admin/Desenvolvedor */}
              {(role === 'admin' || role === 'desenvolvedor') && (
                <div className="flex bg-white rounded-xl shadow-sm border border-slate-200 p-1 shrink-0">
                  <button 
                    onClick={() => setActiveTab('extrato')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'extrato' ? 'bg-slate-100 text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    <LineChart className="w-4 h-4" /> Resumo
                  </button>
                  {role === 'desenvolvedor' && (
                    <button 
                      onClick={() => setActiveTab('configs')}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'configs' ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      <Settings className="w-4 h-4" /> Integração
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* View do Extrato e Dashboard */}
            {activeTab === 'extrato' && (
               <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                 
                 {/* Cards de Resumo Admin */}
                 {(role === 'admin' || role === 'desenvolvedor') && (
                   <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                     <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
                       <span className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">Total Transações</span>
                       <div className="flex items-center gap-3 mt-auto">
                          <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center"><LineChart className="w-5 h-5"/></div>
                          <span className="text-3xl font-black text-slate-800 tabular-nums">{m.total}</span>
                       </div>
                     </div>
                     <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
                       <span className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">Volume Pix</span>
                       <div className="flex items-center gap-3 mt-auto">
                          <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center"><QrCode className="w-5 h-5"/></div>
                          <span className="text-3xl font-black text-slate-800 tabular-nums">{m.pix}</span>
                       </div>
                     </div>
                     <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
                       <span className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">Cartão/Crédito</span>
                       <div className="flex items-center gap-3 mt-auto">
                          <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center"><CreditCard className="w-5 h-5"/></div>
                          <span className="text-3xl font-black text-slate-800 tabular-nums">{m.cartao}</span>
                       </div>
                     </div>
                     <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
                       <span className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">Dinheiro Físico</span>
                       <div className="flex items-center gap-3 mt-auto">
                          <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center"><Banknote className="w-5 h-5"/></div>
                          <span className="text-3xl font-black text-slate-800 tabular-nums">{m.dinheiro}</span>
                       </div>
                     </div>
                   </div>
                 )}

                 {/* Fila de Aprovação Analógica */}
                 {(role === 'admin' || role === 'desenvolvedor') && pendentes.length > 0 && (
                    <div className="bg-amber-50 rounded-2xl border border-amber-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-top-2">
                      <div className="px-6 py-4 border-b border-amber-200/50 flex items-center gap-3">
                         <ShieldAlert className="w-5 h-5 text-amber-600" />
                         <h2 className="font-bold text-amber-800 text-lg">Aguardando Avaliação no Caixa</h2>
                      </div>
                      <div className="p-4 flex flex-col gap-3">
                        {pendentes.map(p => (
                          <div key={p.id} className="bg-white p-4 rounded-xl shadow-sm border border-amber-100 flex flex-col sm:flex-row justify-between items-center gap-4">
                             <div>
                               <p className="font-bold text-slate-800">{p.client_name}</p>
                               <p className="text-sm font-medium text-slate-500">{p.service} <span className="text-xs ml-2 text-slate-400">({p.time})</span></p>
                               <p className="text-xs font-black text-amber-600 uppercase mt-1 tracking-wider">
                                  {p.status === 'pendente_dinheiro' ? 'Físico / Dinheiro' : 'Maquininha'}
                               </p>
                             </div>
                             <button 
                                onClick={() => handleApprovePending(p)}
                                className="w-full sm:w-auto px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm"
                             >
                               <CheckCircle2 className="w-4 h-4" /> Aprovar Baixa
                             </button>
                          </div>
                        ))}
                      </div>
                    </div>
                 )}

                 {/* Tabela de Extrato */}
                 <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-5 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50">
                       <FileText className="w-5 h-5 text-slate-500" />
                       <h2 className="font-bold text-slate-800 text-lg">Histórico de Transações</h2>
                    </div>
                    
                    <div className="overflow-x-auto min-h-[300px] relative">
                       {isLoadingData && (
                         <div className="absolute inset-0 bg-white/80 z-10 flex flex-col items-center justify-center pt-10 backdrop-blur-sm">
                           <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mb-4" />
                           <span className="text-slate-500 font-bold">Resgatando recibos do cofre...</span>
                         </div>
                       )}

                       {(!isLoadingData && extrato.length === 0) && (
                         <div className="p-10 text-center flex flex-col items-center justify-center opacity-60">
                            <ShieldAlert className="w-12 h-12 text-slate-300 mb-4" />
                            <p className="text-slate-500 font-bold text-lg">Nenhum pagamento registrado ainda.</p>
                            <p className="text-slate-400 text-sm mt-1">
                              {(role === 'admin' || role === 'desenvolvedor') 
                                ? 'Finalize os agendamentos marcando a forma de pagamento e eles aparecerão aqui.'
                                : 'Quando você pagar ou realizar um serviço, seu recibo aparecerá aqui.'}
                            </p>
                         </div>
                       )}

                       {(!isLoadingData && extrato.length > 0) && (
                         <table className="w-full text-left border-collapse">
                           <thead>
                             <tr className="bg-white text-xs uppercase tracking-wider text-slate-400 border-b border-slate-100">
                               <th className="px-6 py-4 font-bold">Data & Hora</th>
                               <th className="px-6 py-4 font-bold">Cliente / Serviço</th>
                               <th className="px-6 py-4 font-bold">Modalidade</th>
                               <th className="px-6 py-4 font-bold text-right">Status</th>
                             </tr>
                           </thead>
                           <tbody className="divide-y divide-slate-50">
                             {extrato.map((item) => {
                                const d = parseISO(item.created_at);
                                const isApproved = item.status === 'approved';
                                const isPending = item.status === 'pending';
                                
                                return (
                                 <tr key={item.id} className="hover:bg-slate-50 transition-colors group">
                                   <td className="px-6 py-4 whitespace-nowrap">
                                      <div className="text-sm font-bold text-slate-700">{format(d, "dd MMMM yyyy", { locale: ptBR })}</div>
                                      <div className="text-xs text-slate-400 mt-0.5">{format(d, "HH:mm")}</div>
                                   </td>
                                   <td className="px-6 py-4">
                                      <div className="text-sm font-bold text-slate-800 line-clamp-1">{item.client_name}</div>
                                      <div className="text-xs font-medium text-slate-500 mt-0.5 line-clamp-1">{item.services_desc}</div>
                                      <div className="text-xs font-black text-slate-700 mt-1">R$ {Number(item.amount).toFixed(2).replace('.', ',')}</div>
                                   </td>
                                   <td className="px-6 py-4 whitespace-nowrap">
                                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold capitalize border border-slate-200">
                                         {item.payment_method?.toLowerCase().includes('pix') ? <QrCode className="w-3.5 h-3.5 text-emerald-600"/> :
                                          item.payment_method?.toLowerCase().includes('dinheiro') ? <Banknote className="w-3.5 h-3.5 text-amber-600"/> :
                                          <CreditCard className="w-3.5 h-3.5 text-indigo-600"/>}
                                         {item.payment_method}
                                      </div>
                                   </td>
                                   <td className="px-6 py-4 whitespace-nowrap text-right">
                                      {isApproved ? (
                                        <div className="inline-flex items-center justify-end gap-1 text-emerald-600">
                                           <CheckCircle2 className="w-4 h-4" />
                                           <span className="text-xs font-black uppercase tracking-widest">Aprovado</span>
                                        </div>
                                      ) : isPending ? (
                                        <div className="inline-flex items-center justify-end gap-1 text-amber-500">
                                           <RefreshCw className="w-4 h-4 animate-spin-slow" />
                                           <span className="text-xs font-black uppercase tracking-widest">Pendente</span>
                                        </div>
                                      ) : (
                                        <div className="inline-flex items-center justify-end gap-1 text-rose-500">
                                           <ShieldAlert className="w-4 h-4" />
                                           <span className="text-xs font-black uppercase tracking-widest">Recusado</span>
                                        </div>
                                      )}
                                   </td>
                                 </tr>
                                );
                             })}
                           </tbody>
                         </table>
                       )}
                    </div>
                 </div>
               </div>
            )}

            {/* View das Configurações Admin */}
            {activeTab === 'configs' && role === 'desenvolvedor' && (
               <div className="max-w-3xl animate-in fade-in slide-in-from-right-2">
                 <div className="bg-white rounded-2xl border border-slate-200 shadow-xl shadow-blue-900/5 overflow-hidden">
                    {/* Cofre Header */}
                    <div className="bg-[#00B1EA]/10 px-8 py-8 border-b border-[#00B1EA]/20 relative overflow-hidden">
                       <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-[#00B1EA]/20 to-transparent pointer-events-none" />
                       <ShieldCheck className="w-12 h-12 text-[#00B1EA] mb-4 relative z-10" />
                       <h2 className="text-2xl font-black text-slate-800 capitalize relative z-10">Cofre de Integração</h2>
                       <p className="text-slate-600 mt-2 font-medium relative z-10">Conecte sua conta do <b>Mercado Pago</b> para que a tela de Checkout comece a debitar valores reais direto na sua conta bancária oficial.</p>
                    </div>

                    <div className="p-8 space-y-8">
                       
                       <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-4 text-amber-800 text-sm">
                          <Info className="w-6 h-6 shrink-0 text-amber-600" />
                          <div>
                            <p className="font-bold mb-1">Passo a Passo Rápido:</p>
                            <ol className="list-decimal pl-4 space-y-1.5 opacity-90">
                              <li>Acesse o <a href="https://www.mercadopago.com.br/developers/panel" target="_blank" className="font-black underline hover:text-amber-900">Painel de Desenvolvedores</a> do Mercado Pago.</li>
                              <li>Crie uma nova aplicação no menu <i>"Suas Integrações"</i>.</li>
                              <li>Copie as credenciais de Produção e cole nos campos abaixo.</li>
                            </ol>
                          </div>
                       </div>

                       <div className="space-y-6">
                         <div>
                            <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-2">
                               <Key className="w-4 h-4 text-slate-400" /> Public Key (Chave Pública)
                            </label>
                            <input 
                               type="text"
                               placeholder="APP_USR-00000000-0000-0000-0000-000000000000"
                               value={mpPublic}
                               onChange={e => setMpPublic(e.target.value)}
                               className="w-full font-mono text-sm bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all placeholder-slate-300 shadow-inner"
                            />
                            <p className="text-xs text-slate-400 mt-1.5 font-medium ml-1">Usada para processar cartões de crédito na tela do cliente com segurança extrema.</p>
                         </div>

                         <div>
                            <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-2">
                               <Lock className="w-4 h-4 text-slate-400" /> Access Token (Token Privado)
                            </label>
                            <input 
                               type="password"
                               placeholder="APP_USR-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                               value={mpAccess}
                               onChange={e => setMpAccess(e.target.value)}
                               className="w-full font-mono text-sm bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all placeholder-slate-300 shadow-inner"
                            />
                            <p className="text-xs text-slate-400 mt-1.5 font-medium ml-1">Token privado. Nunca o mostre a ninguém. Ele gera os QR Codes de PIX reais e liquida o dinheiro.</p>
                         </div>
                       </div>

                       <div className="pt-4 flex justify-end border-t border-slate-100">
                         <button 
                           onClick={handleSaveKeys}
                           disabled={isSavingKeys}
                           className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-xl shadow-lg shadow-blue-500/30 transition-all flex items-center gap-2 focus:scale-95 disabled:opacity-50"
                         >
                           {isSavingKeys ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                           Salvar e Ativar Integração
                         </button>
                       </div>

                    </div>
                 </div>
               </div>
            )}

          </div>
        </main>
      </div>
    </div>
  );
}
