'use client';

import React, { useState } from 'react';
import { useSupabaseAuth } from '@/hooks/use-supabase';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import Planner from '@/components/Planner';
import Auth from '@/components/Auth';

export default function AgendamentosPage() {
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

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      
      <div className="lg:ml-64 flex flex-col min-h-screen overflow-hidden">
        <Header onMenuClick={() => setIsSidebarOpen(true)} />
        
        <main className="flex-1 overflow-hidden relative bg-gradient-to-br from-pink-400 via-orange-300 to-yellow-300">
           <Planner role={role} user={user} isAdminView={role === 'admin'} />
        </main>
      </div>
    </div>
  );
}
