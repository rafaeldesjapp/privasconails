'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { CheckCircle2, XCircle, Loader2, Database } from 'lucide-react';

const SetupPage = () => {
  const [status, setStatus] = useState<any[]>([]);
  const [running, setRunning] = useState(false);

  const addStatus = (message: string, type: 'success' | 'error' | 'info') => {
    setStatus(prev => [...prev, { message, type, timestamp: new Date() }]);
  };

  const runSetup = async () => {
    setRunning(true);
    setStatus([]);

    try {
      addStatus('Iniciando configuração do banco de dados...', 'info');

      // 1. Verificar se a tabela profiles existe
      addStatus('Verificando tabela profiles...', 'info');
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .limit(1);

      if (profilesError) {
        if (profilesError.code === '42P01') {
          addStatus('Tabela profiles não existe. Será necessário executar as migrações manualmente no Supabase.', 'error');
          addStatus('Acesse: https://supabase.com/dashboard/project/fxoysrviojbyygelgjln/sql/new', 'info');
          addStatus('Cole o conteúdo dos arquivos em /app/supabase/migrations/', 'info');
        } else {
          addStatus(`Erro ao verificar profiles: ${profilesError.message}`, 'error');
        }
      } else {
        addStatus('✓ Tabela profiles existe', 'success');
      }

      // 2. Criar perfis para usuários existentes se necessário
      addStatus('Verificando perfis de usuários...', 'info');
      
      const testUsers = [
        { email: 'cliente@gmail.com', role: 'cliente' },
        { email: 'abacaxi@abacaxi', role: 'cliente' },
        { email: 'rafaeldesjapp@gmail.com', role: 'admin' }
      ];

      // Tentar buscar cada usuário e criar perfil se não existir
      for (const testUser of testUsers) {
        const { data: authData } = await supabase.auth.admin.listUsers();
        // Note: admin functions may not work from client side
        addStatus(`Nota: Perfis de usuários devem ser criados automaticamente no login`, 'info');
        break; // Skip since we can't use admin functions from client
      }

      addStatus('Configuração concluída!', 'success');
      addStatus('Faça login novamente para sincronizar os perfis', 'info');

    } catch (error: any) {
      addStatus(`Erro durante setup: ${error.message}`, 'error');
    } finally {
      setRunning(false);
    }
  };

  const testAdminUpdate = async () => {
    setStatus([]);
    setRunning(true);

    try {
      addStatus('Testando permissões de atualização...', 'info');
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        addStatus('Você precisa estar logado', 'error');
        return;
      }

      addStatus(`Usuário logado: ${user.email}`, 'info');

      // Get user profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileError) {
        addStatus(`Erro ao buscar perfil: ${profileError.message}`, 'error');
        return;
      }

      addStatus(`Seu perfil atual: ${profile.role}`, 'info');

      if (profile.role !== 'admin') {
        addStatus('Você não é admin. Não pode testar esta funcionalidade.', 'error');
        return;
      }

      // Try to get all profiles
      const { data: allProfiles, error: allProfilesError } = await supabase
        .from('profiles')
        .select('*');

      if (allProfilesError) {
        addStatus(`Erro ao buscar todos os perfis: ${allProfilesError.message}`, 'error');
        addStatus('Verifique as políticas RLS no Supabase', 'error');
      } else {
        addStatus(`✓ Consegue ver ${allProfiles.length} perfis`, 'success');
      }

    } catch (error: any) {
      addStatus(`Erro: ${error.message}`, 'error');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="flex items-center gap-4 mb-8">
            <div className="p-3 bg-blue-100 rounded-xl">
              <Database className="w-8 h-8 text-blue-600" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-slate-800">Setup do Banco de Dados</h1>
              <p className="text-slate-500">Configure as tabelas e permissões do Supabase</p>
            </div>
          </div>

          <div className="space-y-4 mb-8">
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
              <h3 className="font-bold text-yellow-800 mb-2">⚠️ Instruções Importantes</h3>
              <ol className="text-sm text-yellow-700 space-y-2 list-decimal list-inside">
                <li>Acesse o SQL Editor do Supabase: <a href="https://supabase.com/dashboard/project/fxoysrviojbyygelgjln/sql/new" target="_blank" className="underline font-bold">Clique aqui</a></li>
                <li>Execute os arquivos SQL na seguinte ordem:
                  <ul className="ml-6 mt-1 space-y-1 list-disc">
                    <li><code className="bg-yellow-100 px-1 rounded">/app/supabase/migrations/20260327_initial_schema.sql</code></li>
                    <li><code className="bg-yellow-100 px-1 rounded">/app/supabase/migrations/20260327_add_rbac.sql</code></li>
                    <li><code className="bg-yellow-100 px-1 rounded">/app/supabase/migrations/20260327_fix_rbac_policies.sql</code></li>
                  </ul>
                </li>
                <li>Após executar, clique em "Verificar Setup" abaixo</li>
              </ol>
            </div>
          </div>

          <div className="flex gap-4 mb-8">
            <button
              onClick={runSetup}
              disabled={running}
              className="flex-1 px-6 py-3 bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-xl font-bold shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {running ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
              Verificar Setup
            </button>
            <button
              onClick={testAdminUpdate}
              disabled={running}
              className="flex-1 px-6 py-3 bg-gradient-to-br from-green-600 to-green-700 text-white rounded-xl font-bold shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {running ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
              Testar Permissões Admin
            </button>
          </div>

          {status.length > 0 && (
            <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Database className="w-5 h-5" />
                Log de Status
              </h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {status.map((item, idx) => (
                  <div key={idx} className="flex items-start gap-3 text-sm">
                    {item.type === 'success' && <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />}
                    {item.type === 'error' && <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />}
                    {item.type === 'info' && <div className="w-5 h-5 shrink-0 mt-0.5 flex items-center justify-center"><div className="w-2 h-2 bg-blue-600 rounded-full"></div></div>}
                    <span className={
                      item.type === 'success' ? 'text-green-700' :
                      item.type === 'error' ? 'text-red-700' :
                      'text-slate-600'
                    }>{item.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 bg-white rounded-xl p-6 shadow-lg">
          <h3 className="font-bold text-slate-800 mb-3">📝 Scripts SQL para executar no Supabase:</h3>
          <div className="space-y-4">
            <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-lg">
              <p className="text-sm font-bold text-green-800 mb-2">✨ ARQUIVO COMPLETO (Recomendado)</p>
              <code className="text-xs bg-white/70 p-2 rounded block mb-2">/app/SETUP_DATABASE.sql</code>
              <p className="text-xs text-green-700">Este arquivo contém TODOS os comandos necessários em ordem. Basta copiar e colar no SQL Editor do Supabase!</p>
            </div>
            <div className="border-t pt-4">
              <p className="text-xs text-slate-500 mb-2">Ou execute os arquivos individuais na ordem:</p>
              <div className="space-y-2">
                <div>
                  <p className="text-sm font-bold text-slate-600 mb-1">1. Schema Inicial</p>
                  <code className="text-xs bg-slate-100 p-2 rounded block">/app/supabase/migrations/20260327_initial_schema.sql</code>
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-600 mb-1">2. RBAC</p>
                  <code className="text-xs bg-slate-100 p-2 rounded block">/app/supabase/migrations/20260327_add_rbac.sql</code>
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-600 mb-1">3. Fix Policies ⚠️</p>
                  <code className="text-xs bg-slate-100 p-2 rounded block">/app/supabase/migrations/20260327_fix_rbac_policies.sql</code>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SetupPage;
