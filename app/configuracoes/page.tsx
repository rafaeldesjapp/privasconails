'use client';

import React, { useState, useEffect } from 'react';
import { useSupabaseAuth } from '@/hooks/use-supabase';
import { supabase } from '@/lib/supabase';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import Auth from '@/components/Auth';
import { Settings, ShieldAlert, History, Trash2, Edit3, UserPlus, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

export default function ConfiguracoesPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { user, role: currentUserRole, loading: authLoading } = useSupabaseAuth();
  const router = useRouter();
  
  const [logs, setLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('logs');

  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [savingConfig, setSavingConfig] = useState(false);

  useEffect(() => {
    if (currentUserRole === 'admin') {
      const loadSettings = async () => {
        const { data } = await supabase.from('configuracoes').select('valor').eq('chave', 'whatsapp_studio').single();
        if (data?.valor) {
          setWhatsappNumber(data.valor.replace(/"/g, ''));
        }
      };
      loadSettings();
    }
  }, [currentUserRole]);

  const saveConfig = async () => {
    setSavingConfig(true);
    const num = whatsappNumber.replace(/\D/g, '');
    const { error } = await supabase.from('configuracoes')
      .upsert({ chave: 'whatsapp_studio', valor: JSON.stringify(num) }, { onConflict: 'chave' });
    
    if (error) alert('Erro ao salvar configuração. Verifique a tabela no Supabase.');
    else alert('Número do WhatsApp salvo com sucesso!');
    setSavingConfig(false);
  };

  useEffect(() => {
    // Se logado e NÃO for admin, joga pra dashboard (Proteção)
    if (!authLoading && user && currentUserRole !== 'admin') {
      router.push('/');
    }
  }, [user, currentUserRole, authLoading, router]);

  useEffect(() => {
    if (currentUserRole !== 'admin') return;

    const carregarLogs = async () => {
      setLogsLoading(true);
      try {
        const { data, error } = await supabase
          .from('logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100);

        if (error) {
          console.error('Erro ao carregar logs:', error);
          return;
        }

        setLogs(data || []);
      } catch (err) {
        console.error('Falha:', err);
      } finally {
        setLogsLoading(false);
      }
    };

    carregarLogs();
  }, [currentUserRole]);

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

  // Double check do renderizador caso o hook useEffect demore
  if (currentUserRole !== 'admin') {
    return null;
  }

  // Função para traduzir ações do banco para leigos e retornar o ícone correto
  const decodificarLog = (registro: any) => {
    switch (registro.action) {
      case 'DELETE_USER':
        return {
          icone: <Trash2 className="w-5 h-5 text-red-500" />,
          cor_fundo: 'bg-red-50',
          titulo: 'Exclusão de Usuário',
          mensagem: `O administrador excluiu a conta do usuário para sempre. Os últimos dados foram: "${registro.target_info}".`,
          descricaoTecnica: registro.description
        };
      case 'CREATE_USER':
        return {
          icone: <UserPlus className="w-5 h-5 text-emerald-500" />,
          cor_fundo: 'bg-emerald-50',
          titulo: 'Criação de Usuário',
          mensagem: `O administrador adicionou "${registro.target_info}" ao sistema.`,
          descricaoTecnica: registro.description
        };
      case 'UPDATE_PROFILE':
        return {
          icone: <Edit3 className="w-5 h-5 text-blue-500" />,
          cor_fundo: 'bg-blue-50',
          titulo: 'Atualização de Cadastro',
          mensagem: `O administrador alterou os dados do usuário "${registro.target_info}".`,
          descricaoTecnica: registro.description
        };
      default:
        // Caso tenhamos outros logs não mapeados no futuro
        return {
          icone: <History className="w-5 h-5 text-slate-500" />,
          cor_fundo: 'bg-slate-100',
          titulo: 'Atividade no Sistema',
          mensagem: `Um comando interno (${registro.action}) interagiu com "${registro.target_info}".`,
          descricaoTecnica: registro.description
        };
    }
  };

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
                  Configurações do Sistema
                </h1>
                <p className="text-slate-500">
                  Preferências globais e histórico das atividades de administradores.
                </p>
              </div>
              <div className="p-3 bg-slate-200 rounded-xl">
                <Settings className="w-6 h-6 text-slate-700" />
              </div>
            </div>

            {/* Menu de Abas */}
            <div className="flex border-b border-slate-200 mb-6 space-x-6">
              <button
                onClick={() => setActiveTab('logs')}
                className={cn(
                  "pb-4 font-bold transition-all text-sm border-b-2 flex items-center gap-2",
                  activeTab === 'logs' 
                    ? "text-blue-600 border-blue-600" 
                    : "text-slate-400 border-transparent hover:text-slate-600"
                )}
              >
                <ShieldAlert className="w-4 h-4" />
                Logs de Auditoria
              </button>
              {/* Espaço para futuras abas de configuração como "Geral", "Temas" etc */}
              <button
                onClick={() => setActiveTab('geral')}
                className={cn(
                  "pb-4 font-bold transition-all text-sm border-b-2 flex items-center gap-2",
                  activeTab === 'geral' 
                    ? "text-blue-600 border-blue-600" 
                    : "text-slate-400 border-transparent hover:text-slate-600"
                )}
              >
                <Settings className="w-4 h-4" />
                Ajustes Gerais
              </button>
            </div>

            {/* Conteúdo Logs (Linha do Tempo Intuitiva) */}
            {activeTab === 'logs' && (
              <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 lg:p-8">
                
                <div className="mb-8">
                  <h3 className="text-lg font-black text-slate-800 mb-2">Histórico Visível (Timeline)</h3>
                  <p className="text-sm text-slate-500">
                    Sempre que um administrador realizar uma ação crítica no banco de dados (ex: deletar), isso ficará guardado aqui em formato fácil de ler. 
                  </p>
                </div>

                {logsLoading ? (
                  <div className="flex justify-center py-12">
                     <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-400"></div>
                  </div>
                ) : logs.length === 0 ? (
                  <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-2xl">
                    <History className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500 font-medium">Nenhum evento registrado ainda.</p>
                    <p className="text-xs text-slate-400 mt-1">Exclusões de contas ou alterações críticas aparecerão aqui no futuro.</p>
                  </div>
                ) : (
                  <div className="relative border-l-2 border-slate-100 ml-4 pl-8 space-y-10 py-4">
                    {/* Lista Dinâmica com Traduções Visuais */}
                    {logs.map((log) => {
                      const decoracao = decodificarLog(log);
                      
                      return (
                        <div key={log.id} className="relative group">
                          {/* Bolinha ou Ícone que flutua na linha de tempo do lado esquerdo */}
                          <div className={cn(
                            "absolute -left-[45px] top-1 w-10 h-10 rounded-full flex items-center justify-center border-4 border-white shadow-sm ring-1 ring-slate-100",
                            decoracao.cor_fundo
                          )}>
                            {decoracao.icone}
                          </div>

                          <div className="bg-slate-50/50 hover:bg-slate-50 transition-colors border border-slate-100 p-5 rounded-2xl">
                            {/* Data e Identificação Simplificada */}
                            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-3 gap-2">
                              <h4 className="font-bold text-slate-800 text-base">{decoracao.titulo}</h4>
                              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 bg-white px-2.5 py-1 rounded-lg border border-slate-100 shadow-sm w-fit">
                                <Clock className="w-3.5 h-3.5" />
                                {new Date(log.created_at).toLocaleString('pt-BR', { 
                                  day: '2-digit', month: '2-digit', year: 'numeric', 
                                  hour: '2-digit', minute: '2-digit' 
                                })}
                              </div>
                            </div>
                            
                            {/* Mensagem Fácil */}
                            <p className="text-slate-600 text-sm mb-4 leading-relaxed bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                              {decoracao.mensagem}
                            </p>

                            {/* Informações Técnicas Menores Ocultas (Pra curiosidade / verificação do dono) */}
                            <div className="flex items-center gap-2 pt-3 border-t border-slate-200/60 text-xs">
                              <span className="text-slate-400"><strong>Resp:</strong> {log.admin_email}</span>
                              <span className="text-slate-300">•</span>
                              <span className="text-slate-400"><strong>Tipo:</strong> {log.action}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Aba de Ajustes Gerais */}
            {activeTab === 'geral' && (
              <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 lg:p-8">
                <div className="mb-8">
                  <h3 className="text-lg font-black text-slate-800 mb-2">WhatsApp do Estúdio (Obrigatório)</h3>
                  <p className="text-sm text-slate-500">
                    Sempre que um cliente fizer um agendamento na plataforma, ele será **obrigado** a disparar uma mensagem de confirmação para este número, caso contrário o horário não é salvo. 
                    Insira apenas os números (ex: 5511999999999).
                  </p>
                </div>

                <div className="max-w-md bg-slate-50 border border-slate-200 rounded-2xl p-6">
                  <label className="block text-sm font-bold text-slate-700 mb-2">Número Recebedor</label>
                  <div className="flex items-center gap-3">
                    <span className="text-xl font-bold text-slate-400">+</span>
                    <input 
                      type="text" 
                      placeholder="Ex: 5511988887777"
                      className="flex-1 bg-white border border-slate-300 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 font-bold tracking-wider placeholder:font-normal placeholder:text-slate-400"
                      value={whatsappNumber}
                      onChange={(e) => setWhatsappNumber(e.target.value.replace(/\D/g, ''))}
                    />
                  </div>
                  <button 
                    onClick={saveConfig}
                    disabled={savingConfig || whatsappNumber.length < 10}
                    className="mt-6 w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl shadow-md transition-all flex justify-center items-center gap-2"
                  >
                    {savingConfig ? <div className="animate-spin w-5 h-5 border-2 border-white/30 border-t-white rounded-full"></div> : 'Salvar WhatsApp'}
                  </button>
                </div>
              </div>
            )}

          </div>
        </main>
      </div>
    </div>
  );
}
