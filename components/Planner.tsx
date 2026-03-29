'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, CheckCircle2, Clock, Plus, Trash2, Calendar as CalIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { format, addDays, subDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Agendamento {
  id: string;
  user_id: string;
  client_name: string;
  service: string;
  date: string;
  time: string;
  status: 'agendado' | 'concluido' | 'cancelado';
}

interface PlannerProps {
  role: 'admin' | 'cliente' | string | null;
  user: any;
  isAdminView?: boolean;
}

const timeSlots = [
  '08:00', '09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'
];

export default function Planner({ role, user, isAdminView = false }: PlannerProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [direction, setDirection] = useState(0); // 1 = forward, -1 = backward
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [newService, setNewService] = useState('');

  const fetchAgendamentos = async (date: Date) => {
    setLoading(true);
    try {
      const dateStr = format(date, 'yyyy-MM-dd');
      let query = supabase.from('agendamentos').select('*').eq('date', dateStr);
      
      // If client and NOT in admin view, maybe filter by their own? 
      // Actually, if it's the shared agendamentos page, clients need to see available slots.
      // So we fetch all for the day to block taken slots.
      // If isAdminView, we show who booked. If client, we just show "Ocupado" or their own name.
      
      const { data, error } = await query;
      
      if (error) {
        if (error.code === 'PGRST116' || error.message.includes('relation "public.agendamentos" does not exist')) {
          console.error('Table agendamentos does not exist yet. Please create it.');
        } else {
          console.error('Error fetching agendamentos:', error);
        }
      }
      
      setAgendamentos(data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgendamentos(currentDate);

    const channel = supabase
      .channel('agendamentos-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agendamentos' }, () => {
        fetchAgendamentos(currentDate);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentDate]);

  const handleNextDay = () => {
    setDirection(1);
    setCurrentDate(prev => addDays(prev, 1));
  };

  const handlePrevDay = () => {
    setDirection(-1);
    setCurrentDate(prev => subDays(prev, 1));
  };

  const handleBook = async (time: string) => {
    if (!user) return alert('Você precisa estar logado para agendar.');
    if (!newService.trim()) return alert('Por favor, informe o serviço desejado.');

    try {
      const novaReserva = {
        user_id: user.id,
        client_name: user?.user_metadata?.full_name || user.email,
        service: newService,
        date: format(currentDate, 'yyyy-MM-dd'),
        time,
        status: 'agendado'
      };

      const { error } = await supabase.from('agendamentos').insert([novaReserva]);
      if (error) throw error;
      
      alert('Agendamento realizado com sucesso!');
      setSelectedSlot(null);
      setNewService('');
      fetchAgendamentos(currentDate);
    } catch (err: any) {
      alert('Erro ao agendar: ' + err.message);
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm('Deseja realmente cancelar este agendamento?')) return;
    try {
      const { error } = await supabase.from('agendamentos').delete().eq('id', id);
      if (error) throw error;
      fetchAgendamentos(currentDate);
    } catch (err: any) {
      alert('Erro ao cancelar: ' + err.message);
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      const { error } = await supabase.from('agendamentos').update({ status: newStatus }).eq('id', id);
      if (error) throw error;
      fetchAgendamentos(currentDate);
    } catch (err: any) {
      alert('Erro ao atualizar status: ' + err.message);
    }
  };

  // Animation variants
  const variants = {
    enter: (direction: number) => {
      return {
        rotateY: direction > 0 ? -90 : 90,
        opacity: 0,
        x: direction > 0 ? 100 : -100,
        filter: "blur(4px)"
      };
    },
    center: {
      rotateY: 0,
      opacity: 1,
      x: 0,
      filter: "blur(0px)",
      transition: {
        duration: 0.6,
        type: 'spring',
        bounce: 0.2
      }
    },
    exit: (direction: number) => {
      return {
        rotateY: direction < 0 ? -90 : 90,
        opacity: 0,
        x: direction < 0 ? 100 : -100,
        filter: "blur(4px)",
        transition: {
          duration: 0.5
        }
      };
    }
  };

  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(currentDate),
    end: endOfMonth(currentDate)
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-400 via-orange-300 to-yellow-300 p-4 md:p-8 flex items-center justify-center font-sans">
      
      {/* Container do Caderno */}
      <div className="relative w-full max-w-6xl aspect-[4/3] max-h-[90vh] flex shadow-2xl rounded-2xl md:rounded-3xl overflow-hidden bg-pink-100 ring-8 ring-white/20 perspective-[2000px]">
        
        {/* Capa Traseira e Textura */}
        <div className="absolute inset-0 bg-white/40 mix-blend-overlay pointer-events-none z-0" style={{ backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.5) 2px, transparent 2px)', backgroundSize: '24px 24px' }} />

        {/* Página Esquerda (Estática - Resumo do Mês) */}
        <div className="hidden md:flex w-1/2 bg-white flex-col border-r-2 border-slate-200/50 shadow-[10px_0_20px_rgba(0,0,0,0.05)] z-10 p-8 pt-12 relative overflow-hidden">
          {/* Furos do Caderno Esquerda */}
          <div className="absolute right-0 top-0 bottom-0 w-8 flex flex-col justify-evenly py-6">
            {[...Array(15)].map((_, i) => (
              <div key={i} className="w-5 h-5 rounded-full bg-slate-200 border border-slate-300 shadow-inner -mr-2" />
            ))}
          </div>

          <div className="pr-6 h-full flex flex-col">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-12 h-12 bg-pink-100 rounded-full flex items-center justify-center">
                <CalIcon className="w-6 h-6 text-pink-500" />
              </div>
              <h2 className="text-3xl font-black text-slate-800 uppercase tracking-tight">
                {format(currentDate, "MMMM yyyy", { locale: ptBR })}
              </h2>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center mb-4">
              {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map(d => (
                <div key={d} className="font-bold text-slate-400 text-sm">{d}</div>
              ))}
              {daysInMonth.map((day, i) => (
                <button
                  key={i}
                  onClick={() => {
                    const dir = day > currentDate ? 1 : -1;
                    if (!isSameDay(day, currentDate)) {
                      setDirection(dir);
                      setCurrentDate(day);
                    }
                  }}
                  className={cn(
                    "aspect-square rounded-full flex items-center justify-center text-sm font-medium transition-all",
                    isSameDay(day, currentDate) 
                      ? "bg-gradient-to-br from-pink-500 to-orange-400 text-white shadow-md shadow-pink-500/30 scale-110" 
                      : "text-slate-600 hover:bg-pink-50"
                  )}
                  style={{ gridColumnStart: i === 0 ? day.getDay() + 1 : 'auto' }}
                >
                  {format(day, 'd')}
                </button>
              ))}
            </div>

            <div className="mt-auto bg-orange-50/50 rounded-2xl p-6 border border-orange-100 border-dashed">
              <h3 className="font-bold text-slate-800 mb-2">Resumo da Semana</h3>
              <p className="text-sm text-slate-600">
                Selecione um dia no calendário ao lado para gerenciar ou marcar seus agendamentos.
              </p>
            </div>
          </div>
        </div>

        {/* Espiral do Caderno (Centro) */}
        <div className="hidden md:flex absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-8 flex-col justify-evenly py-6 z-30 pointer-events-none drop-shadow-xl">
          {[...Array(15)].map((_, i) => (
            <div key={i} className="w-16 h-3 bg-gradient-to-r from-slate-300 via-slate-100 to-slate-400 rounded-full shadow-sm ml-[-1rem] border border-slate-400/20" />
          ))}
        </div>

        {/* Página Direita Animada (Dinâmica) */}
        <div className="w-full md:w-1/2 relative bg-[#FDFBF7] z-20 overflow-hidden transform-gpu" style={{ transformOrigin: 'left center' }}>
          
          <AnimatePresence initial={false} custom={direction} mode="wait">
            <motion.div
              key={currentDate.toISOString()}
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              className="absolute inset-0 p-6 md:p-8 pt-12 overflow-y-auto no-scrollbar"
              style={{ transformOrigin: 'left center' }}
            >
              
              {/* Linhas Pautadas (Fundo da Folha) */}
              <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'repeating-linear-gradient(transparent, transparent 39px, rgba(239, 68, 68, 0.15) 40px)', backgroundPosition: '0 40px' }} />

              <div className="relative z-10 pl-2 md:pl-6">
                
                {/* Cabeçalho do Dia */}
                <div className="flex items-end justify-between mb-8 border-b-2 border-red-400/30 pb-4">
                  <div>
                    <h1 className="text-4xl font-black text-rose-500 uppercase tracking-tighter">
                      {format(currentDate, "EEEE", { locale: ptBR })}
                    </h1>
                    <p className="text-lg font-bold text-slate-500">
                      {format(currentDate, "dd 'de' MMMM", { locale: ptBR })}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handlePrevDay} className="p-2 bg-white rounded-full shadow-sm hover:bg-rose-50 hover:text-rose-600 text-slate-400 transition-colors border border-slate-100 z-50 relative pointer-events-auto">
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button onClick={handleNextDay} className="p-2 bg-white rounded-full shadow-sm hover:bg-rose-50 hover:text-rose-600 text-slate-400 transition-colors border border-slate-100 z-50 relative pointer-events-auto">
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Slots de Horário */}
                <div className="space-y-[1px]">
                  {loading ? (
                    <div className="flex justify-center py-12">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-500"></div>
                    </div>
                  ) : (
                    timeSlots.map(time => {
                      const age = agendamentos.find(a => a.time === time);
                      const isOccupied = !!age;
                      const isMine = age?.user_id === user?.id;
                      const isSelected = selectedSlot === time;

                      return (
                        <div key={time} className="group relative min-h-[40px] flex items-center gap-4 transition-all">
                          <div className="w-16 flex-shrink-0 text-right font-bold text-rose-400/80 group-hover:text-rose-600 pt-1">
                            {time}
                          </div>
                          
                          <div className="flex-1 min-h-[40px] border-b border-rose-100/50 group-hover:border-rose-300 transition-colors flex items-center pr-2">
                            {isOccupied ? (
                              <div className={cn(
                                "flex-1 flex items-center justify-between px-3 py-1 rounded-lg ml-2 mb-1",
                                age.status === 'concluido' ? 'bg-green-100 text-green-700' :
                                isMine || isAdminView ? 'bg-gradient-to-r from-rose-100 to-orange-100 text-rose-700 shadow-sm border border-rose-200' : 'bg-slate-100 text-slate-500 line-through'
                              )}>
                                <span className="font-medium text-sm">
                                  {isAdminView || isMine ? `${age.client_name} - ${age.service}` : 'Horário Indisponível'}
                                </span>
                                {(isAdminView || isMine) && age.status === 'agendado' && (
                                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {isAdminView && (
                                      <button onClick={() => handleStatusChange(age.id, 'concluido')} className="p-1 text-green-600 hover:bg-green-200 rounded">
                                        <CheckCircle2 className="w-4 h-4" />
                                      </button>
                                    )}
                                    <button onClick={() => handleCancel(age.id)} className="p-1 text-red-500 hover:bg-red-200 rounded">
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="flex-1 flex items-center">
                                {isSelected ? (
                                  <div className="flex-1 flex items-center gap-2 ml-2 mb-1 bg-white p-1 rounded-lg shadow-sm border border-rose-200 z-20 relative">
                                    <input 
                                      type="text" 
                                      placeholder="Ex: Unhas de Gel..." 
                                      className="flex-1 bg-transparent px-3 py-1 outline-none text-sm text-slate-700 font-medium placeholder:text-slate-300"
                                      value={newService}
                                      onChange={(e) => setNewService(e.target.value)}
                                      autoFocus
                                    />
                                    <button 
                                      onClick={() => handleBook(time)}
                                      className="bg-rose-500 text-white px-3 py-1 rounded text-sm font-bold shadow-md hover:bg-rose-600 transition-colors"
                                    >
                                      Salvar
                                    </button>
                                    <button onClick={() => setSelectedSlot(null)} className="p-1 text-slate-400 hover:text-slate-600">
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                ) : (
                                  <button 
                                    onClick={() => setSelectedSlot(time)}
                                    className="flex items-center gap-2 text-slate-300 hover:text-rose-500 text-sm font-medium ml-2 opacity-0 group-hover:opacity-100 transition-all z-20 relative"
                                  >
                                    <Plus className="w-4 h-4" />
                                    <span>Agendar</span>
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
