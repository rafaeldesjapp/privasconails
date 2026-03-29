'use client';

import React, { useState, useEffect } from 'react';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import { useSupabaseAuth } from '@/hooks/use-supabase';
import Auth from '@/components/Auth';
import { supabase } from '@/lib/supabase';
import { 
  History as HistoryIcon, 
  Search, 
  Filter, 
  Printer, 
  CalendarDays, 
  Clock, 
  CreditCard,
  CheckCircle2,
  FileText,
  User as UserIcon,
  RefreshCw
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface HistoricoItem {
  id: string;
  client_name: string;
  service: string;
  date: string;
  time: string;
  duration_minutes: number;
  payment_method: string;
  created_at: string;
}

export default function HistoricoPage() {
  const { user, role, loading } = useSupabaseAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [historico, setHistorico] = useState<HistoricoItem[]>([]);
  const [isFetching, setIsFetching] = useState(true);

  // Filtros de Admin
  const [filterDateStart, setFilterDateStart] = useState('');
  const [filterDateEnd, setFilterDateEnd] = useState('');
  const [filterPayment, setFilterPayment] = useState('');
  const [filterService, setFilterService] = useState('');
  const [filterName, setFilterName] = useState('');

  const carregarHistorico = async () => {
    if (!user) return;
    setIsFetching(true);
    try {
      let query = supabase
        .from('agendamentos')
        .select('*')
        .eq('status', 'concluido')
        .order('date', { ascending: false })
        .order('time', { ascending: false });

      if (role === 'cliente') {
        query = query.eq('user_id', user.id);
      } else if (role === 'admin') {
        if (filterDateStart) query = query.gte('date', filterDateStart);
        if (filterDateEnd) query = query.lte('date', filterDateEnd);
        if (filterPayment) query = query.eq('payment_method', filterPayment);
        if (filterService) query = query.ilike('service', `%${filterService}%`);
        if (filterName) query = query.ilike('client_name', `%${filterName}%`);
      }

      const { data, error } = await query;
      
      if (error && error.message.includes('column')) {
        console.warn("Colunas de Histórico ainda não existem no DB. Retornando vazio para não quebrar a tela.");
        setHistorico([]);
      } else if (error) {
        throw error;
      } else {
        setHistorico(data || []);
      }
      
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsFetching(false);
    }
  };

  useEffect(() => {
    if (!loading) {
      // Pequeno debounce artificial para não metralhar requisições enquanto digita rápido
      const timeout = setTimeout(() => {
        carregarHistorico();
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [user, loading, role, filterDateStart, filterDateEnd, filterPayment, filterService, filterName]);

  const handlePrint = () => {
    window.print();
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

  // Função utilitária
  const converteMinutosEmHoras = (mins: number | undefined) => {
    if (!mins) return 'Não registrado';
    const hours = Math.floor(mins / 60);
    const m = mins % 60;
    if (hours === 0) return `${m}m`;
    if (m === 0) return `${hours}h`;
    return `${hours}h ${m}m`;
  };

  return (
    <div className="min-h-screen bg-slate-50 print:bg-white print:m-0 print:p-0">
      <div className="print:hidden">
        <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      </div>
      
      <div className="lg:ml-64 flex flex-col min-h-screen print:ml-0 print:min-h-0">
        <div className="print:hidden">
          <Header onMenuClick={() => setIsSidebarOpen(true)} />
        </div>
        
        <main className="flex-1 p-4 lg:p-8 print:p-0">
          <div className="max-w-7xl mx-auto space-y-6">
            
            {/* Cabeçalho */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <div>
                <h1 className="text-2xl md:text-3xl font-black text-slate-800 font-headline flex items-center gap-3">
                  <HistoryIcon className="w-8 h-8 text-blue-600 print:text-black" />
                  Histórico de Atendimentos
                </h1>
                <p className="text-slate-500 mt-1">
                  {role === 'admin' ? 'Controle consolidado de todos os serviços realizados e faturados.' : 'Seus recibos e serviços anteriores no estúdio.'}
                </p>
              </div>
              
              {role === 'admin' && (
                <button 
                  onClick={handlePrint}
                  className="print:hidden bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold py-2.5 px-6 rounded-xl shadow-sm transition-all flex items-center gap-2 hover:border-slate-300"
                >
                  <Printer className="w-5 h-5" />
                  Exportar PDF
                </button>
              )}
            </div>

            {/* Filtros OTIMIZADOS Administrativos */}
            {role === 'admin' && (
              <div className="print:hidden bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-4">
                <div className="flex items-center gap-2 mb-2 text-slate-700 font-bold">
                  <Filter className="w-5 h-5" />
                  <h3>Filtros Avançados</h3>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wider">De (Data)</label>
                    <input 
                      type="date" 
                      value={filterDateStart}
                      onChange={(e) => setFilterDateStart(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 text-slate-700"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wider">Até (Data)</label>
                    <input 
                      type="date" 
                      value={filterDateEnd}
                      onChange={(e) => setFilterDateEnd(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 text-slate-700"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wider">Cliente (Nome)</label>
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input 
                        type="text" 
                        placeholder="Buscar cliente..." 
                        value={filterName}
                        onChange={(e) => setFilterName(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wider">Serviço oferecido</label>
                    <input 
                      type="text" 
                      placeholder="Ex: Fibra, Gel..." 
                      value={filterService}
                      onChange={(e) => setFilterService(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 text-slate-700"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wider">Pagamento</label>
                    <select 
                      value={filterPayment}
                      onChange={(e) => setFilterPayment(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 text-slate-700"
                    >
                      <option value="">Todos</option>
                      <option value="Pix">PIX</option>
                      <option value="Dinheiro">Dinheiro</option>
                      <option value="Crédito">Cartão de Crédito</option>
                      <option value="Débito">Cartão de Débito</option>
                    </select>
                  </div>
                </div>
                
                {/* Botão para limpar filtros caso exista algum ativo */}
                {(filterDateStart || filterDateEnd || filterPayment || filterService || filterName) && (
                  <div className="flex justify-end pt-2">
                    <button 
                      onClick={() => {
                        setFilterDateStart(''); setFilterDateEnd(''); setFilterPayment(''); 
                        setFilterService(''); setFilterName('');
                      }}
                      className="text-sm text-red-500 hover:text-red-700 font-medium flex items-center gap-1 transition-colors"
                    >
                      <RefreshCw className="w-4 h-4" /> Limpar Filtros
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Listagem Global */}
            <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-slate-200 print:shadow-none print:border-none print:p-0">
              
              <div className="hidden print:block mb-6 pb-4 border-b border-black">
                <h2 className="text-2xl font-black mb-1">Relatório de Serviços Executados</h2>
                <p className="text-sm font-medium">Data de emissão: {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
                <p className="text-sm mt-2 font-bold">Filtros aplicados localmente refletidos neste documento.</p>
              </div>

              {isFetching ? (
                <div className="py-20 flex justify-center">
                   <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
                </div>
              ) : historico.length === 0 ? (
                <div className="text-center py-24 border-2 border-dashed border-slate-100 rounded-2xl">
                  <FileText className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-slate-700 mb-2">Nenhum registro encontrado</h3>
                  <p className="text-slate-500">
                    O histórico está vazio ou os filtros ocultaram tudo.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b-2 border-slate-100 text-slate-400 font-bold tracking-wide uppercase text-xs">
                        <th className="py-4 px-4 pl-0">Data e Hora</th>
                        {role === 'admin' && <th className="py-4 px-4">Cliente</th>}
                        <th className="py-4 px-4">Serviço Realizado</th>
                        <th className="py-4 px-4">Tempo Total</th>
                        <th className="py-4 px-4 pr-0 text-right">Pagamento</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {historico.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50 transition-colors print:hover:bg-transparent">
                          <td className="py-4 px-4 pl-0 whitespace-nowrap">
                            <div className="flex items-center gap-2 text-slate-700 font-medium">
                              <CalendarDays className="w-4 h-4 text-slate-400" />
                              {item.date ? format(parseISO(item.date), "dd/MM/yy") : 'N/A'}
                              <span className="text-slate-300 mx-1">•</span>
                              <Clock className="w-4 h-4 text-slate-400" />
                              {item.time}
                            </div>
                          </td>
                          {role === 'admin' && (
                            <td className="py-4 px-4 font-medium text-slate-800 flex items-center gap-2 mt-2">
                              {item.client_name}
                            </td>
                          )}
                          <td className="py-4 px-4">
                            <span className="inline-block bg-pink-50 text-pink-700 px-3 py-1 rounded-full text-sm font-bold border border-pink-100 print:border-black print:text-black print:bg-transparent">
                              {item.service}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-slate-600 font-medium text-sm">
                            {converteMinutosEmHoras(item.duration_minutes)}
                          </td>
                          <td className="py-4 px-4 pr-0 text-right">
                             <div className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-700 bg-slate-100 px-3 py-1 rounded-lg print:border print:border-black print:bg-transparent">
                               <CreditCard className="w-4 h-4 text-slate-500 print:hidden" />
                               {item.payment_method || 'Não registrado'}
                             </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            
          </div>
        </main>
      </div>
    </div>
  );
}
