'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSupabaseAuth } from '@/hooks/use-supabase';
import { supabase } from '@/lib/supabase';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import Auth from '@/components/Auth';
import { 
  Camera, 
  Instagram, 
  Heart, 
  MessageCircle, 
  Share2, 
  ExternalLink,
  Sparkles,
  Scissors,
  Paintbrush,
  Star,
  Plus,
  Trash2,
  X,
  Upload,
  Loader2,
  Check,
  Paperclip
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

interface PortfolioItem {
  id: string;
  title: string;
  category: string;
  imageUrl: string;
  likes: number;
  comments: number;
  createdAt: string;
}

const PortfolioPage = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { user, loading: authLoading } = useSupabaseAuth();
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [portfolioItems, setPortfolioItems] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Form state
  const [newItem, setNewItem] = useState({
    title: '',
    category: 'Nail Art',
    imageUrl: ''
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const categories = ['Todos', 'Nail Art', 'Cabelos'];

  useEffect(() => {
    if (user) {
      fetchRole();
      fetchPortfolio();
    }
  }, [user]);

  const fetchRole = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user?.id)
        .single();
      
      if (error) throw error;
      setRole(data?.role);
    } catch (error) {
      console.error('Erro ao buscar role:', error);
    }
  };

  const fetchPortfolio = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('portfolio')
        .select('id, title, category, imageUrl:imageurl, likes, comments, createdAt:createdat')
        .order('createdat', { ascending: false });
      
      if (error) throw error;
      setPortfolioItems(data || []);
    } catch (error) {
      console.error('Erro ao buscar portfólio:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.title || !selectedFile) {
        alert("Por favor, selecione uma imagem do dispositivo.");
        return;
    }

    setIsSaving(true);
    try {
      // 1. Fazer upload da imagem física para o Storage
      const fileExt = selectedFile.name.split('.').pop() || 'jpg';
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `images/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('portfolio_images')
        .upload(filePath, selectedFile);

      if (uploadError) throw uploadError;

      // 2. Pegar a URL pública
      const { data: publicUrlData } = supabase.storage
        .from('portfolio_images')
        .getPublicUrl(filePath);

      const finalImageUrl = publicUrlData.publicUrl;

      // 3. Salvar no banco de dados com a URL real do Storage
      const { error } = await supabase
        .from('portfolio')
        .insert([{
          title: newItem.title,
          category: newItem.category,
          imageurl: finalImageUrl,
          likes: Math.floor(Math.random() * 200),
          comments: Math.floor(Math.random() * 20),
          createdat: new Date().toISOString()
        }]);

      if (error) throw error;
      
      setIsModalOpen(false);
      setNewItem({ title: '', category: 'Nail Art', imageUrl: '' });
      setSelectedFile(null);
      fetchPortfolio();
    } catch (error: any) {
      console.error('Erro ao salvar item:', error);
      alert('Erro ao salvar item. Mensagem: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteItem = async (id: string, imageUrl: string) => {
    if (!confirm('Tem certeza que deseja excluir este item e a imagem associada?')) return;

    try {
      // 1. Tentar deletar o arquivo físico do Storage extraindo o caminho da URL
      const urlMatches = imageUrl.match(/portfolio_images\/(.+)$/);
      if (urlMatches && urlMatches[1]) {
        const filePath = urlMatches[1];
        const { error: storageError } = await supabase.storage
          .from('portfolio_images')
          .remove([filePath]);
          
        if (storageError) console.error("Erro ao deletar arquivo no Storage:", storageError);
      }

      // 2. Deletar do banco de dados
      const { error } = await supabase
        .from('portfolio')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      fetchPortfolio();
    } catch (error) {
      console.error('Erro ao excluir item:', error);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);

    const reader = new FileReader();
    reader.onloadend = () => {
      setNewItem({ ...newItem, imageUrl: reader.result as string });
    };
    reader.readAsDataURL(file);
  };

  const filteredItems = selectedCategory === 'Todos' 
    ? portfolioItems 
    : portfolioItems.filter(item => item.category === selectedCategory);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (!user) return <Auth />;

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      
      <div className="lg:ml-64 flex flex-col min-h-screen">
        <Header onMenuClick={() => setIsSidebarOpen(true)} />
        
        <main className="flex-1">
          {/* Hero Section */}
          <section className="relative h-[60vh] overflow-hidden flex items-center justify-center bg-slate-900">
            <Image 
              src="/fundo.jpg"
              alt="Background"
              fill
              className="object-cover object-[center_25%] opacity-50"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-slate-900/50 to-[#fafafa]"></div>
            
            <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
              >
                <span className="inline-block px-4 py-1.5 bg-purple-500/20 backdrop-blur-md border border-purple-500/30 rounded-full text-purple-200 text-xs font-black uppercase tracking-[0.2em] mb-6">
                  Nail Designer & Artist
                </span>
                <h1 className="text-5xl md:text-7xl font-black text-white mb-6 font-headline tracking-tighter leading-none">
                  Meus <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-purple-400 to-indigo-400">Trabalhos</span>
                </h1>
                <p className="text-lg md:text-xl text-slate-300 font-medium max-w-2xl mx-auto leading-relaxed">
                  Transformando unhas em obras de arte com técnica, cuidado e a sofisticação que você merece.
                </p>
                
                <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
                  <a 
                    href="https://www.instagram.com/nails.priscilavasconcellos/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-8 py-4 bg-white text-slate-900 rounded-2xl font-bold hover:scale-105 transition-all shadow-xl shadow-white/5"
                  >
                    <Instagram className="w-5 h-5 text-pink-500" />
                    Ver no Instagram
                  </a>
                  {role === 'admin' ? (
                    <button 
                      onClick={() => setIsModalOpen(true)}
                      className="flex items-center gap-2 px-8 py-4 bg-purple-600 text-white rounded-2xl font-bold hover:bg-purple-700 hover:scale-105 transition-all shadow-xl shadow-purple-500/20"
                    >
                      <Plus className="w-5 h-5" />
                      Adicionar Trabalho
                    </button>
                  ) : (
                    <Link href="/agendamentos" className="flex items-center gap-2 px-8 py-4 bg-purple-600 text-white rounded-2xl font-bold hover:bg-purple-700 hover:scale-105 transition-all shadow-xl shadow-purple-500/20">
                      <Sparkles className="w-5 h-5" />
                      Agendar Agora
                    </Link>
                  )}
                </div>
              </motion.div>
            </div>
          </section>

          {/* Portfolio Grid Section */}
          <section className="px-4 lg:px-8 py-16 max-w-7xl mx-auto -mt-20 relative z-20">
            {/* Category Filter */}
            <div className="flex flex-wrap items-center justify-center gap-2 mb-12">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={cn(
                    "px-6 py-2.5 rounded-2xl text-sm font-bold transition-all border",
                    selectedCategory === cat 
                      ? "bg-slate-900 text-white border-slate-900 shadow-lg shadow-slate-200" 
                      : "bg-white text-slate-500 border-slate-100 hover:border-slate-300"
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Grid */}
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="w-10 h-10 text-purple-600 animate-spin mb-4" />
                <p className="text-slate-500 font-medium">Carregando portfólio...</p>
              </div>
            ) : filteredItems.length > 0 ? (
              <motion.div 
                layout
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
              >
                <AnimatePresence mode="popLayout">
                  {filteredItems.map((item) => (
                    <motion.div
                      key={item.id}
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ duration: 0.3 }}
                      className="group relative bg-white rounded-[2rem] overflow-hidden shadow-sm hover:shadow-2xl transition-all duration-500 border border-slate-100"
                    >
                      <div className="aspect-[4/5] relative overflow-hidden">
                        <Image 
                          src={item.imageUrl}
                          alt={item.title}
                          fill
                          className="object-cover group-hover:scale-110 transition-transform duration-700"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex flex-col justify-end p-6">
                          <div className="flex items-center gap-4 text-white mb-4 translate-y-4 group-hover:translate-y-0 transition-transform duration-500">
                            <div className="flex items-center gap-1.5">
                              <Heart className="w-4 h-4 fill-pink-500 text-pink-500" />
                              <span className="text-sm font-bold">{item.likes}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <MessageCircle className="w-4 h-4 fill-white/20" />
                              <span className="text-sm font-bold">{item.comments}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="p-5">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-black uppercase tracking-widest text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
                            {item.category}
                          </span>
                          <div className="flex items-center gap-2">
                            <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                            {role === 'admin' && (
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteItem(item.id, item.imageUrl);
                                }}
                                className="p-1.5 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition-colors"
                                title="Excluir trabalho"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                        <h3 className="font-bold text-slate-800 line-clamp-1 group-hover:text-purple-600 transition-colors">
                          {item.title}
                        </h3>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </motion.div>
            ) : (
              <div className="text-center py-20 bg-white rounded-[3rem] border border-dashed border-slate-200">
                <Camera className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-slate-800 mb-2">Nenhum trabalho encontrado</h3>
                <p className="text-slate-500">
                  {role === 'admin' 
                    ? 'Comece adicionando seu primeiro trabalho ao portfólio.' 
                    : 'Em breve teremos novos trabalhos incríveis por aqui!'}
                </p>
              </div>
            )}

            {/* Instagram CTA */}
            <div className="mt-24 text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 rounded-[2rem] text-white shadow-2xl shadow-pink-200 mb-8 rotate-3 hover:rotate-0 transition-transform duration-500">
                <Instagram className="w-10 h-10" />
              </div>
              <h2 className="text-3xl font-black text-slate-800 mb-4 font-headline tracking-tight">Siga-me no Instagram</h2>
              <p className="text-slate-500 mb-10 max-w-md mx-auto">
                Acompanhe meu trabalho diário, dicas de cuidados e as últimas tendências em nail design.
              </p>
              <a 
                href="https://www.instagram.com/nails.priscilavasconcellos/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 px-10 py-5 bg-slate-900 text-white rounded-[2rem] font-bold hover:scale-105 transition-all shadow-2xl shadow-slate-200"
              >
                @nails.priscilavasconcellos
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </section>

          {/* Services Teaser */}
          <section className="bg-white py-24 px-4 border-t border-slate-100">
            <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-12">
              <div className="text-center group">
                <div className="w-16 h-16 bg-pink-50 rounded-2xl flex items-center justify-center text-pink-500 mx-auto mb-6 group-hover:scale-110 transition-transform duration-500">
                  <Scissors className="w-8 h-8" />
                </div>
                <h4 className="text-xl font-bold text-slate-800 mb-3">Técnica Impecável</h4>
                <p className="text-slate-500 text-sm leading-relaxed">
                  Especialista em alongamentos e banhos de gel com foco na saúde da unha natural.
                </p>
              </div>
              <div className="text-center group">
                <div className="w-16 h-16 bg-purple-50 rounded-2xl flex items-center justify-center text-purple-500 mx-auto mb-6 group-hover:scale-110 transition-transform duration-500">
                  <Paintbrush className="w-8 h-8" />
                </div>
                <h4 className="text-xl font-bold text-slate-800 mb-3">Arte Exclusiva</h4>
                <p className="text-slate-500 text-sm leading-relaxed">
                  Nail arts personalizadas que refletem sua personalidade e estilo único.
                </p>
              </div>
              <div className="text-center group">
                <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-500 mx-auto mb-6 group-hover:scale-110 transition-transform duration-500">
                  <Star className="w-8 h-8" />
                </div>
                <h4 className="text-xl font-bold text-slate-800 mb-3">Experiência Premium</h4>
                <p className="text-slate-500 text-sm leading-relaxed">
                  Um ambiente acolhedor e produtos de alta qualidade para o seu momento de beleza.
                </p>
              </div>
            </div>
          </section>
        </main>
      </div>

      {/* Admin Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-black text-slate-800 tracking-tight">Novo Trabalho</h2>
                  <button 
                    onClick={() => setIsModalOpen(false)}
                    className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                  >
                    <X className="w-6 h-6 text-slate-400" />
                  </button>
                </div>

                <form onSubmit={handleAddItem} className="space-y-6">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">
                      Título do Trabalho
                    </label>
                    <input
                      type="text"
                      required
                      value={newItem.title}
                      onChange={(e) => setNewItem({ ...newItem, title: e.target.value })}
                      placeholder="Ex: Alongamento em Gel Nude"
                      className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-purple-500 transition-all font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">
                      Categoria
                    </label>
                    <select
                      value={newItem.category}
                      onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                      className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-purple-500 transition-all font-medium appearance-none"
                    >
                      {categories.filter(c => c !== 'Todos').map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">
                      Imagem do Trabalho
                    </label>
                    <div className="relative">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                        id="image-upload"
                      />
                      <label 
                        htmlFor="image-upload"
                        className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl transition-all font-medium flex items-center justify-between cursor-pointer hover:bg-slate-100 hover:border-slate-200 group"
                      >
                        <span className="text-slate-500 truncate mr-4">
                          {newItem.imageUrl ? 'Imagem carregada com sucesso!' : 'Procurar no dispositivo...'}
                        </span>
                        <div className="p-2.5 bg-purple-100 rounded-xl group-hover:bg-purple-200 transition-colors shadow-sm">
                          <Paperclip className="w-5 h-5 text-purple-600" />
                        </div>
                      </label>
                    </div>
                  </div>

                  {newItem.imageUrl && (
                    <div className="relative aspect-video rounded-2xl overflow-hidden bg-slate-100">
                      <Image 
                        src={newItem.imageUrl}
                        alt="Preview"
                        fill
                        className="object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://picsum.photos/seed/error/800/450';
                        }}
                      />
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isSaving}
                    className="w-full py-5 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isSaving ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <Check className="w-5 h-5" />
                        Salvar no Portfólio
                      </>
                    )}
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PortfolioPage;
