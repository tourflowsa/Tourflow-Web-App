
import { supabase } from './supabase';
import { UserProfile } from '../types';
import { logAuditEvent } from './auditService';

export interface AdminFeeTier {
  id: string;
  tier_code: string;
  fee_percent: number;
  is_active: boolean;
  created_at: string;
}

export interface OperatorFeeAssignment {
  operator_id: string;
  fee_tier_id: string;
  effective_from: string;
  created_at: string;
  platform_fee_tiers?: {
    tier_code: string;
    fee_percent: number;
  }; 
}

/**
 * Search for operators by email.
 */
export const searchOperators = async (searchTerm: string): Promise<UserProfile[]> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'operator')
    .ilike('email', `%${searchTerm}%`)
    .limit(5);

  if (error) throw error;
  return data as UserProfile[];
};

/**
 * Fetch all active fee tiers for selection.
 */
export const getActiveFeeTiers = async (): Promise<AdminFeeTier[]> => {
  const { data, error } = await supabase
    .from('platform_fee_tiers')
    .select('*')
    // We remove strictly server-side filters here if they are brittle, 
    // but for the dropdown we generally want "Active" ones. 
    // We'll trust the caller or DB here, but fetch all usually safer.
    // Let's keep it simple:
    .order('fee_percent', { ascending: false });

  if (error) throw error;
  
  // Filter in memory to match robustness of feeService
  return (data || []).filter((t: any) => 
    t.is_active === true || String(t.status).toUpperCase() === 'ACTIVE'
  ) as AdminFeeTier[];
};

/**
 * Fetch all fee tiers (including inactive) for management list.
 */
export const getAllFeeTiers = async (): Promise<AdminFeeTier[]> => {
  const { data, error } = await supabase
    .from('platform_fee_tiers')
    .select('*')
    .order('fee_percent', { ascending: false });

  if (error) throw error;
  return data as AdminFeeTier[];
};

/**
 * Get current assignment for a specific operator.
 */
export const getOperatorAssignment = async (operatorId: string): Promise<OperatorFeeAssignment | null> => {
  const { data, error } = await supabase
    .from('operator_fee_assignments')
    .select(`
      *,
      platform_fee_tiers (
        tier_code,
        fee_percent
      )
    `)
    .eq('operator_id', operatorId)
    .order('effective_from', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data as OperatorFeeAssignment | null;
};

/**
 * Assign a fee tier to an operator.
 * Upserts based on operator_id unique constraint to ensure latest assignment.
 */
export const assignOperatorTier = async (operatorId: string, feeTierId: string) => {
  const payload = {
    operator_id: operatorId,
    fee_tier_id: feeTierId,
    effective_from: new Date().toISOString(), // Immediate effect
  };

  // Upsert to handle "latest state" logic on this table
  const { data, error } = await supabase
    .from('operator_fee_assignments')
    .upsert(payload, { onConflict: 'operator_id' })
    .select(`
      *,
      platform_fee_tiers (
        tier_code,
        fee_percent
      )
    `)
    .single();

  if (error) throw error;

  await logAuditEvent({
    action: 'FEE_TIER_ASSIGNED',
    entityType: 'operator_fee_assignment',
    entityId: operatorId, 
    metadata: { 
      fee_tier_id: feeTierId,
      tier_code: data.platform_fee_tiers?.tier_code, 
      fee_percent: data.platform_fee_tiers?.fee_percent, 
      effective_from: payload.effective_from 
    }
  });

  return data;
};

/**
 * Create or Update a Fee Tier (Admin only).
 */
export const upsertFeeTier = async (tier: Partial<AdminFeeTier>) => {
  const { data, error } = await supabase
    .from('platform_fee_tiers')
    .upsert(tier)
    .select()
    .single();

  if (error) throw error;

  await logAuditEvent({
    action: tier.id ? 'FEE_TIER_UPDATED' : 'FEE_TIER_CREATED',
    entityType: 'platform_fee_tiers',
    entityId: data.id,
    metadata: { code: data.tier_code, percent: data.fee_percent, active: data.is_active }
  });

  return data as AdminFeeTier;
};
