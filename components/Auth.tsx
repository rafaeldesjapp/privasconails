'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Paintbrush, Eye, EyeOff } from 'lucide-react';

const Auth = () => {
  const [loading, setLoading] = useState(false);
  const [loginId, setLoginId] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [success, setSuccess] = useState<string | null>(null);

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

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(formatPhone(e.target.value));
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    if (isSignUp) {
      if (!fullName.trim()) {
        setError('O nome é obrigatório.');
        setLoading(false);
        return;
      }
      if (phone.replace(/\D/g, "").length !== 11) {
        setError('O celular deve ter 11 dígitos (DDD + número).');
        setLoading(false);
        return;
      }
    }

    try {
      if (isSignUp) {
        if (!username.trim() || username.includes(' ')) {
          setError('O nome de usuário não pode conter espaços.');
          setLoading(false);
          return;
        }
        
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              phone: phone,
              username: username.toLowerCase()
            }
          }
        });
        if (error) throw error;
        
        // Após criar o usuário, forçar o perfil como 'cliente'
        if (data.user) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          await supabase
            .from('profiles')
            .upsert({
              id: data.user.id,
              email: data.user.email,
              full_name: fullName,
              phone: phone,
              username: username.toLowerCase(),
              role: 'cliente'
            });
        }
        
        setSuccess('Conta criada com sucesso! Você já pode fazer login.');
        setIsSignUp(false); // Switch to login screen natively
      } else {
        let finalEmail = loginId;

        if (!loginId.includes('@')) {
          // Input não é e-mail. Vamos procurar qual e-mail está associado no banco
          const { data: resolvedEmail, error: rpcError } = await supabase.rpc('get_email_by_identifier', { 
            p_identifier: loginId 
          });

          if (rpcError || !resolvedEmail) {
            setError('Celular ou Nome de Usuário não encontrado.');
            setLoading(false);
            return;
          }
          finalEmail = resolvedEmail;
        }

        const { error } = await supabase.auth.signInWithPassword({
          email: finalEmail,
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
          {isSignUp ? (
            <>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Nome Completo</label>
                <input 
                  type="text"
                  required
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
                  placeholder="Seu nome"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Celular</label>
                <input 
                  type="text"
                  required
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
                  placeholder="(00) 00000-0000"
                  value={phone}
                  onChange={handlePhoneChange}
                  maxLength={15}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Nome de Usuário (@)</label>
                <input 
                  type="text"
                  required
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
                  placeholder="ex: maria123"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ''))}
                />
              </div>
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
            </>
          ) : (
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">E-mail, Celular, Nome ou @Login</label>
              <input 
                type="text"
                required
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
                placeholder="E-mail, (11) 99999-9999, seu nome completo ou @usuario"
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
              />
            </div>
          )}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Senha</label>
            <div className="relative">
              <input 
                type={showPassword ? 'text' : 'password'}
                required
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
