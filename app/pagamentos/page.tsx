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
        // Busca o extrato de agendamentos que têm payment_method
        let q = supabase
          .from('agendamentos')
          .select('id, client_name, service, date, time, status, user_id, payment_method, updated_at')
          .not('payment_method', 'is', null)
          .order('updated_at', { ascending: false });
          
        if (role === 'cliente') {
           q = q.eq('user_id', user!.id);
        }
        
        const { data, error } = await q;
        if (error) throw error;
        
        if (isMounted && data) {
           setExtrato(data);
        }

        // Se for admin, tenta buscar as chaves da tabela configuracoes
        if (role === 'admin') {
           try {
             const { data: configData, error: configErr } = await supabase
                .from('configuracoes')
                .select('id, valor');
             
             if (!configErr && configData && isMounted) {
                const acc = configData.find((c: any) => c.id === 'MERCADO_PAGO_ACCESS_TOKEN');
                const pub = configData.find((c: any) => c.id === 'MERCADO_PAGO_PUBLIC_KEY');
                if (acc) setMpAccess(acc.valor);
                if (pub) setMpPublic(pub.valor);
             }
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

  const calcularMetricas = () => {
     let pix = 0;
     let cartao = 0;
     let dinheiro = 0;
     
     extrato.forEach(e => {
       const p = e.payment_method?.toLowerCase() || '';
       if (p.includes('pix')) pix++;
       else if (p.includes('dinheiro') || p.includes('espécie')) dinheiro++;
       else cartao++; // Maquininha, Mercado Pago, PicPay, Crédito, Débito caem aqui
     });
     
     return { total: extrato.length, pix, cartao, dinheiro };
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
                   {role === 'admin' ? 'Dashboard Financeiro' : 'Meus Recibos'}
                 </h1>
                 <p className="text-slate-500 mt-1">
                   {role === 'admin' ? 'Acompanhe as entradas de caixa e configure o portal de pagamentos.' : 'Histórico de todos os seus pagamentos confirmados.'}
                 </p>
              </div>

              {/* Tabs do Admin */}
              {role === 'admin' && (
                <div className="flex bg-white rounded-xl shadow-sm border border-slate-200 p-1 shrink-0">
                  <button 
                    onClick={() => setActiveTab('extrato')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'extrato' ? 'bg-slate-100 text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    <LineChart className="w-4 h-4" /> Resumo
                  </button>
                  <button 
                    onClick={() => setActiveTab('configs')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'configs' ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    <Settings className="w-4 h-4" /> Integração
                  </button>
                </div>
              )}
            </div>

            {/* View do Extrato e Dashboard */}
            {activeTab === 'extrato' && (
               <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                 
                 {/* Cards de Resumo Admin */}
                 {role === 'admin' && (
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
                              {role === 'admin' 
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
                                const d = parseISO(item.updated_at || item.created_at);
                                return (
                                 <tr key={item.id} className="hover:bg-slate-50 transition-colors group">
                                   <td className="px-6 py-4 whitespace-nowrap">
                                      <div className="text-sm font-bold text-slate-700">{format(d, "dd MMMM yyyy", { locale: ptBR })}</div>
                                      <div className="text-xs text-slate-400 mt-0.5">{format(d, "HH:mm")}</div>
                                   </td>
                                   <td className="px-6 py-4">
                                      <div className="text-sm font-bold text-slate-800 line-clamp-1">{item.client_name}</div>
                                      <div className="text-xs font-medium text-slate-500 mt-0.5 line-clamp-1">{item.service}</div>
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
                                      <div className="inline-flex items-center gap-1 text-emerald-600">
                                         <CheckCircle2 className="w-4 h-4" />
                                         <span className="text-xs font-black uppercase tracking-widest">Liquidado</span>
                                      </div>
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
            {activeTab === 'configs' && role === 'admin' && (
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
