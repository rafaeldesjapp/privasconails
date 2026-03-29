'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, CheckCircle2, Clock, Plus, Trash2, Calendar as CalIcon, Lock, Unlock, AlertOctagon } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { format, addDays, subDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, getMonth, getYear } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Agendamento {
  id: string;
  user_id: string;
  client_name: string;
  service: string;
  date: string;
  time: string;
  status: 'agendado' | 'concluido' | 'cancelado' | 'bloqueado';
}

interface PlannerProps {
  role: 'admin' | 'cliente' | string | null;
  user: any;
  isAdminView?: boolean;
}

// Função para gerar horários de 15 em 15 minutos
const generateTimeSlots = (startHour: number, endHour: number) => {
  const slots: string[] = [];
  for (let h = startHour; h <= endHour; h++) {
    for (let m = 0; m < 60; m += 15) {
      if (h === endHour && m > 0) break; 
      slots.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
    }
  }
  return slots;
};

const fullDayTimeSlots = generateTimeSlots(7, 23);

export default function Planner({ role, user, isAdminView = false }: PlannerProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [direction, setDirection] = useState(0); 
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [newService, setNewService] = useState('');
  
  // Novo estado para controlar os dias bloqueados no mês atual
  const [blockedDays, setBlockedDays] = useState<{id: string, date: string}[]>([]);

  const isDayBlocked = agendamentos.some(a => a.time === 'ALL' && a.status === 'bloqueado');
  const dayBlockId = agendamentos.find(a => a.time === 'ALL' && a.status === 'bloqueado')?.id;

  const fetchAgendamentos = async (date: Date) => {
    setLoading(true);
    try {
      const dateStr = format(date, 'yyyy-MM-dd');
      let query = supabase.from('agendamentos').select('*').eq('date', dateStr);
      const { data, error } = await query;
      
      if (error && error.code !== 'PGRST116') console.error(error);
      setAgendamentos(data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBlockedDays = async (date: Date) => {
    try {
      const start = format(startOfMonth(date), 'yyyy-MM-dd');
      const end = format(endOfMonth(date), 'yyyy-MM-dd');
      const { data, error } = await supabase.from('agendamentos')
        .select('id, date')
        .eq('time', 'ALL')
        .eq('status', 'bloqueado')
        .gte('date', start)
        .lte('date', end);
        
      if (data) setBlockedDays(data);
    } catch (err) {
      console.error(err);
    }
  };

  // Carrega agendamentos diários
  useEffect(() => {
    fetchAgendamentos(currentDate);
    const channel = supabase
      .channel('agendamentos-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agendamentos' }, () => {
        fetchAgendamentos(currentDate);
        fetchBlockedDays(currentDate); // atualiza o grid do mês se houver mudança
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentDate]);

  // Carrega os bloqueios do mês apenas quando o mês/ano mudar
  useEffect(() => {
    fetchBlockedDays(currentDate);
  }, [getMonth(currentDate), getYear(currentDate)]);

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
      
      setSelectedSlot(null);
      setNewService('');
      fetchAgendamentos(currentDate);
      fetchBlockedDays(currentDate);
    } catch (err: any) {
      alert('Erro ao agendar: ' + err.message);
    }
  };

  const handleBlockSlot = async (time: string) => {
    if (!user) return; 
    try {
      const bloq = {
        user_id: user.id,
        client_name: 'Bloqueado',
        service: 'Horário Indisponível',
        date: format(currentDate, 'yyyy-MM-dd'),
        time,
        status: 'bloqueado'
      };
      const { error } = await supabase.from('agendamentos').insert([bloq]);
      if (error) throw error;
      fetchAgendamentos(currentDate);
      fetchBlockedDays(currentDate);
    } catch (err: any) {
      alert('Erro ao bloquear: ' + err.message);
    }
  };

  const handleBlockFullDay = async (targetDate: Date = currentDate) => {
    try {
      const bloq = {
        user_id: user?.id,
        client_name: 'Dia Fechado',
        service: 'Dia Indisponível',
        date: format(targetDate, 'yyyy-MM-dd'),
        time: 'ALL',
        status: 'bloqueado'
      };
      const { error } = await supabase.from('agendamentos').insert([bloq]);
      if (error) throw error;
      
      fetchAgendamentos(currentDate);
      fetchBlockedDays(currentDate);
    } catch (err: any) {
      alert('Erro ao bloquear o dia: ' + err.message);
    }
  };

  const handleCancel = async (id: string, silently: boolean = false, isExternalAction = false) => {
    if (!silently && !confirm('Deseja realmente cancelar este agendamento/bloqueio?')) return;
    try {
      const { error } = await supabase.from('agendamentos').delete().eq('id', id);
      if (error) throw error;
      
      fetchAgendamentos(currentDate);
      fetchBlockedDays(currentDate);
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

  const variants: any = {
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
        
        <div className="absolute inset-0 bg-white/40 mix-blend-overlay pointer-events-none z-0" style={{ backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.5) 2px, transparent 2px)', backgroundSize: '24px 24px' }} />

        {/* Página Esquerda (Estática - Resumo do Mês) */}
        <div className="hidden md:flex w-1/2 bg-white flex-col border-r-2 border-slate-200/50 shadow-[10px_0_20px_rgba(0,0,0,0.05)] z-10 p-8 pt-12 relative overflow-hidden">
          <div className="absolute right-0 top-0 bottom-0 w-8 flex flex-col justify-evenly py-6">
            {[...Array(15)].map((_, i) => (
              <div key={i} className="w-5 h-5 rounded-full bg-slate-200 border border-slate-300 shadow-inner -mr-2" />
            ))}
          </div>

          <div className="pr-6 h-full flex flex-col">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-pink-100 rounded-full flex items-center justify-center">
                  <CalIcon className="w-6 h-6 text-pink-500" />
                </div>
                <h2 className="text-3xl font-black text-slate-800 uppercase tracking-tight">
                  {format(currentDate, "MMMM yyyy", { locale: ptBR })}
                </h2>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center mb-4">
              {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map(d => (
                <div key={d} className="font-bold text-slate-400 text-sm py-2">{d}</div>
              ))}
              {daysInMonth.map((day, i) => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const blockRecord = blockedDays.find(b => b.date === dateStr);
                const isThisDayBlocked = !!blockRecord;
                const isSelected = isSameDay(day, currentDate);

                return (
                  <div 
                    key={i} 
                    className="group relative flex justify-center items-center p-0.5" 
                    style={{ gridColumnStart: i === 0 ? day.getDay() + 1 : 'auto' }}
                  >
                    <button
                      onClick={() => {
                        const dir = day > currentDate ? 1 : -1;
                        if (!isSelected) {
                          setDirection(dir);
                          setCurrentDate(day);
                        }
                      }}
                      className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-all relative",
                        isSelected 
                          ? "bg-gradient-to-br from-pink-500 to-orange-400 text-white shadow-md shadow-pink-500/30 scale-110" 
                          : "text-slate-600 hover:bg-pink-50",
                        isThisDayBlocked && !isSelected && "bg-red-50 text-red-500 border border-red-200"
                      )}
                    >
                      {format(day, 'd')}

                      {/* Ícone de Cadeado Visível sempre se estiver bloqueado */}
                      {isThisDayBlocked && (
                        <Lock className={cn("w-3 h-3 absolute -top-1 -right-1", isSelected ? "text-white" : "text-red-500")} />
                      )}
                    </button>

                    {/* Botão flutuante de bloquear no grid do calendário (Apenas Admin) */}
                    {isAdminView && (
                      <div className="absolute top-[-10px] right-[-10px] z-50 opacity-0 group-hover:opacity-100 transition-opacity">
                         {isThisDayBlocked ? (
                           <button 
                             onClick={(e) => { e.stopPropagation(); handleCancel(blockRecord.id, true, true); }} 
                             className="bg-white rounded-full p-1 shadow-md border border-slate-200 text-red-500 hover:text-slate-700"
                             title="Desbloquear Dia"
                           >
                             <Unlock className="w-3.5 h-3.5" />
                           </button>
                         ) : (
                           <button 
                             onClick={(e) => { e.stopPropagation(); handleBlockFullDay(day); }} 
                             className="bg-white rounded-full p-1 shadow-md border border-slate-200 text-slate-400 hover:text-red-500"
                             title="Bloquear Dia"
                           >
                             <Lock className="w-3.5 h-3.5" />
                           </button>
                         )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-auto bg-orange-50/50 rounded-2xl p-6 border border-orange-100 border-dashed">
              <h3 className="font-bold text-slate-800 mb-2">Deslize para ver horários</h3>
              <p className="text-sm text-slate-600">
                A página da direita possui horários de 15 em 15 minutos, das 7h até as 23h. Use o mouse ou o dedo para rolar a página verticalmente!
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
              className="absolute inset-0 p-6 md:p-8 pt-12 overflow-y-auto"
              style={{ transformOrigin: 'left center' }}
            >
              
              <div className="absolute inset-x-0 top-0 bottom-[-2000px] pointer-events-none" style={{ backgroundImage: 'repeating-linear-gradient(transparent, transparent 39px, rgba(239, 68, 68, 0.15) 40px)', backgroundPosition: '0 40px' }} />

              <div className="relative z-10 pl-2 md:pl-6">
                
                <div className="flex items-center justify-between mb-8 border-b-2 border-red-400/30 pb-4">
                  <div className="group flex items-start gap-3">
                    <div>
                      <h1 className="text-4xl font-black text-rose-500 uppercase tracking-tighter">
                        {format(currentDate, "EEEE", { locale: ptBR })}
                      </h1>
                      <div className="flex items-center gap-2">
                        <p className="text-lg font-bold text-slate-500">
                          {format(currentDate, "dd 'de' MMMM", { locale: ptBR })}
                        </p>
                        {isAdminView && (
                          isDayBlocked ? (
                            <button 
                              onClick={() => dayBlockId && handleCancel(dayBlockId, true)} 
                              className="p-1 text-red-500 hover:text-slate-800 transition-all"
                              title="Desbloquear o Dia Todo"
                            >
                              <Unlock className="w-4 h-4" />
                            </button>
                          ) : (
                            <button 
                              onClick={() => handleBlockFullDay(currentDate)} 
                              className="opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-red-500 transition-all"
                              title="Bloquear o Dia Todo"
                            >
                              <Lock className="w-4 h-4" />
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 items-center">
                    <button onClick={handlePrevDay} className="p-2 bg-white rounded-full shadow-sm hover:bg-rose-50 hover:text-rose-600 text-slate-400 transition-colors border border-slate-100 relative pointer-events-auto">
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button onClick={handleNextDay} className="p-2 bg-white rounded-full shadow-sm hover:bg-rose-50 hover:text-rose-600 text-slate-400 transition-colors border border-slate-100 relative pointer-events-auto">
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {isDayBlocked ? (
                  <div className="py-24 flex items-center justify-center">
                    <div className="transform rotate-[-15deg] border-4 border-red-500 text-red-500 p-8 rounded-2xl text-6xl font-black uppercase tracking-widest opacity-80 mix-blend-multiply flex items-center gap-4">
                      Fechado <Lock className="w-16 h-16" />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-[1px] pb-24">
                    {loading ? (
                      <div className="flex justify-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-500"></div>
                      </div>
                    ) : (
                      fullDayTimeSlots.map(time => {
                        const age = agendamentos.find(a => a.time === time);
                        const isBlockedSlot = age?.status === 'bloqueado';
                        const isOccupied = !!age && !isBlockedSlot;
                        const isMine = age?.user_id === user?.id;
                        const isSelected = selectedSlot === time;

                        return (
                          <div key={time} className="group relative min-h-[40px] flex items-center gap-4 transition-all hover:bg-white/50 -mx-4 px-4 rounded-lg">
                            <div className="w-16 flex-shrink-0 text-right font-medium text-rose-400/80 group-hover:text-rose-600 group-hover:font-bold transition-all pt-1">
                              {time}
                            </div>
                            
                            <div className="flex-1 min-h-[40px] border-b border-rose-100/50 group-hover:border-rose-300 transition-colors flex items-center pr-2">
                              {isBlockedSlot ? (
                                <div className="flex-1 flex items-center justify-between ml-2 bg-slate-50 text-slate-400 opacity-60 px-2 py-0.5 rounded italic">
                                  <span className="text-sm flex items-center gap-1"><AlertOctagon className="w-3 h-3"/> Bloqueado</span>
                                  {isAdminView && age && (
                                    <button onClick={() => handleCancel(age.id, true)} className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-slate-800 transition-all">
                                      <Unlock className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              ) : isOccupied ? (
                                <div className={cn(
                                  "flex-1 flex items-center justify-between px-3 py-1 rounded-lg ml-2 mb-1",
                                  age.status === 'concluido' ? 'bg-green-100 text-green-700' :
                                  isMine || isAdminView ? 'bg-gradient-to-r from-rose-100 to-orange-100 text-rose-700 shadow-sm border border-rose-200' : 'bg-slate-100 text-slate-500 line-through'
                                )}>
                                  <span className="font-medium text-sm">
                                    {isAdminView || isMine ? `${age.client_name} - ${age.service}` : 'Agendado'}
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
                                <div className="flex-1 flex items-center justify-between">
                                  {isSelected ? (
                                    <div className="flex-1 flex items-center gap-2 ml-2 mb-1 bg-white p-1 rounded-lg shadow-sm border border-rose-200 z-20 relative">
                                      <input 
                                        type="text" 
                                        placeholder="Serviço..." 
                                        className="flex-1 w-full bg-transparent px-2 py-1 outline-none text-sm text-slate-700 font-medium placeholder:text-slate-300"
                                        value={newService}
                                        onChange={(e) => setNewService(e.target.value)}
                                        autoFocus
                                      />
                                      <button 
                                        onClick={() => handleBook(time)}
                                        className="bg-rose-500 text-white px-2 py-1 rounded text-xs font-bold shadow hover:bg-rose-600 transition-colors shrink-0"
                                      >
                                        Salvar
                                      </button>
                                      <button onClick={() => setSelectedSlot(null)} className="p-1 text-slate-400 hover:text-slate-600 shrink-0">
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  ) : (
                                    <button 
                                      onClick={() => setSelectedSlot(time)}
                                      className="flex items-center gap-2 text-slate-300 hover:text-rose-500 text-sm font-medium ml-2 opacity-0 group-hover:opacity-100 transition-all z-20 relative"
                                    >
                                      <Plus className="w-4 h-4" />
                                      <span className="text-xs">Agendar</span>
                                    </button>
                                  )}

                                  {isAdminView && !isSelected && (
                                    <button 
                                      onClick={() => handleBlockSlot(time)}
                                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-red-500 transition-all ml-auto"
                                      title="Bloquear Horário"
                                    >
                                      <Lock className="w-3.5 h-3.5" />
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
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
