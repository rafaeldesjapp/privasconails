import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';

export function useSupabaseAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const currentUser = session?.user ?? null;
        setUser(currentUser);
        
        if (currentUser) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', currentUser.id)
            .single();
          setRole(profile?.role ?? 'cliente');
        } else {
          setRole(null);
        }
      } catch (err) {
        console.error('Erro ao obter sessão:', err);
        setUser(null);
        setRole(null);
      } finally {
        setLoading(false);
      }
    };

    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event: string, session: any) => {
      try {
        const currentUser = session?.user ?? null;
        setUser(currentUser);
        
        if (currentUser) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', currentUser.id)
            .single();
          setRole(profile?.role ?? 'cliente');
        } else {
          setRole(null);
        }
      } catch (err) {
        console.error('Erro na mudança de estado de autenticação:', err);
      } finally {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return { user, role, loading };
}

export function useSupabaseQuery<T>(
  queryOrTable: string | (() => Promise<{ data: T | null; error: any }>),
  deps: any[] = []
) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      let result;
      if (typeof queryOrTable === 'string') {
        result = await supabase.from(queryOrTable).select('*');
      } else {
        result = await queryOrTable();
      }
      setData(result.data as T | null);
      setError(result.error);
      setLoading(false);
    };

    fetchData();
  }, [queryOrTable, ...deps]);

  return { data, error, loading };
}
