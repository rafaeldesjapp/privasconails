'use client';

import React, { useState } from 'react';
import { useSupabaseAuth, useSupabaseQuery } from '@/hooks/use-supabase';
import { supabase } from '@/lib/supabase';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import { Users, Shield, User as UserIcon, Check, X, AlertCircle, Key, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

import Link from 'next/link';

const UsuariosPage = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { user, role: currentUserRole, loading: authLoading } = useSupabaseAuth();
  const { data: profiles, loading: profilesLoading, error } = useSupabaseQuery('profiles');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [localProfiles, setLocalProfiles] = useState<any[]>([]);
  
  // Estados para modal de alterar senha
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [updatingPassword, setUpdatingPassword] = useState(false);

  // Sincronizar profiles com localProfiles
  React.useEffect(() => {
    if (profiles) {
      setLocalProfiles(profiles);
    }
  }, [profiles]);

  // Função para abrir modal de alterar senha
  const openPasswordModal = (profile: any) => {
    setSelectedUser(profile);
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError(null);
    setPasswordSuccess(null);
    setShowPassword(false);
    setShowPasswordModal(true);
  };

  // Função para alterar senha
  const handleChangePassword = async () => {
    setPasswordError(null);
    setPasswordSuccess(null);

    // Validações
    if (!newPassword || newPassword.length < 6) {
      setPasswordError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('As senhas não coincidem.');
      return;
    }

    setUpdatingPassword(true);

    try {
      // Usar a API para alterar senha
      const response = await fetch('/api/admin/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUser.id,
          newPassword: newPassword
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao alterar senha');
      }

      setPasswordSuccess(`Senha do usuário ${selectedUser.email} alterada com sucesso!`);
      setNewPassword('');
      setConfirmPassword('');
      
      // Fechar modal após 2 segundos
      setTimeout(() => {
        setShowPasswordModal(false);
        setPasswordSuccess(null);
      }, 2000);

    } catch (err: any) {
      console.error('Erro ao alterar senha:', err);
      setPasswordError(err.message || 'Erro ao alterar senha. Verifique as permissões.');
    } finally {
      setUpdatingPassword(false);
    }
  };

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
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openPasswordModal(profile)}
                          className="text-xs font-bold px-3 py-2 rounded-lg transition-all text-slate-600 hover:bg-slate-100 flex items-center gap-1"
                          title="Alterar Senha"
                        >
                          <Key className="w-3.5 h-3.5" />
                          Senha
                        </button>
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
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal de Alterar Senha */}
      {showPasswordModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-blue-100 rounded-xl">
                <Key className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-800">Alterar Senha</h2>
                <p className="text-sm text-slate-500">{selectedUser.email}</p>
              </div>
            </div>

            {passwordError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {passwordError}
              </div>
            )}

            {passwordSuccess && (
              <div className="mb-4 p-3 bg-green-50 border border-green-100 text-green-600 rounded-xl text-sm flex items-center gap-2">
                <Check className="w-4 h-4 flex-shrink-0" />
                {passwordSuccess}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Nova Senha
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                    placeholder="Digite a nova senha"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Confirmar Senha
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                  placeholder="Confirme a nova senha"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowPasswordModal(false)}
                className="flex-1 py-3 px-4 bg-slate-100 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleChangePassword}
                disabled={updatingPassword || !newPassword || !confirmPassword}
                className="flex-1 py-3 px-4 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {updatingPassword ? 'Salvando...' : 'Salvar Senha'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsuariosPage;
