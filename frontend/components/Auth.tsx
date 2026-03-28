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
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        
        // Após criar o usuário, forçar o perfil como 'cliente'
        if (data.user) {
          // Aguardar um pouco para o trigger criar o perfil
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Forçar atualização para cliente
          await supabase
            .from('profiles')
            .upsert({
              id: data.user.id,
              email: data.user.email,
              role: 'cliente'
            });
        }
        
        setSuccess('Conta criada com sucesso! Você já pode fazer login.');
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

        <div className="mt-6 text-center">
          <button 
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-sm font-bold text-blue-700 hover:underline block w-full"
          >
            {isSignUp ? 'Já tem uma conta? Entre aqui' : 'Não tem conta? Cadastre-se'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Auth;
