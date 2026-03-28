import { createClient } from '@supabase/supabase-js';

let supabaseClient: any = null;

export const supabase = (() => {
  if (supabaseClient) return supabaseClient;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Configuração do Supabase ausente. Por favor, defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY nas suas variáveis de ambiente.');
    // Return a proxy that throws a better error when used
    return new Proxy({}, {
      get: () => {
        throw new Error('Cliente Supabase utilizado, mas NEXT_PUBLIC_SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_ANON_KEY está ausente.');
      }
    });
  }

  supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
  return supabaseClient;
})();
