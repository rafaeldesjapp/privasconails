'use client';

import React, { useState } from 'react';
import { useSupabaseAuth, useSupabaseQuery } from '@/hooks/use-supabase';
import { supabase } from '@/lib/supabase';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import Auth from '@/components/Auth';
import { Users, Shield, User as UserIcon, Check, X, AlertCircle, Key, Eye, EyeOff, Pencil, Mail, Phone, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

import Link from 'next/link';

const UsuariosPage = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { user, role: currentUserRole, loading: authLoading } = useSupabaseAuth();
  const { data: profiles, loading: profilesLoading, error } = useSupabaseQuery<any[]>('profiles', [user?.id]);
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

  // Estados para edição de email e celular
  const [showNameModal, setShowNameModal] = useState(false);
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [updatingField, setUpdatingField] = useState(false);

  // Estados para criação de novo usuário
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newPasswordValue, setNewPasswordValue] = useState('');
  const [creatingUser, setCreatingUser] = useState(false);

  // Estados para exclusão de usuário
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deletingUser, setDeletingUser] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Sincronizar profiles com localProfiles
  React.useEffect(() => {
    if (profiles) {
      setLocalProfiles(profiles);
    }
  }, [profiles]);

  // Função para abrir modal de alterar senha
  const openPasswordModal = (profile: any) => {
    if (currentUserRole !== 'admin') {
      alert('Apenas administradores podem gerenciar senhas de usuários.');
      return;
    }
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
      if (currentUserRole === 'admin') {
        console.log('Frontend: Attempting to change password for:', selectedUser.id);
        // Usar a API para alterar senha
        const response = await fetch('/api/admin/change-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: selectedUser.id,
            newPassword: newPassword
          })
        });

        console.log('Frontend: API Response status:', response.status);
        const data = await response.json();
        console.log('Frontend: API Response data:', data);

        if (!response.ok) {
          throw new Error(data.error || 'Erro ao alterar senha');
        }

        setPasswordSuccess(`Senha do usuário ${selectedUser.email} alterada com sucesso!`);
      } else {
        // Lógica para cliente: Criar solicitação
        const { error: reqError } = await supabase.from('solicitacoes').insert({
          user_id: user?.id,
          type: 'change_password',
          data: { newPassword },
          status: 'pendente',
          description: `Alteração de senha solicitada por ${user?.email}`
        });

        if (reqError) throw reqError;
        setPasswordSuccess('Sua solicitação de alteração de senha foi enviada para aprovação do administrador.');
      }

      setNewPassword('');
      setConfirmPassword('');
      
      // Fechar modal após 2 segundos
      setTimeout(() => {
        setShowPasswordModal(false);
        setPasswordSuccess(null);
      }, 2000);

    } catch (err: any) {
      console.error('Erro ao alterar senha:', err);
      setPasswordError(err.message || 'Erro ao processar solicitação.');
    } finally {
      setUpdatingPassword(false);
    }
  };

  const formatPhone = (input: string) => {
    const digits = input.replace(/\D/g, "").slice(0, 11);
    let formatted = digits;
    if (digits.length > 0) {
      if (digits.length <= 2) {
        formatted = `(${digits}`;
      } else if (digits.length <= 7) {
        formatted = `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
      } else {
        formatted = `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
      }
    }
    return formatted;
  };

  const openNameModal = (profile: any) => {
    setSelectedUser(profile);
    setEditName(profile.full_name || profile.email?.split('@')[0] || '');
    setShowNameModal(true);
  };

  const openUsernameModal = (profile: any) => {
    setSelectedUser(profile);
    setEditUsername(profile.username || '');
    setShowUsernameModal(true);
  };

  const openEmailModal = (profile: any) => {
    setSelectedUser(profile);
    setEditEmail(profile.email || '');
    setShowEmailModal(true);
  };

  const openPhoneModal = (profile: any) => {
    setSelectedUser(profile);
    setEditPhone(formatPhone(profile.phone || ''));
    setShowPhoneModal(true);
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditPhone(formatPhone(e.target.value));
  };

  const handleNewPhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewPhone(formatPhone(e.target.value));
  };

  const handleCreateUser = async () => {
    if (!newName.trim() || !newEmail.trim() || !newPasswordValue.trim() || !newUsername.trim()) {
      alert('Preencha todos os campos obrigatórios.');
      return;
    }

    if (newPhone.replace(/\D/g, "").length !== 11) {
      alert('O celular deve ter 11 dígitos.');
      return;
    }

    setCreatingUser(true);
    try {
      const response = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: newName.trim(),
          phone: newPhone.trim(),
          email: newEmail.trim(),
          username: newUsername.trim().toLowerCase().replace(/\s/g, ''),
          password: newPasswordValue.trim(),
          role: 'cliente'
        })
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Erro ao criar usuário');

      // Atualizar lista local
      const { data: updatedProfiles } = await supabase
        .from('profiles')
        .select('*');
      
      if (updatedProfiles) {
        setLocalProfiles(updatedProfiles);
      }

      setShowCreateModal(false);
      setNewName('');
      setNewUsername('');
      setNewEmail('');
      setNewPhone('');
      setNewPasswordValue('');
      alert('Usuário criado com sucesso!');
    } catch (err: any) {
      console.error('Erro ao criar usuário:', err);
      alert('Erro ao criar usuário: ' + err.message);
    } finally {
      setCreatingUser(false);
    }
  };

  const handleUpdateUser = async (data: { email?: string; phone?: string; fullName?: string; username?: string }) => {
    setUpdatingField(true);
    try {
      if (currentUserRole === 'admin') {
        // Limpar dados antes de enviar
        const cleanData: any = { userId: selectedUser.id };
        if (data.email) cleanData.email = data.email.trim();
        if (data.phone !== undefined) cleanData.phone = data.phone.trim();
        if (data.fullName !== undefined) cleanData.fullName = data.fullName.trim();
        if (data.username !== undefined) cleanData.username = data.username.trim().toLowerCase().replace(/\s/g, '');

        const response = await fetch('/api/admin/update-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(cleanData)
        });

        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Erro ao atualizar usuário');

        // Atualizar estado local
        setLocalProfiles(prev => prev.map(p => {
          if (p.id === selectedUser.id) {
            const updated = { ...p };
            if (data.email) updated.email = data.email;
            if (data.phone !== undefined) updated.phone = data.phone;
            if (data.fullName !== undefined) updated.full_name = data.fullName;
            if (data.username !== undefined) updated.username = data.username;
            return updated;
          }
          return p;
        }));
        alert('Usuário atualizado com sucesso!');
      } else {
        // Lógica para cliente: Criar solicitação
        const { error: reqError } = await supabase.from('solicitacoes').insert({
          user_id: user?.id,
          type: 'update_profile',
          data: data,
          status: 'pendente',
          description: `Alteração de dados solicitada por ${user?.email}`
        });

        if (reqError) throw reqError;
        alert('Sua solicitação de alteração foi enviada para aprovação do administrador.');
      }

      setShowNameModal(false);
      setShowUsernameModal(false);
      setShowEmailModal(false);
      setShowPhoneModal(false);
    } catch (err: any) {
      console.error('Erro ao atualizar usuário:', err);
      alert('Erro ao processar solicitação: ' + err.message);
    } finally {
      setUpdatingField(false);
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
      if (profiles) {
        setLocalProfiles(profiles);
      }
    } finally {
      setUpdatingId(null);
    }
  };

  const openDeleteModal = (profile: any) => {
    if (currentUserRole !== 'admin') {
      alert('Apenas administradores podem excluir usuários.');
      return;
    }
    setSelectedUser(profile);
    setDeletePassword('');
    setDeleteError(null);
    setShowDeleteModal(true);
  };

  const handleDeleteUser = async () => {
    if (!deletePassword) {
      setDeleteError('A senha é obrigatória para excluir o usuário.');
      return;
    }
    setDeletingUser(true);
    setDeleteError(null);

    try {
      const response = await fetch('/api/admin/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUserId: selectedUser.id,
          adminEmail: user?.email,
          adminPassword: deletePassword,
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao excluir usuário');
      }

      // Remover o usuário localmente
      setLocalProfiles(prev => prev.filter(p => p.id !== selectedUser.id));
      setShowDeleteModal(false);
      alert('Usuário excluído com sucesso!');
    } catch (err: any) {
      console.error('Erro na exclusão:', err);
      setDeleteError(err.message || 'Erro ao processar solicitação.');
    } finally {
      setDeletingUser(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      
      <div className="lg:ml-64 flex flex-col min-h-screen">
        <Header onMenuClick={() => setIsSidebarOpen(true)} />
        
        <main className="flex-1 p-4 lg:p-8">
          <div className="w-full">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-2xl font-black text-slate-800 font-headline">
                  {currentUserRole === 'admin' ? 'Gerenciamento de Usuários' : 'Meu Perfil'}
                </h1>
                <p className="text-slate-500">
                  {currentUserRole === 'admin' 
                    ? 'Controle os níveis de acesso dos usuários do sistema.' 
                    : 'Visualize suas informações de perfil.'}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {currentUserRole === 'admin' && (
                  <button 
                    onClick={() => setShowCreateModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-all shadow-sm"
                  >
                    <Plus className="w-4 h-4" />
                    Novo Usuário
                  </button>
                )}
                <div className="p-3 bg-blue-100 rounded-xl">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
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
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">Usuário (Nome)</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">Login (@)</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">Email</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">Celular</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">Nível de Acesso</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">Data de Cadastro</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right whitespace-nowrap">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {localProfiles
                        .filter(p => currentUserRole === 'admin' || p.id === user?.id)
                        .map((profile) => (
                        <tr key={profile.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                                <UserIcon className="w-4 h-4 text-slate-400" />
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-slate-700">
                                  {profile.full_name || profile.email?.split('@')[0] || 'Usuário'}
                                </span>
                                {(currentUserRole === 'admin' || profile.id === user?.id) && (
                                  <button
                                    onClick={() => openNameModal(profile)}
                                    className="p-1 hover:bg-blue-50 rounded text-slate-400 hover:text-blue-600 transition-all"
                                    title="Editar Nome"
                                  >
                                    <Pencil className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-slate-600">
                                {profile.username ? `@${profile.username}` : '---'}
                              </span>
                              {(currentUserRole === 'admin' || profile.id === user?.id) && (
                                <button
                                  onClick={() => openUsernameModal(profile)}
                                  className="p-1.5 hover:bg-blue-50 rounded-lg text-slate-400 hover:text-blue-600 transition-all"
                                  title="Editar Login (@)"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-slate-600">{profile.email}</span>
                              {(currentUserRole === 'admin' || profile.id === user?.id) && (
                                <button
                                  onClick={() => openEmailModal(profile)}
                                  className="p-1.5 hover:bg-blue-50 rounded-lg text-slate-400 hover:text-blue-600 transition-all"
                                  title="Editar Email"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-slate-600">{profile.phone || '---'}</span>
                              {(currentUserRole === 'admin' || profile.id === user?.id) && (
                                <button
                                  onClick={() => openPhoneModal(profile)}
                                  className="p-1.5 hover:bg-blue-50 rounded-lg text-slate-400 hover:text-blue-600 transition-all"
                                  title="Editar Celular"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
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
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-xs text-slate-500">
                              {new Date(profile.created_at).toLocaleDateString('pt-BR')}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-2">
                              {(currentUserRole === 'admin' || profile.id === user?.id) && (
                                <button
                                  onClick={() => openPasswordModal(profile)}
                                  className="text-xs font-bold px-3 py-2 rounded-lg transition-all text-slate-600 hover:bg-slate-100 flex items-center gap-1"
                                  title="Redefinir Senha"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  Redefinir Senha
                                </button>
                              )}
                              {currentUserRole === 'admin' && (
                                <button
                                  onClick={() => openDeleteModal(profile)}
                                  disabled={profile.id === user?.id}
                                  className={cn(
                                    "p-2 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed",
                                    "text-red-500 hover:bg-red-50 hover:text-red-600"
                                  )}
                                  title={profile.id === user?.id ? "Você não pode excluir a si mesmo" : "Excluir Usuário"}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                              {currentUserRole === 'admin' && (
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
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

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

      {/* Modal de Alterar Nome */}
      {showNameModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-blue-100 rounded-xl">
                <UserIcon className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-800">Editar Nome</h2>
                <p className="text-sm text-slate-500">Atualize o nome completo do usuário.</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Nome Completo
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                  placeholder="Digite o nome completo"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowNameModal(false)}
                className="flex-1 py-3 px-4 bg-slate-100 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleUpdateUser({ fullName: editName })}
                disabled={updatingField || !editName}
                className="flex-1 py-3 px-4 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {updatingField ? 'Salvando...' : 'Salvar Nome'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Alterar Usuário (@) */}
      {showUsernameModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-blue-100 rounded-xl">
                <UserIcon className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-800">Editar Login (@)</h2>
                <p className="text-sm text-slate-500">Atualize o nome de usuário (@) para login.</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Nome de Usuário (@)
                </label>
                <input
                  type="text"
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value.toLowerCase().replace(/\s/g, ''))}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                  placeholder="ex: maria123"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowUsernameModal(false)}
                className="flex-1 py-3 px-4 bg-slate-100 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleUpdateUser({ username: editUsername })}
                disabled={updatingField || !editUsername}
                className="flex-1 py-3 px-4 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {updatingField ? 'Salvando...' : 'Salvar Login'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Alterar Email */}
      {showEmailModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-blue-100 rounded-xl">
                <Mail className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-800">Editar Email</h2>
                <p className="text-sm text-slate-500">Atualize o endereço de email do usuário.</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                  placeholder="Digite o novo email"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowEmailModal(false)}
                className="flex-1 py-3 px-4 bg-slate-100 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleUpdateUser({ email: editEmail })}
                disabled={updatingField || !editEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editEmail.trim())}
                className="flex-1 py-3 px-4 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {updatingField ? 'Salvando...' : 'Salvar Email'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Alterar Celular */}
      {showPhoneModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-blue-100 rounded-xl">
                <Phone className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-800">Editar Celular</h2>
                <p className="text-sm text-slate-500">Atualize o número de telefone do usuário.</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Celular
                </label>
                <input
                  type="text"
                  value={editPhone}
                  onChange={handlePhoneChange}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                  placeholder="(00) 00000-0000"
                  maxLength={15}
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowPhoneModal(false)}
                className="flex-1 py-3 px-4 bg-slate-100 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleUpdateUser({ phone: editPhone })}
                disabled={updatingField || editPhone.replace(/\D/g, "").length !== 11}
                className="flex-1 py-3 px-4 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {updatingField ? 'Salvando...' : 'Salvar Celular'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Criar Usuário */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-blue-100 rounded-xl">
                <Plus className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-800">Novo Usuário</h2>
                <p className="text-sm text-slate-500">Crie uma nova conta de usuário.</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Nome Completo</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                  placeholder="Nome do usuário"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Nome de Usuário (@)</label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value.toLowerCase().replace(/\s/g, ''))}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                  placeholder="ex: maria123"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Celular</label>
                <input
                  type="text"
                  value={newPhone}
                  onChange={handleNewPhoneChange}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                  placeholder="(00) 00000-0000"
                  maxLength={15}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Email</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                  placeholder="usuario@email.com"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Senha</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPasswordValue}
                    onChange={(e) => setNewPasswordValue(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                    placeholder="••••••••"
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
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 py-3 px-4 bg-slate-100 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateUser}
                disabled={creatingUser}
                className="flex-1 py-3 px-4 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creatingUser ? 'Criando...' : 'Criar Usuário'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Excluir Usuário */}
      {showDeleteModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-red-100 rounded-xl">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-800">Excluir Usuário</h2>
                <p className="text-sm text-slate-500">Ação irreversível para {selectedUser.email}</p>
              </div>
            </div>

            {deleteError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {deleteError}
              </div>
            )}

            <div className="p-4 bg-orange-50 border border-orange-100 rounded-xl mb-6">
              <p className="text-sm text-orange-800 font-medium">
                Esta ação excluirá permanentemente o usuário <strong className="font-bold">{selectedUser.email}</strong>. Por questões de segurança, digite a sua senha de administrador para confirmar e registrar este evento.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Sua Senha (Admin)</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all"
                    placeholder="Sua senha para confirmar"
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
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 py-3 px-4 bg-slate-100 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteUser}
                disabled={deletingUser || !deletePassword}
                className="flex-1 py-3 px-4 bg-red-600 text-white rounded-xl font-bold text-sm hover:bg-red-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deletingUser ? 'Excluindo...' : 'Excluir Definitivamente'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsuariosPage;
