'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, CheckCircle2, Clock, Plus, Trash2, Calendar as CalIcon, Lock, Unlock, AlertOctagon, Pencil, Save, X, GripVertical, Users, Banknote } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { format, addDays, subDays, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, getMonth, getYear, isSaturday, isSunday, setHours, setMinutes, startOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Agendamento {
  id: string;
  user_id: string;
  client_name: string;
  service: string;
  date: string;
  time: string;
  status: 'agendado' | 'concluido' | 'cancelado' | 'bloqueado' | 'pendente_dinheiro' | 'aberto' | 'pendente_autorizacao';
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
  const [newServices, setNewServices] = useState<{qty: number, name: string}[]>([{qty: 1, name: ''}]);
  const [clientsList, setClientsList] = useState<{id: string, full_name: string}[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [freeNote, setFreeNote] = useState<string>('');
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editServices, setEditServices] = useState<{qty: number, name: string}[]>([{qty: 1, name: ''}]);
  
  const [blockedDays, setBlockedDays] = useState<{id: string, date: string, status: string}[]>([]); 
  const [holidayConfirm, setHolidayConfirm] = useState<{isOpen: boolean, date: Date | null}>({ isOpen: false, date: null });

  // Estados do Drag-to-Fill
  const [isDragging, setIsDragging] = useState(false);
  const [dragSource, setDragSource] = useState<Agendamento | null>(null);
  const [dragCurrentTime, setDragCurrentTime] = useState<string | null>(null);

  // Estados de Feriados
  const [holidays, setHolidays] = useState<{date: string, name: string, type: string}[]>([]);

  // Estados do WhatsApp e Serviços
  const [studioWhatsapp, setStudioWhatsapp] = useState<string | null>(null);
  const [pendingBooking, setPendingBooking] = useState<{ time: string, service: string } | null>(null);
  
  // Categorias padrão servindo como fallback caso RLS bloqueie a query da tabela configuracoes para clientes comuns
  const DEFAULT_CATEGORIES = [
    { category: 'Unhas Simples', items: [{name: 'Mão', price: 30}, {name: 'Pé', price: 30}, {name: 'Pé e Mão Simples', price: 50}, {name: 'Pé e Mão Decorado', price: 55}] },
    { category: 'Alongamento', items: [{name: 'Postiça Realista', price: 60}, {name: 'Banho de Gel', price: 80}, {name: 'Acrigel', price: 129}, {name: 'Fibra de Vidro', price: 160}] },
    { category: 'Manutenções e Extra', items: [{name: 'Manutenção em Gel', price: 50}, {name: 'Manutenção em Acrigel', price: 90}, {name: 'Manutenção em Fibra', price: 130}, {name: 'Reposição de Unha (UN)', price: 15}] }
  ];
  
  const [availableServices, setAvailableServices] = useState<{category: string, items: {name: string, price: number}[]}[]>(DEFAULT_CATEGORIES);

  // Estados do Checkout
  const [checkoutData, setCheckoutData] = useState<Agendamento | null>(null);
  const [checkoutDuration, setCheckoutDuration] = useState<string>('60'); 
  const [checkoutPayment, setCheckoutPayment] = useState<string>('Pix');

  const isDayBlocked = (() => {
    const dateStr = format(currentDate, 'yyyy-MM-dd');
    const adminRecord = agendamentos.find(a => a.time === 'ALL' && a.date === dateStr);
    
    const isHoliday = holidays.some(h => h.date === dateStr);
    const isWeekend = isSaturday(currentDate) || isSunday(currentDate);
    
    const now = new Date();
    const currentWeekMonday = startOfWeek(now, { weekStartsOn: 1 });
    const monday7AM = setHours(setMinutes(currentWeekMonday, 0), 7);
    const weeksToAdd = now >= monday7AM ? 12 : 5;
    const openHorizon = addDays(currentWeekMonday, weeksToAdd);
    const isPastHorizon = currentDate > openHorizon;
    
    const isExplicitlyBlocked = adminRecord?.status === 'bloqueado';
    const isExplicitlyOpened = adminRecord?.status === 'aberto';
    
    return isExplicitlyBlocked || ((isWeekend || isHoliday || isPastHorizon) && !isExplicitlyOpened);
  })();

  const dayBlockId = agendamentos.find(a => a.time === 'ALL' && a.status === 'bloqueado' && a.date === format(currentDate, 'yyyy-MM-dd'))?.id;

  // Busca número do WhatsApp e Tabela de Preços
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const req = await fetch('/api/configuracoes/get', { cache: 'no-store' });
        if (!req.ok) throw new Error('Falha na API: ' + req.statusText);
        
        const res = await req.json();
        if (res.success && res.data) {
           const wData = res.data.whatsapp_studio;
           if (wData) setStudioWhatsapp(String(wData).replace(/"/g, ''));
           
           let parsedTabela = res.data.tabela_precos;
           if (typeof parsedTabela === 'string') {
              try { parsedTabela = JSON.parse(parsedTabela); } catch(e) {}
           }
           
           if (parsedTabela && Array.isArray(parsedTabela)) {
              const grouped: {category: string, items: {name: string, price: number}[]}[] = [];
              parsedTabela.forEach((cat: any) => {
                if (cat.itens && Array.isArray(cat.itens)) {
                  const catObj = { category: cat.nome || 'Serviços', items: [] as {name: string, price: number}[] };
                  cat.itens.forEach((item: any) => {
                    if (item.nome) catObj.items.push({ name: item.nome, price: Number(item.preco) || 0 });
                  });
                  if (catObj.items.length > 0) grouped.push(catObj);
                }
              });
              if (grouped.length > 0) setAvailableServices(grouped);
              else setAvailableServices(DEFAULT_CATEGORIES);
           } else {
              setAvailableServices(DEFAULT_CATEGORIES);
           }
        } else {
           setAvailableServices(DEFAULT_CATEGORIES);
        }
      } catch (err) {
        console.error("Erro ao buscar configurações iniciais:", err);
        setAvailableServices(DEFAULT_CATEGORIES);
      }
    };
    fetchConfig();
  }, []);

  useEffect(() => {
    if (isAdminView) {
      supabase.from('profiles').select('id, full_name').order('full_name').then(({data}: any) => {
         if (data) setClientsList(data);
      });
    }
  }, [isAdminView]);

  useEffect(() => {
    const fetchHolidays = async () => {
      try {
        const year = getYear(currentDate);
        const res = await fetch(`https://brasilapi.com.br/api/feriados/v1/${year}`);
        const nHolidays = res.ok ? await res.json() : [];
        
        const rjHolidays = [
          { date: `${year}-01-20`, name: 'São Sebastião (Padroeiro)', type: 'Municipal' },
          { date: `${year}-04-23`, name: 'São Jorge', type: 'Estadual' },
          { date: `${year}-11-20`, name: 'Consciência Negra', type: 'Estadual' } 
        ];

        const allHolidays = nHolidays.map((h: any) => ({ date: h.date, name: h.name, type: 'Nacional' }));
        rjHolidays.forEach(r => {
           if (!allHolidays.some((a: any) => a.date === r.date)) {
               allHolidays.push(r);
           }
        });

        allHolidays.sort((a: any, b: any) => a.date.localeCompare(b.date));
        setHolidays(allHolidays);
      } catch (err) {
        console.error("Erro ao buscar feriados:", err);
      }
    };
    fetchHolidays();
  }, [getYear(currentDate)]);

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
        .select('id, date, status')
        .eq('time', 'ALL')
        .in('status', ['bloqueado', 'aberto'])
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

  const serializeServices = (srvs: {qty: number, name: string}[]) => {
    return srvs.filter(s => s.name.trim() !== '').map(s => s.qty > 1 ? `${s.qty}x ${s.name}` : s.name).join(' + ');
  };

  const parseServicesString = (str: string) => {
    if (!str) return [{ qty: 1, name: '' }];
    return str.split(' + ').map(p => {
      const match = p.match(/^(\d+)x\s+(.*)$/);
      if (match) return { qty: Number(match[1]), name: match[2] };
      return { qty: 1, name: p };
    });
  };

  const handleConfirmCash = async (id: string) => {
    try {
      const { error } = await supabase.from('agendamentos').update({ status: 'concluido', payment_method: 'dinheiro_caixa' }).eq('id', id);
      if (error) throw error;
      fetchAgendamentos(currentDate);
    } catch (err: any) {
      alert('Erro ao confirmar recebimento: ' + err.message);
    }
  };

  const handleBook = async (time: string) => {
    const srvStr = serializeServices(newServices);
    const finalStr = freeNote.trim() ? (srvStr ? `${srvStr} | ${freeNote.trim()}` : freeNote.trim()) : srvStr;

    if (!user) return alert('Você precisa estar logado para agendar.');
    if (!finalStr.trim()) return alert('Por favor, informe o serviço desejado ou adicione uma anotação livre.');

    // Imposição para clientes (se um número estiver configurado)
    if (studioWhatsapp && studioWhatsapp.length > 5 && !isAdminView) {
      setPendingBooking({ time, service: finalStr });
      return;
    }

    commitBooking(time, finalStr);
  };

  const commitBooking = async (timeStr: string, finalServiceStr: string) => {
    try {
      const selectedClient = clientsList.find(c => c.id === selectedClientId);
      const targetUserId = selectedClientId || user.id;
      const targetClientName = selectedClient ? selectedClient.full_name : (user?.user_metadata?.full_name || user.email);

      const dateStr = format(currentDate, 'yyyy-MM-dd');
      const adminOverride = blockedDays.find(b => b.date === dateStr);
      const isHoliday = holidays.some(h => h.date === dateStr);
      
      const now = new Date();
      const currentWeekMonday = startOfWeek(now, { weekStartsOn: 1 });
      const monday7AM = setHours(setMinutes(currentWeekMonday, 0), 7);
      const weeksToAdd = now >= monday7AM ? 12 : 5;
      const openHorizon = addDays(currentWeekMonday, weeksToAdd);
      
      const isWeekend = isSaturday(currentDate) || isSunday(currentDate);
      const isPastHorizon = currentDate > openHorizon;
      
      const isExplicitlyOpened = adminOverride?.status === 'aberto';
      
      // Se estiver bloqueado por padrão e NÃO foi aberto explicitamente, entra como pendente
      const isPendente = (isWeekend || isHoliday || isPastHorizon) && !isExplicitlyOpened;

      const novaReserva = {
        user_id: targetUserId,
        client_name: targetClientName,
        service: finalServiceStr,
        date: format(currentDate, 'yyyy-MM-dd'),
        time: timeStr,
        status: isPendente ? 'pendente_autorizacao' : 'agendado'
      };

      const { error } = await supabase.from('agendamentos').insert([novaReserva]);
      if (error) throw error;
      
      setSelectedSlot(null);
      setNewServices([{qty: 1, name: availableServices[0]?.items[0]?.name || ''}]);
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

  const logAuditAction = async (action: string, target_info: string, description: string) => {
    try {
      await fetch('/api/logs/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          target_info,
          description,
          admin_email: user?.email || 'Admin Desconhecido',
          admin_id: user?.id
        })
      });
    } catch (err) {
      console.error('Erro ao gravar log via API:', err);
    }
  };

  const handleBlockFullDay = async (targetDate: Date = currentDate) => {
    try {
      const dateStr = format(targetDate, 'yyyy-MM-dd');
      const isHoliday = holidays.some(h => h.date === dateStr);
      
      // Se for feriado e quisermos ABRIR, mostrar o novo modal
      if (isHoliday) {
        setHolidayConfirm({ isOpen: true, date: targetDate });
        return;
      }

      await executeHolidayUnlock(targetDate);
    } catch (err: any) {
      alert('Erro ao abrir o dia: ' + err.message);
    }
  };

  const executeHolidayUnlock = async (targetDate: Date, wasConfirmedHoliday: boolean = false) => {
    const dateStr = format(targetDate, 'yyyy-MM-dd');
    const holidayName = holidays.find(h => h.date === dateStr)?.name || 'Dia Indefinido';

    try {
      await fetch('/api/admin/manage-day', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: dateStr,
          status: 'aberto',
          user_id: user?.id,
          client_name: 'Manual Override',
          service: 'Abertura Manual'
        })
      });

      if (wasConfirmedHoliday) {
        await logAuditAction('HOLIDAY_UNLOCK_ALLOWED', holidayName, `Administrador confirmou a abertura do feriado no dia ${dateStr}.`);
      }
    } catch (err) {
      console.error('Erro ao abrir o dia via servidor:', err);
      // Fallback local caso a API falhe
      const bloq = {
        user_id: user?.id,
        client_name: 'Manual Override',
        service: 'Abertura Manual',
        date: dateStr,
        time: 'ALL',
        status: 'aberto'
      };
      await supabase.from('agendamentos').insert([bloq]);
    }
    
    fetchAgendamentos(currentDate);
    fetchBlockedDays(currentDate);
  };

  const handleManualBlockDay = async (targetDate: Date = currentDate) => {
    const dateStr = format(targetDate, 'yyyy-MM-dd');
    try {
      await fetch('/api/admin/manage-day', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: dateStr,
          status: 'bloqueado',
          user_id: user?.id,
          client_name: 'Dia Fechado',
          service: 'Dia Indisponível'
        })
      });
    } catch (err) {
      console.error('Erro ao bloquear dia via servidor:', err);
      const bloq = {
        user_id: user?.id,
        client_name: 'Dia Fechado',
        service: 'Dia Indisponível',
        date: dateStr,
        time: 'ALL',
        status: 'bloqueado'
      };
      await supabase.from('agendamentos').insert([bloq]);
    }
    
    fetchAgendamentos(currentDate);
    fetchBlockedDays(currentDate);
  };

  const handleDeleteOverride = async (targetDate: Date) => {
    try {
      const dateStr = format(targetDate, 'yyyy-MM-dd');
      await fetch('/api/admin/manage-day', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: dateStr })
      });
      
      fetchAgendamentos(currentDate);
      fetchBlockedDays(currentDate);
    } catch (err: any) {
      alert('Erro ao remover trava do dia: ' + err.message);
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
    const srvStr = serializeServices(editServices);
    const finalStr = freeNote.trim() ? (srvStr ? `${srvStr} | ${freeNote.trim()}` : freeNote.trim()) : srvStr;

    if (!finalStr.trim()) return;
    try {
      const { error } = await supabase.from('agendamentos').update({ service: finalStr }).eq('id', id);
      if (error) throw error;
      setEditingId(null);
      setFreeNote('');
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
    <div className="absolute inset-0 bg-transparent p-2 py-3 md:p-8 flex flex-col items-center justify-center font-sans overflow-hidden">
      
      {/* Container do Caderno */}
      <div className="relative w-full h-full max-w-6xl md:h-auto md:aspect-[4/3] md:max-h-[90vh] flex flex-col md:flex-row shadow-2xl rounded-2xl md:rounded-3xl overflow-hidden bg-pink-100 ring-2 sm:ring-4 md:ring-8 ring-white/20 perspective-[2000px] select-none">
        
        <div className="absolute inset-0 bg-white/40 mix-blend-overlay pointer-events-none z-0" style={{ backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.5) 2px, transparent 2px)', backgroundSize: '24px 24px' }} />

        {/* Página Esquerda (Estática - Resumo do Mês) */}
        <div className="flex w-full md:w-1/2 bg-white flex-col border-b-2 md:border-b-0 md:border-r-2 border-slate-200/50 shadow-[0_5px_15px_rgba(0,0,0,0.05)] md:shadow-[10px_0_20px_rgba(0,0,0,0.05)] z-30 p-2 md:p-8 md:pt-12 relative flex-shrink-0">
          <div className="hidden md:flex absolute right-0 top-0 bottom-0 w-8 flex-col justify-evenly py-6">
            {[...Array(15)].map((_, i) => (
              <div key={i} className="w-5 h-5 rounded-full bg-slate-200 border border-slate-300 shadow-inner -mr-2" />
            ))}
          </div>

          <div className="md:pr-6 h-full flex flex-col">
            <div className="flex items-center justify-between mb-2 md:mb-8">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="w-8 h-8 md:w-12 md:h-12 bg-pink-100 rounded-full flex items-center justify-center">
                  <CalIcon className="w-4 h-4 md:w-6 md:h-6 text-pink-500" />
                </div>
                <h2 className="text-xl md:text-3xl font-black text-slate-800 uppercase tracking-tight">
                  {format(currentDate, "MMMM yyyy", { locale: ptBR })}
                </h2>
              </div>
              <div className="flex gap-1">
                <button 
                  onClick={() => setCurrentDate(prev => subMonths(prev, 1))} 
                  className="p-1.5 md:p-2 bg-slate-50 rounded-full shadow-sm hover:bg-pink-50 hover:text-pink-600 text-slate-400 transition-colors border border-slate-200/60"
                  title="Mês Anterior"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => setCurrentDate(prev => addMonths(prev, 1))} 
                  className="p-1.5 md:p-2 bg-slate-50 rounded-full shadow-sm hover:bg-pink-50 hover:text-pink-600 text-slate-400 transition-colors border border-slate-200/60"
                  title="Próximo Mês"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center mb-4">
              {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map(d => (
                <div key={d} className="font-bold text-slate-400 text-sm py-2">{d}</div>
              ))}
              {daysInMonth.map((day, i) => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const adminOverride = blockedDays.find(b => b.date === dateStr);
                const isSelected = isSameDay(day, currentDate);
                const isHoliday = holidays.some(h => h.date === dateStr);
                
                // Cálculo da Janela de Abertura (Horizonte)
                const now = new Date();
                const currentWeekMonday = startOfWeek(now, { weekStartsOn: 1 }); // Segunda desta semana
                const monday7AM = setHours(setMinutes(currentWeekMonday, 0), 7);
                
                // Se já passou de segunda 7h, o limite é o final da próxima semana. 
                // Caso contrário, é o final desta semana.
                const weeksToAdd = now >= monday7AM ? 12 : 5; // Dias desde a segunda atual para chegar na sexta (4) + 7 = 11? 
                // Vamos ser precisos: addDays(segunda, 4) = sexta atual. addDays(segunda, 11) = próxima sexta.
                const openHorizon = addDays(currentWeekMonday, weeksToAdd);
                
                const isWeekend = isSaturday(day) || isSunday(day);
                const isPastHorizon = day > openHorizon;
                
                // Lógica final de bloqueio:
                const isExplicitlyBlocked = adminOverride?.status === 'bloqueado';
                const isExplicitlyOpened = adminOverride?.status === 'aberto';
                
                // Bloqueado se:
                // 1. Bloqueio manual
                // 2. É fim de semana, feriado ou está além do horizonte E NÃO foi aberto manualmente.
                const isThisDayBlocked = isExplicitlyBlocked || ((isWeekend || isHoliday || isPastHorizon) && !isExplicitlyOpened);

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
                        "w-7 h-7 md:w-10 md:h-10 mx-auto rounded-full flex items-center justify-center text-xs md:text-sm font-medium transition-all relative font-[600]",
                        isSelected 
                          ? "bg-gradient-to-br from-pink-500 to-orange-400 text-white shadow-md shadow-pink-500/30 scale-110" 
                          : isHoliday ? "text-rose-600 bg-rose-50/70 border border-rose-100 font-bold" : "text-slate-600 hover:bg-pink-50",
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
                         {isThisDayBlocked ? (
                           <button 
                             onClick={(e) => { 
                               e.stopPropagation(); 
                               // Se houver registro de bloqueio manual, deleta. Se for bloqueio automático, cria abertura.
                               if (isExplicitlyBlocked) handleDeleteOverride(day);
                               else handleBlockFullDay(day); 
                             }} 
                             className="bg-white rounded-full p-1 shadow-md border border-slate-200 text-red-500 hover:text-slate-700"
                             title="Desbloquear Dia"
                           >
                             <Unlock className="w-3.5 h-3.5" />
                           </button>
                         ) : (
                           <button 
                             onClick={(e) => { 
                               e.stopPropagation(); 
                               // Se for uma abertura manual, deleta. Se for uma abertura automática, cria bloqueio.
                               if (isExplicitlyOpened) handleDeleteOverride(day);
                               else handleManualBlockDay(day);
                             }} 
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

            {(() => {
               const currentMonthHolidays = holidays.filter(h => {
                 const month = h.date.split('-')[1];
                 return parseInt(month, 10) === getMonth(currentDate) + 1;
               });

               if (currentMonthHolidays.length === 0) return null;

               return (
                 <div className="hidden md:block mt-auto mb-3 bg-rose-50/60 rounded-2xl p-4 border border-rose-100 shadow-sm">
                   <h3 className="font-bold text-rose-700 mb-2 flex items-center gap-2 text-[11px] uppercase tracking-wider">
                     <CalIcon className="w-3.5 h-3.5" /> Feriados e Datas Comemorativas
                   </h3>
                   <div className="space-y-1.5">
                     {currentMonthHolidays.map((fh, idx) => (
                       <div key={idx} className="flex items-center justify-between text-xs">
                         <div className="flex items-center gap-2">
                           <span className="font-black text-rose-600 bg-white px-1.5 py-0.5 rounded shadow-sm border border-rose-100/50">{fh.date.split('-')[2]}/{fh.date.split('-')[1]}</span>
                           <span className="text-slate-600 font-medium truncate max-w-[130px]" title={fh.name}>{fh.name}</span>
                         </div>
                         <span className="px-1.5 py-0.5 rounded-md bg-white border border-slate-200 text-[9px] font-black text-slate-400 uppercase tracking-wider">
                           {fh.type}
                         </span>
                       </div>
                     ))}
                   </div>
                 </div>
               );
            })()}

            <div className="hidden md:block bg-orange-50/50 rounded-2xl p-6 border border-orange-100 border-dashed">
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
        <div className="w-full h-full min-h-[300px] md:w-1/2 flex-1 relative bg-[#FDFBF7] z-20 overflow-hidden transform-gpu" style={{ transformOrigin: 'left center' }}>
          
          <AnimatePresence initial={false} custom={direction} mode="wait">
            <motion.div
              key={currentDate.toISOString()}
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              className="absolute inset-0 p-3 md:p-8 pt-4 md:pt-12 overflow-y-auto"
              style={{ transformOrigin: 'left center' }}
            >
              
              <div className="absolute inset-x-0 top-0 bottom-[-2000px] pointer-events-none" style={{ backgroundImage: 'repeating-linear-gradient(transparent, transparent 39px, rgba(239, 68, 68, 0.15) 40px)', backgroundPosition: '0 40px' }} />

              <div className="relative z-10 pl-2 md:pl-6">
                
                <div className="flex items-center justify-between mb-4 md:mb-8 border-b-2 border-red-400/30 pb-2 md:pb-4">
                  <div className="group flex items-start gap-3">
                    <div>
                      <h1 className="text-xl md:text-4xl font-black text-rose-500 uppercase tracking-tighter">
                        {format(currentDate, "EEEE", { locale: ptBR })}
                      </h1>
                      <div className="flex items-center gap-2">
                        <p className="text-sm md:text-lg font-bold text-slate-500">
                          {format(currentDate, "dd 'de' MMMM", { locale: ptBR })}
                        </p>
                        {(() => {
                           const todayHoliday = holidays.find(h => h.date === format(currentDate, 'yyyy-MM-dd'));
                           if (!todayHoliday) return null;
                           return (
                             <div className="md:hidden flex items-center gap-1 bg-rose-50 border border-rose-100 text-[10px] font-black text-rose-500 px-2 py-0.5 rounded-full uppercase tracking-widest shadow-sm">
                                <CalIcon className="w-3 h-3" /> {todayHoliday.name}
                             </div>
                           )
                        })()}
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

                {isDayBlocked && (
                  <div className="mx-2 mb-6 p-4 bg-orange-50 border border-orange-100 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-500">
                    <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <Clock className="w-5 h-5 text-orange-600" />
                    </div>
                    <div>
                      <h4 className="font-bold text-orange-800 text-sm">Solicitação sob Consulta</h4>
                      <p className="text-xs text-orange-700/80">Este dia é feriado ou fim de semana. Você pode solicitar o horário, mas ele só será validado após aprovação da profissional.</p>
                    </div>
                  </div>
                )}

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
                                    <div className="flex-1 flex flex-col gap-1 mr-2 mt-1">
                                      {editServices.map((srv, idx) => (
                                        <div key={idx} className="flex flex-1 items-center gap-2">
                                          <select
                                            className="w-16 bg-white border border-slate-200 px-2 py-1 rounded outline-none text-xs text-slate-700 font-bold"
                                            value={srv.qty}
                                            onChange={(e) => {
                                              const ns = [...editServices];
                                              ns[idx].qty = Number(e.target.value);
                                              setEditServices(ns);
                                            }}
                                          >
                                            {[...Array(10)].map((_, i) => (
                                              <option key={i+1} value={i+1}>{i+1}x</option>
                                            ))}
                                          </select>
                                          <select
                                            className="flex-1 bg-white border border-slate-200 px-2 py-1 rounded outline-none text-xs text-slate-700 font-bold"
                                            value={srv.name}
                                            onChange={(e) => {
                                              const ns = [...editServices];
                                              ns[idx].name = e.target.value;
                                              setEditServices(ns);
                                            }}
                                            autoFocus={idx === 0}
                                          >
                                            <option value="" disabled>Selecione um Serviço...</option>
                                            {availableServices.map((grp, gIdx) => (
                                              <optgroup key={gIdx} label={grp.category?.toUpperCase() || 'SERVIÇOS'}>
                                                {grp.items.map((svc: {name: string, price: number}, sIdx: number) => (
                                                   <option key={`${gIdx}-${sIdx}`} value={svc.name}>{svc.name} - R$ {svc.price.toFixed(2).replace('.', ',')}</option>
                                                ))}
                                              </optgroup>
                                            ))}
                                          </select>
                                          {editServices.length > 1 && (
                                            <button onClick={() => setEditServices(editServices.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-500 p-1">
                                              <X className="w-3 h-3" />
                                            </button>
                                          )}
                                        </div>
                                      ))}

                                      <div className="flex mt-1">
                                        <input 
                                          type="text"
                                          placeholder="Anotação livre..."
                                          value={freeNote}
                                          onChange={(e) => setFreeNote(e.target.value)}
                                          className="flex-1 bg-slate-50 border border-slate-200 px-2 py-1 rounded outline-none text-xs text-slate-700"
                                        />
                                      </div>
                                      
                                      <div className="flex justify-between items-center mt-1">
                                        <button 
                                          onClick={() => setEditServices([...editServices, {qty: 1, name: availableServices[0]?.items[0]?.name || ''}])}
                                          className="text-xs font-bold text-rose-500 hover:text-rose-600 flex items-center gap-1 bg-rose-50 px-2 py-1 rounded"
                                        >
                                          <Plus className="w-3 h-3" /> Adicionar
                                        </button>
                                        <div className="flex items-center gap-1">
                                          <button onClick={() => handleEditSave(age.id)} className="p-1 text-blue-600 hover:bg-blue-100 rounded bg-white shadow-sm" title="Salvar">
                                            <Save className="w-3.5 h-3.5" />
                                          </button>
                                          <button onClick={() => setEditingId(null)} className="p-1 text-slate-400 hover:bg-slate-100 rounded bg-white shadow-sm" title="Cancelar">
                                            <X className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      </div>
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
                                        <span className="font-medium text-sm truncate flex-1 block">
                                          {isAdminView || isMine ? `${age.client_name} - ${age.service}` : 'Agendado'}
                                        </span>
                                        {age.status === 'pendente_autorizacao' && (
                                          <span className="ml-2 px-1.5 py-0.5 rounded-full bg-amber-200 text-[9px] font-black uppercase tracking-widest text-amber-800 flex items-center gap-1 shadow-sm shrink-0">
                                            <Clock className="w-3 h-3" /> Aguardando Autorização
                                          </span>
                                        )}
                                        {age.status === 'concluido' && (
                                          <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-black bg-green-200 text-green-800 uppercase tracking-widest border border-green-300 shadow-sm shrink-0">
                                            ✓ PG
                                          </span>
                                        )}
                                      </div>

                                      {(isAdminView || isMine) && (
                                        <div className="flex items-center gap-1.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                          {isAdminView && age.status === 'pendente_dinheiro' && (
                                            <button onClick={() => handleConfirmCash(age.id)} className="p-1 text-amber-500 hover:bg-amber-100 flex items-center gap-1 rounded transition-colors" title="Confirmar Recebimento em Dinheiro (Físico)">
                                              <Banknote className="w-4 h-4" />
                                            </button>
                                          )}
                                          {isAdminView && age.status === 'pendente_autorizacao' && (
                                            <button onClick={() => handleStatusChange(age.id, 'agendado')} className="p-1 text-green-500 hover:bg-green-100 flex items-center gap-1 rounded transition-colors" title="Autorizar Agendamento">
                                              <CheckCircle2 className="w-4 h-4" />
                                            </button>
                                          )}
                                          {isAdminView && age.status !== 'concluido' && age.status !== 'pendente_dinheiro' && age.status !== 'pendente_autorizacao' && (
                                            <button onClick={() => setCheckoutData(age)} className="p-1 text-green-600 hover:bg-green-200 rounded transition-colors" title="Finalizar Atendimento">
                                              <CheckCircle2 className="w-4 h-4" />
                                            </button>
                                          )}
                                          {(isAdminView || isMine) && (
                                            <button onClick={() => { 
                                              if (age.service.includes(' | ')) {
                                                const parts = age.service.split(' | ');
                                                setEditServices(parseServicesString(parts[0]));
                                                setFreeNote(parts[1] || '');
                                              } else {
                                                setEditServices(parseServicesString(age.service));
                                                setFreeNote('');
                                              }
                                              setEditingId(age.id); 
                                            }} className="p-1 text-blue-500 hover:bg-blue-200 rounded" title="Editar Serviço">
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
                                    <div className="flex-1 flex flex-col gap-1 ml-2 mb-1 bg-white p-2 rounded-lg shadow-sm border border-rose-200 z-20 relative">
                                      {isAdminView && (
                                        <div className="flex items-center gap-2 mb-1">
                                          <Users className="w-4 h-4 text-slate-400" />
                                          <select 
                                            className="flex-1 border border-slate-200 rounded px-2 py-1 outline-none text-xs text-slate-600 bg-slate-50"
                                            value={selectedClientId}
                                            onChange={e => setSelectedClientId(e.target.value)}
                                          >
                                            <option value="">(Reservar para Mim)</option>
                                            {clientsList.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                                          </select>
                                        </div>
                                      )}
                                      {newServices.map((srv, idx) => (
                                        <div key={idx} className="flex items-center gap-2">
                                          <select
                                            className="w-16 bg-slate-50 border border-slate-200 px-2 py-1.5 rounded-md outline-none text-xs text-slate-700 font-bold"
                                            value={srv.qty}
                                            onChange={(e) => {
                                              const ns = [...newServices];
                                              ns[idx].qty = Number(e.target.value);
                                              setNewServices(ns);
                                            }}
                                          >
                                            {[...Array(10)].map((_, i) => (
                                              <option key={i+1} value={i+1}>{i+1}x</option>
                                            ))}
                                          </select>
                                          <select
                                            className="flex-1 w-full bg-slate-50 border border-slate-200 px-2 py-1.5 rounded-md outline-none text-xs text-slate-700 font-bold focus:border-rose-300 transition-colors"
                                            value={srv.name}
                                            onChange={(e) => {
                                              const ns = [...newServices];
                                              ns[idx].name = e.target.value;
                                              setNewServices(ns);
                                            }}
                                            autoFocus={idx === 0}
                                          >
                                            <option value="" disabled>Selecione um Serviço...</option>
                                            {availableServices.map((grp, gIdx) => (
                                              <optgroup key={gIdx} label={grp.category?.toUpperCase() || 'SERVIÇOS'}>
                                                {grp.items.map((svc: {name: string, price: number}, sIdx: number) => (
                                                   <option key={`${gIdx}-${sIdx}`} value={svc.name}>{svc.name} - R$ {svc.price.toFixed(2).replace('.', ',')}</option>
                                                ))}
                                              </optgroup>
                                            ))}
                                          </select>
                                          {newServices.length > 1 && (
                                            <button onClick={() => setNewServices(newServices.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-500 p-1">
                                              <X className="w-3 h-3" />
                                            </button>
                                          )}
                                        </div>
                                      ))}

                                      <div className="flex mt-1">
                                        <input 
                                          type="text"
                                          placeholder="Anotação livre..."
                                          value={freeNote}
                                          onChange={(e) => setFreeNote(e.target.value)}
                                          className="flex-1 bg-slate-50 border border-slate-200 px-2 py-1 rounded outline-none text-xs text-slate-700"
                                        />
                                      </div>

                                      <div className="flex justify-between items-center mt-1">
                                        <button 
                                          onClick={() => setNewServices([...newServices, {qty: 1, name: availableServices[0]?.items[0]?.name || ''}])}
                                          className="text-xs font-bold text-rose-500 hover:text-rose-600 flex items-center gap-1 bg-rose-50 px-2 py-1 rounded"
                                        >
                                          <Plus className="w-3 h-3" /> Adicionar
                                        </button>
                                        
                                        <div className="flex items-center gap-1">
                                          <button 
                                            onClick={() => handleBook(time)}
                                            className="bg-rose-500 text-white px-2 py-1 rounded text-xs font-bold shadow hover:bg-rose-600 transition-colors shrink-0"
                                          >
                                            Salvar
                                          </button>
                                          <button onClick={() => setSelectedSlot(null)} className="p-1 text-slate-400 hover:text-slate-600 auto shrink-0">
                                            <Trash2 className="w-4 h-4" />
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  ) : (
                                    <button 
                                      onClick={() => { setSelectedSlot(time); setNewServices([{qty: 1, name: availableServices[0]?.items[0]?.name || ''}]); }}
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

      {/* Modal de Confirmação de Feriado (Auditoria) */}
      <AnimatePresence>
        {holidayConfirm.isOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-sm p-8 border border-white overflow-hidden relative"
            >
              <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-pink-500 via-rose-400 to-orange-400" />
              
              <div className="w-20 h-20 bg-rose-50 rounded-3xl flex items-center justify-center mx-auto mb-6 rotate-3 shadow-inner">
                <AlertOctagon className="w-10 h-10 text-rose-500" />
              </div>

              <h3 className="text-xl font-black text-slate-800 text-center mb-4 leading-tight px-4">
                Dia de Feriado Detectado
              </h3>
              
              <p className="text-slate-500 text-sm text-center mb-8 px-2 font-medium leading-relaxed">
                O dia solicitado é um feriado (<strong className="text-rose-500">{holidays.find(h => h.date === format(holidayConfirm.date!, 'yyyy-MM-dd'))?.name}</strong>). 
                Você tem certeza que deseja retirar o cadeado desse dia?
              </p>
              
              <div className="space-y-3">
                <button 
                  onClick={async () => {
                    if (holidayConfirm.date) {
                      await executeHolidayUnlock(holidayConfirm.date, true);
                      setHolidayConfirm({ isOpen: false, date: null });
                    }
                  }}
                  className="w-full bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white font-black py-4 rounded-2xl shadow-xl shadow-rose-200 transition-all active:scale-95 flex justify-center items-center gap-2 group"
                >
                  <Unlock className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                  Sim, quero abrir
                </button>
                
                <button 
                  onClick={async () => {
                    const dateStr = format(holidayConfirm.date!, 'yyyy-MM-dd');
                    const hName = holidays.find(h => h.date === dateStr)?.name || 'Feriado';
                    await logAuditAction('HOLIDAY_UNLOCK_DENIED', hName, `Administrador visualizou o aviso e decidiu MANTER o bloqueio do feriado.`);
                    setHolidayConfirm({ isOpen: false, date: null });
                  }}
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-4 rounded-2xl transition-all active:scale-95"
                >
                  Não
                </button>
              </div>

              <div className="mt-6 flex justify-center">
                <span className="text-[10px] uppercase tracking-widest font-black text-slate-300">Auditoria Ativada</span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {checkoutData && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 relative border border-slate-100 font-sans">
            <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
              <CheckCircle2 className="w-6 h-6 text-green-500" />
              Finalizar Atendimento
            </h3>
            
            <div className="space-y-4 mb-8">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Forma de Pagamento</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Mercado Pago', id: 'MercadoPago' },
                    { label: 'PicPay (App)', id: 'PicPay' },
                    { label: 'Maquininha', id: 'Maquina' },
                    { label: 'Dinheiro', id: 'Dinheiro' },
                    { label: 'Pix Direto', id: 'Pix' }
                  ].map(method => (
                    <button
                      key={method.id}
                      onClick={() => setCheckoutPayment(method.id)}
                      className={cn(
                        "py-2 px-1 rounded-lg text-xs sm:text-sm font-medium transition-all border",
                        checkoutPayment === method.id ? "bg-green-50 border-green-200 text-green-700 font-bold shadow-sm" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                      )}
                    >
                      {method.label}
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
