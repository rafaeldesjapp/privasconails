import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const { data, error } = await supabase
    .rpc('exec_sql', { query: "SELECT * FROM pg_policies WHERE tablename = 'profiles'" });
    
  console.log('Using exec_sql (rpc):', data, error);

  // If rpc fails, we can just fetch via a standard REST if there's a pg_policies exposed (unlikely)
}

run();
