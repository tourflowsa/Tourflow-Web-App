import { supabase } from './src/lib/supabase';

async function test() {
  const { data, error } = await supabase.from('payout_ledger').select('*').limit(3);
  console.log("Error:", error);
  console.log("Data:", data ? data.map(d => d.id) : null);
}

test();
