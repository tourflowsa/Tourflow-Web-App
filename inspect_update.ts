import { supabase } from './lib/supabase.ts';
import { updatePayoutLedgerStatus } from './lib/payoutService.ts';

async function main() {
  const { data: listData } = await supabase.from('payout_ledger').select('*').limit(1);
  if (!listData || listData.length === 0) {
    console.log("No payouts found.");
    return;
  }
  const id = listData[0].id;
  console.log("Found ID:", id);

  try {
    await updatePayoutLedgerStatus(id, 'approved');
    console.log("Success!");
  } catch (err: any) {
    console.log("Error updating:", err.message);
  }
}
main();
