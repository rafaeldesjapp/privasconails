'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useSupabaseAuth } from '@/hooks/use-supabase';

interface ContactFormProps {
  onSuccess: () => void;
  initialData?: any;
}

const ContactForm = ({ onSuccess, initialData }: ContactFormProps) => {
  const { user } = useSupabaseAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState(initialData || {
    name: '',
    role: '',
    company: '',
    email: '',
    phone: '',
    location: '',
    status: 'Lead',
    health_score: 100,
    open_value: 0,
    last_interaction: new Date().toISOString(),
    photo_url: `https://picsum.photos/seed/${Math.random()}/200/200`
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    try {
      if (initialData?.id) {
        const { error } = await supabase
          .from('contacts')
          .update({
            ...formData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', initialData.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('contacts')
          .insert({
            ...formData,
            uid: user.id,
            created_at: new Date().toISOString(),
          });
        if (error) throw error;
      }
      onSuccess();
    } catch (err) {
      console.error('Error saving contact:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Nome Completo</label>
          <input 
            required
            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Ex: Beatriz Cavalcante"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Cargo</label>
          <input 
            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
            value={formData.role}
            onChange={(e) => setFormData({ ...formData, role: e.target.value })}
            placeholder="Ex: CTO"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Empresa</label>
          <input 
            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
            value={formData.company}
            onChange={(e) => setFormData({ ...formData, company: e.target.value })}
            placeholder="Ex: TechFlow Solutions"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">E-mail</label>
          <input 
            type="email"
            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="beatriz@empresa.com"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Telefone</label>
          <input 
            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            placeholder="+55 (11) 9..."
          />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Localização</label>
          <input 
            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
            value={formData.location}
            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
            placeholder="São Paulo, SP"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Status</label>
          <select 
            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
          >
            <option>Lead</option>
            <option>Customer</option>
            <option>Key Account</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Valor do Pipeline (R$)</label>
          <input 
            type="number"
            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
            value={formData.open_value}
            onChange={(e) => setFormData({ ...formData, open_value: Number(e.target.value) })}
          />
        </div>
      </div>
      <button 
        disabled={loading || !user}
        className="w-full py-3 bg-gradient-to-br from-[#003d9b] to-[#0052cc] text-white font-bold rounded-xl shadow-lg shadow-blue-900/20 hover:opacity-90 transition-all disabled:opacity-50"
      >
        {loading ? 'Salvando...' : 'Salvar Contato'}
      </button>
    </form>
  );
};

export default ContactForm;
