
import { supabase } from './supabase';
import { logAuditEvent } from './auditService';

export interface PlatformBankDetails {
  id?: string;
  account_holder_name: string;
  bank_name: string;
  account_number: string;
  account_type: string;
  branch_code: string;
  country: string;
  currency: string;
  is_primary: boolean;
  updated_at?: string;
}

export const getPlatformBankDetails = async () => {
  const { data, error } = await supabase
    .from('platform_bank_details')
    .select('*')
    .order('is_primary', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data as PlatformBankDetails | null;
};

export const savePlatformBankDetails = async (details: Omit<PlatformBankDetails, 'id' | 'updated_at'>) => {
  const { data: existing } = await supabase
    .from('platform_bank_details')
    .select('id')
    .limit(1)
    .maybeSingle();

  const payload = {
    ...details,
    updated_at: new Date().toISOString()
  };

  let result;
  let action: 'platform_bank_created' | 'platform_bank_updated';

  if (existing) {
    const { data, error } = await supabase
      .from('platform_bank_details')
      .update(payload)
      .eq('id', existing.id)
      .select()
      .single();
    if (error) throw error;
    result = data;
    action = 'platform_bank_updated';
  } else {
    const { data, error } = await supabase
      .from('platform_bank_details')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    result = data;
    action = 'platform_bank_created';
  }

  // Audit Log
  await logAuditEvent({
    action,
    entityType: 'platform_bank_details',
    entityId: result.id,
    metadata: {
      bank_name: details.bank_name,
      account_holder: details.account_holder_name,
      is_primary: details.is_primary
    }
  });

  return result;
};

export const maskAccountNumber = (accountNumber: string) => {
  if (!accountNumber) return '';
  const last4 = accountNumber.slice(-4);
  return `****${last4}`;
};
