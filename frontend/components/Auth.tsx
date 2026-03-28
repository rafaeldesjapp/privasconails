'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Paintbrush } from 'lucide-react';

const Auth = () => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [success, setSuccess] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        setSuccess('Verifique seu e-mail para confirmar o cadastro!');
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
    } catch (err: any) {
      setError(err.message || 'Ocorreu um erro na autenticação.');
    } finally {
      setLoading(false);
    }
  };

  const seedTestUser = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: 'cliente@gmail.com',
        password: '123456',
      });
      
      if (error) {
        if (error.message.includes('already registered')) {
          setSuccess('Usuário cliente@gmail.com já existe. Você pode entrar com a senha 123456.');
          return;
        } else {
          throw error;
        }
      }

      if (data.user) {
        // Tenta atualizar o perfil para garantir que seja cliente
        await supabase
          .from('profiles')
          .update({ role: 'cliente' })
          .eq('id', data.user.id);
      }

      setSuccess('Usuário de teste (cliente@gmail.com) criado com sucesso! Tente entrar.');
    } catch (err: any) {
      setError(err.message || 'Erro ao criar usuário de teste.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 font-dancing mb-2">
            Priscila Vasconcelos
          </h1>
          <p className="text-lg font-medium bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 font-dancing flex items-center justify-center gap-2">
            Nail Designer
            <Paintbrush className="w-5 h-5 text-pink-500" />
          </p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">E-mail</label>
            <input 
              type="email"
              required
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Senha</label>
            <input 
              type="password"
              required
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-100 text-red-600 text-xs font-medium rounded-lg">
              {error}
            </div>
          )}

          {success && (
            <div className="p-3 bg-green-50 border border-green-100 text-green-600 text-xs font-medium rounded-lg">
              {success}
            </div>
          )}

          <button 
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-gradient-to-br from-[#003d9b] to-[#0052cc] text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-900/10 hover:opacity-90 transition-all disabled:opacity-50"
          >
            {loading ? 'Processando...' : (isSignUp ? 'Criar Conta' : 'Entrar')}
          </button>
        </form>

        <div className="mt-6 text-center space-y-4">
          <button 
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-sm font-bold text-blue-700 hover:underline block w-full"
          >
            {isSignUp ? 'Já tem uma conta? Entre aqui' : 'Não tem conta? Cadastre-se'}
          </button>
          
          <div className="pt-4 border-t border-slate-100 space-y-2">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-2">Ambiente de Teste</p>
            <button 
              onClick={seedTestUser}
              disabled={loading}
              className="w-full py-2 px-4 bg-slate-100 text-slate-600 rounded-xl font-bold text-xs hover:bg-slate-200 transition-all disabled:opacity-50"
            >
              Criar Usuário Cliente (cliente@gmail.com)
            </button>
            <button 
              onClick={async () => {
                setLoading(true);
                setError(null);
                setSuccess(null);
                try {
                  const { data, error } = await supabase.auth.signUp({
                    email: 'abacaxi@abacaxi',
                    password: 'amarelo',
                  });
                  if (error) {
                    if (error.message.includes('already registered')) {
                      setSuccess('Usuário abacaxi@abacaxi já existe. Senha: amarelo.');
                      return;
                    } else {
                      throw error;
                    }
                  }

                  if (data.user) {
                    await supabase
                      .from('profiles')
                      .update({ role: 'cliente' })
                      .eq('id', data.user.id);
                  }

                  setSuccess('Usuário abacaxi@abacaxi criado com sucesso!');
                } catch (err: any) {
                  setError(err.message || 'Erro ao criar usuário.');
                } finally {
                  setLoading(false);
                }
              }}
              disabled={loading}
              className="w-full py-2 px-4 bg-yellow-50 text-yellow-700 rounded-xl font-bold text-xs hover:bg-yellow-100 transition-all disabled:opacity-50 border border-yellow-100"
            >
              Criar Usuário Abacaxi (abacaxi@abacaxi)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
