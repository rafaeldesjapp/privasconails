import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';

// Estado Global para Auth
let globalUser: User | null = null;
let globalRole: string | null = null;
let globalLoading = true;
let isInitialized = false;
let sessionPromise: Promise<void> | null = null;
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach(listener => listener());
}

async function initializeGlobalAuth() {
  if (sessionPromise) return sessionPromise;
  
  sessionPromise = (async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const currentUser = session?.user ?? null;
      globalUser = currentUser;
      
      if (currentUser) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', currentUser.id)
          .single();
        globalRole = profile?.role ?? 'cliente';
      } else {
        globalRole = null;
      }
    } catch (err) {
      console.error('Erro ao obter sessão:', err);
      globalUser = null;
      globalRole = null;
    } finally {
      globalLoading = false;
      isInitialized = true;
      notifyListeners();
    }

    supabase.auth.onAuthStateChange(async (_event: string, session: any) => {
      globalLoading = true;
      notifyListeners();
      try {
        const currentUser = session?.user ?? null;
        globalUser = currentUser;
        
        if (currentUser) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', currentUser.id)
            .single();
          globalRole = profile?.role ?? 'cliente';
        } else {
          globalRole = null;
        }
      } catch (err) {
        console.error('Erro na mudança de estado:', err);
      } finally {
        globalLoading = false;
        notifyListeners();
      }
    });
  })();

  return sessionPromise;
}

export function useSupabaseAuth() {
  const [state, setState] = useState({
    user: globalUser,
    role: globalRole,
    loading: globalLoading
  });

  useEffect(() => {
    const listener = () => {
      setState({
        user: globalUser,
        role: globalRole,
        loading: globalLoading
      });
    };

    listeners.add(listener);

    if (!isInitialized && !sessionPromise) {
      initializeGlobalAuth();
    } else if (isInitialized) {
      // Se montou depois da inicialização, já reflete o estado atual
      listener();
    }

    return () => {
      listeners.delete(listener);
    };
  }, []);

  return state;
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
