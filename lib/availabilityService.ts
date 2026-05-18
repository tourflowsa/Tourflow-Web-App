import { supabase } from './supabase';

export interface ProviderAvailabilityBlock {
  id: string;
  user_id: string;
  date_start: string;
  date_end: string;
  is_blocked: boolean;
  reason: string | null;
}

export async function listPersonalAvailabilityBlocks(userId: string): Promise<ProviderAvailabilityBlock[]> {
  const { data, error } = await supabase
    .from('availability')
    .select('*')
    .eq('user_id', userId)
    .is('vehicle_id', null)
    .eq('is_blocked', true)
    .order('date_start', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function createPersonalAvailabilityBlock(
  userId: string,
  startDate: string,
  endDate: string,
  reason?: string
): Promise<void> {
  const { error } = await supabase.from('availability').insert({
    user_id: userId,
    date_start: startDate,
    date_end: endDate,
    is_blocked: true,
    reason: reason || null,
  });

  if (error) throw error;
}

export async function deletePersonalAvailabilityBlock(blockId: string): Promise<void> {
  const { error } = await supabase.from('availability').delete().eq('id', blockId);
  if (error) throw error;
}
