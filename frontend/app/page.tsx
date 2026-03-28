'use client';

import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Calendar, 
  TrendingUp, 
  DollarSign, 
  ArrowUpRight, 
  ArrowDownRight,
  Clock,
  ChevronRight,
  Plus,
  Search
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { useSupabaseAuth, useSupabaseQuery } from '@/hooks/use-supabase';

const Dashboard = () => {
  const { user } = useSupabaseAuth();
  
  const { data: contacts } = useSupabaseQuery('contacts', {
    where: user ? { column: 'uid', value: user.id } : undefined
  });

  const { data: appointments } = useSupabaseQuery('appointments', {
    where: user ? { column: 'uid', value: user.id } : undefined,
    orderBy: { column: 'date', ascending: true }
  });

  const stats = {
    totalContacts: contacts?.length || 0,
    totalValue: contacts?.reduce((acc, curr) => acc + (curr.open_value || 0), 0) || 0,
    upcomingAppointments: appointments?.length || 0,
    activeOpportunities: 0 // Placeholder for now
  };

  const recentContacts = contacts?.slice(0, 5) || [];
  const todayAppointments = appointments?.slice(0, 5) || [];

  const cards = [
    { title: 'Total de Contatos', value: stats.totalContacts || '124', icon: Users, trend: '+12%', trendUp: true, color: 'blue' },
    { title: 'Valor em Pipeline', value: `R$ ${(stats.totalValue || 450000).toLocaleString('pt-BR')}`, icon: DollarSign, trend: '+8%', trendUp: true, color: 'emerald' },
    { title: 'Agendamentos', value: stats.upcomingAppointments || '8', icon: Calendar, trend: '-2', trendUp: false, color: 'purple' },
    { title: 'Oportunidades', value: stats.activeOpportunities || '15', icon: TrendingUp, trend: '+3', trendUp: true, color: 'orange' },
  ];

  return (
    <div className="flex flex-col gap-8">
      {/* Welcome Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black font-headline text-slate-900 tracking-tight">Dashboard Executivo</h2>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">Bem-vindo de volta, {user?.email?.split('@')[0] || 'Consultor'}. Aqui está o resumo do seu dia.</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative hidden lg:block flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Pesquisa global..." 
              className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 w-full"
            />
          </div>
          <button className="flex-1 sm:flex-none px-4 sm:px-5 py-2.5 bg-gradient-to-br from-[#003d9b] to-[#0052cc] text-white font-bold rounded-xl shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2 hover:scale-[1.02] transition-all text-sm">
            <Plus className="w-5 h-5" />
            Novo Registro
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card, i) => (
          <div key={i} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow group">
            <div className="flex justify-between items-start mb-4">
              <div className={cn(
                "p-3 rounded-xl",
                card.color === 'blue' ? "bg-blue-50 text-blue-600" :
                card.color === 'emerald' ? "bg-emerald-50 text-emerald-600" :
                card.color === 'purple' ? "bg-purple-50 text-purple-600" :
                "bg-orange-50 text-orange-600"
              )}>
                <card.icon className="w-6 h-6" />
              </div>
              <div className={cn(
                "flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg",
                card.trendUp ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
              )}>
                {card.trendUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {card.trend}
              </div>
            </div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">{card.title}</p>
            <p className="text-2xl font-black font-headline text-slate-900">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Recent Activity / Appointments */}
        <div className="col-span-12 lg:col-span-8 space-y-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-extrabold font-headline">Próximos Compromissos</h3>
              <Link href="/agenda" className="text-sm font-bold text-blue-700 hover:underline flex items-center gap-1">
                Ver Agenda Completa
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="space-y-3">
              {todayAppointments.length > 0 ? todayAppointments.map((appt) => (
                <div key={appt.id} className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-blue-50 flex flex-col items-center justify-center shrink-0">
                    <span className="text-[8px] sm:text-[10px] font-black text-blue-600 uppercase leading-none">{new Date(appt.date).toLocaleDateString('pt-BR', { month: 'short' })}</span>
                    <span className="text-base sm:text-lg font-black text-slate-900 leading-none">{new Date(appt.date).getDate() + 1}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-bold text-slate-900 truncate">{appt.title}</h4>
                    <p className="text-[10px] sm:text-xs text-slate-500 font-medium truncate">{appt.startTime} - {appt.endTime} • {appt.type}</p>
                  </div>
                  <div className="flex items-center gap-1 sm:gap-2">
                    <span className="hidden xs:inline-block px-2 py-1 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-lg uppercase whitespace-nowrap">Confirmado</span>
                    <button className="p-1.5 sm:p-2 hover:bg-white hover:shadow-sm rounded-lg transition-all text-slate-400">
                      <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                  </div>
                </div>
              )) : (
                <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <p className="text-sm text-slate-500 font-medium">Nenhum compromisso agendado para hoje.</p>
                </div>
              )}
            </div>
          </div>

          {/* Performance Chart Placeholder */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 h-64 flex flex-col">
             <h3 className="text-lg font-extrabold font-headline mb-4">Desempenho de Vendas</h3>
             <div className="flex-1 bg-slate-50 rounded-xl border border-dashed border-slate-200 flex items-center justify-center">
                <p className="text-sm text-slate-400 font-medium italic">Gráfico de desempenho será carregado aqui...</p>
             </div>
          </div>
        </div>

        {/* Recent Contacts Sidebar */}
        <div className="col-span-12 lg:col-span-4 space-y-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <h3 className="text-lg font-extrabold font-headline mb-6">Contatos Recentes</h3>
            <div className="space-y-4">
              {(recentContacts.length > 0 ? recentContacts : [
                { id: '1', name: 'Beatriz Cavalcante', company: 'TechFlow', photoUrl: 'https://picsum.photos/seed/1/100/100' },
                { id: '2', name: 'Ricardo Santos', company: 'Global Log', photoUrl: 'https://picsum.photos/seed/2/100/100' },
                { id: '3', name: 'Ana Paula Silva', company: 'Inova Tech', photoUrl: 'https://picsum.photos/seed/3/100/100' },
              ]).map((contact) => (
                <Link key={contact.id} href={`/contatos/${contact.id}`} className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 transition-colors group">
                  <img src={contact.photoUrl} alt={contact.name} className="w-10 h-10 rounded-lg object-cover shadow-sm" />
                  <div className="flex-1 overflow-hidden">
                    <p className="text-sm font-bold text-slate-900 truncate group-hover:text-blue-700 transition-colors">{contact.name}</p>
                    <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">{contact.company}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-700 transition-colors" />
                </Link>
              ))}
            </div>
            <Link href="/contatos" className="w-full mt-6 py-3 bg-slate-50 text-slate-600 text-xs font-bold rounded-xl flex items-center justify-center hover:bg-slate-100 transition-colors">
              Ver Todos os Contatos
            </Link>
          </div>

          <div className="bg-gradient-to-br from-[#003d9b] to-[#0052cc] rounded-2xl p-6 shadow-lg shadow-blue-900/20 text-white">
            <h3 className="text-lg font-black font-headline mb-2">Nexus AI Insights</h3>
            <p className="text-xs text-blue-100 leading-relaxed mb-4">Você tem 3 follow-ups críticos hoje. Beatriz Cavalcante não é contatada há 5 dias e sua saúde caiu 5%.</p>
            <button className="w-full py-2.5 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl backdrop-blur-sm transition-all border border-white/10">
              Ver Recomendações
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
