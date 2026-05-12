import { supabase } from './lib/supabase.ts';

async function main() {
  const { data, error } = await supabase.from('payout_ledger').select('provider_type').limit(1);
  console.log("Error:", error);
}
main();
