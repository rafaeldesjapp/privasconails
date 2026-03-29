'use client';

import React, { useState } from 'react';
import { useSupabaseAuth } from '@/hooks/use-supabase';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import Planner from '@/components/Planner';
import Auth from '@/components/Auth';
import { AlertCircle } from 'lucide-react';

export default function AgendaPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { user, role, loading: authLoading } = useSupabaseAuth();

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) return <Auth />;
  
  if (role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-slate-800 mb-2">Acesso Negado</h1>
          <p className="text-slate-600 mb-6">Apenas administradores podem ver a agenda completa.</p>
          <button 
            onClick={() => window.location.href = '/'}
            className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold"
          >
            Voltar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      
      <div className="lg:ml-64 flex flex-col min-h-screen overflow-hidden">
        <Header onMenuClick={() => setIsSidebarOpen(true)} />
        
        {/* Usamos !p-0 aqui para o Planner preencher melhor a tela com a animação 3D */}
        <main className="flex-1 overflow-hidden relative bg-gradient-to-br from-pink-400 via-orange-300 to-yellow-300">
           <Planner role={role} user={user} isAdminView={true} />
        </main>
      </div>
    </div>
  );
}
