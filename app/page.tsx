'use client';

import React, { useState } from 'react';
import { useSupabaseAuth } from '@/hooks/use-supabase';
import Auth from '@/components/Auth';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import { 
  TrendingUp, 
  Users, 
  Calendar, 
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

export default function Dashboard() {
  const { user, loading } = useSupabaseAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

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

  const stats = [
    { name: 'Agendamentos Hoje', value: '12', icon: Calendar, change: '+2', trend: 'up' },
    { name: 'Novos Clientes', value: '4', icon: Users, change: '+1', trend: 'up' },
    { name: 'Faturamento Mensal', value: 'R$ 4.250', icon: DollarSign, change: '+12%', trend: 'up' },
    { name: 'Taxa de Retorno', value: '85%', icon: TrendingUp, change: '-2%', trend: 'down' },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      
      <div className="lg:ml-64 flex flex-col min-h-screen">
        <Header onMenuClick={() => setIsSidebarOpen(true)} />
        
        <main className="flex-1 p-4 lg:p-8">
          <div className="max-w-7xl mx-auto space-y-8">
            {/* Boas-vindas */}
            <div>
              <h1 className="text-3xl font-black text-slate-800 font-headline">Olá, Priscila!</h1>
              <p className="text-slate-500">Aqui está o resumo do seu estúdio hoje.</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {stats.map((stat) => (
                <div key={stat.name} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-2 bg-blue-50 rounded-lg">
                      <stat.icon className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className={`flex items-center gap-1 text-xs font-bold ${stat.trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
                      {stat.change}
                      {stat.trend === 'up' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    </div>
                  </div>
                  <p className="text-sm font-medium text-slate-500 mb-1">{stat.name}</p>
                  <p className="text-2xl font-black text-slate-800">{stat.value}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Próximos Agendamentos */}
              <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-black text-slate-800 font-headline">Próximos Agendamentos</h2>
                  <button className="text-sm font-bold text-blue-600 hover:underline">Ver todos</button>
                </div>
                
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="p-4 flex items-center justify-between border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-slate-100 flex flex-col items-center justify-center text-slate-500">
                          <span className="text-xs font-bold uppercase">Mar</span>
                          <span className="text-lg font-black leading-none">28</span>
                        </div>
                        <div>
                          <p className="font-bold text-slate-800">Maria Oliveira</p>
                          <p className="text-xs text-slate-500 flex items-center gap-1">
                            <Clock className="w-3 h-3" /> 14:30 - Alongamento em Gel
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-3 py-1 bg-blue-50 text-blue-700 text-[10px] font-bold uppercase tracking-wider rounded-full border border-blue-100">
                          Confirmado
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Atividades Recentes */}
              <div className="space-y-4">
                <h2 className="text-xl font-black text-slate-800 font-headline">Atividades</h2>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-6">
                  <div className="flex gap-3">
                    <div className="mt-1 p-1 bg-green-50 rounded-full">
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-800 font-medium">Agendamento concluído</p>
                      <p className="text-xs text-slate-500">Ana Paula finalizou o serviço.</p>
                      <p className="text-[10px] text-slate-400 mt-1">Há 15 minutos</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="mt-1 p-1 bg-blue-50 rounded-full">
                      <AlertCircle className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-800 font-medium">Novo agendamento</p>
                      <p className="text-xs text-slate-500">Carla Mendes agendou para amanhã.</p>
                      <p className="text-[10px] text-slate-400 mt-1">Há 1 hora</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
