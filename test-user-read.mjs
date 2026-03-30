import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const anonSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  const { data: authData, error: authError } = await anonSupabase.auth.signInWithPassword({
    email: 'rafaeldesjapp@gmail.com',
    password: 'vitoriavitoria'
  });
  console.log('Login:', authData?.user?.id ? 'Success' : 'Fail', authError?.message);

  if (authData?.user) {
    const { data: profile, error: readError } = await anonSupabase
      .from('profiles')
      .select('role')
      .eq('id', authData.user.id)
      .single();
    console.log('Profile fetch:', profile, readError?.message);
  }
}
run();
