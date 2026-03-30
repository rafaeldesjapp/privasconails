'use client';

import React, { useState, useEffect } from 'react';
import { useSupabaseAuth } from '@/hooks/use-supabase';
import { supabase } from '@/lib/supabase';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import Auth from '@/components/Auth';
import { Bell, Check, X, User, Mail, Phone, Key, AlertCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

const SolicitacoesPage = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { user, role, loading: authLoading } = useSupabaseAuth();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('solicitacoes')
        .select('*, profiles(full_name, email)')
        .order('created_at', { ascending: false });

      if (error) {
        if (error.code === 'PGRST116' || error.message.includes('relation "public.solicitacoes" does not exist')) {
          // Tabela não existe, vamos tentar criar (isso é um hack, idealmente seria via SQL)
          console.error('Tabela solicitacoes não existe.');
        }
        throw error;
      }
      setRequests(data || []);
    } catch (err) {
      console.error('Erro ao buscar solicitações:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (role === 'admin' || role === 'desenvolvedor') {
      fetchRequests();
      
      // Real-time updates
      const channel = supabase
        .channel('solicitacoes-admin')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'solicitacoes' }, () => {
          fetchRequests();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [role]);

  const handleApprove = async (request: any) => {
    setProcessingId(request.id);
    try {
      if (request.type === 'update_profile') {
        const response = await fetch('/api/admin/update-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: request.user_id,
            ...request.data
          })
        });

        if (!response.ok) {
          const result = await response.json();
          throw new Error(result.error || 'Erro ao processar atualização');
        }
      } else if (request.type === 'change_password') {
        const response = await fetch('/api/admin/change-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: request.user_id,
            newPassword: request.data.newPassword
          })
        });

        if (!response.ok) {
          const result = await response.json();
          throw new Error(result.error || 'Erro ao processar alteração de senha');
        }
      }

      // Marcar como aprovado
      const { error } = await supabase
        .from('solicitacoes')
        .update({ 
          status: 'aprovado',
          data: {
            ...request.data,
            resolved_by: user?.email,
            resolved_at: new Date().toISOString()
          }
        })
        .eq('id', request.id);

      if (error) throw error;
      
      alert('Solicitação aprovada e executada com sucesso!');
      fetchRequests();
    } catch (err: any) {
      console.error('Erro ao aprovar solicitação:', err);
      alert('Erro ao aprovar: ' + err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (request: any) => {
    setProcessingId(request.id);
    try {
      const { error } = await supabase
        .from('solicitacoes')
        .update({ 
          status: 'rejeitado',
          data: {
            ...request.data,
            resolved_by: user?.email,
            resolved_at: new Date().toISOString()
          }
        })
        .eq('id', request.id);

      if (error) throw error;
      
      alert('Solicitação rejeitada.');
      fetchRequests();
    } catch (err: any) {
      console.error('Erro ao rejeitar solicitação:', err);
      alert('Erro ao rejeitar: ' + err.message);
    } finally {
      setProcessingId(null);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) return <Auth />;
  if (role !== 'admin' && role !== 'desenvolvedor') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-slate-800 mb-2">Acesso Negado</h1>
          <p className="text-slate-600 mb-6">Você não tem permissão para acessar esta página.</p>
          <button 
            onClick={() => window.location.href = '/'}
            className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold"
          >
            Voltar para o Início
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      
      <div className="lg:ml-64 flex flex-col min-h-screen">
        <Header onMenuClick={() => setIsSidebarOpen(true)} />
        
        <main className="flex-1 p-4 lg:p-8">
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-2xl font-black text-slate-800 font-headline">Solicitações de Alteração</h1>
                <p className="text-slate-500">Aprove ou rejeite as solicitações feitas pelos clientes.</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-xl">
                <Bell className="w-6 h-6 text-blue-600" />
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : requests.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center border border-slate-100 shadow-sm">
                <Clock className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-slate-700">Nenhuma solicitação encontrada</h3>
                <p className="text-slate-500">Tudo em dia por aqui!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {requests.map((request) => (
                  <div 
                    key={request.id} 
                    className={cn(
                      "bg-white rounded-2xl p-6 shadow-sm border transition-all",
                      request.status === 'pendente' ? "border-blue-100 bg-blue-50/10" : "border-slate-100"
                    )}
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div className={cn(
                          "p-3 rounded-xl",
                          request.type === 'change_password' ? "bg-amber-100 text-amber-600" : "bg-blue-100 text-blue-600"
                        )}>
                          {request.type === 'change_password' ? <Key className="w-6 h-6" /> : <User className="w-6 h-6" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-bold text-slate-800">
                              {request.type === 'change_password' ? 'Alteração de Senha' : 'Atualização de Perfil'}
                            </h3>
                            <span className={cn(
                              "text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full",
                              request.status === 'pendente' ? "bg-blue-100 text-blue-700" :
                              request.status === 'aprovado' ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                            )}>
                              {request.status}
                            </span>
                          </div>
                          <p className="text-sm text-slate-600 mb-2">
                            Solicitado por: <span className="font-medium text-slate-800">{request.profiles?.full_name || request.profiles?.email}</span>
                          </p>
                          
                          <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Novos Dados:</p>
                            <div className="space-y-1">
                              {request.type === 'change_password' ? (
                                <div className="flex items-center gap-2 text-sm text-slate-700">
                                  <Key className="w-3.5 h-3.5 text-slate-400" />
                                  <span>Nova senha solicitada</span>
                                </div>
                              ) : (
                                <>
                                  {request.data.fullName && (
                                    <div className="flex items-center gap-2 text-sm text-slate-700">
                                      <User className="w-3.5 h-3.5 text-slate-400" />
                                      <span>Nome: {request.data.fullName}</span>
                                    </div>
                                  )}
                                  {request.data.email && (
                                    <div className="flex items-center gap-2 text-sm text-slate-700">
                                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                                      <span>Email: {request.data.email}</span>
                                    </div>
                                  )}
                                  {request.data.phone && (
                                    <div className="flex items-center gap-2 text-sm text-slate-700">
                                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                                      <span>Celular: {request.data.phone}</span>
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                          
                          {request.status !== 'pendente' && request.data.resolved_by && (
                            <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-500 bg-slate-50/50 p-2 rounded-lg border border-slate-200 w-fit">
                              <User className="w-3.5 h-3.5" />
                              <span>{request.status === 'aprovado' ? 'Aprovado' : 'Rejeitado'} por: <strong className="font-bold text-slate-700">{request.data.resolved_by}</strong></span>
                            </div>
                          )}
                        </div>
                      </div>

                      {request.status === 'pendente' && (
                        <div className="flex items-center gap-2 self-end md:self-center">
                          <button
                            onClick={() => handleReject(request)}
                            disabled={processingId === request.id}
                            className="p-3 text-red-600 hover:bg-red-50 rounded-xl transition-all border border-transparent hover:border-red-100"
                            title="Rejeitar"
                          >
                            <X className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleApprove(request)}
                            disabled={processingId === request.id}
                            className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-xl font-bold text-sm hover:bg-green-700 transition-all shadow-sm disabled:opacity-50"
                          >
                            {processingId === request.id ? 'Processando...' : (
                              <>
                                <Check className="w-4 h-4" />
                                Aprovar
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="mt-4 pt-4 border-t border-slate-50 flex items-center justify-between">
                      <span className="text-[10px] text-slate-400 font-medium">
                        ID: {request.id}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {new Date(request.created_at).toLocaleString('pt-BR')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default SolicitacoesPage;
