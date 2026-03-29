'use client';

import React, { useState } from 'react';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import { useSupabaseAuth } from '@/hooks/use-supabase';
import Auth from '@/components/Auth';
import { CreditCard, Wrench } from 'lucide-react';

export default function PagamentosPage() {
  const { user, role, loading } = useSupabaseAuth();
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

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      
      <div className="lg:ml-64 flex flex-col min-h-screen">
        <Header onMenuClick={() => setIsSidebarOpen(true)} />
        
        <main className="flex-1 p-4 lg:p-8 flex items-center justify-center">
          <div className="text-center max-w-md">
            <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6 text-blue-600 relative shrink-0">
              <CreditCard className="w-12 h-12" />
              <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-md">
                <Wrench className="w-5 h-5 text-slate-400" />
              </div>
            </div>
            
            <h1 className="text-3xl font-black text-slate-800 mb-4 font-headline">Módulo em Construção</h1>
            <p className="text-slate-500 mb-8 leading-relaxed">
              {role === 'admin' 
                ? 'Em breve você poderá gerenciar recebimentos, links de cobrança e fluxo de caixa direto por aqui.'
                : 'Em breve você poderá visualizar todos os seus recibos e realizar pagamentos antecipados pelo aplicativo.'}
            </p>
            
            <button className="bg-slate-200 text-slate-600 font-bold py-3 px-8 rounded-xl cursor-not-allowed opacity-70">
              Novidades em breve
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}
