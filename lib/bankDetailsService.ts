
import { supabase } from './supabase';
import { logAuditEvent } from './auditService';

export interface BankDetails {
  id?: string;
  provider_id: string;
  provider_type: 'driver' | 'guide' | 'fleet';
  account_holder_name: string;
  bank_name: string;
  account_number: string;
  account_type: string;
  branch_code: string;
  country: string;
  currency: string;
  is_verified: boolean;
  updated_at?: string;
}

export const getBankDetails = async (providerId: string) => {
  const { data, error } = await supabase
    .from('provider_bank_details')
    .select(`
      provider_id,
      provider_type,
      account_holder_name,
      bank_name,
      account_number,
      account_type,
      branch_code,
      country,
      currency,
      is_verified,
      updated_at
    `)
    .eq('provider_id', providerId)
    .maybeSingle();

  if (error) throw error;
  return data as BankDetails | null;
};

export const saveBankDetails = async (details: Omit<BankDetails, 'id' | 'updated_at' | 'is_verified'>) => {
  const payload = {
    provider_id: details.provider_id,
    provider_type: details.provider_type,
    account_holder_name: details.account_holder_name,
    bank_name: details.bank_name,
    account_number: details.account_number,
    account_type: details.account_type,
    branch_code: details.branch_code,
    country: details.country,
    currency: details.currency,
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('provider_bank_details')
    .upsert(payload, { onConflict: 'provider_id' })
    .select()
    .single();

  if (error) throw error;

  // Audit logging - non-blocking
  logAuditEvent({
    action: 'PROVIDER_BANK_DETAILS_UPDATED',
    entityType: 'provider_bank_details',
    entityId: details.provider_id,
    metadata: {
      provider_id: details.provider_id,
      bank_name: details.bank_name,
      account_number_masked: maskAccountNumber(details.account_number),
      provider_type: details.provider_type
    }
  }).catch(err => console.warn('[bankDetailsService] Audit log failed:', err));

  return data as BankDetails;
};

export const maskAccountNumber = (accountNumber: string) => {
  if (!accountNumber) return '';
  const last4 = accountNumber.slice(-4);
  return `****${last4}`;
};

export const getBankStatus = (details: BankDetails | null) => {
  if (!details) return 'Missing';
  
  const requiredFields: (keyof BankDetails)[] = [
    'account_holder_name',
    'bank_name',
    'account_number',
    'branch_code'
  ];

  const isComplete = requiredFields.every(field => !!details[field]);
  if (!isComplete) return 'Incomplete';

  const updatedDate = new Date(details.updated_at || '');
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - updatedDate.getTime()) / (1000 * 3600 * 24));
  
  if (diffDays < 7) return 'Updated recently';
  return 'Complete';
};
