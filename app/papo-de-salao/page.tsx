'use client';

import React, { useState, useEffect, useRef } from 'react';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import { useSupabaseAuth } from '@/hooks/use-supabase';
import Auth from '@/components/Auth';
import { supabase } from '@/lib/supabase';
import { MessageCircle, Send, Trash2, User as UserIcon } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ChatMessage {
  id: string;
  user_id: string;
  texto: string;
  created_at: string;
  profiles?: {
    full_name: string;
    avatar_url: string | null;
  };
}

export default function PapoDeSalaoPage() {
  const { user, role, loading } = useSupabaseAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isFetching, setIsFetching] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [typingUsers, setTypingUsers] = useState<{ [key: string]: { name: string, avatar: string | null } }>({});

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, typingUsers]);

  useEffect(() => {
    if (!user) return;

    fetchMessages();

    // Inscrição para novas mensagens (Realtime)
    const channel = supabase
      .channel('chat_room')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_mensagens' }, (payload) => {
        fetchNewMessageData(payload.new as ChatMessage);
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'chat_mensagens' }, (payload) => {
        setMessages(prev => prev.filter(msg => msg.id !== payload.old.id));
      })
      .subscribe();

    // Canal de Presence para o "Digitando..."
    const presenceChannel = supabase.channel('chat_presence', {
      config: { presence: { key: user.id } },
    });

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        const currentlyTyping: any = {};
        for (const [key, presences] of Object.entries(state)) {
          if (key !== user.id && presences.length > 0 && (presences[0] as any).isTyping) {
            currentlyTyping[key] = {
              name: (presences[0] as any).name,
              avatar: (presences[0] as any).avatar
            };
          }
        }
        setTypingUsers(currentlyTyping);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({
            name: user?.user_metadata?.full_name || 'Alguém',
            avatar: user?.user_metadata?.avatar_url || null,
            isTyping: false
          });
        }
      });

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(presenceChannel);
    };
  }, [user]);

  // Função para rastrear digitação contínua
  useEffect(() => {
    if (!user) return;
    const presenceChannel = supabase.channel('chat_presence');
    const updateTypingStatus = async () => {
      if (presenceChannel.state === 'joined' || presenceChannel.state === 'JOINED') {
        try {
           await presenceChannel.track({
             name: user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Alguém',
             avatar: user?.user_metadata?.avatar_url || null,
             isTyping: newMessage.trim().length > 0
           });
        } catch(e) {}
      }
    };
    
    const timeout = setTimeout(() => {
      updateTypingStatus();
    }, 300); // debounce pequeno
    
    return () => clearTimeout(timeout);
  }, [newMessage, user]);

  const fetchMessages = async () => {
    setIsFetching(true);
    try {
      const { data, error } = await supabase
        .from('chat_mensagens')
        .select(`
          id, user_id, texto, created_at,
          profiles:user_id ( full_name, avatar_url )
        `)
        .order('created_at', { ascending: true })
        .limit(200);

      if (error) {
        if (error.code === '42P01') {
          console.warn("Aviso: Tabela 'chat_mensagens' ainda não existe no banco.");
        } else {
          console.error(error);
        }
      } else {
        setMessages(data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsFetching(false);
    }
  };

  const fetchNewMessageData = async (msg: ChatMessage) => {
    try {
      const { data } = await supabase.from('profiles').select('full_name, avatar_url').eq('id', msg.user_id).single();
      const completeMsg = { ...msg, profiles: data || { full_name: 'Usuário', avatar_url: null } };
      setMessages(prev => [...prev.filter(m => m.id !== msg.id), completeMsg]);
    } catch (err) {
      setMessages(prev => [...prev.filter(m => m.id !== msg.id), msg]);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user) return;

    const textoObj = newMessage.trim();
    setNewMessage(''); // Limpa o input imediatamente otimista
    
    try {
      const { error } = await supabase.from('chat_mensagens').insert([{
        user_id: user.id,
        texto: textoObj
      }]);
      if (error) throw error;
    } catch (err: any) {
      if (err.message.includes('relation "chat_mensagens" does not exist')) {
         alert("Opa! A tabela de mensagens ainda não existe no Supabase. Por favor, rode o script SQL que o assistente I.A te enviou.");
      } else {
         alert("Erro ao enviar mensagem: " + err.message);
      }
    }
  };

  const handleDeleteMessage = async (id: string) => {
    if (role !== 'admin') return;
    if (confirm("Você sendo Admin, tem o poder de apagar isso para todo mundo. Tem certeza?")) {
      try {
        const { error } = await supabase.from('chat_mensagens').delete().eq('id', id);
        if (error) throw error;
        // O realtime de DELETE já cuida de remover da UI via .on('DELETE')
      } catch (err: any) {
        alert("Erro ao apagar: " + err.message);
      }
    }
  };

  const getRandomColor = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash % 360);
    return `hsl(${hue}, 70%, 40%)`; 
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#efeae2]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <div className="hidden lg:block">
         <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      </div>
      
      <div className="lg:ml-64 flex flex-col h-screen">
        <div className="shrink-0">
          <Header onMenuClick={() => setIsSidebarOpen(true)} />
        </div>
        
        <main className="flex-1 flex flex-col min-h-0 bg-[#efeae2] relative shadow-inner overflow-hidden">
          
          {/* Fundo do WhatsApp (Doodle CSS fallback) */}
          <div 
            className="absolute inset-0 opacity-[0.06] pointer-events-none z-0" 
            style={{ 
              backgroundImage: 'url("https://transparenttextures.com/patterns/notebook-dark.png"), radial-gradient(circle, transparent 20%, #efeae2 20%, #efeae2 80%, transparent 80%, transparent), radial-gradient(circle, transparent 20%, #efeae2 20%, #efeae2 80%, transparent 80%, transparent) 25px 25px',
              backgroundSize: 'auto, 50px 50px, 50px 50px',
              backgroundColor: '#efeae2'
            }} 
          />
          
          {/* Header do Chat Interno */}
          <div className="bg-[#f0f2f5] px-4 md:px-6 py-3 border-b border-gray-200 flex items-center gap-4 z-10 shrink-0">
            <div className="w-12 h-12 rounded-full bg-green-500 overflow-hidden shrink-0 flex items-center justify-center text-white border-2 border-white shadow-sm ring-2 ring-green-100">
              <MessageCircle className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-bold text-slate-800 text-lg leading-tight">Papo de Salão</h1>
              <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5 font-medium">
                {typingUsers && Object.keys(typingUsers).length > 0 ? (
                  <span className="text-green-600 italic animate-pulse">
                     {Object.values(typingUsers).length > 1 
                      ? 'Várias pessoas digitando...' 
                      : `${Object.values(typingUsers)[0]?.name.split(' ')[0]} digitando...`}
                  </span>
                ) : (
                  <>Comunidade Privasconails • <span className="w-1.5 h-1.5 bg-green-500 rounded-full inline-block"></span> Online</>
                )}
              </p>
            </div>
          </div>

          {/* Área Principal de Mensagens */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-3 z-10 relative scroll-smooth bg-transparent custom-scrollbar">
            
            {/* Aviso de Tabela Faltando */}
            {isFetching && messages.length === 0 && (
               <div className="flex justify-center my-4">
                  <span className="bg-white/80 backdrop-blur-sm text-slate-600 text-xs py-1.5 px-4 rounded-full shadow-sm font-medium">Carregando mensagens...</span>
               </div>
            )}
            
            {!isFetching && messages.length === 0 && (
               <div className="flex justify-center mt-6">
                  <div className="bg-[#FFEECD] border border-[#f5dbb2] text-slate-800 text-xs md:text-sm py-3 px-6 rounded-2xl shadow-sm max-w-sm text-center">
                    <span className="font-black text-slate-900 block mb-1">💅 Bem-vinda ao Papo de Salão!</span>
                    As mensagens trocadas aqui são visíveis para todas as amigas de estúdio. Envie o seu primeiro "Oi"!
                  </div>
               </div>
            )}

            {/* Loop de Mensagens */}
            {messages.map((msg, idx) => {
              const isMe = msg.user_id === user.id;
              const dateObj = new Date(msg.created_at);
              const timeStr = format(dateObj, "HH:mm");
              const showAvatar = !isMe && (idx === 0 || messages[idx - 1]?.user_id !== msg.user_id);
              const nameColor = getRandomColor(msg.user_id || 'random');

              return (
                <div key={msg.id} className={cn("flex w-full group", isMe ? "justify-end" : "justify-start")}>
                  
                  {!isMe && (
                    <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden mr-2 mt-auto shrink-0 border border-white max-md:hidden shadow-sm self-end">
                      {showAvatar || msg.profiles?.avatar_url ? (
                         msg.profiles?.avatar_url ? (
                             <img src={msg.profiles.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                         ) : (
                             <UserIcon className="w-full h-full text-slate-400 p-1.5 bg-slate-100" />
                         )
                      ) : (
                         <div className="w-8 h-8 opacity-0"></div> // Espaçador invisível caso contínuo
                      )}
                    </div>
                  )}
                  
                  <div className={cn(
                    "max-w-[85%] md:max-w-[65%] rounded-2xl px-3 py-2 shadow-sm relative",
                    isMe ? "bg-[#d9fdd3] rounded-br-[4px] text-slate-800" : "bg-white rounded-bl-[4px] text-slate-800",
                    !showAvatar && !isMe ? "ml-10 max-md:ml-0" : ""
                  )}>
                    {!isMe && showAvatar && (
                      <div className="text-[13px] font-bold mb-0.5 break-words max-w-full" style={{ color: nameColor }}>
                        {msg.profiles?.full_name || 'Alguém'}
                      </div>
                    )}
                    
                    <div className="text-[15px] leading-relaxed break-words pb-3.5 min-w-[50px] whitespace-pre-wrap">
                      {msg.texto}
                    </div>
                    
                    <div className="text-[10px] text-slate-500 absolute bottom-1 right-2 flex items-center gap-1 select-none">
                      {timeStr}
                      {role === 'admin' && (
                        <button 
                          onClick={() => handleDeleteMessage(msg.id)}
                          className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-600 transition-opacity ml-1.5 p-0.5 rounded cursor-pointer shrink-0"
                          title="Apagar para todos (Admin)"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Microbolha: Digitando... */}
            {Object.keys(typingUsers).length > 0 && (
              <div className="flex w-full justify-start items-end mb-4 animate-fade-in-up md:ml-10">
                 <div className="bg-white rounded-2xl rounded-bl-[4px] px-4 py-2 shadow-sm flex items-center gap-1.5 min-h-[40px]">
                    <div className="flex -space-x-2 mr-1">
                      {Object.values(typingUsers).slice(0, 3).map((typer: any, i) => (
                        <div key={i} className="w-5 h-5 rounded-full bg-slate-200 border border-white overflow-hidden shadow-sm shrink-0">
                          {typer.avatar ? (
                            <img src={typer.avatar} alt="avatar" className="w-full h-full object-cover" />
                          ) : (
                            <UserIcon className="w-full h-full text-slate-400 p-0.5 bg-slate-100" />
                          )}
                        </div>
                      ))}
                    </div>
                    
                    <span className="flex space-x-1 items-center mb-0.5">
                       <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                       <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                       <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                    </span>
                 </div>
              </div>
            )}

            <div ref={messagesEndRef} className="h-2" />
          </div>

          {/* Barra de Entrada de Mensagem FIXA rodapé */}
          <div className="bg-[#f0f2f5] p-2 md:p-3 z-20 shrink-0">
            <form onSubmit={handleSendMessage} className="max-w-5xl mx-auto flex items-end gap-2 md:gap-3">
              <div className="flex-1 bg-white rounded-2xl md:rounded-3xl min-h-[48px] max-h-[120px] shadow-sm flex items-center px-4 overflow-hidden border border-slate-200 focus-within:ring-1 focus-within:ring-green-500/30">
                <input 
                  type="text" 
                  name="message"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Mensagem..."
                  className="w-full bg-transparent outline-none py-3 text-slate-700 resize-none text-[15px] border-none focus:ring-0"
                  autoComplete="off"
                />
              </div>
              <button 
                type="submit" 
                disabled={!newMessage.trim()}
                className="w-[48px] h-[48px] rounded-full bg-[#00a884] text-white flex items-center justify-center shrink-0 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed hover:bg-[#008f6f] transition-all active:scale-95"
              >
                <Send className="w-5 h-5 ml-0.5" />
              </button>
            </form>
          </div>
          
        </main>
      </div>
    </div>
  );
}
