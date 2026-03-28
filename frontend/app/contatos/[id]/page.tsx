'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  ChevronRight, 
  Star, 
  Clock, 
  CalendarPlus, 
  Edit, 
  Mail, 
  TrendingUp, 
  Calendar, 
  Plus, 
  MoreVertical, 
  Phone, 
  Mic, 
  FileText, 
  Image as ImageIcon, 
  Download, 
  AtSign, 
  Smartphone, 
  MapPin,
  Trash2
} from 'lucide-react';
import { motion } from 'motion/react';
import { supabase } from '@/lib/supabase';
import { useSupabaseAuth, useSupabaseQuery } from '@/hooks/use-supabase';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import Modal from '@/components/Modal';
import AppointmentForm from '@/components/AppointmentForm';

const ContactDetailPage = () => {
  const params = useParams();
  const router = useRouter();
  const contactId = params.id as string;
  const { user } = useSupabaseAuth();
  const [contact, setContact] = useState<any>(null);
  const [isAppointmentModalOpen, setIsAppointmentModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const { data: appointments } = useSupabaseQuery('appointments', {
    orderBy: { column: 'date', ascending: true },
    where: { column: 'contact_id', value: contactId }
  });

  const handleDelete = async () => {
    if (!contactId) return;
    try {
      const { error } = await supabase.from('contacts').delete().eq('id', contactId);
      if (error) throw error;
      router.push('/contatos');
    } catch (err) {
      console.error('Error deleting contact:', err);
    }
  };

  useEffect(() => {
    if (!user || !contactId) return;

    async function fetchContact() {
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('id', contactId)
        .single();

      if (error) {
        if (contactId.startsWith('mock-')) {
          setContact({
            id: contactId,
            name: contactId === 'mock-1' ? "Beatriz Cavalcante" : contactId === 'mock-2' ? "Ricardo Santos" : "Ana Paula Silva",
            role: contactId === 'mock-1' ? "Chief Technology Officer" : contactId === 'mock-2' ? "Diretor Comercial" : "Gerente de Projetos",
            company: contactId === 'mock-1' ? "TechFlow Solutions" : contactId === 'mock-2' ? "Global Logistics" : "Inova Tech",
            status: contactId === 'mock-1' ? "Key Account" : contactId === 'mock-2' ? "Lead" : "Customer",
            health_score: contactId === 'mock-1' ? 92 : contactId === 'mock-2' ? 75 : 88,
            open_value: contactId === 'mock-1' ? 145200 : contactId === 'mock-2' ? 45000 : 12000,
            last_interaction: "Ontem, 14:30",
            email: contactId === 'mock-1' ? "beatriz.c@techflow.com.br" : contactId === 'mock-2' ? "ricardo.s@globallog.com" : "ana.silva@inovatech.io",
            phone: "+55 (11) 98765-4321",
            location: "São Paulo, SP",
            photo_url: `https://picsum.photos/seed/${contactId}/200/200`
          });
        }
      } else {
        setContact(data);
      }
    }

    fetchContact();
  }, [user, contactId]);

  if (!contact) return <div className="p-8 text-center font-medium text-slate-500">Carregando contato...</div>;

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header Section: Customer Identity */}
      <section className="mb-8 flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6 w-full lg:w-auto text-center sm:text-left">
          <div className="relative">
            <img 
              alt={contact?.name} 
              className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover shadow-xl" 
              src={contact?.photo_url || "https://picsum.photos/seed/avatar/200/200"}
            />
            <div className="absolute -bottom-2 -right-2 bg-green-500 w-5 h-5 sm:w-6 sm:h-6 rounded-full border-4 border-white"></div>
          </div>
          <div className="flex-1">
            <nav className="flex items-center justify-center sm:justify-start gap-2 text-[10px] sm:text-xs text-slate-500 mb-2 font-medium">
              <Link href="/contatos" className="hover:text-blue-700">Contatos</Link>
              <ChevronRight className="w-3 h-3" />
              <span className="truncate max-w-[150px]">{contact?.company}</span>
            </nav>
            <h2 className="text-2xl sm:text-3xl font-extrabold font-headline tracking-tight text-slate-900">{contact?.name}</h2>
            <p className="text-sm sm:text-base text-slate-600 font-medium">{contact?.role} na {contact?.company}</p>
            <div className="flex flex-wrap justify-center sm:justify-start gap-2 sm:gap-4 mt-3">
              <span className={cn(
                "px-2 sm:px-3 py-1 text-[10px] sm:text-xs font-bold rounded-full border flex items-center gap-1",
                contact.status === 'Key Account' ? "bg-blue-50 text-blue-700 border-blue-100" :
                contact.status === 'Lead' ? "bg-orange-50 text-orange-700 border-orange-100" :
                "bg-emerald-50 text-emerald-700 border-emerald-100"
              )}>
                <Star className="w-3 h-3 fill-current" />
                {contact.status}
              </span>
              <span className="px-2 sm:px-3 py-1 bg-slate-50 text-slate-700 text-[10px] sm:text-xs font-bold rounded-full border border-slate-100 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Follow-up Pendente
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2 sm:gap-3 w-full lg:w-auto">
          <button 
            onClick={() => setIsAppointmentModalOpen(true)}
            className="flex-1 sm:flex-none px-4 sm:px-5 py-2 sm:py-2.5 bg-white text-slate-700 text-xs sm:text-sm font-bold rounded-xl shadow-sm hover:shadow-md transition-all border border-slate-200 flex items-center justify-center gap-2"
          >
            <CalendarPlus className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="hidden xs:inline">Novo Agendamento</span>
            <span className="xs:hidden">Agendar</span>
          </button>
          <button className="flex-1 sm:flex-none px-4 sm:px-5 py-2 sm:py-2.5 bg-white text-slate-700 text-xs sm:text-sm font-bold rounded-xl shadow-sm hover:shadow-md transition-all border border-slate-200 flex items-center justify-center gap-2">
            <Edit className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="hidden xs:inline">Editar Perfil</span>
            <span className="xs:hidden">Editar</span>
          </button>
          <button 
            onClick={() => setIsDeleteModalOpen(true)}
            className="p-2 sm:px-5 sm:py-2.5 bg-white text-red-600 font-bold rounded-xl shadow-sm hover:shadow-md transition-all border border-red-100 flex items-center justify-center gap-2"
          >
            <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="hidden sm:inline">Excluir</span>
          </button>
          <button className="flex-1 sm:flex-none px-4 sm:px-6 py-2 sm:py-2.5 bg-gradient-to-br from-[#003d9b] to-[#0052cc] text-white text-xs sm:text-sm font-bold rounded-xl shadow-lg shadow-blue-900/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2">
            <Mail className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="hidden xs:inline">Enviar E-mail</span>
            <span className="xs:hidden">E-mail</span>
          </button>
        </div>
      </section>

      <Modal 
        isOpen={isAppointmentModalOpen} 
        onClose={() => setIsAppointmentModalOpen(false)} 
        title="Novo Agendamento"
      >
        <AppointmentForm 
          contactId={contact?.id} 
          onSuccess={() => setIsAppointmentModalOpen(false)} 
        />
      </Modal>

      <Modal 
        isOpen={isDeleteModalOpen} 
        onClose={() => setIsDeleteModalOpen(false)} 
        title="Excluir Contato"
      >
        <div className="space-y-6">
          <p className="text-slate-600">Tem certeza que deseja excluir este contato? Esta ação não pode ser desfeita.</p>
          <div className="flex gap-3 justify-end">
            <button 
              onClick={() => setIsDeleteModalOpen(false)}
              className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-100 rounded-xl transition-all"
            >
              Cancelar
            </button>
            <button 
              onClick={handleDelete}
              className="px-4 py-2 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-all shadow-lg shadow-red-900/20"
            >
              Excluir
            </button>
          </div>
        </div>
      </Modal>

      {/* Bento Grid Layout */}
      <div className="grid grid-cols-12 gap-6 items-start">
        {/* Left Column */}
        <div className="col-span-12 lg:col-span-8 space-y-6">
          {/* Metrics Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-1">Total em Aberto</p>
              <p className="text-2xl font-black font-headline text-blue-700">R$ {contact?.open_value?.toLocaleString('pt-BR')}</p>
            </div>
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-1">Última Interação</p>
              <p className="text-2xl font-black font-headline text-slate-900">{contact?.last_interaction}</p>
            </div>
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-1">Score de Saúde</p>
              <div className="flex items-center gap-2">
                <p className="text-2xl font-black font-headline text-emerald-600">{contact?.health_score}/100</p>
                <TrendingUp className="w-5 h-5 text-emerald-600" />
              </div>
            </div>
          </div>

          {/* Upcoming Appointments */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-700" />
                <h3 className="text-lg font-extrabold font-headline">Próximos Agendamentos</h3>
              </div>
              <button 
                onClick={() => setIsAppointmentModalOpen(true)}
                className="text-sm font-bold text-blue-700 hover:underline flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                Agendar
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {appointments.length > 0 ? appointments.map((appt) => (
                <div key={appt.id} className="flex items-center gap-4 p-4 rounded-xl bg-blue-50/50 border border-blue-100">
                  <div className="bg-white p-2 rounded-lg text-center min-w-[50px] shadow-sm">
                    <p className="text-[10px] font-black text-blue-600 uppercase">
                      {new Date(appt.date).toLocaleDateString('pt-BR', { month: 'short' })}
                    </p>
                    <p className="text-lg font-black text-slate-900">
                      {new Date(appt.date).getDate() + 1}
                    </p>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-bold text-slate-900">{appt.title}</h4>
                    <p className="text-xs text-slate-500">{appt.startTime} - {appt.endTime} • {appt.type}</p>
                  </div>
                  <button className="p-1.5 hover:bg-white rounded-lg transition-colors text-slate-400">
                    <MoreVertical className="w-5 h-5" />
                  </button>
                </div>
              )) : (
                <div className="col-span-2 p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <p className="text-sm text-slate-500 font-medium">Nenhum agendamento futuro encontrado.</p>
                </div>
              )}
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-extrabold font-headline">Linha do Tempo</h3>
              <div className="flex gap-2">
                <button className="text-xs font-bold text-blue-700 px-3 py-1.5 bg-blue-50 rounded-lg">Tudo</button>
                <button className="text-xs font-bold text-slate-400 px-3 py-1.5 hover:bg-slate-50 rounded-lg">Chamadas</button>
                <button className="text-xs font-bold text-slate-400 px-3 py-1.5 hover:bg-slate-50 rounded-lg">E-mails</button>
              </div>
            </div>
            <div className="space-y-8 relative before:absolute before:left-[19px] before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-100">
              <div className="relative flex gap-6">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center z-10 ring-4 ring-white">
                  <Phone className="w-5 h-5 text-blue-700" />
                </div>
                <div className="flex-1">
                  <div className="flex justify-between mb-1">
                    <h4 className="font-bold text-slate-900">Chamada Realizada</h4>
                    <span className="text-xs text-slate-400 font-medium">Ontem às 14:30</span>
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed mb-3">Discussão sobre a renovação do contrato anual e expansão para 50 novas licenças. Beatriz demonstrou interesse no módulo de IA.</p>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-center gap-3">
                    <Mic className="w-4 h-4 text-slate-400" />
                    <span className="text-xs font-bold text-slate-500 italic">&quot;Gostaríamos de ver uma demo da nova API...&quot;</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="col-span-12 lg:col-span-4 space-y-6">
          {/* Quick Notes */}
          <div className="bg-slate-100 rounded-2xl p-6 shadow-inner">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-500">Notas Rápidas</h3>
              <button className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm text-blue-700 hover:bg-slate-50 transition-colors">
                <Plus className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div className="bg-amber-50 p-4 rounded-xl border-l-4 border-amber-300 shadow-sm">
                <p className="text-sm text-amber-900 leading-relaxed">Prefere reuniões às terças-feiras pela manhã. Tomador de decisão final é o CFO (Marcos).</p>
              </div>
            </div>
          </div>

          {/* Contact Info */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 mb-4">Informações de Contato</h3>
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                  <AtSign className="w-5 h-5 text-slate-500" />
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">E-mail Corporativo</p>
                  <p className="text-sm font-semibold text-slate-900">{contact?.email}</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                  <Smartphone className="w-5 h-5 text-slate-500" />
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Celular</p>
                  <p className="text-sm font-semibold text-slate-900">{contact?.phone}</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                  <MapPin className="w-5 h-5 text-slate-500" />
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Escritório</p>
                  <p className="text-sm font-semibold text-slate-900">{contact?.location}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Documents */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-500">Documentos</h3>
              <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 rounded text-slate-500">4 ARQUIVOS</span>
            </div>
            <div className="space-y-3">
              <a className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors group" href="#">
                <div className="w-8 h-8 rounded bg-red-50 flex items-center justify-center text-red-600 group-hover:bg-red-100">
                  <FileText className="w-4 h-4" />
                </div>
                <div className="flex-1 overflow-hidden">
                  <p className="text-xs font-bold text-slate-900 truncate">Contrato_Master_v2023.pdf</p>
                  <p className="text-[10px] text-slate-400">2.4 MB • 12 Out</p>
                </div>
                <Download className="w-4 h-4 text-slate-300 group-hover:text-blue-600 transition-colors" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContactDetailPage;
