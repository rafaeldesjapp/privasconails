'use client';

import React from 'react';
import { Search, Bell, HelpCircle, Menu } from 'lucide-react';
import { useSupabaseAuth } from '@/hooks/use-supabase';
import { cn } from '@/lib/utils';

interface HeaderProps {
  onMenuClick: () => void;
}

const Header = ({ onMenuClick }: HeaderProps) => {
  const { user, role } = useSupabaseAuth();

  return (
    <header className="sticky top-0 z-30 flex justify-between items-center px-4 md:px-8 py-3 bg-white/80 backdrop-blur-md border-b border-slate-100 h-16">
      <div className="flex items-center gap-3 flex-1">
        <button 
          onClick={onMenuClick}
          className="lg:hidden p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <Menu className="w-6 h-6" />
        </button>
        <div className="relative w-full max-w-md hidden sm:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <input 
            className="w-full pl-10 pr-4 py-2 bg-slate-100 border-none rounded-full text-sm focus:ring-2 focus:ring-blue-500/20 transition-all outline-none" 
            placeholder="Buscar no workspace..." 
            type="text"
          />
        </div>
      </div>
      
      <div className="flex items-center gap-2 sm:gap-6">
        <button className="text-slate-500 hover:text-blue-600 transition-colors hidden xs:block">
          <Bell className="w-5 h-5" />
        </button>
        <button className="text-slate-500 hover:text-blue-600 transition-colors hidden md:block">
          <HelpCircle className="w-5 h-5" />
        </button>
        <div className="h-8 w-[1px] bg-slate-200 hidden xs:block"></div>
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-bold font-headline leading-none truncate max-w-[100px]">{user?.email?.split('@')[0] || 'Usuário'}</p>
            <p className={cn(
              "text-[10px] tracking-wider font-bold",
              role === 'admin' ? "text-blue-600" : "text-amber-600"
            )}>
              {role === 'admin' ? 'Administrador' : (role === 'cliente' ? 'Cliente' : (role || 'Carregando...'))}
            </p>
          </div>
          <img 
            alt="Avatar do Usuário" 
            className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover ring-2 ring-blue-500/10" 
            src={user?.user_metadata?.avatar_url || "https://picsum.photos/seed/user/100/100"}
          />
        </div>
      </div>
    </header>
  );
};

export default Header;
