import { supabaseAdmin } from './src/lib/supabase-admin';

async function check() {
  const { data, error } = await supabaseAdmin.from('availability').select('*').limit(1);
  console.log('Sample row:', data, error);
}

check();
