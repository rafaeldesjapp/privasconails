'use client';

import React, { useState, useEffect } from 'react';
import { useSupabaseAuth } from '@/hooks/use-supabase';
import Auth from '@/components/Auth';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import { supabase } from '@/lib/supabase';
import { format, startOfMonth, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  TrendingUp, 
  Users, 
  Calendar, 
  CheckCircle2,
  Clock,
  AlertCircle
} from 'lucide-react';

export default function MeuPainel() {
  const { user, role, loading } = useSupabaseAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [loadingDados, setLoadingDados] = useState(true);

  // States reais do banco
  const [agendamentosHoje, setAgendamentosHoje] = useState(0);
  const [novosClientes, setNovosClientes] = useState(0);
  const [servicosConcluidos, setServicosConcluidos] = useState(0);
  const [proximosAgendamentos, setProximosAgendamentos] = useState<any[]>([]);
  const [atividadesRecentes, setAtividadesRecentes] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;

    let isMounted = true;

    async function fetchData() {
      try {
        setLoadingDados(true);
        const hojeStr = format(new Date(), 'yyyy-MM-dd');
        const mesAtualStr = format(startOfMonth(new Date()), 'yyyy-MM-dd');

        // 1. Agendamentos Hoje
        let qHoje = supabase
          .from('agendamentos')
          .select('*', { count: 'exact', head: true })
          .eq('date', hojeStr)
          .neq('status', 'bloqueado');
        if (role === 'cliente') qHoje = qHoje.eq('user_id', user!.id);
        const hojeResult = await qHoje;
        if (isMounted) setAgendamentosHoje(hojeResult.count || 0);

        // 2. Novos Clientes (Só admin vê todos. Cadastro no mês)
        if (role === 'admin') {
          const clientesR = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .eq('role', 'cliente')
            .gte('created_at', mesAtualStr);
          if (isMounted) setNovosClientes(clientesR.count || 0);
        } else {
          if (isMounted) setNovosClientes(0);
        }

        // 3. Serviços Finalizados no Mês (Para o cliente, os recebidos)
        let qServicos = supabase
          .from('agendamentos')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'concluido')
          .gte('date', mesAtualStr);
        if (role === 'cliente') qServicos = qServicos.eq('user_id', user!.id);
        const servicosResult = await qServicos;
        if (isMounted) setServicosConcluidos(servicosResult.count || 0);

        // 4. Próximos Agendamentos Reais (Limite 3)
        let qProximos = supabase
          .from('agendamentos')
          .select('id, client_name, service, date, time, status, user_id')
          .gte('date', hojeStr)
          .neq('status', 'bloqueado')
          .neq('status', 'cancelado')
          .order('date', { ascending: true })
          .order('time', { ascending: true })
          .limit(3);
        if (role === 'cliente') qProximos = qProximos.eq('user_id', user!.id);
        const { data: proximosData } = await qProximos;
        if (isMounted) setProximosAgendamentos(proximosData || []);

        // 5. Atividades Recentes Reais (Últimos criados)
        let qRecentes = supabase
          .from('agendamentos')
          .select('id, client_name, service, status, created_at')
          .order('created_at', { ascending: false })
          .limit(5);
        if (role === 'cliente') qRecentes = qRecentes.eq('user_id', user!.id);
        const { data: recentesData } = await qRecentes;
        if (isMounted) setAtividadesRecentes(recentesData || []);
        
      } catch (error) {
        console.error('Erro ao buscar painel:', error);
      } finally {
        if (isMounted) setLoadingDados(false);
      }
    }

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [user, role]);

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

  const estatisticas = [
    { name: 'Agendamentos Hoje', value: agendamentosHoje.toString(), icon: Calendar, color: 'text-blue-600', bg: 'bg-blue-50' },
    { name: role === 'admin' ? 'Novos Clientes (Mês)' : 'Seus Clientes', value: novosClientes.toString(), icon: Users, color: 'text-purple-600', bg: 'bg-purple-50' },
    { name: 'Serviços Finalizados (Mês)', value: servicosConcluidos.toString(), icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50' },
    { name: 'Futuros Confirmados', value: proximosAgendamentos.length.toString(), icon: TrendingUp, color: 'text-pink-600', bg: 'bg-pink-50' },
  ];

  const cardsParaExibir = role === 'admin' ? estatisticas : estatisticas.filter(e => e.name !== 'Seus Clientes');

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      
      <div className="lg:ml-64 flex flex-col min-h-screen">
        <Header onMenuClick={() => setIsSidebarOpen(true)} />
        
        <main className="flex-1 p-3 sm:p-4 lg:p-8">
          <div className="max-w-7xl mx-auto space-y-6 lg:space-y-8">
            {/* Boas-vindas */}
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-800 font-headline">
                {role === 'admin' ? 'Olá, Priscila!' : `Olá, ${user.user_metadata?.full_name?.split(' ')[0] || 'Cliente'}!`}
              </h1>
              <p className="text-sm sm:text-base text-slate-500">Aqui está o resumo do seu estúdio em tempo real.</p>
            </div>

            {/* Stats Grid */}
            <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-${cardsParaExibir.length} gap-4`}>
              {cardsParaExibir.map((stat) => (
                <div key={stat.name} className="bg-white p-4 sm:p-5 lg:p-6 rounded-xl sm:rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow relative overflow-hidden">
                  {loadingDados && (
                    <div className="absolute inset-0 bg-white/80 z-10 flex items-center justify-center">
                      <div className="animate-spin w-5 h-5 border-2 border-slate-300 border-t-blue-500 rounded-full"></div>
                    </div>
                  )}
                  <div className="flex items-center justify-between mb-3 sm:mb-4">
                    <div className={`p-1.5 sm:p-2 rounded-lg ${stat.bg}`}>
                      <stat.icon className={`w-4 h-4 sm:w-5 sm:h-5 ${stat.color}`} />
                    </div>
                  </div>
                  <p className="text-xs sm:text-sm font-medium text-slate-500 mb-0.5 sm:mb-1">{stat.name}</p>
                  <p className="text-xl sm:text-2xl font-black text-slate-800">{stat.value}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Próximos Agendamentos */}
              <div className="lg:col-span-2 space-y-3 sm:space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg sm:text-xl font-black text-slate-800 font-headline">Próximos Agendamentos</h2>
                </div>
                
                <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-slate-100 overflow-hidden relative min-h-[120px] sm:min-h-[150px]">
                  {loadingDados && (
                    <div className="absolute inset-0 bg-white/80 z-10 flex items-center justify-center">
                       <span className="text-xs sm:text-sm text-slate-500 font-medium animate-pulse">Carregando dados...</span>
                    </div>
                  )}
                  {proximosAgendamentos.length === 0 && !loadingDados && (
                    <div className="p-6 sm:p-8 text-center text-sm sm:text-base text-slate-400 font-medium">
                      Nenhum agendamento futuro encontrado.
                    </div>
                  )}
                  {proximosAgendamentos.map((agend) => {
                    const dataObj = parseISO(agend.date);
                    return (
                      <div key={agend.id} className="p-3 sm:p-4 flex items-center justify-between border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-xl bg-slate-100 flex flex-col items-center justify-center text-slate-500 min-w-[3rem]">
                            <span className="text-[10px] font-bold uppercase leading-none">{format(dataObj, 'MMM', { locale: ptBR })}</span>
                            <span className="text-lg font-black leading-none">{format(dataObj, 'dd')}</span>
                          </div>
                          <div>
                            <p className="font-bold text-slate-800">{agend.client_name}</p>
                            <p className="text-xs text-slate-500 flex items-center gap-1">
                              <Clock className="w-3 h-3" /> {agend.time} - {agend.service}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full border ${
                            agend.status === 'agendado' ? 'bg-blue-50 text-blue-700 border-blue-100' : 
                            agend.status === 'concluido' ? 'bg-green-50 text-green-700 border-green-100' :
                            'bg-red-50 text-red-700 border-red-100'
                          }`}>
                            {agend.status}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Atividades Recentes */}
              <div className="space-y-3 sm:space-y-4">
                <h2 className="text-lg sm:text-xl font-black text-slate-800 font-headline">Atividades Recentes</h2>
                <div className="bg-white p-4 sm:p-6 rounded-xl sm:rounded-2xl shadow-sm border border-slate-100 space-y-4 sm:space-y-6 relative min-h-[120px] sm:min-h-[150px]">
                  {loadingDados && (
                    <div className="absolute inset-0 bg-white/80 z-10 flex items-center justify-center"></div>
                  )}
                  {atividadesRecentes.length === 0 && !loadingDados && (
                    <div className="text-center text-slate-400 font-medium py-3 sm:py-4 text-xs sm:text-sm">
                      Nenhuma atividade recente.
                    </div>
                  )}
                  {atividadesRecentes.map((atividade) => {
                     const isNovo = atividade.status === 'agendado';
                     return (
                      <div key={atividade.id} className="flex gap-2.5 sm:gap-3">
                        <div className={`mt-1 p-1 rounded-full w-fit h-fit ${isNovo ? 'bg-blue-50' : (atividade.status === 'concluido' ? 'bg-green-50' : 'bg-red-50')}`}>
                          {isNovo ? <AlertCircle className="w-4 h-4 text-blue-600" /> : <CheckCircle2 className={`w-4 h-4 ${atividade.status === 'concluido' ? 'text-green-600' : 'text-red-600'}`} />}
                        </div>
                        <div>
                          <p className="text-sm text-slate-800 font-medium leading-tight">
                            {isNovo ? 'Agendado' : (atividade.status === 'concluido' ? 'Finalizado' : 'Cancelado')}
                          </p>
                          <p className="text-xs text-slate-500 mt-1">{atividade.client_name} - {atividade.service}</p>
                          <p className="text-[10px] text-slate-400 mt-1">
                            {format(new Date(atividade.created_at), "dd/MM 'às' HH:mm")}
                          </p>
                        </div>
                      </div>
                     );
                  })}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
