'use client';

import React, { useState, useEffect, useRef } from 'react';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import { useSupabaseAuth } from '@/hooks/use-supabase';
import Auth from '@/components/Auth';
import { supabase } from '@/lib/supabase';
import { MessageCircle, Send, Trash2, User as UserIcon, Paperclip, Smile, X, Loader2, PlayCircle } from 'lucide-react';
import { format, differenceInHours } from 'date-fns';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';
import { cn } from '@/lib/utils';

interface ChatMessage {
  id: string;
  user_id: string;
  texto: string | null;
  media_url: string | null;
  media_type: string | null;
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
  
  // Anexos e Emojis
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [attachedFile, setAttachedFile] = useState<{ file: File, preview: string, type: 'video'|'image' } | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, typingUsers, attachedFile, showEmojiPicker]);

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
          id, user_id, texto, media_url, media_type, created_at,
          profiles:user_id ( full_name, avatar_url )
        `)
        .order('created_at', { ascending: true })
        .limit(200);

      if (error) {
        if (error.code === '42P01') {
          console.warn("Aviso: Tabela 'chat_mensagens' ainda não existe no banco.");
        } else if (error.message.includes('media_url')) {
          console.warn("Aviso: Colunas de mídia não criadas ainda.");
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

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    setNewMessage(prev => prev + emojiData.emoji);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      alert("Arquivo muito grande. Limite máximo é 20MB.");
      return;
    }

    const isVideo = file.type.startsWith('video/');
    const previewUrl = isVideo ? URL.createObjectURL(file) : URL.createObjectURL(file);
    
    setAttachedFile({ file, preview: previewUrl, type: isVideo ? 'video' : 'image' });
    setShowEmojiPicker(false);
  };

  const cancelAttachment = () => {
    if (attachedFile?.preview) URL.revokeObjectURL(attachedFile.preview);
    setAttachedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newMessage.trim() && !attachedFile) || !user || uploading) return;

    setUploading(true);
    let finalMediaUrl = null;
    let finalMediaType = null;

    try {
      // 1. Fazer upload do anexo se existir
      if (attachedFile) {
         const fileExt = attachedFile.file.name.split('.').pop();
         const fileName = `${user.id}_${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
         
         const { data, error: uploadError } = await supabase.storage
           .from('chat_media')
           .upload(fileName, attachedFile.file);

         if (uploadError) {
           throw new Error(uploadError.message.includes('Bucket not found') 
              ? "Bucket 'chat_media' não encontrado no Supabase. Crie-o antes de enviar anexos."
              : uploadError.message);
         }

         const { data: { publicUrl } } = supabase.storage.from('chat_media').getPublicUrl(fileName);
         finalMediaUrl = publicUrl;
         finalMediaType = attachedFile.type;
      }

      // 2. Inserir a mensagem no DB
      const textoObj = newMessage.trim() || null;
      
      const { error } = await supabase.from('chat_mensagens').insert([{
        user_id: user.id,
        texto: textoObj,
        media_url: finalMediaUrl,
        media_type: finalMediaType,
      }]);
      
      if (error) throw error;
      
      // Limpa os states pós-sucesso
      setNewMessage('');
      cancelAttachment();
      setShowEmojiPicker(false);

    } catch (err: any) {
      if (err.message.includes('relation "chat_mensagens" does not exist')) {
         alert("Opa! A tabela de mensagens ainda não existe no Supabase. Por favor, rode o script SQL.");
      } else {
         alert("Erro ao enviar: " + err.message);
      }
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteMessage = async (id: string, media_url: string | null) => {
    if (role !== 'admin') return;
    if (confirm("Você sendo Admin, tem o poder de apagar isso para todo mundo. Tem certeza?")) {
      try {
        // Se houver media_url, você idealmente devia deletar fisicamente do Storage aqui antes.
        // O DB row apaga agora:
        const { error } = await supabase.from('chat_mensagens').delete().eq('id', id);
        if (error) throw error;

        // Limpeza do aquivo (Opcional Client-side se der erro de cors ele não liga)
        if (media_url) {
          try {
             const basePath = media_url.split('/chat_media/')[1];
             if (basePath) supabase.storage.from('chat_media').remove([basePath]).catch(()=>{});
          } catch(e) {}
        }
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

  // Frontend Hide: Oculta Mídia com mais de 24 horas independentemente do banco ter limpado
  const activeMessages = messages.filter(msg => {
    if (!msg.media_url) return true; // Texto não expira por padrão
    return differenceInHours(new Date(), new Date(msg.created_at)) < 24; 
  });

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <div className="hidden lg:block">
         <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      </div>
      
      <div className="lg:ml-64 flex flex-col h-[100dvh]">
        <div className="shrink-0">
          <Header onMenuClick={() => setIsSidebarOpen(true)} />
        </div>
        
        <main className="flex-1 flex flex-col min-h-0 relative shadow-inner overflow-hidden">
          
          {/* Fundo Original do WhatsApp Light (Clone perfeito) */}
          <div className="absolute inset-0 bg-[#efeae2] z-[-2]"></div>
          <div 
            className="absolute inset-0 opacity-[0.25] pointer-events-none z-[-1]" 
            style={{ 
              backgroundImage: 'url("https://web.whatsapp.com/img/bg-chat-tile-light_686b98c9fdffcf36c5646fdd25157ba1.png")',
              backgroundRepeat: 'repeat',
              backgroundSize: '400px'
            }} 
          />
          
          {/* Header do Chat Interno */}
          <div className="bg-[#f0f2f5] px-4 md:px-6 py-3 border-b border-gray-200 flex items-center gap-4 z-10 shrink-0">
            <div className="w-12 h-12 rounded-full bg-green-500 overflow-hidden shrink-0 flex items-center justify-center text-white shadow-sm ring-2 ring-green-100 relative">
               <img src="https://ui-avatars.com/api/?name=Papo&background=25D366&color=fff" className="absolute w-full h-full object-cover rounded-full" />
            </div>
            <div>
              <h1 className="font-semibold text-slate-800 text-[17px] leading-tight">Papo de Salão</h1>
              <p className="text-[13px] text-slate-500 flex items-center gap-1 mt-0.5">
                {typingUsers && Object.keys(typingUsers).length > 0 ? (
                  <span className="text-[#00a884] italic animate-pulse">
                     {Object.values(typingUsers).length > 1 
                      ? 'Várias pessoas estão digitando...' 
                      : `${Object.values(typingUsers)[0]?.name.split(' ')[0]} está digitando...`}
                  </span>
                ) : (
                  <>Você, Esposa Amor e outras clientes</>
                )}
              </p>
            </div>
          </div>

          {/* Área Principal de Mensagens */}
          <div 
            className="flex-1 overflow-y-auto px-4 py-8 md:px-[8%] space-y-2 z-10 relative scroll-smooth bg-transparent custom-scrollbar flex flex-col"
          >
            {isFetching && activeMessages.length === 0 && (
               <div className="flex justify-center my-4">
                  <span className="bg-white/80 backdrop-blur-sm text-slate-600 text-[12.5px] py-1.5 px-4 rounded-[12px] shadow-sm font-medium">Carregando mensagens...</span>
               </div>
            )}
            
            {!isFetching && activeMessages.length === 0 && (
               <div className="flex justify-center mt-6">
                  <div className="bg-[#FFEECD] text-slate-800 text-[12.5px] py-2 px-6 rounded-lg shadow-sm max-w-sm text-center">
                     Bem-vinda ao Papo de Salão! Fotos e Vídeos enviados somem magicamente em 24h. 🕓
                  </div>
               </div>
            )}

            {/* Loop de Mensagens */}
            {activeMessages.map((msg, idx) => {
              const isMe = msg.user_id === user.id;
              const dateObj = new Date(msg.created_at);
              const timeStr = format(dateObj, "HH:mm");
              const isContinuation = !isMe && idx > 0 && activeMessages[idx - 1]?.user_id === msg.user_id;
              const nameColor = getRandomColor(msg.user_id || 'random');

              // Verifica se a mensagem contém Mídia e ajusta as bordas/padding baseada nisso
              const hasMedia = !!msg.media_url;
              const hasText = !!msg.texto && msg.texto.length > 0;

              return (
                <div key={msg.id} className={cn("flex w-full group relative mb-1", isMe ? "justify-end pl-[15%]" : "justify-start pr-[15%]")}>
                   
                  <div className={cn(
                    "relative shadow-sm text-slate-800",
                    isMe ? "bg-[#d9fdd3]" : "bg-white",
                    // Arredondamentos complexos do Whatsapp
                    isMe && !hasMedia ? "rounded-[8px] rounded-tr-[0px]" : "rounded-[8px]",
                    !isMe && !isContinuation ? "rounded-tl-[0px]" : "",
                    hasMedia ? "p-1 pb-1" : "px-[9px] py-[6px]", // Padding muda pra anexos
                  )}
                  style={{ wordBreak: 'break-word', maxWidth: '100%' }}
                  >
                    {!isMe && !isContinuation && (
                      <div className={cn("text-[13px] font-bold mb-0.5 leading-[22px]", hasMedia && "px-1 pt-1")} style={{ color: nameColor }}>
                        {msg.profiles?.full_name || 'Alguém'}
                      </div>
                    )}
                    
                    {/* Renderização da Mídia */}
                    {hasMedia && (
                       <div className="relative overflow-hidden rounded-[8px] bg-black/5 flex items-center justify-center max-w-[320px]">
                          {msg.media_type === 'video' ? (
                            <video 
                              src={msg.media_url as string} 
                              controls 
                              className="w-full max-h-[350px] object-cover" 
                              preload="metadata"
                            />
                          ) : (
                            <img 
                              src={msg.media_url as string} 
                              alt="Anexo" 
                              className="w-full max-h-[350px] object-cover" 
                              loading="lazy"
                            />
                          )}
                       </div>
                    )}
                    
                    {/* Texto Render */}
                    {hasText && (
                      <div className={cn("text-[14.2px] leading-[19px] min-w-[30px]", hasMedia ? "px-1 pt-1 pb-3" : "pb-[10px] min-w-[60px]")}>
                        <span style={{ whiteSpace: 'pre-wrap' }}>{msg.texto}</span>
                      </div>
                    )}
                    
                    {/* Data / Hora rodapé inferior direito */}
                    <div className={cn(
                       "absolute right-[4px] bottom-[2px] flex items-center gap-1 select-none z-10",
                       hasMedia && !hasText ? "bg-black/30 backdrop-blur-sm text-white/90 px-1.5 py-0.5 rounded-full bottom-1 right-1 border border-white/20" : "text-[#667781]"
                    )}>
                      <span className="text-[11px] leading-[15px] max-md:text-[10px]">{timeStr}</span>
                      
                      {/* Check duplo para quem enviou */}
                      {isMe && (
                        <svg viewBox="0 0 16 11" width="16" height="11" fill="currentColor" className="text-[#34b7f1] w-3.5 h-3.5 mt-[-1px]">
                          <path d="M11.801 1.014L5.59 7.22l-1.921-1.921L2.24 6.726l3.35 3.351L13.228 2.441zm3.178.026L8.432 7.601L7.172 6.34L6.096 7.417L8.432 9.752L16.406 1.777z"/>
                        </svg>
                      )}

                      {/* Botão de Apagar Global (Admin) */}
                      {role === 'admin' && (
                        <button 
                          onClick={() => handleDeleteMessage(msg.id, msg.media_url)}
                          className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 transition-opacity ml-1 p-0.5"
                          title="Apagar para todos (Admin)"
                        >
                          <Trash2 className="w-[11px] h-[11px]" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            <div ref={messagesEndRef} className="h-6" />
          </div>

          {/* Container de Emoji Picker Absoluto para não quebrar layout */}
          <div className={cn(
             "absolute bottom-[65px] left-4 md:left-[10%] z-50 transition-all duration-300 ease-in-out shadow-2xl rounded-2xl overflow-hidden",
             showEmojiPicker ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-10 scale-95 pointer-events-none"
          )}>
            <EmojiPicker 
               onEmojiClick={handleEmojiClick} 
               searchDisabled={false}
               skinTonesDisabled={false}
            />
          </div>

          {/* Pré-visualização de Anexo (Acima da Input Bar) */}
          {attachedFile && (
            <div className="absolute bottom-[60px] left-0 right-0 z-40 bg-[#f0f2f5] p-3 border-t border-slate-300 shadow-[0_-5px_20px_rgba(0,0,0,0.05)] animate-slide-up flex flex-col justify-center items-center">
              <div className="flex justify-between w-full max-w-5xl mb-2 px-2 items-center">
                 <span className="text-slate-600 font-bold text-sm">Preview do Anexo (apaga em 24h)</span>
                 <button onClick={cancelAttachment} className="p-1 text-slate-400 hover:text-red-500 hover:bg-slate-200 rounded-full transition-colors">
                   <X className="w-5 h-5"/>
                 </button>
              </div>
              <div className="relative rounded-xl overflow-hidden border border-slate-300 max-h-[160px] max-w-max shadow-md bg-white p-1">
                 {attachedFile.type === 'image' ? (
                   <img src={attachedFile.preview} alt="Upload" className="max-h-[150px] object-contain rounded-lg" />
                 ) : (
                   <video src={attachedFile.preview} className="max-h-[150px] object-contain rounded-lg pointer-events-none" />
                 )}
                 {uploading && (
                   <div className="absolute inset-0 bg-white/70 backdrop-blur-sm flex flex-col justify-center items-center rounded-lg">
                      <Loader2 className="w-8 h-8 text-[#00a884] animate-spin" />
                      <span className="text-xs font-bold text-[#00a884] mt-2">Enviando mídia...</span>
                   </div>
                 )}
              </div>
            </div>
          )}

          {/* Barra inferior de Digitação Original WhatsApp */}
          <div className="bg-[#f0f2f5] px-3 py-2 z-20 shrink-0 border-t border-[#d1d7db] flex items-end min-h-[62px]">
             
             {/* Input Invisível para Upload de Mídia */}
             <input 
               type="file" 
               ref={fileInputRef} 
               style={{ display: 'none' }} 
               accept="image/png, image/jpeg, image/webp, image/gif, video/mp4, video/quicktime"
               onChange={handleFileChange}
             />

             <div className="flex-1 max-w-7xl mx-auto flex items-end gap-2 px-1 pb-1">
                
                {/* Botão de Emojis */}
                <button 
                  type="button"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className="w-10 h-10 flex items-center justify-center text-[#54656f] hover:text-[#00a884] transition-colors shrink-0 rounded-full hover:bg-black/5 active:bg-black/10 self-center"
                >
                  <Smile className="w-[26px] h-[26px]" />
                </button>

                {/* Botão de Clipe / Anexo */}
                <button 
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-10 h-10 flex items-center justify-center text-[#54656f] hover:text-[#00a884] transition-colors shrink-0 rounded-full hover:bg-black/5 active:bg-black/10 self-center"
                  title="Anexar Imagem ou Vídeo (Expira em 1 Dia)"
                >
                  <Paperclip className="w-6 h-6" />
                </button>

                {/* Caixa de Texto Branca */}
                <form onSubmit={handleSendMessage} className="flex-1 bg-white rounded-lg flex items-center min-h-[42px] px-3 shadow-sm mx-1 self-center border border-white focus-within:border-white ring-0">
                  <input 
                    type="text" 
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onFocus={() => setShowEmojiPicker(false)}
                    placeholder={attachedFile ? "Adicione uma legenda..." : "Digite uma mensagem"}
                    className="w-full bg-transparent outline-none py-2 text-[#111b21] resize-none text-[15px] border-none focus:ring-0 placeholder-[#8696a0]"
                    autoComplete="off"
                    disabled={uploading}
                  />
                </form>

                {/* Botão de Enviar (Só aparece se tiver algo escrito ou anexado) */}
                {(newMessage.trim() || attachedFile) ? (
                  <button 
                    type="button"
                    onClick={handleSendMessage}
                    disabled={uploading}
                    className="w-10 h-10 flex items-center justify-center text-[#54656f] hover:text-[#00a884] shrink-0 self-center transition-transform hover:scale-110 active:scale-95 disabled:opacity-50"
                  >
                    <Send className="w-6 h-6 ml-1" />
                  </button>
                ) : (
                  <button 
                    type="button"
                    className="w-10 h-10 flex items-center justify-center text-[#54656f] shrink-0 self-center opacity-70"
                  >
                    {/* Placeholder para Mic (Fake no momento, para visual igual print) */}
                    <svg viewBox="0 0 24 24" width="24" height="24" className="w-6 h-6"><path fill="currentColor" d="M11.999 14.942c2.001 0 3.531-1.53 3.531-3.531V4.35c0-2.001-1.53-3.531-3.531-3.531S8.469 2.35 8.469 4.35v7.061c0 2.001 1.53 3.531 3.53 3.531zm6.238-3.53c0 3.531-2.942 6.002-6.237 6.002s-6.237-2.471-6.237-6.002H3.761c0 4.001 3.178 7.297 7.061 7.827v3.884h2.354v-3.884c3.884-.53 7.061-3.826 7.061-7.827h-2.001z"></path></svg>
                  </button>
                )}
             </div>
          </div>
          
        </main>
      </div>
    </div>
  );
}
