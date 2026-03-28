'use client';

import React, { useState, useEffect } from 'react';
import { Search, Plus, MoreVertical, Filter, Download, Mail, Phone, MapPin, ChevronRight, Star, Clock, Edit, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useSupabaseAuth, useSupabaseQuery } from '@/hooks/use-supabase';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import Modal from '@/components/Modal';
import ContactForm from '@/components/ContactForm';

const ContactsPage = () => {
  const { user, loading: authLoading } = useSupabaseAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<any>(null);
  const [contactToDelete, setContactToDelete] = useState<string | null>(null);

  const { data: contacts, loading: dataLoading } = useSupabaseQuery('contacts', {
    orderBy: { column: 'name', ascending: true },
    where: user ? { column: 'uid', value: user.id } : undefined
  });

  const handleEdit = (contact: any) => {
    setSelectedContact(contact);
    setIsModalOpen(true);
  };

  const handleAddNew = () => {
    setSelectedContact(null);
    setIsModalOpen(true);
  };

  const handleDeleteClick = (id: string) => {
    setContactToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!contactToDelete) return;
    try {
      const { error } = await supabase.from('contacts').delete().eq('id', contactToDelete);
      if (error) throw error;
      setIsDeleteModalOpen(false);
      setContactToDelete(null);
    } catch (err) {
      console.error('Error deleting contact:', err);
    }
  };

  const filteredContacts = contacts.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.company?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Mock data if empty
  const displayContacts = filteredContacts.length > 0 ? filteredContacts : [
    {
      id: 'mock-1',
      name: "Beatriz Cavalcante",
      role: "Chief Technology Officer",
      company: "TechFlow Solutions",
      status: "Key Account",
      healthScore: 92,
      email: "beatriz.c@techflow.com.br",
      phone: "+55 (11) 98765-4321",
      photoUrl: "https://picsum.photos/seed/beatriz/100/100"
    },
    {
      id: 'mock-2',
      name: "Ricardo Santos",
      role: "Diretor Comercial",
      company: "Global Logistics",
      status: "Lead",
      healthScore: 75,
      email: "ricardo.s@globallog.com",
      phone: "+55 (21) 97654-3210",
      photoUrl: "https://picsum.photos/seed/ricardo/100/100"
    },
    {
      id: 'mock-3',
      name: "Ana Paula Silva",
      role: "Gerente de Projetos",
      company: "Inova Tech",
      status: "Customer",
      healthScore: 88,
      email: "ana.silva@inovatech.io",
      phone: "+55 (31) 96543-2109",
      photoUrl: "https://picsum.photos/seed/ana/100/100"
    }
  ];

  return (
    <div className="flex flex-col h-full gap-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black font-headline text-slate-900 tracking-tight">Gestão de Contatos</h2>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">Gerencie seus relacionamentos e oportunidades</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button className="flex-1 sm:flex-none px-4 py-2.5 bg-white text-slate-700 font-bold rounded-xl shadow-sm border border-slate-200 flex items-center justify-center gap-2 hover:bg-slate-50 transition-all text-sm">
            <Download className="w-4 h-4" />
            Exportar
          </button>
          <button 
            onClick={handleAddNew}
            className="flex-1 sm:flex-none px-4 sm:px-5 py-2.5 bg-gradient-to-br from-[#003d9b] to-[#0052cc] text-white font-bold rounded-xl shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all text-sm"
          >
            <Plus className="w-5 h-5" />
            Novo Contato
          </button>
        </div>
      </div>

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
              onClick={confirmDelete}
              className="px-4 py-2 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-all shadow-lg shadow-red-900/20"
            >
              Excluir
            </button>
          </div>
        </div>
      </Modal>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={selectedContact ? "Editar Contato" : "Novo Contato"}
      >
        <ContactForm 
          initialData={selectedContact} 
          onSuccess={() => setIsModalOpen(false)} 
        />
      </Modal>

      {/* Filters & Search */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col lg:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Buscar por nome, empresa ou e-mail..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto items-center">
          <button className="w-full sm:w-auto px-4 py-2.5 bg-slate-50 text-slate-600 font-bold rounded-xl border border-slate-200 flex items-center justify-center gap-2 hover:bg-slate-100 transition-all text-sm">
            <Filter className="w-4 h-4" />
            Filtros
          </button>
          <div className="h-10 w-[1px] bg-slate-200 hidden lg:block mx-2"></div>
          <div className="flex bg-slate-100 p-1 rounded-xl w-full sm:w-auto">
            <button className="flex-1 sm:flex-none px-4 py-1.5 text-xs font-bold rounded-lg bg-white text-blue-700 shadow-sm">Todos</button>
            <button className="flex-1 sm:flex-none px-4 py-1.5 text-xs font-medium text-slate-500 hover:text-blue-700 transition-colors">Clientes</button>
            <button className="flex-1 sm:flex-none px-4 py-1.5 text-xs font-medium text-slate-500 hover:text-blue-700 transition-colors">Leads</button>
          </div>
        </div>
      </div>

      {/* Contacts Table/Grid */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {/* Mobile View: Cards */}
        <div className="grid grid-cols-1 divide-y divide-slate-100 sm:hidden">
          {displayContacts.map((contact) => (
            <div key={contact.id} className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img 
                    src={contact.photo_url} 
                    alt={contact.name} 
                    className="w-12 h-12 rounded-xl object-cover shadow-sm"
                  />
                  <div>
                    <Link href={`/contatos/${contact.id}`} className="text-sm font-bold text-slate-900 hover:text-blue-700 transition-colors block">
                      {contact.name}
                    </Link>
                    <p className="text-[10px] text-slate-500 font-medium">{contact.company}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => handleEdit(contact)}
                    className="p-2 text-slate-400 hover:text-blue-600"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => handleDeleteClick(contact.id)}
                    className="p-2 text-slate-400 hover:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              <div className="flex items-center justify-between pt-2">
                <span className={cn(
                  "px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider",
                  contact.status === 'Key Account' ? "bg-blue-50 text-blue-700 border border-blue-100" :
                  contact.status === 'Lead' ? "bg-orange-50 text-orange-700 border border-orange-100" :
                  "bg-emerald-50 text-emerald-700 border border-emerald-100"
                )}>
                  {contact.status}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Saúde</span>
                  <span className={cn(
                    "text-xs font-black",
                    contact.health_score > 85 ? "text-emerald-500" :
                    contact.health_score > 70 ? "text-blue-500" : "text-orange-500"
                  )}>{contact.health_score}%</span>
                </div>
              </div>
              
              <div className="flex items-center gap-4 text-[10px] text-slate-500 font-medium pt-2 border-t border-slate-50">
                <div className="flex items-center gap-1">
                  <Mail className="w-3 h-3" />
                  <span className="truncate max-w-[120px]">{contact.email}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  <span>{contact.phone}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop View: Table */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Contato</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Empresa / Cargo</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Status</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Saúde</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {displayContacts.map((contact) => (
                <tr key={contact.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <img 
                        src={contact.photo_url} 
                        alt={contact.name} 
                        className="w-10 h-10 rounded-xl object-cover shadow-sm"
                      />
                      <div>
                        <Link href={`/contatos/${contact.id}`} className="text-sm font-bold text-slate-900 hover:text-blue-700 transition-colors block">
                          {contact.name}
                        </Link>
                        <div className="flex items-center gap-2 text-[10px] text-slate-500 font-medium">
                          <Mail className="w-3 h-3" />
                          {contact.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="text-sm font-bold text-slate-700">{contact.company}</div>
                    <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">{contact.role}</div>
                  </td>
                  <td className="p-4">
                    <span className={cn(
                      "px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider",
                      contact.status === 'Key Account' ? "bg-blue-50 text-blue-700 border border-blue-100" :
                      contact.status === 'Lead' ? "bg-orange-50 text-orange-700 border border-orange-100" :
                      "bg-emerald-50 text-emerald-700 border border-emerald-100"
                    )}>
                      {contact.status}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-slate-100 rounded-full max-w-[60px] overflow-hidden">
                        <div 
                          className={cn(
                            "h-full rounded-full",
                            contact.health_score > 85 ? "bg-emerald-500" :
                            contact.health_score > 70 ? "bg-blue-500" : "bg-orange-500"
                          )}
                          style={{ width: `${contact.health_score}%` }}
                        ></div>
                      </div>
                      <span className="text-xs font-bold text-slate-700">{contact.health_score}%</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => handleEdit(contact)}
                        className="p-2 hover:bg-white hover:shadow-sm rounded-lg transition-all text-slate-400 hover:text-blue-600"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDeleteClick(contact.id)}
                        className="p-2 hover:bg-white hover:shadow-sm rounded-lg transition-all text-slate-400 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ContactsPage;
