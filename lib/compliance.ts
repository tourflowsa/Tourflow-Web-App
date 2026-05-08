
import { getLatestDocumentsForUser, getLatestDocumentsForReadiness, getLatestDocumentsForAssignmentCheck } from './documentService';
import { DocumentType, UserRole } from '../types';
import { getRequirementsForRole, DOCUMENT_DEFINITIONS, computeDerivedStatus } from './complianceRequirements';
import { supabase } from './supabase';

export type ComplianceStatus = 'compliant' | 'warn_only' | 'non_compliant';

export interface ComplianceIssue {
  document_type: DocumentType;
  title: string;
  problem: 'missing' | 'rejected' | 'pending' | 'expired' | 'expiring_soon';
  expiry_date?: string;
  isRequired: boolean;
}

export interface ComplianceResult {
  status: ComplianceStatus;
  issues: ComplianceIssue[];
}

/**
 * Validates if a vehicle is eligible for assignment.
 * Checks vehicle status and owner compliance.
 */
export const canAssignVehicle = async (vehicleId: string): Promise<{
  canAssign: boolean;
  warning?: string;
  blockers: string[];
}> => {
  try {
    const { data, error } = await supabase
      .rpc('rpc_check_vehicle_assignment_compliance', { p_vehicle_id: vehicleId });

    if (error || !data || data.length === 0) {
      console.error('Compliance RPC error:', error);
      return { 
        canAssign: false, 
        blockers: ['Vehicle compliance could not be verified. Please try again.'] 
      };
    }

    const result = data[0];
    
    let canAssign = result.can_assign === true;
    let blockers = result.blockers && result.blockers.length > 0 ? result.blockers : [];
    
    if (canAssign) {
      blockers = [];
    } else {
      if (blockers.length === 0) {
        blockers = ['Vehicle compliance checks are incomplete'];
      }
    }
    
    const warningsArr = result.warnings || [];
    const warning = warningsArr.length > 0 ? warningsArr.join(', ') : undefined;
    
    return {
      canAssign,
      warning,
      blockers
    };
  } catch (err) {
    console.error('Compliance RPC exception:', err);
    return { 
      canAssign: false, 
      blockers: ['Vehicle compliance could not be verified. Please try again.'] 
    };
  }
};

/**
 * Generic compliance check for any user role using the central requirements configuration.
 */
export const getUserCompliance = async (
  userId: string, 
  role: UserRole, 
  mode: 'user' | 'readiness' | 'assignment' = 'user'
): Promise<ComplianceResult> => {
  let docs;
  if (mode === 'readiness') {
    docs = await getLatestDocumentsForReadiness(userId);
  } else if (mode === 'assignment') {
    docs = await getLatestDocumentsForAssignmentCheck(userId);
  } else {
    docs = await getLatestDocumentsForUser(userId);
  }
    
  const issues: ComplianceIssue[] = [];
  
  const requirements = getRequirementsForRole(role);

  for (const req of requirements) {
    const doc = docs[req.docId];
    const def = DOCUMENT_DEFINITIONS[req.docId];
    const title = def ? def.label : req.docId;
    const type = req.docId as DocumentType;
    
    // Evaluate status using the new helper that respects requiresExpiry
    const status = computeDerivedStatus(doc, req.requiresExpiry);

    // Only report issues. 'valid' is good.
    if (status !== 'valid') {
      // For required docs, any non-valid status is an issue
      if (req.required) {
        issues.push({ 
          document_type: type, 
          title: title, 
          problem: status as any, // 'missing' | 'rejected' | 'pending' | 'expired' | 'expiring_soon'
          expiry_date: doc?.expiry_date || undefined,
          isRequired: true
        });
      } else {
        // For optional docs, only report if present but expired/rejected (as warning info, not blocking)
        // Actually, optional docs should generally not block. We might list them as warnings if uploaded but expired.
        if (status === 'expired' || status === 'expiring_soon') {
           issues.push({
             document_type: type,
             title: title,
             problem: status,
             expiry_date: doc?.expiry_date || undefined,
             isRequired: false
           });
        }
      }
    }
  }

  // Blocking logic: Required docs that are missing, pending, rejected, or expired
  const hasBlocking = issues.some(i => i.isRequired && i.problem !== 'expiring_soon');
  
  // Warning logic: Expiring soon (required or optional) OR optional docs that are expired/rejected
  // Note: We typically only warn about expiring soon for required docs to keep noise down, 
  // but let's include all expiring soon.
  const hasWarning = issues.some(i => i.problem === 'expiring_soon' || (!i.isRequired && i.problem === 'expired'));

  let statusResult: ComplianceStatus = 'compliant';
  if (hasBlocking) statusResult = 'non_compliant';
  else if (hasWarning) statusResult = 'warn_only';

  return { status: statusResult, issues };
};

/**
 * Validates if a provider is eligible for assignment.
 * Blocks if any required document is missing, pending, rejected, or expired.
 */
export const canAssignProvider = async (providerId: string, role: UserRole): Promise<{
  canAssign: boolean;
  warning?: string;
  blockers: string[];
}> => {
  const compliance = await getProviderComplianceForOperator(providerId, role);
  
  const blockers = compliance.issues
    .filter(i => i.isRequired && ['missing', 'pending', 'rejected', 'expired'].includes(i.problem))
    .map(i => `${i.title}: ${i.problem}`);

  const warnings = compliance.issues
    .filter(i => i.problem === 'expiring_soon')
    .map(i => `${i.title} is expiring soon`);

  return {
    canAssign: blockers.length === 0,
    warning: warnings.length > 0 ? warnings.join(', ') : undefined,
    blockers
  };
};

/**
 * Specifically for operators checking provider compliance.
 */
export const getProviderComplianceForOperator = async (
  providerId: string, 
  role: UserRole,
  mode: 'readiness' | 'assignment' = 'assignment'
): Promise<ComplianceResult> => {
  return getUserCompliance(providerId, role, mode);
};

/**
 * Operator specific wrapper (backward compatibility)
 */
export const getOperatorCompliance = async (userId: string): Promise<ComplianceResult> => {
  return getUserCompliance(userId, 'operator', 'user');
};
