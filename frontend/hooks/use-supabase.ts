import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';

export function useSupabaseAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      
      if (currentUser) {
        // REGRA DE OURO: rafaeldesjapp@gmail.com é SEMPRE admin
        if (currentUser.email === 'rafaeldesjapp@gmail.com') {
          setRole('admin');
          setLoading(false);
          
          // Tenta garantir que o perfil existe no banco em background
          supabase.from('profiles').upsert({
            id: currentUser.id,
            email: currentUser.email,
            role: 'admin'
          }).then(({ error }) => {
            if (error) console.error('Erro ao sincronizar perfil admin:', error);
          });
          
          return;
        }

        let { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', currentUser.id)
          .single();
        
        if (profileError && profileError.code === 'PGRST116') {
          // Perfil não existe, vamos criar um como CLIENTE por padrão
          const { data: newProfile, error: createError } = await supabase
            .from('profiles')
            .insert({
              id: currentUser.id,
              email: currentUser.email,
              role: 'cliente'
            })
            .select('role')
            .single();
          
          if (!createError && newProfile) {
            profile = newProfile;
            profileError = null;
          } else {
            // Se falhou ao criar, força cliente
            console.log('Não foi possível criar perfil, usando cliente como padrão');
            setRole('cliente');
            setLoading(false);
            return;
          }
        }

        if (profileError) {
          console.error('Erro ao buscar perfil:', profileError);
          // Se for o email do administrador principal, forçamos admin
          if (currentUser.email === 'rafaeldesjapp@gmail.com') {
            setRole('admin');
          } else {
            // Qualquer outro usuário é cliente por padrão
            setRole('cliente');
          }
        } else {
          // Verifica se é o admin principal
          if (currentUser.email === 'rafaeldesjapp@gmail.com') {
            setRole('admin');
          } else {
            // Para outros usuários, respeita o que está no banco
            setRole(profile?.role || 'cliente');
          }
        }
      } else {
        setRole(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  return { user, role, loading };
}

export function useSupabaseQuery(table: string, options?: { 
  orderBy?: { column: string, ascending?: boolean },
  where?: { column: string, value: any }
}) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      let query = supabase.from(table).select('*');

      if (options?.where) {
        query = query.eq(options.where.column, options.where.value);
      }

      if (options?.orderBy) {
        query = query.order(options.orderBy.column, { ascending: options.orderBy.ascending ?? true });
      }

      const { data, error } = await query;

      if (error) {
        setError(error);
      } else {
        setData(data);
      }
      setLoading(false);
    }

    fetchData();

    // Set up real-time subscription
    const channel = supabase
      .channel(`${table}-changes`)
      .on('postgres_changes', { event: '*', schema: 'public', table }, () => {
        fetchData(); // Refresh on any change for simplicity
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, options?.orderBy?.column, options?.orderBy?.ascending, options?.where?.column, options?.where?.value]);

  return { data, loading, error };
}
