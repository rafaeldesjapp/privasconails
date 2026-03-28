'use client';

import React, { useState, useEffect } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Search, 
  Bell, 
  HelpCircle, 
  X, 
  Briefcase, 
  User, 
  Users, 
  MoreVertical, 
  TrendingUp, 
  CalendarPlus,
  CheckCircle
} from 'lucide-react';
import { useSupabaseAuth, useSupabaseQuery } from '@/hooks/use-supabase';
import { cn } from '@/lib/utils';
import Modal from '@/components/Modal';
import AppointmentForm from '@/components/AppointmentForm';

const AgendaPage = () => {
  const { user } = useSupabaseAuth();
  const { data: appointments } = useSupabaseQuery('appointments', {
    where: user ? { column: 'uid', value: user.id } : undefined,
    orderBy: { column: 'date', ascending: true }
  });
  const [selectedConsultant, setSelectedConsultant] = useState('Carlos Mendes');
  const [isAppointmentModalOpen, setIsAppointmentModalOpen] = useState(false);

  const consultants = [
    { name: 'Carlos Mendes', photo: 'https://picsum.photos/seed/carlos/100/100' },
    { name: 'Ana Oliveira', photo: 'https://picsum.photos/seed/ana/100/100' },
    { name: 'Marcos Paulo', photo: 'https://picsum.photos/seed/marcos/100/100' },
  ];

  // Calendar logic (simplified for UI)
  const days = Array.from({ length: 31 }, (_, i) => i + 1);
  const currentMonth = "Outubro 2024";

  return (
    <div className="flex flex-col h-full gap-6">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-slate-100 gap-4">
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
          <div className="flex items-center bg-slate-100 rounded-lg p-1 w-full sm:w-auto">
            <button className="flex-1 sm:flex-none px-4 py-1.5 text-[10px] sm:text-xs font-bold rounded-md bg-white text-blue-700 shadow-sm">Mês</button>
            <button className="flex-1 sm:flex-none px-4 py-1.5 text-[10px] sm:text-xs font-medium text-slate-500 hover:text-blue-700 transition-colors">Semana</button>
            <button className="flex-1 sm:flex-none px-4 py-1.5 text-[10px] sm:text-xs font-medium text-slate-500 hover:text-blue-700 transition-colors">Dia</button>
          </div>
          <h3 className="font-headline font-bold text-lg sm:text-xl text-slate-900 tracking-tight">{currentMonth}</h3>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto justify-center">
          <button className="p-2 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button className="px-6 py-2 bg-slate-50 hover:bg-slate-100 rounded-lg text-xs font-bold transition-colors">Hoje</button>
          <button className="p-2 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-6 overflow-hidden">
        {/* Calendar Grid */}
        <section className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-auto min-h-[400px] lg:min-h-0">
          <div className="grid grid-cols-7 border-b border-slate-100 min-w-[600px] lg:min-w-0">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
              <div key={day} className="p-3 text-center text-[10px] font-black uppercase tracking-widest text-slate-400 border-l first:border-l-0 border-slate-100">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 auto-rows-fr h-full min-h-[600px] min-w-[600px] lg:min-w-0">
            {/* Mock days for visualization */}
            {Array.from({ length: 35 }).map((_, i) => {
              const dayNum = i - 2; // Offset for Oct 2024
              const isCurrentMonth = dayNum > 0 && dayNum <= 31;
              
              // Find real appointments for this day
              const dayAppointments = appointments.filter(appt => {
                const apptDate = new Date(appt.date);
                return apptDate.getDate() + 1 === dayNum && apptDate.getMonth() === 9 && apptDate.getFullYear() === 2024;
              });

              return (
                <div 
                  key={i} 
                  className={cn(
                    "min-h-[120px] p-2 border-t border-l first:border-l-0 border-slate-100",
                    !isCurrentMonth && "bg-slate-50/50",
                    dayNum === 7 && "bg-blue-50/30"
                  )}
                >
                  <span className={cn(
                    "text-xs font-bold",
                    isCurrentMonth ? (dayNum === 7 ? "text-blue-700" : "text-slate-900") : "text-slate-300"
                  )}>
                    {dayNum > 0 && dayNum <= 31 ? dayNum : (dayNum <= 0 ? 30 + dayNum : dayNum - 31)}
                  </span>
                  
                  {dayAppointments.map(appt => (
                    <div key={appt.id} className="mt-2 p-1.5 bg-blue-100/50 border-l-4 border-blue-700 rounded text-[10px] font-semibold text-blue-700 truncate hover:scale-105 transition-transform cursor-pointer">
                      {appt.title}
                    </div>
                  ))}

                  {/* Fallback mock events if no real ones */}
                  {appointments.length === 0 && (
                    <>
                      {dayNum === 4 && (
                        <div className="mt-2 p-1.5 bg-blue-100/50 border-l-4 border-blue-700 rounded text-[10px] font-semibold text-blue-700 truncate">
                          Reunião Nexus...
                        </div>
                      )}

                      {dayNum === 7 && (
                        <div className="mt-2 space-y-1">
                          <div className="p-1.5 bg-white shadow-sm border-l-4 border-blue-700 rounded text-[10px] font-semibold text-blue-700 truncate hover:scale-105 transition-transform cursor-pointer">
                            Demo Corporate
                          </div>
                          <div className="p-1.5 bg-white shadow-sm border-l-4 border-orange-600 rounded text-[10px] font-semibold text-orange-700 truncate hover:scale-105 transition-transform cursor-pointer">
                            Call Alinhamento
                          </div>
                        </div>
                      )}

                      {dayNum === 8 && (
                        <div className="mt-2 p-1.5 bg-orange-100/50 border-l-4 border-orange-600 rounded text-[10px] font-semibold text-orange-700 truncate">
                          Prospecção Ativa
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Sidebar */}
        <aside className="w-full lg:w-80 flex flex-col gap-6">
          {/* Consultant Filter */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
            <h4 className="font-headline font-bold text-sm text-slate-900 mb-4">Filtrar por Consultor</h4>
            <div className="space-y-3">
              {consultants.map(c => (
                <label 
                  key={c.name}
                  onClick={() => setSelectedConsultant(c.name)}
                  className={cn(
                    "flex items-center justify-between p-2 rounded-xl cursor-pointer transition-all",
                    selectedConsultant === c.name 
                      ? "bg-blue-50 border border-blue-200" 
                      : "hover:bg-slate-50 border border-transparent"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <img 
                      alt={c.name} 
                      className={cn("w-8 h-8 rounded-full", selectedConsultant !== c.name && "grayscale opacity-50")} 
                      src={c.photo} 
                    />
                    <span className={cn("text-xs font-bold", selectedConsultant === c.name ? "text-blue-700" : "text-slate-500")}>
                      {c.name}
                    </span>
                  </div>
                  {selectedConsultant === c.name ? (
                    <CheckCircle className="w-4 h-4 text-blue-700 fill-current" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border border-slate-300"></div>
                  )}
                </label>
              ))}
            </div>
          </div>

          {/* Next Appointments */}
          <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col overflow-hidden">
            <div className="p-5 border-b border-slate-100 bg-slate-50/50">
              <h4 className="font-headline font-bold text-sm text-slate-900">Próximos Agendamentos</h4>
              <p className="text-[10px] text-slate-500 font-medium">Hoje, 07 de Outubro</p>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {appointments.length > 0 ? appointments.map(appt => (
                <div key={appt.id} className="relative pl-4 group cursor-pointer">
                  <div className={cn(
                    "absolute left-0 top-0 bottom-0 w-1 rounded-full group-hover:w-1.5 transition-all",
                    appt.type === 'Presencial' ? 'bg-orange-600' : 'bg-blue-700'
                  )}></div>
                  <div className="bg-slate-50 p-3 rounded-xl border border-transparent hover:border-blue-700/20 transition-all">
                    <div className="flex justify-between items-start mb-2">
                      <span className={cn(
                        "text-[10px] font-black uppercase tracking-wider",
                        appt.type === 'Presencial' ? 'text-orange-600' : 'text-blue-700'
                      )}>{appt.startTime} - {appt.endTime}</span>
                      <MoreVertical className="w-4 h-4 text-slate-400" />
                    </div>
                    <h5 className="text-sm font-bold text-slate-900 mb-1">{appt.title}</h5>
                    <div className="flex items-center gap-2 mb-2">
                      <Briefcase className="w-3 h-3 text-slate-500" />
                      <span className="text-[11px] text-slate-600 font-medium">{appt.type}</span>
                    </div>
                  </div>
                </div>
              )) : (
                <>
                  <div className="relative pl-4 group cursor-pointer">
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-700 rounded-full group-hover:w-1.5 transition-all"></div>
                    <div className="bg-slate-50 p-3 rounded-xl border border-transparent hover:border-blue-700/20 transition-all">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] font-black text-blue-700 uppercase tracking-wider">10:30 - 11:30</span>
                        <MoreVertical className="w-4 h-4 text-slate-400" />
                      </div>
                      <h5 className="text-sm font-bold text-slate-900 mb-1">Demo Sistema ERP</h5>
                      <div className="flex items-center gap-2 mb-2">
                        <Briefcase className="w-3 h-3 text-slate-500" />
                        <span className="text-[11px] text-slate-600 font-medium">Tech Solutions S.A.</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <img alt="Client" className="w-5 h-5 rounded-full" src="https://picsum.photos/seed/joao/50/50" />
                        <span className="text-[11px] text-slate-500">João Viana</span>
                      </div>
                    </div>
                  </div>

                  <div className="relative pl-4 group cursor-pointer">
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-orange-600 rounded-full group-hover:w-1.5 transition-all"></div>
                    <div className="bg-slate-50 p-3 rounded-xl border border-transparent hover:border-orange-600/20 transition-all">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] font-black text-orange-600 uppercase tracking-wider">14:00 - 14:45</span>
                        <MoreVertical className="w-4 h-4 text-slate-400" />
                      </div>
                      <h5 className="text-sm font-bold text-slate-900 mb-1">Negociação Contrato</h5>
                      <div className="flex items-center gap-2 mb-2">
                        <User className="w-3 h-3 text-slate-500" />
                        <span className="text-[11px] text-slate-600 font-medium">Marina Luz</span>
                      </div>
                      <div className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded text-[9px] font-bold w-fit uppercase">Alta Prioridade</div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Capacity Stats */}
          <div className="bg-gradient-to-br from-[#003d9b] to-[#0052cc] p-5 rounded-2xl shadow-lg text-white">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">Capacidade da Semana</span>
              <TrendingUp className="w-4 h-4" />
            </div>
            <div className="text-2xl font-black font-headline">84%</div>
            <div className="w-full bg-white/20 h-1.5 rounded-full mt-3 overflow-hidden">
              <div className="bg-white h-full w-[84%] rounded-full shadow-[0_0_8px_rgba(255,255,255,0.5)]"></div>
            </div>
            <p className="text-[10px] mt-3 opacity-70 font-medium">+12% em relação à última semana</p>
          </div>
        </aside>
      </div>

      <Modal 
        isOpen={isAppointmentModalOpen} 
        onClose={() => setIsAppointmentModalOpen(false)} 
        title="Novo Agendamento"
      >
        <AppointmentForm 
          onSuccess={() => setIsAppointmentModalOpen(false)} 
        />
      </Modal>

      {/* FAB */}
      <button 
        onClick={() => setIsAppointmentModalOpen(true)}
        className="fixed bottom-8 right-8 w-14 h-14 bg-blue-700 text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 transition-transform z-50 group"
      >
        <CalendarPlus className="w-6 h-6" />
        <span className="absolute right-full mr-3 bg-slate-900 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Agendar Agora</span>
      </button>
    </div>
  );
};

export default AgendaPage;
