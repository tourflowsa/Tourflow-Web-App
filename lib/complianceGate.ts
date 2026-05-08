
import { getUserCompliance } from './compliance';
import { UserRole } from '../types';

export type ComplianceAction =
  | "create_booking"
  | "complete_booking"
  | "receive_payout"
  | "accept_assignment";

export type ComplianceGateCode =
  | "OK"
  | "MISSING_REQUIRED_DOC"
  | "EXPIRED_REQUIRED_DOC"
  | "NOT_VERIFIED"
  | "UNKNOWN";

export interface ComplianceGateResult {
  allowed: boolean;
  code: ComplianceGateCode;
  message: string;
  missing?: string[];
  expired?: string[];
  ctaLabel?: string;
  ctaTo?: string;
}

/**
 * Centralized gate to check if a specific action is allowed based on compliance status.
 * Uses the shared evaluator (getUserCompliance) to ensure consistency with banners/badges.
 */
export async function checkComplianceGate(params: {
  action: ComplianceAction;
  actorRole: UserRole;
  actorUserId: string;
  targetBookingId?: string;
}): Promise<ComplianceGateResult> {
  const { action, actorRole, actorUserId } = params;

  // 1. Admin Override
  if (actorRole === 'admin') {
    return { allowed: true, code: 'OK', message: 'Admin override active.' };
  }

  // 2. Evaluate Compliance State
  // This uses the exact same logic as the dashboard banners
  const compliance = await getUserCompliance(actorUserId, actorRole);
  const isNonCompliant = compliance.status === 'non_compliant';
  
  // Extract specific issues for messaging
  const missing = compliance.issues
    .filter(i => i.problem === 'missing' || i.problem === 'rejected' || i.problem === 'pending')
    .map(i => i.title);
    
  const expired = compliance.issues
    .filter(i => i.problem === 'expired')
    .map(i => i.title);

  // Determine CTA Route based on role
  let ctaTo = '/';
  switch (actorRole) {
    case 'operator': ctaTo = '/operator/documents'; break;
    case 'guide': ctaTo = '/guide/documents'; break;
    case 'driver': ctaTo = '/driver/documents'; break;
    case 'vehicle_owner': ctaTo = '/owner/documents'; break;
  }

  // 3. Action-Specific Rules

  // Operator Actions: Booking Creation & Completion
  if (action === 'create_booking' || action === 'complete_booking') {
    if (isNonCompliant) {
      return {
        allowed: false,
        code: missing.length > 0 ? 'MISSING_REQUIRED_DOC' : 'EXPIRED_REQUIRED_DOC',
        message: 'Action blocked due to missing or expired required documents.',
        missing,
        expired,
        ctaLabel: 'Update Documents',
        ctaTo
      };
    }
  }

  // Provider Actions: Payouts
  if (action === 'receive_payout') {
    if (isNonCompliant) {
      return {
        allowed: false,
        code: 'NOT_VERIFIED',
        message: 'Payouts are on hold due to missing or expired required documents.',
        missing,
        expired,
        ctaLabel: 'Update Documents',
        ctaTo
      };
    }
  }

  // Provider Actions: Assignments
  // Rule: Only block if the app already blocks assignment today. 
  // Currently, no strict block exists in the legacy code for accepting assignments, 
  // so we default to allowed to prevent regression/new friction.
  if (action === 'accept_assignment') {
    return { allowed: true, code: 'OK', message: 'Allowed' };
  }

  // Default Fallback
  return { allowed: true, code: 'OK', message: 'Allowed' };
}
