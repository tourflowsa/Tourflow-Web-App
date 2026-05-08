
import { supabase } from './supabase';
import { FeeTier, OperatorFeeAssignment } from '../types';

/**
 * Fetch all defined platform fee tiers.
 */
export const getFeeTiers = async () => {
  const { data, error } = await supabase
    .from('platform_fee_tiers')
    .select('*')
    .order('fee_percent', { ascending: false });

  if (error) throw error;
  return data as FeeTier[];
};

/**
 * Update a fee tier's rate or active status.
 */
export const updateFeeTier = async (tierCode: string, updates: Partial<FeeTier>) => {
  const { data, error } = await supabase
    .from('platform_fee_tiers')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('tier_code', tierCode)
    .select()
    .single();

  if (error) throw error;
  return data as FeeTier;
};

/**
 * Resolves the effective fee tier for an operator at a specific point in time.
 * robust strategy:
 * 1. Fetch ALL fee tiers (small dataset, safe to fetch all).
 * 2. Filter for "active" tiers in memory to handle schema variations (status vs is_active).
 * 3. Fetch specific assignment for operator.
 * 4. Match assignment or fallback to Bronze/Highest.
 */
export const resolveOperatorFee = async (operatorId: string, atDate: Date = new Date()) => {
  const dateStr = atDate.toISOString();

  // 1. Fetch All Tiers
  // We avoid server-side filtering on 'is_active' to prevent "No rows" errors if the column usage varies.
  const { data: allTiers, error: tierError } = await supabase
    .from('platform_fee_tiers')
    .select('*');

  if (tierError) {
    console.error("Error fetching fee tiers:", tierError);
    throw tierError;
  }

  if (!allTiers || allTiers.length === 0) {
    // Fallback hardcoded if DB is empty to prevent app crash
    console.error("CRITICAL: No fee tiers in DB. Using hardcoded fallback.");
    return { feeTierId: null, feeTierCode: 'Fallback', feePercent: 15 };
  }

  // 2. Identify Active Tiers (In-Memory Robustness)
  const activeTiers = allTiers.filter((t: any) => {
    const status = t.status ? String(t.status).toUpperCase() : '';
    const isActiveBool = t.is_active === true;
    // Consider active if explicit boolean true OR status string is ACTIVE
    return isActiveBool || status === 'ACTIVE';
  });

  // If no active tiers found, fallback to ALL tiers to avoid blocking operations
  const candidateTiers = activeTiers.length > 0 ? activeTiers : allTiers;

  // 3. Fetch Operator Assignment
  // We query for the most recent assignment effective before or at 'dateStr'
  const { data: assignment } = await supabase
    .from('operator_fee_assignments')
    .select('fee_tier_id')
    .eq('operator_id', operatorId)
    .lte('effective_from', dateStr)
    .order('effective_from', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let chosenTier = null;

  if (assignment) {
    chosenTier = candidateTiers.find((t: any) => t.id === assignment.fee_tier_id);
  }

  // 4. Fallback Selection (If no assignment or assigned tier not found in candidates)
  if (!chosenTier) {
    // Sort candidates by fee_percent descending (Highest fee first is safest default)
    candidateTiers.sort((a: any, b: any) => {
       const feeA = Number(a.fee_percent ?? a.platform_fee_rate_percent ?? 0);
       const feeB = Number(b.fee_percent ?? b.platform_fee_rate_percent ?? 0);
       return feeB - feeA;
    });

    // Prefer "Bronze" if it exists
    const bronze = candidateTiers.find((t: any) => 
      t.tier_code && String(t.tier_code).toUpperCase() === 'BRONZE'
    );
    
    // Default to Bronze, otherwise the highest fee tier available
    chosenTier = bronze || candidateTiers[0];
  }

  // Normalize return values
  const finalPercent = Number(chosenTier.fee_percent ?? chosenTier.platform_fee_rate_percent ?? 15);
  
  return {
    feeTierId: chosenTier.id,
    feeTierCode: chosenTier.tier_code,
    feePercent: finalPercent
  };
};
