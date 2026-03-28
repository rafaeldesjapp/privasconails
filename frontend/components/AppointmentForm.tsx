'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useSupabaseAuth } from '@/hooks/use-supabase';

interface AppointmentFormProps {
  contactId?: string;
  onSuccess: () => void;
}

const AppointmentForm = ({ contactId, onSuccess }: AppointmentFormProps) => {
  const { user } = useSupabaseAuth();
  const [loading, setLoading] = useState(false);
  const [contacts, setContacts] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    title: '',
    date: '',
    startTime: '',
    endTime: '',
    type: 'Google Meet',
    selectedContactId: contactId || '',
  });

  React.useEffect(() => {
    if (!user || contactId) return;

    const fetchContacts = async () => {
      const { data } = await supabase
        .from('contacts')
        .select('*')
        .eq('uid', user.id);
      if (data) setContacts(data);
    };

    fetchContacts();
  }, [user, contactId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    try {
      const { error } = await supabase.from('appointments').insert({
        title: formData.title,
        date: formData.date,
        start_time: formData.startTime,
        end_time: formData.endTime,
        type: formData.type,
        contact_id: formData.selectedContactId,
        uid: user.id,
      });
      
      if (error) throw error;
      onSuccess();
    } catch (err) {
      console.error('Error creating appointment:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {!contactId && (
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Contato</label>
          <select 
            required
            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
            value={formData.selectedContactId}
            onChange={(e) => setFormData({ ...formData, selectedContactId: e.target.value })}
          >
            <option value="">Selecione um contato</option>
            {contacts.map(c => (
              <option key={c.id} value={c.id}>{c.name} ({c.company})</option>
            ))}
          </select>
        </div>
      )}
      <div>
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Título</label>
        <input 
          required
          className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          placeholder="Ex: Reunião Trimestral"
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Data</label>
          <input 
            required
            type="date"
            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Tipo</label>
          <select 
            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
          >
            <option>Google Meet</option>
            <option>Presencial</option>
            <option>Call</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Início</label>
          <input 
            required
            type="time"
            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
            value={formData.startTime}
            onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Fim</label>
          <input 
            type="time"
            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
            value={formData.endTime}
            onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
          />
        </div>
      </div>
      <button 
        disabled={loading}
        className="w-full py-3 bg-gradient-to-br from-[#003d9b] to-[#0052cc] text-white font-bold rounded-xl shadow-lg shadow-blue-900/20 hover:opacity-90 transition-all disabled:opacity-50"
      >
        {loading ? 'Agendando...' : 'Agendar'}
      </button>
    </form>
  );
};

export default AppointmentForm;
