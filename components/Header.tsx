'use client';

import React from 'react';
import { Menu, User, Bell } from 'lucide-react';
import { useSupabaseAuth } from '@/hooks/use-supabase';

interface HeaderProps {
  onMenuClick: () => void;
}

const Header = ({ onMenuClick }: HeaderProps) => {
  const { user, role } = useSupabaseAuth();

  return (
    <header className="h-16 bg-white border-b border-slate-100 flex items-center justify-between px-4 lg:px-8 sticky top-0 z-40">
      <div className="flex items-center gap-4">
        <button 
          onClick={onMenuClick}
          className="lg:hidden p-2 text-slate-400 hover:bg-slate-50 rounded-lg transition-colors"
        >
          <Menu className="w-6 h-6" />
        </button>
      </div>

      <div className="flex items-center gap-4">
        <button className="p-2 text-slate-400 hover:bg-slate-50 rounded-lg transition-colors relative">
          <Bell className="w-5 h-5" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
        </button>
        
        <div className="h-8 w-px bg-slate-100 mx-2"></div>
        
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-bold text-slate-700 leading-none mb-1">
              {user?.email?.split('@')[0]}
            </p>
            <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider leading-none">
              {role === 'admin' ? 'Administrador' : 'Cliente'}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center border border-slate-200">
            <User className="w-5 h-5 text-slate-400" />
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
