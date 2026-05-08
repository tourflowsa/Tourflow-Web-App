
import { supabase } from './supabase';
import { logAuditEvent } from './auditService';

export interface OperatorBankDetails {
  id?: string;
  operator_id: string;
  account_holder_name: string;
  bank_name: string;
  account_number: string;
  account_type: string;
  branch_code: string;
  country: string;
  currency: string;
  updated_at?: string;
}

export const getOperatorBankDetails = async (operatorId: string) => {
  const { data, error } = await supabase
    .from('operator_bank_details')
    .select('*')
    .eq('operator_id', operatorId)
    .maybeSingle();

  if (error) throw error;
  return data as OperatorBankDetails | null;
};

export const saveOperatorBankDetails = async (details: Omit<OperatorBankDetails, 'id' | 'updated_at'>) => {
  const { data: existing } = await supabase
    .from('operator_bank_details')
    .select('id')
    .eq('operator_id', details.operator_id)
    .maybeSingle();

  const payload = {
    ...details,
    updated_at: new Date().toISOString()
  };

  let result;
  let action: 'operator_bank_created' | 'operator_bank_updated';

  if (existing) {
    const { data, error } = await supabase
      .from('operator_bank_details')
      .update(payload)
      .eq('id', existing.id)
      .select()
      .single();
    if (error) throw error;
    result = data;
    action = 'operator_bank_updated';
  } else {
    const { data, error } = await supabase
      .from('operator_bank_details')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    result = data;
    action = 'operator_bank_created';
  }

  // Audit Log
  await logAuditEvent({
    action,
    entityType: 'operator_bank_details',
    entityId: result.id,
    metadata: {
      operator_id: details.operator_id,
      bank_name: details.bank_name,
      account_holder: details.account_holder_name
    }
  });

  return result;
};

export const maskAccountNumber = (accountNumber: string) => {
  if (!accountNumber) return '';
  const last4 = accountNumber.slice(-4);
  return `****${last4}`;
};

export const getOperatorBankStatus = (details: OperatorBankDetails | null) => {
  if (!details) return 'Missing';
  
  const requiredFields: (keyof OperatorBankDetails)[] = [
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
