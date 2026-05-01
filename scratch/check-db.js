const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Environment variables missing');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase
    .from('solicitacoes')
    .select('id, status, data')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('Error fetching solicitacoes:', error);
    return;
  }

  console.log('Last 5 solicitacoes:');
  data.forEach(s => {
    console.log(`ID: ${s.id}, Status: ${s.status}, AppID: ${s.data?.appointment_id}`);
  });
}

check();
