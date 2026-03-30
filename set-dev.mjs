import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const { data, error } = await supabase
    .from('profiles')
    .update({ role: 'desenvolvedor' })
    .in('username', ['rafaeldesjapp', 'rafaeldesj']);
    
  console.log('Update username based:', data, error);

  // As a fallback, try to update by email if username does not match
  const { data: d2, error: e2 } = await supabase
    .from('profiles')
    .update({ role: 'desenvolvedor' })
    .like('email', '%rafaeldesj%');
    
  console.log('Update email based:', d2, e2);
}

run();
