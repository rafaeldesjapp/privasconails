'use client';

import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  MoreVertical, 
  Search, 
  Filter, 
  TrendingUp, 
  DollarSign,
  ChevronRight,
  User
} from 'lucide-react';
import { useSupabaseAuth, useSupabaseQuery } from '@/hooks/use-supabase';
import { cn } from '@/lib/utils';
import Link from 'next/link';

const PipelinePage = () => {
  const { user } = useSupabaseAuth();
  const { data: contacts } = useSupabaseQuery('contacts', {
    where: user ? { column: 'uid', value: user.id } : undefined
  });

  const stages = [
    { id: 'lead', name: 'Leads', color: 'bg-slate-100 text-slate-600' },
    { id: 'contact', name: 'Contato Inicial', color: 'bg-blue-50 text-blue-600' },
    { id: 'proposal', name: 'Proposta', color: 'bg-purple-50 text-purple-600' },
    { id: 'negotiation', name: 'Negociação', color: 'bg-orange-50 text-orange-600' },
    { id: 'closed', name: 'Fechado', color: 'bg-emerald-50 text-emerald-600' },
  ];

  // Group contacts by stage (mocking stages for now based on status or random)
  const getContactsInStage = (stageId: string) => {
    if (!contacts) return [];
    // For demo, we'll distribute contacts across stages
    if (stageId === 'lead') return contacts.filter(c => c.status === 'Lead');
    if (stageId === 'closed') return contacts.filter(c => c.status === 'Key Account');
    return []; // Others empty for now or we could mock
  };

  return (
    <div className="flex flex-col h-full gap-6">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black font-headline text-slate-900 tracking-tight">Pipeline de Vendas</h2>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">Visualize e gerencie suas oportunidades em tempo real</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
          <div className="bg-white px-4 py-2.5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between sm:justify-start gap-4 flex-1">
            <div className="flex flex-col">
              <span className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest">Valor Total</span>
              <span className="text-xs sm:text-sm font-black text-blue-700">R$ 1.240.000</span>
            </div>
            <div className="w-[1px] h-8 bg-slate-100"></div>
            <div className="flex flex-col text-right sm:text-left">
              <span className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest">Conversão</span>
              <span className="text-xs sm:text-sm font-black text-emerald-600">24%</span>
            </div>
          </div>
          <button className="px-5 py-2.5 bg-gradient-to-br from-[#003d9b] to-[#0052cc] text-white font-bold rounded-xl shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2 hover:scale-[1.02] transition-all text-sm">
            <Plus className="w-5 h-5" />
            Nova Oportunidade
          </button>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 flex gap-4 sm:gap-6 overflow-x-auto pb-4 min-h-[500px] snap-x snap-mandatory lg:snap-none">
        {stages.map((stage) => {
          const stageContacts = getContactsInStage(stage.id);
          const totalValue = stageContacts.reduce((acc, c) => acc + (c.open_value || 0), 0);

          return (
            <div key={stage.id} className="flex-shrink-0 w-[85vw] sm:w-80 flex flex-col gap-4 snap-center">
              <div className={cn("p-3 rounded-xl flex items-center justify-between border", stage.color.replace('text-', 'border-').replace('bg-', 'border-opacity-20 bg-'))}>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest">{stage.name}</span>
                  <span className="px-2 py-0.5 bg-white/50 rounded-full text-[9px] sm:text-[10px] font-bold">{stageContacts.length}</span>
                </div>
                <span className="text-[9px] sm:text-[10px] font-black opacity-70">R$ {totalValue.toLocaleString('pt-BR')}</span>
              </div>

              <div className="flex-1 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 p-2 space-y-3">
                {stageContacts.map((contact) => (
                  <div key={contact.id} className="bg-white p-3 sm:p-4 rounded-xl shadow-sm border border-slate-100 hover:shadow-md hover:border-blue-200 transition-all cursor-grab active:cursor-grabbing group">
                    <div className="flex justify-between items-start mb-2 sm:mb-3">
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[9px] sm:text-[10px] font-bold rounded uppercase">Prioridade Alta</span>
                      <button className="p-1 text-slate-300 hover:text-slate-600">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>
                    <Link href={`/contatos/${contact.id}`} className="text-sm font-bold text-slate-900 mb-1 block hover:text-blue-700 transition-colors">
                      {contact.name}
                    </Link>
                    <p className="text-[10px] text-slate-500 font-medium mb-3 sm:mb-4">{contact.company}</p>
                    
                    <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                      <div className="flex items-center gap-1.5">
                        <DollarSign className="w-3 h-3 text-emerald-600" />
                        <span className="text-[11px] sm:text-xs font-black text-slate-700">R$ {(contact.open_value || 0).toLocaleString('pt-BR')}</span>
                      </div>
                      <div className="flex -space-x-2">
                        <img src={contact.photo_url || "https://picsum.photos/seed/user/100/100"} className="w-5 h-5 sm:w-6 sm:h-6 rounded-full border-2 border-white shadow-sm" alt="Owner" />
                      </div>
                    </div>
                  </div>
                ))}
                
                {stageContacts.length === 0 && (
                  <div className="h-24 sm:h-32 flex flex-col items-center justify-center text-slate-300 gap-2">
                    <Plus className="w-5 h-5 sm:w-6 sm:h-6 opacity-20" />
                    <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest opacity-40">Arraste aqui</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PipelinePage;
