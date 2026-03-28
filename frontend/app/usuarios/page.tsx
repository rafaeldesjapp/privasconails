'use client';

import React, { useState } from 'react';
import { useSupabaseAuth, useSupabaseQuery } from '@/hooks/use-supabase';
import { supabase } from '@/lib/supabase';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import { Users, Shield, User as UserIcon, Check, X, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

import Link from 'next/link';

const UsuariosPage = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { user, role: currentUserRole, loading: authLoading } = useSupabaseAuth();
  const { data: profiles, loading: profilesLoading, error } = useSupabaseQuery('profiles');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [localProfiles, setLocalProfiles] = useState<any[]>([]);

  // Sincronizar profiles com localProfiles
  React.useEffect(() => {
    if (profiles) {
      setLocalProfiles(profiles);
    }
  }, [profiles]);

  const toggleRole = async (profileId: string, currentRole: string) => {
    setUpdatingId(profileId);
    const newRole = currentRole === 'admin' ? 'cliente' : 'admin';
    
    // Optimistic update - atualiza a UI imediatamente
    setLocalProfiles(prev => 
      prev.map(p => p.id === profileId ? { ...p, role: newRole } : p)
    );
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', profileId);
      
      if (error) throw error;
      
      // Força um refetch para garantir sincronização
      const { data: updatedProfiles } = await supabase
        .from('profiles')
        .select('*');
      
      if (updatedProfiles) {
        setLocalProfiles(updatedProfiles);
      }
    } catch (err) {
      console.error('Erro ao atualizar papel:', err);
      alert('Erro ao atualizar papel do usuário.');
      // Reverte o optimistic update em caso de erro
      setLocalProfiles(profiles);
    } finally {
      setUpdatingId(null);
    }
  };

  if (authLoading) return null;

  // Se não for admin, não deve ver esta página
  if (currentUserRole !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="text-center p-8 bg-white rounded-2xl shadow-xl max-w-md">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-black text-slate-800 mb-2">Acesso Negado</h1>
          <p className="text-slate-500 mb-6">Você não tem permissão para acessar esta página.</p>
          <Link href="/" className="inline-block py-3 px-6 bg-blue-600 text-white rounded-xl font-bold">Voltar para Home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-black text-slate-800 font-headline">Gerenciamento de Usuários</h1>
          <p className="text-slate-500">Controle os níveis de acesso dos usuários do sistema.</p>
        </div>
        <div className="p-3 bg-blue-100 rounded-xl">
          <Users className="w-6 h-6 text-blue-600" />
        </div>
      </div>

      {profilesLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : error ? (
        <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm">
          Erro ao carregar usuários: {error.message}
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Usuário</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nível de Acesso</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Data de Cadastro</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {localProfiles.map((profile) => (
                  <tr key={profile.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                          <UserIcon className="w-4 h-4 text-slate-400" />
                        </div>
                        <span className="text-sm font-medium text-slate-700">{profile.email}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all",
                        profile.role === 'admin' 
                          ? "bg-blue-50 text-blue-700 border border-blue-100" 
                          : "bg-amber-50 text-amber-700 border border-amber-100"
                      )}>
                        {profile.role === 'admin' ? <Shield className="w-3 h-3" /> : null}
                        {profile.role === 'admin' ? 'Administrador' : 'Cliente'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs text-slate-500">
                        {new Date(profile.created_at).toLocaleDateString('pt-BR')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => toggleRole(profile.id, profile.role)}
                        disabled={updatingId === profile.id || profile.id === user?.id}
                        className={cn(
                          "text-xs font-bold px-4 py-2 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed",
                          profile.role === 'admin'
                            ? "text-amber-600 hover:bg-amber-50"
                            : "text-blue-600 hover:bg-blue-50"
                        )}
                      >
                        {updatingId === profile.id ? 'Atualizando...' : (profile.role === 'admin' ? 'Tornar Cliente' : 'Tornar Admin')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsuariosPage;
