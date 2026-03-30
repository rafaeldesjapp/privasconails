'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Users, 
  CalendarDays, 
  MessageCircle, 
  History, 
  Settings, 
  LogOut, 
  Plus,
  X,
  Sparkles,
  Tag,
  Paintbrush,
  Bell,
  CalendarPlus,
  CreditCard
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { useSupabaseAuth } from '@/hooks/use-supabase';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar = ({ isOpen, onClose }: SidebarProps) => {
  const pathname = usePathname();
  const { role } = useSupabaseAuth();
  const [hasNewRequests, setHasNewRequests] = useState(false);

  // Verificar se há novas solicitações
  React.useEffect(() => {
    if (role !== 'admin') return;

    const checkRequests = async () => {
      try {
        const { count, error } = await supabase
          .from('solicitacoes')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pendente');
        
        if (!error && count && count > 0) {
          setHasNewRequests(true);
        } else {
          setHasNewRequests(false);
        }
      } catch (err) {
        console.error('Erro ao verificar solicitações:', err);
      }
    };

    checkRequests();
    
    // Inscrição em tempo real para novas solicitações
    const channel = supabase
      .channel('solicitacoes-changes')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'solicitacoes' 
      }, () => {
        checkRequests();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [role]);

  const navItems = [
    { name: 'Meus Trabalhos', icon: Sparkles, href: '/portfolio' },
    { name: 'Tabela de Preços', icon: Tag, href: '/tabela-precos' },
    { name: 'Meu Painel', icon: LayoutDashboard, href: '/painel' },
    { name: 'Contatos', icon: Users, href: '/contatos' },
    { name: 'Agenda', icon: CalendarDays, href: '/agenda' },
    { name: 'Agendamentos', icon: CalendarPlus, href: '/agendamentos' },
    { name: 'Pagamentos', icon: CreditCard, href: '/pagamentos' },
    { name: 'Papo de Salão', icon: MessageCircle, href: '/papo-de-salao' },
    { name: 'Histórico', icon: History, href: '/historico' },
  ];

  const filteredNavItems = role === 'admin' 
    ? navItems 
    : navItems.filter(item => 
        ['Meus Trabalhos', 'Tabela de Preços', 'Agendamentos', 'Pagamentos', 'Papo de Salão', 'Histórico'].includes(item.name)
      );

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      // Força reload da página
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
    } catch (error) {
      console.error('Error signing out:', error);
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
    }
  };

  return (
    <aside className={cn(
      "fixed left-0 top-0 h-full z-50 flex flex-col bg-slate-50 w-60 lg:w-64 border-r border-slate-200 transition-transform duration-300 lg:translate-x-0",
      isOpen ? "translate-x-0" : "-translate-x-full"
    )}>
      <div className="p-4 lg:p-6 flex items-center justify-between">
        <div className="space-y-0.5">
          <h1 className="text-xl lg:text-2xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 font-dancing leading-none">
            Priscila Vasconcelos
          </h1>
          <p className="text-xs lg:text-sm font-medium bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 font-dancing flex items-center gap-1 mt-1">
            Nail Designer
            <Paintbrush className="w-3 h-3 text-pink-500 inline-block" />
          </p>
        </div>
        <button 
          onClick={onClose}
          className="lg:hidden p-2 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      
      <nav className="flex-1 px-3 lg:px-4 space-y-0.5 lg:space-y-1 overflow-y-auto mt-2">
        {filteredNavItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={() => onClose()}
              className={cn(
                "flex items-center gap-2.5 lg:gap-3 px-3 py-2 lg:px-4 lg:py-2.5 transition-all duration-200 rounded-lg lg:rounded-xl",
                isActive 
                  ? "bg-white text-blue-700 shadow-sm font-bold border border-slate-100" 
                  : "text-slate-600 hover:text-blue-600 hover:bg-slate-200/50"
              )}
            >
              <item.icon className={cn("w-4 h-4 lg:w-5 lg:h-5", isActive ? "text-blue-700" : "text-slate-400")} />
              <span className="text-sm">{item.name}</span>
            </Link>
          );
        })}
      </nav>



      <div className="p-3 lg:p-4 border-t border-slate-100 space-y-0.5 lg:space-y-1">
        <Link 
          href="/usuarios"
          onClick={() => onClose()}
          className={cn(
            "flex items-center gap-2.5 lg:gap-3 px-3 py-2 lg:px-4 lg:py-2.5 transition-colors duration-200 rounded-lg lg:rounded-xl hover:bg-slate-50",
            pathname === '/usuarios' ? "text-blue-600 bg-white shadow-sm border border-slate-100 font-bold" : "text-slate-600 hover:text-blue-600"
          )}
        >
          <Users className="w-4 h-4 lg:w-5 lg:h-5 text-slate-400" />
          <span className="text-sm font-medium">
            {role === 'cliente' ? 'Meu Perfil' : 'Usuários'}
          </span>
        </Link>
        {role === 'admin' && (
          <Link 
            href="/solicitacoes"
            onClick={() => onClose()}
            className={cn(
              "flex items-center gap-2.5 lg:gap-3 px-3 py-2 lg:px-4 lg:py-2.5 transition-colors duration-200 rounded-lg lg:rounded-xl hover:bg-slate-50",
              pathname === '/solicitacoes' ? "text-blue-600 bg-white shadow-sm border border-slate-100 font-bold" : "text-slate-600 hover:text-blue-600"
            )}
          >
            <Bell className={cn("w-4 h-4 lg:w-5 lg:h-5", hasNewRequests ? "text-blue-600" : "text-slate-400")} />
            <span className={cn(
              "text-sm font-medium",
              hasNewRequests && "animate-blink-bold"
            )}>
              Solicitações
            </span>
          </Link>
        )}
        <Link 
          href="/configuracoes"
          onClick={() => onClose()}
          className="flex items-center gap-2.5 lg:gap-3 px-3 py-2 lg:px-4 lg:py-2.5 text-slate-600 hover:text-blue-600 transition-colors duration-200 rounded-lg lg:rounded-xl hover:bg-slate-50"
        >
          <Settings className="w-4 h-4 lg:w-5 lg:h-5 text-slate-400" />
          <span className="text-sm font-medium">Configurações</span>
        </Link>
        <button 
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 lg:gap-3 px-3 py-2 lg:px-4 lg:py-2.5 text-slate-600 hover:text-red-600 transition-colors duration-200 rounded-lg lg:rounded-xl hover:bg-red-50"
        >
          <LogOut className="w-4 h-4 lg:w-5 lg:h-5 text-slate-400" />
          <span className="text-sm font-medium">Sair</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
