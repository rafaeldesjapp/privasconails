'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSupabaseAuth } from '@/hooks/use-supabase';
import Auth from '@/components/Auth';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import { supabase } from '@/lib/supabase';
import {
  Pencil,
  Save,
  X,
  Plus,
  Trash2,
  Tag,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';

// ─── Tipos ───────────────────────────────────────────────────────────
interface PriceItem {
  id: string;
  nome: string;
  preco: number;
}

interface PriceCategory {
  id: string;
  nome: string;
  itens: PriceItem[];
}

// ─── Dados padrão (da imagem) ─────────────────────────────────────────
const DEFAULT_CATEGORIES: PriceCategory[] = [
  {
    id: 'unhas-simples',
    nome: 'Unhas Simples',
    itens: [
      { id: 'us-1', nome: 'Mão', preco: 30 },
      { id: 'us-2', nome: 'Pé', preco: 30 },
      { id: 'us-3', nome: 'Pé e Mão Simples', preco: 50 },
      { id: 'us-4', nome: 'Pé e Mão Decorado', preco: 55 },
    ],
  },
  {
    id: 'alongamento',
    nome: 'Alongamento',
    itens: [
      { id: 'al-1', nome: 'Postiça Realista', preco: 60 },
      { id: 'al-2', nome: 'Banho de Gel', preco: 80 },
      { id: 'al-3', nome: 'Acrigel', preco: 129 },
      { id: 'al-4', nome: 'Fibra de Vidro', preco: 160 },
    ],
  },
  {
    id: 'manutencoes',
    nome: 'Manutenções e Extra',
    itens: [
      { id: 'ma-1', nome: 'Manutenção em Gel', preco: 50 },
      { id: 'ma-2', nome: 'Manutenção em Acrigel', preco: 90 },
      { id: 'ma-3', nome: 'Manutenção em Fibra', preco: 130 },
      { id: 'ma-4', nome: 'Reposição de Unha (UN)', preco: 15 },
    ],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────
const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const uid = () => Math.random().toString(36).slice(2, 10);

// ─── Componente principal ─────────────────────────────────────────────
export default function TabelaPrecos() {
  const { user, role, loading } = useSupabaseAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const isAdmin = role === 'admin';

  // Estado dos dados
  const [categories, setCategories] = useState<PriceCategory[]>(DEFAULT_CATEGORIES);
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState<PriceCategory[]>(DEFAULT_CATEGORIES);
  const [saving, setSaving] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // ── Carregar do Supabase ──────────────────────────────────────────
  const loadData = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('configuracoes')
        .select('valor')
        .eq('chave', 'tabela_precos')
        .single();

      if (!error && data?.valor) {
        setCategories(data.valor);
      }
    } catch {
      // Tabela pode não existir ainda — usa padrão
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => {
    if (user) loadData();
  }, [user, loadData]);

  // ── Iniciar edição ────────────────────────────────────────────────
  const startEdit = () => {
    setDraft(JSON.parse(JSON.stringify(categories)));
    setEditMode(true);
  };

  // ── Cancelar edição ───────────────────────────────────────────────
  const cancelEdit = () => setEditMode(false);

  // ── Salvar no Supabase ────────────────────────────────────────────
  const saveData = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('configuracoes')
        .upsert({ chave: 'tabela_precos', valor: draft }, { onConflict: 'chave' });

      if (error) throw error;
      setCategories(draft);
      setEditMode(false);
      showToast('success', 'Tabela de preços salva com sucesso!');
    } catch (err: any) {
      showToast('error', err?.message ?? 'Erro ao salvar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  // ── Toast helper ──────────────────────────────────────────────────
  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Atualizar campo ───────────────────────────────────────────────
  const updateCatName = (catIdx: number, nome: string) => {
    setDraft(prev => prev.map((c, i) => i === catIdx ? { ...c, nome } : c));
  };

  const updateItemName = (catIdx: number, itemIdx: number, nome: string) => {
    setDraft(prev => prev.map((c, i) =>
      i === catIdx
        ? { ...c, itens: c.itens.map((it, j) => j === itemIdx ? { ...it, nome } : it) }
        : c
    ));
  };

  const updateItemPrice = (catIdx: number, itemIdx: number, raw: string) => {
    const preco = parseFloat(raw.replace(',', '.')) || 0;
    setDraft(prev => prev.map((c, i) =>
      i === catIdx
        ? { ...c, itens: c.itens.map((it, j) => j === itemIdx ? { ...it, preco } : it) }
        : c
    ));
  };

  const addItem = (catIdx: number) => {
    setDraft(prev => prev.map((c, i) =>
      i === catIdx
        ? { ...c, itens: [...c.itens, { id: uid(), nome: 'Novo serviço', preco: 0 }] }
        : c
    ));
  };

  const removeItem = (catIdx: number, itemIdx: number) => {
    setDraft(prev => prev.map((c, i) =>
      i === catIdx
        ? { ...c, itens: c.itens.filter((_, j) => j !== itemIdx) }
        : c
    ));
  };

  const addCategory = () => {
    setDraft(prev => [...prev, { id: uid(), nome: 'Nova Categoria', itens: [] }]);
  };

  const removeCategory = (catIdx: number) => {
    setDraft(prev => prev.filter((_, i) => i !== catIdx));
  };

  // ── Guards ────────────────────────────────────────────────────────
  // Aguarda autenticação primeiro — se não logado, mostra Auth
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-10 h-10 text-rose-400 animate-spin" />
      </div>
    );
  }

  if (!user) return <Auth />;

  // Aguarda dados do Supabase (só chega aqui se autenticado)
  if (fetching) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-10 h-10 text-rose-400 animate-spin" />
      </div>
    );
  }

  const displayData = editMode ? draft : categories;

  return (
    <div className="min-h-screen bg-slate-50 font-[family-name:var(--font-mplus)]">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      <div className="lg:ml-64 flex flex-col min-h-screen">
        <Header onMenuClick={() => setIsSidebarOpen(true)} />

        <main className="flex-1 p-4 lg:p-8">
          <div className="max-w-3xl mx-auto space-y-8">

            {/* ── Cabeçalho ── */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="p-2 bg-rose-100 rounded-xl">
                    <Tag className="w-5 h-5 text-rose-500" />
                  </div>
                  <h1 className="text-3xl font-black text-slate-800">Tabela de Preços</h1>
                </div>
                <p className="text-slate-500 text-sm pl-1">
                  Serviços e valores praticados pelo estúdio
                </p>
              </div>

              {isAdmin && (
                <div className="flex gap-2">
                  {!editMode ? (
                    <button
                      onClick={startEdit}
                      className="flex items-center gap-2 px-4 py-2.5 bg-rose-500 hover:bg-rose-600 text-white text-sm font-bold rounded-xl shadow-sm shadow-rose-200 transition-all hover:scale-[1.02] active:scale-[0.98]"
                    >
                      <Pencil className="w-4 h-4" />
                      Editar
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={cancelEdit}
                        disabled={saving}
                        className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-bold rounded-xl transition-all"
                      >
                        <X className="w-4 h-4" />
                        Cancelar
                      </button>
                      <button
                        onClick={saveData}
                        disabled={saving}
                        className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold rounded-xl shadow-sm shadow-emerald-200 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60"
                      >
                        {saving ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Save className="w-4 h-4" />
                        )}
                        {saving ? 'Salvando…' : 'Salvar'}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* ── Modo edição: badge ── */}
            {editMode && (
              <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 text-sm font-medium">
                <Pencil className="w-4 h-4 shrink-0" />
                Modo edição ativo — clique nos campos para alterar nomes e valores.
              </div>
            )}

            {/* ── Categorias ── */}
            <div className="space-y-3 sm:space-y-4">
              {displayData.map((cat, catIdx) => (
                <div
                  key={cat.id}
                  className="bg-white rounded-2xl shadow-sm border border-rose-100 overflow-hidden"
                >
                  {/* Cabeçalho da categoria */}
                  <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-2.5 sm:py-2.5 bg-gradient-to-r from-rose-500 to-pink-500">
                    {editMode ? (
                      <input
                        value={cat.nome}
                        onChange={e => updateCatName(catIdx, e.target.value)}
                        className="flex-1 w-full bg-white/20 text-white placeholder-white/70 font-black text-base sm:text-lg rounded-lg px-3 py-2 outline-none border border-white/30 focus:border-white transition"
                      />
                    ) : (
                      <h2 className="text-lg font-black text-white tracking-wide uppercase">
                        {cat.nome}
                      </h2>
                    )}
                    {editMode && (
                      <button
                        onClick={() => removeCategory(catIdx)}
                        className="p-1.5 bg-white/20 hover:bg-white/40 text-white rounded-lg transition"
                        title="Remover categoria"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Itens */}
                  <div className="divide-y divide-slate-50">
                    {cat.itens.map((item, itemIdx) => (
                      <div
                        key={item.id}
                        className={`flex ${editMode ? 'flex-col sm:flex-row gap-3 items-start py-3' : 'items-center py-1.5 sm:py-2'} sm:items-center justify-between px-4 sm:px-6 hover:bg-rose-50/40 transition-colors group relative`}
                      >
                        {editMode ? (
                          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-1 w-full min-w-0">
                            <input
                              value={item.nome}
                              onChange={e => updateItemName(catIdx, itemIdx, e.target.value)}
                              className="w-full sm:flex-1 text-base sm:text-sm text-slate-700 font-medium bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 sm:py-2 outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100 transition"
                              placeholder="Nome do serviço"
                            />
                            <div className="flex items-center gap-3 w-full sm:w-auto">
                              <div className="relative flex-1 sm:flex-none">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">R$</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={item.preco}
                                  onChange={e => updateItemPrice(catIdx, itemIdx, e.target.value)}
                                  className="w-full sm:w-28 pl-9 pr-3 py-2.5 sm:py-2 text-base sm:text-sm font-bold text-rose-600 bg-rose-50 border border-slate-200 rounded-lg outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100 transition"
                                />
                              </div>
                              <button
                                onClick={() => removeItem(catIdx, itemIdx)}
                                className="p-2 sm:p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition sm:opacity-0 sm:group-hover:opacity-100 shrink-0"
                                title="Remover item"
                              >
                                <Trash2 className="w-5 h-5 sm:w-4 sm:h-4" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <span className="text-slate-700 font-medium text-sm">{item.nome}</span>
                            <span className="text-rose-500 font-black text-sm tabular-nums">
                              {fmt(item.preco)}
                            </span>
                          </>
                        )}
                      </div>
                    ))}

                    {/* Botão adicionar item (só edit mode) */}
                    {editMode && (
                      <button
                        onClick={() => addItem(catIdx)}
                        className="w-full flex items-center justify-center gap-2 px-6 py-3 text-rose-400 hover:text-rose-600 hover:bg-rose-50 text-sm font-bold transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        Adicionar serviço
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {/* Botão nova categoria (só edit mode) */}
              {editMode && (
                <button
                  onClick={addCategory}
                  className="w-full flex items-center justify-center gap-2 px-6 py-4 border-2 border-dashed border-rose-200 text-rose-400 hover:text-rose-600 hover:border-rose-400 hover:bg-rose-50 text-sm font-bold rounded-2xl transition-all"
                >
                  <Plus className="w-5 h-5" />
                  Nova categoria
                </button>
              )}
            </div>

            {/* ── Nota de rodapé ── */}
            {!editMode && (
              <p className="text-center text-xs text-slate-400 pb-4">
                Preços sujeitos a alteração sem aviso prévio. Consulte disponibilidade.
              </p>
            )}
          </div>
        </main>
      </div>

      {/* ── Toast ── */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-lg text-white text-sm font-bold z-50 transition-all animate-in fade-in slide-in-from-bottom-4 ${
            toast.type === 'success' ? 'bg-emerald-500' : 'bg-red-500'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 shrink-0" />
          )}
          {toast.msg}
        </div>
      )}
    </div>
  );
}
