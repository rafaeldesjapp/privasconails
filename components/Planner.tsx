'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, CheckCircle2, Clock, Plus, Trash2, Calendar as CalIcon, Lock, Unlock, AlertOctagon, Pencil, Save, X, GripVertical } from 'lucide-react';
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
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editServiceText, setEditServiceText] = useState('');
  
  const [blockedDays, setBlockedDays] = useState<{id: string, date: string}[]>([]);

  // Estados do Drag-to-Fill
  const [isDragging, setIsDragging] = useState(false);
  const [dragSource, setDragSource] = useState<Agendamento | null>(null);
  const [dragCurrentTime, setDragCurrentTime] = useState<string | null>(null);

  // Estados do WhatsApp
  const [studioWhatsapp, setStudioWhatsapp] = useState<string | null>(null);
  const [pendingBooking, setPendingBooking] = useState<{ time: string, service: string } | null>(null);

  // Estados do Checkout
  const [checkoutData, setCheckoutData] = useState<Agendamento | null>(null);
  const [checkoutDuration, setCheckoutDuration] = useState<string>('60'); 
  const [checkoutPayment, setCheckoutPayment] = useState<string>('Pix');

  const isDayBlocked = agendamentos.some(a => a.time === 'ALL' && a.status === 'bloqueado');
  const dayBlockId = agendamentos.find(a => a.time === 'ALL' && a.status === 'bloqueado')?.id;

  // Busca número do WhatsApp
  useEffect(() => {
    const fetchConfig = async () => {
      const { data } = await supabase.from('configuracoes').select('valor').eq('chave', 'whatsapp_studio').single();
      if (data?.valor) setStudioWhatsapp(data.valor.replace(/"/g, ''));
    };
    fetchConfig();
  }, []);

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

  useEffect(() => {
    fetchAgendamentos(currentDate);
    const channel = supabase
      .channel('agendamentos-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agendamentos' }, () => {
        fetchAgendamentos(currentDate);
        fetchBlockedDays(currentDate); 
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentDate]);

  useEffect(() => {
    fetchBlockedDays(currentDate);
  }, [getMonth(currentDate), getYear(currentDate)]);

  // Listener Global para o fim do Arrasto (Drag-to-Fill)
  useEffect(() => {
    const handleMouseUp = async () => {
      if (isDragging && dragSource && dragCurrentTime) {
        const sIdx = fullDayTimeSlots.indexOf(dragSource.time);
        const cIdx = fullDayTimeSlots.indexOf(dragCurrentTime);
        
        if (sIdx !== -1 && cIdx !== -1 && sIdx !== cIdx) {
          const start = Math.min(sIdx, cIdx);
          const end = Math.max(sIdx, cIdx);
          const times = fullDayTimeSlots.slice(start, end + 1);

          // Pular ocupados e a própria origem (filtro anti-sobrescrita)
          const targetTimes = times.filter(t => 
            t !== dragSource.time && !agendamentos.some(a => a.time === t)
          );

          if (targetTimes.length > 0) {
            try {
              const novosAgendamentos = targetTimes.map(t => ({
                user_id: dragSource.user_id,
                client_name: dragSource.client_name,
                service: dragSource.service,
                date: dragSource.date,
                time: t,
                status: dragSource.status
              }));

              const { error } = await supabase.from('agendamentos').insert(novosAgendamentos);
              if (error) throw error;
              
              fetchAgendamentos(currentDate);
              fetchBlockedDays(currentDate);
            } catch (err: any) {
              alert('Erro ao colar blocos arrastados: ' + err.message);
            }
          }
        }
      }
      setIsDragging(false);
      setDragSource(null);
      setDragCurrentTime(null);
    };

    if (isDragging) {
      window.addEventListener('mouseup', handleMouseUp);
      // Fallback para mobile
      window.addEventListener('touchend', handleMouseUp);
    }
    
    return () => {
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [isDragging, dragSource, dragCurrentTime, agendamentos, currentDate]);

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

    // Imposição para clientes (se um número estiver configurado)
    if (studioWhatsapp && studioWhatsapp.length > 5 && !isAdminView) {
      setPendingBooking({ time, service: newService });
      return;
    }

    commitBooking(time, newService);
  };

  const commitBooking = async (timeStr: string, serviceStr: string) => {
    try {
      const novaReserva = {
        user_id: user.id,
        client_name: user?.user_metadata?.full_name || user.email,
        service: serviceStr,
        date: format(currentDate, 'yyyy-MM-dd'),
        time: timeStr,
        status: 'agendado'
      };

      const { error } = await supabase.from('agendamentos').insert([novaReserva]);
      if (error) throw error;
      
      setSelectedSlot(null);
      setNewService('');
      setPendingBooking(null);
      fetchAgendamentos(currentDate);
      fetchBlockedDays(currentDate);
    } catch (err: any) {
      alert('Erro ao agendar: ' + err.message);
    }
  };

  const confirmAndSendWhatsApp = () => {
    if (!pendingBooking) return;
    
    commitBooking(pendingBooking.time, pendingBooking.service);

    const clientName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Cliente';
    const dataFormatada = format(currentDate, "dd/MM/yyyy");
    const mensagem = `Olá! Meu nome é *${clientName}* e acabei de fazer uma solicitação na agenda online.%0A%0A✂ *Serviço:* ${pendingBooking.service}%0A📅 *Data:* ${dataFormatada}%0A⏰ *Horário:* ${pendingBooking.time}`;
    
    window.open(`https://wa.me/${studioWhatsapp}?text=${mensagem}`, '_blank');
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
    try {
      const { data, error } = await supabase.from('agendamentos').delete().eq('id', id).select();
      if (error) throw error;
      
      if (!silently && (!data || data.length === 0)) {
        alert(`O banco de dados bloqueou a exclusão do agendamento. Você pode não ter permissão de administrador no nível do banco (RLS).`);
        return;
      }
      
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

  const handleCheckoutSubmit = async () => {
    if (!checkoutData) return;
    try {
      const { error } = await supabase.from('agendamentos').update({ 
        status: 'concluido',
        duration_minutes: parseInt(checkoutDuration),
        payment_method: checkoutPayment
      }).eq('id', checkoutData.id);
      
      if (error) {
        if (error.message.includes('column')) {
           alert('Opa! Você esqueceu de rodar o código no SQL Editor para adicionar os campos de pagamento no banco. Por favor, execute-os primeiro!');
        } else {
           throw error;
        }
        return;
      }
      
      setCheckoutData(null);
      fetchAgendamentos(currentDate);
    } catch (err: any) {
      alert('Erro ao concluir atendimento: ' + err.message);
    }
  };

  const handleEditSave = async (id: string) => {
    if (!editServiceText.trim()) return;
    try {
      const { error } = await supabase.from('agendamentos').update({ service: editServiceText }).eq('id', id);
      if (error) throw error;
      setEditingId(null);
      fetchAgendamentos(currentDate);
    } catch (err: any) {
      alert('Erro ao editar: ' + err.message);
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
      <div className="relative w-full max-w-6xl h-[85vh] md:h-auto md:aspect-[4/3] md:max-h-[90vh] flex shadow-2xl rounded-xl md:rounded-3xl overflow-hidden bg-pink-100 ring-4 md:ring-8 ring-white/20 perspective-[2000px] select-none">
        
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

                    {isAdminView && (
                      <div className="absolute top-[-10px] right-[-10px] z-50 opacity-0 group-hover:opacity-100 transition-opacity">
                         {isThisDayBlocked && blockRecord ? (
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
              <h3 className="font-bold text-slate-800 mb-2">Dica de Produtividade</h3>
              <p className="text-sm text-slate-600">
                Pressione a bolinha <GripVertical className="inline w-4 h-4 text-slate-400" /> ao lado de qualquer compromisso ou bloqueio e arraste para os horários vizinhos para multiplicar sua ação imediatamente!
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
              className="absolute inset-0 p-4 md:p-8 pt-8 md:pt-12 overflow-y-auto"
              style={{ transformOrigin: 'left center' }}
            >
              
              <div className="absolute inset-x-0 top-0 bottom-[-2000px] pointer-events-none" style={{ backgroundImage: 'repeating-linear-gradient(transparent, transparent 39px, rgba(239, 68, 68, 0.15) 40px)', backgroundPosition: '0 40px' }} />

              <div className="relative z-10 pl-2 md:pl-6">
                
                <div className="flex items-center justify-between mb-8 border-b-2 border-red-400/30 pb-4">
                  <div className="group flex items-start gap-3">
                    <div>
                      <h1 className="text-3xl md:text-4xl font-black text-rose-500 uppercase tracking-tighter">
                        {format(currentDate, "EEEE", { locale: ptBR })}
                      </h1>
                      <div className="flex items-center gap-2">
                        <p className="text-base md:text-lg font-bold text-slate-500">
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
                              className="opacity-100 md:opacity-0 md:group-hover:opacity-100 p-1 text-slate-300 hover:text-red-500 transition-all"
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

                        // Drag logic visual tracking
                        const isPreview = isDragging && dragSource && dragCurrentTime && (() => {
                          const tIdx = fullDayTimeSlots.indexOf(time);
                          const sIdx = fullDayTimeSlots.indexOf(dragSource.time);
                          const cIdx = fullDayTimeSlots.indexOf(dragCurrentTime);
                          return tIdx >= Math.min(sIdx, cIdx) && tIdx <= Math.max(sIdx, cIdx);
                        })();

                        const showPreviewGhost = isPreview && !age; // Only preview on empty ones

                        return (
                          <div 
                            key={time} 
                            className="group relative min-h-[40px] flex items-center gap-2 md:gap-4 transition-all hover:bg-white/50 -mx-2 md:-mx-4 px-2 md:px-4 rounded-lg"
                            onMouseEnter={() => {
                              if (isDragging && isAdminView) setDragCurrentTime(time);
                            }}
                            // Captura touchmove no mobile
                            onTouchMove={(e) => {
                              if (!isDragging || !isAdminView) return;
                              // Identifica o elemento sobre o qual o dedo está
                              const touch = e.touches[0];
                              const el = document.elementFromPoint(touch.clientX, touch.clientY);
                              const targetTime = el?.getAttribute('data-time');
                              if (targetTime) setDragCurrentTime(targetTime);
                            }}
                            data-time={time}
                          >
                            <div className="w-12 md:w-16 flex-shrink-0 text-right font-medium text-rose-400/80 group-hover:text-rose-600 group-hover:font-bold transition-all pt-1 text-xs md:text-base">
                              {time}
                            </div>
                            
                            <div className="flex-1 min-h-[40px] border-b border-rose-100/50 group-hover:border-rose-300 transition-colors flex items-center pr-2">
                              {/* Fantasma do Drag */}
                              {showPreviewGhost && (
                                <div className="flex-1 flex items-center px-3 py-1 rounded-lg ml-2 mb-1 bg-rose-50 border-2 border-rose-300 border-dashed text-rose-400 opacity-60">
                                  <span className="font-bold text-sm italic">
                                    {(dragSource?.status === 'bloqueado') ? 'Bloqueando espaço...' : 'Pintando '+dragSource?.service}
                                  </span>
                                </div>
                              )}

                              {isBlockedSlot ? (
                                <div className="flex-1 flex items-center justify-between ml-2 bg-slate-50 text-slate-400 opacity-60 px-2 py-0.5 rounded italic">
                                  <div className="flex items-center gap-1">
                                    {isAdminView && (
                                      <div 
                                        className="cursor-grab active:cursor-grabbing p-1 text-slate-300 hover:text-slate-500"
                                        onMouseDown={() => { setIsDragging(true); setDragSource(age); setDragCurrentTime(time); }}
                                        onTouchStart={() => { setIsDragging(true); setDragSource(age); setDragCurrentTime(time); }}
                                      >
                                        <GripVertical className="w-3.5 h-3.5" />
                                      </div>
                                    )}
                                    <span className="text-sm flex items-center gap-1"><AlertOctagon className="w-3 h-3"/> Bloqueado</span>
                                  </div>
                                  {isAdminView && age && (
                                    <button onClick={() => handleCancel(age.id, true)} className="opacity-100 md:opacity-0 md:group-hover:opacity-100 p-1 text-slate-500 hover:text-slate-800 transition-all">
                                      <Unlock className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              ) : isOccupied ? (
                                <div className={cn(
                                  "flex-1 flex items-center justify-between px-3 py-1 rounded-lg ml-2 mb-1",
                                  age.status === 'concluido' ? 'bg-[url("https://www.transparenttextures.com/patterns/diagonal-stripes.png")] bg-green-100 text-green-700 font-bold border border-green-200' :
                                  isMine || isAdminView ? 'bg-gradient-to-r from-rose-100 to-orange-100 text-rose-700 shadow-sm border border-rose-200' : 'bg-slate-100 text-slate-500 line-through'
                                )}>
                                  {editingId === age.id ? (
                                    <div className="flex-1 flex items-center gap-2 mr-2">
                                      <input 
                                        type="text" 
                                        className="flex-1 bg-white/60 px-2 py-0.5 rounded outline-none text-sm text-slate-800"
                                        value={editServiceText}
                                        onChange={(e) => setEditServiceText(e.target.value)}
                                        autoFocus
                                      />
                                      <button onClick={() => handleEditSave(age.id)} className="p-1 text-blue-600 hover:bg-blue-100 rounded bg-white shadow-sm" title="Salvar">
                                        <Save className="w-3.5 h-3.5" />
                                      </button>
                                      <button onClick={() => setEditingId(null)} className="p-1 text-slate-400 hover:bg-slate-100 rounded bg-white shadow-sm" title="Cancelar">
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  ) : (
                                    <>
                                      <div className="flex items-center gap-1">
                                        {isAdminView && (
                                          <div 
                                            className="cursor-grab active:cursor-grabbing p-1 -ml-2 text-rose-300 hover:text-rose-500 opacity-60 hover:opacity-100 hover:scale-110 transition-all"
                                            onMouseDown={() => { setIsDragging(true); setDragSource(age); setDragCurrentTime(time); }}
                                            onTouchStart={(e) => { 
                                              // Impede o scroll no celular ao arrastar a alça
                                              document.body.style.overflow = 'hidden';
                                              setIsDragging(true); 
                                              setDragSource(age); 
                                              setDragCurrentTime(time); 
                                            }}
                                            onTouchEnd={() => { document.body.style.overflow = ''; }}
                                          >
                                            <GripVertical className="w-4 h-4" />
                                          </div>
                                        )}
                                        <span className="font-medium text-sm">
                                          {isAdminView || isMine ? `${age.client_name} - ${age.service}` : 'Agendado'}
                                        </span>
                                      </div>

                                      {(isAdminView || isMine) && (
                                        <div className="flex items-center gap-1.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                          {isAdminView && age.status !== 'concluido' && (
                                            <button onClick={() => setCheckoutData(age)} className="p-1 text-green-600 hover:bg-green-200 rounded transition-colors" title="Finalizar Atendimento">
                                              <CheckCircle2 className="w-4 h-4" />
                                            </button>
                                          )}
                                          {(isAdminView || isMine) && (
                                            <button onClick={() => { setEditingId(age.id); setEditServiceText(age.service); }} className="p-1 text-blue-500 hover:bg-blue-200 rounded" title="Editar Serviço">
                                              <Pencil className="w-4 h-4" />
                                            </button>
                                          )}
                                          <button onClick={() => handleCancel(age.id)} className="p-1 text-red-500 hover:bg-red-200 rounded" title="Cancelar Agendamento">
                                            <Trash2 className="w-4 h-4" />
                                          </button>
                                        </div>
                                      )}
                                    </>
                                  )}
                                </div>
                              ) : !showPreviewGhost && (
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
                                      className="flex items-center gap-1 md:gap-2 text-rose-400 md:text-slate-300 hover:text-rose-500 text-sm font-medium ml-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all z-20 relative"
                                    >
                                      <Plus className="w-4 h-4" />
                                      <span className="text-xs hidden md:inline">Agendar</span>
                                    </button>
                                  )}

                                  {isAdminView && !isSelected && (
                                    <button 
                                      onClick={() => handleBlockSlot(time)}
                                      className="opacity-100 md:opacity-0 md:group-hover:opacity-100 p-1 text-slate-300 hover:text-red-500 transition-all ml-auto"
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

      {pendingBooking && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl shadow-blue-900/20 w-full max-w-sm p-8 overflow-hidden relative border border-slate-100">
            <div className="w-16 h-16 bg-green-50 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner ring-4 ring-green-50">
              {/* Fake WhatsApp Icon Silhouette */}
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.888-.788-1.489-1.761-1.665-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
              </svg>
            </div>
            <h3 className="text-xl font-bold text-slate-800 text-center mb-2 leading-tight">Envio Necessário</h3>
            <p className="text-slate-500 text-sm text-center mb-8 px-2">
              Para confirmar sua vaga das <strong className="text-slate-700">{pendingBooking.time}</strong>, você precisa notificar o estúdio agora mesmo pelo WhatsApp.
            </p>
            
            <button 
              onClick={confirmAndSendWhatsApp}
              className="w-full bg-[#25D366] hover:bg-[#1fbb59] text-white font-bold py-3.5 rounded-xl shadow-md transition-all flex justify-center items-center mb-3"
            >
              Concluir e Enviar Zap
            </button>
            <button 
              onClick={() => { setPendingBooking(null); setSelectedSlot(null); }}
              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-3.5 rounded-xl transition-all flex justify-center items-center"
            >
              Cancelar Horário
            </button>
          </div>
        </div>
      )}

      {checkoutData && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 relative border border-slate-100">
            <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
              <CheckCircle2 className="w-6 h-6 text-green-500" />
              Finalizar Atendimento
            </h3>
            
            <div className="space-y-4 mb-8">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Forma de Pagamento</label>
                <div className="grid grid-cols-2 gap-2">
                  {['Pix', 'Dinheiro', 'Crédito', 'Débito'].map(method => (
                    <button
                      key={method}
                      onClick={() => setCheckoutPayment(method)}
                      className={cn(
                        "py-2 rounded-lg text-sm font-medium transition-all border",
                        checkoutPayment === method ? "bg-blue-50 border-blue-200 text-blue-700" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                      )}
                    >
                      {method}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Tempo Gasto (Minutos)</label>
                <select 
                  value={checkoutDuration}
                  onChange={(e) => setCheckoutDuration(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="30">30 Minutos (Rápido)</option>
                  <option value="60">1 Hora (Padrão)</option>
                  <option value="90">1 Hora e 30 Minutos</option>
                  <option value="120">2 Horas (Completo)</option>
                  <option value="150">2 Horas e 30 Minutos</option>
                  <option value="180">3 Horas (Longo)</option>
                </select>
              </div>
            </div>
            
            <button 
              onClick={handleCheckoutSubmit}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3.5 rounded-xl shadow-md transition-all flex justify-center items-center mb-3"
            >
              Salvar Recibo no Histórico
            </button>
            <button 
              onClick={() => setCheckoutData(null)}
              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-3 rounded-xl transition-all"
            >
              Voltar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
