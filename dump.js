import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

let env = {};
try {
  const envFile = fs.readFileSync(path.resolve(process.cwd(), '.env'), 'utf8');
  envFile.split('\n').forEach(line => {
    const [key, ...val] = line.split('=');
    if (key && val) env[key.trim()] = val.join('=').trim().replace(/(^"|"$)/g, '');
  });
} catch(e) {}

const supabase = createClient(
  env['VITE_SUPABASE_URL'] || process.env.VITE_SUPABASE_URL,
  env['VITE_SUPABASE_SERVICE_ROLE_KEY'] || env['VITE_SUPABASE_ANON_KEY'] || process.env.VITE_SUPABASE_ANON_KEY
);

async function run() {
  const { data, error } = await supabase.from('payout_ledger').select('*').limit(1);
  console.log("Error:", error);
  if (data && data.length) {
    console.log("Columns:", Object.keys(data[0]));
  }
}
run();
