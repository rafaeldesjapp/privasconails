'use client';

import React, { useRef, useState, useEffect } from 'react';
import { Menu, User, Bell, LogOut, RefreshCcw, Camera, Loader2 } from 'lucide-react';
import { useSupabaseAuth } from '@/hooks/use-supabase';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

interface HeaderProps {
  onMenuClick: () => void;
}

const Header = ({ onMenuClick }: HeaderProps) => {
  const { user, role } = useSupabaseAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  
  const [avatar, setAvatar] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (user?.user_metadata?.avatar_url) {
      setAvatar(user.user_metadata.avatar_url);
    }
  }, [user]);

  const handleAvatarClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);

      const compressedBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
          const img = new Image();
          img.src = event.target?.result as string;
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_SIZE = 150; 
            let width = img.width;
            let height = img.height;

            if (width > height) {
              if (width > MAX_SIZE) {
                height *= MAX_SIZE / width;
                width = MAX_SIZE;
              }
            } else {
              if (height > MAX_SIZE) {
                width *= MAX_SIZE / height;
                height = MAX_SIZE;
              }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, width, height);

            resolve(canvas.toDataURL('image/webp', 0.8));
          };
          img.onerror = () => reject(new Error('Decodificação da imagem falhou'));
        };
        reader.onerror = () => reject(new Error('Falha na leitura do arquivo local'));
      });

      setAvatar(compressedBase64);

      const { error } = await supabase.auth.updateUser({
        data: { avatar_url: compressedBase64 }
      });

      if (error) {
        console.error('Error saving avatar', error);
        alert('Falha ao salvar a imagem. Tente novamente mais tarde.');
      } else {
        // Força exatamente o comportamento do "F5" para atualizar toda a aplicação
        window.location.reload();
      }

    } catch (err: any) {
      console.error(err);
      alert('Ocorreu um erro ao processar a imagem do seu aparelho.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  return (
    <header className="h-16 bg-white border-b border-slate-100 flex items-center justify-between px-4 lg:px-8 sticky top-0 z-40">
      <div className="flex items-center gap-4">
        <button 
          onClick={onMenuClick}
          className="lg:hidden p-2 text-slate-400 hover:bg-slate-50 rounded-lg transition-colors"
        >
          <Menu className="w-6 h-6" />
        </button>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        <button className="p-2 text-slate-400 hover:bg-slate-50 rounded-lg transition-colors relative hidden sm:block">
          <Bell className="w-5 h-5" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
        </button>
        
        <div className="h-8 w-px bg-slate-100 mx-1 sm:mx-2 hidden sm:block"></div>
        
        {/* Info do Usuário e Foto */}
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-bold text-slate-700 leading-none mb-1">
              {user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Usuário'}
            </p>
            <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider leading-none">
              {role === 'desenvolvedor' ? 'Desenvolvedor' : (role === 'admin' ? 'Administrador' : 'Cliente')}
            </p>
          </div>
          
          <div 
            onClick={handleAvatarClick}
            className="group relative w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center border border-slate-200 overflow-hidden cursor-pointer hover:ring-2 hover:ring-blue-100 transition-all shadow-sm"
            title="Trocar foto de perfil"
          >
            {isUploading ? (
              <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
            ) : avatar ? (
              <img src={avatar} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <User className="w-5 h-5 text-slate-400" />
            )}
            
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera className="w-4 h-4 text-white" />
            </div>
          </div>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept="image/*" 
            className="hidden" 
          />
        </div>

        <div className="h-8 w-px bg-slate-100 mx-1 sm:mx-2"></div>
         
        {/* Ações Rápidas  */}
        <div className="flex items-center gap-1">
          <button 
            onClick={handleSignOut}
            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Trocar de Conta"
          >
            <RefreshCcw className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
          <button 
            onClick={handleSignOut}
            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            title="Sair da Conta (Logout)"
          >
            <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
