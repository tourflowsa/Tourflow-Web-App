
import { supabase } from './supabase';
import { getOperatorCompliance, getUserCompliance, ComplianceResult } from './compliance';
import { getOperatorBankDetails } from './operatorBankDetailsService';
import { getLatestDocumentsForUser, getLatestDocumentsForReadiness, normalizeDocumentType } from './documentService';
import { getRequirementsForRole, getRequirementsForResource, computeDerivedStatus, DOCUMENT_DEFINITIONS } from './complianceRequirements';
import { Document as AppDocument } from '../types';

export interface DisputeIssueDetail {
  booking_id: string;
  booking_ref: string;
  start_date: string;
  dispute_status: string;
  impact_amount: number;
}

export interface EscrowIssueDetail {
  booking_id: string;
  booking_ref: string;
  start_date: string;
  expected_payout: number;
  escrow_amount: number;
  shortfall_amount: number;
}

export interface ProviderBankIssueItem {
  booking_id: string;
  booking_ref: string;
  start_date: string;
  provider_id: string;
  provider_name: string;
  provider_type: string;
}

export interface ProviderComplianceIssueItem {
  booking_id: string;
  booking_ref: string;
  start_date: string;
  provider_id: string;
  provider_name: string;
  provider_type: string;
  document_name: string;
  issue_type: string;
  issue: string;
  expiry_date?: string;
  vehicle_id?: string;
  vehicle_name?: string;
}

export interface ReadinessBreakdown {
  yourBankDetails: {
    missing: boolean;
    items: any[];
  };
  providerBankDetails: {
    missingCount: number;
    items: ProviderBankIssueItem[];
  };
  providerCompliance: {
    expiredCount: number;
    items: ProviderComplianceIssueItem[];
  };
  disputes: {
    count: number;
    items: DisputeIssueDetail[];
  };
  escrowFunding: {
    count: number;
    items: EscrowIssueDetail[];
  };
  // Legacy fields for UI compatibility
  operatorBankDetailsMissing: boolean;
  providerBankDetailsMissing: number;
  expiredDocuments: number;
  activeDisputes: number;
  unfundedEscrow: number;
}

export interface PaymentReadiness {
  score: number;
  status: 'ready' | 'at_risk' | 'blocked';
  breakdown: ReadinessBreakdown;
  criticalIssues: string[];
}

/**
 * Aggregates operator payment readiness signals into a single score and status.
 */
export const getOperatorPaymentReadiness = async (operatorId: string): Promise<PaymentReadiness> => {
  const breakdown: ReadinessBreakdown = {
    yourBankDetails: {
      missing: false,
      items: []
    },
    providerBankDetails: {
      missingCount: 0,
      items: []
    },
    providerCompliance: {
      expiredCount: 0,
      items: []
    },
    disputes: {
      count: 0,
      items: []
    },
    escrowFunding: {
      count: 0,
      items: []
    },
    operatorBankDetailsMissing: false,
    providerBankDetailsMissing: 0,
    expiredDocuments: 0,
    activeDisputes: 0,
    unfundedEscrow: 0
  };

  const criticalIssues: string[] = [];
  let score = 100;

  try {
    // 1. Operator Level Checks
    const [opBankDetails, opCompliance] = await Promise.all([
      getOperatorBankDetails(operatorId).catch(err => {
        console.error('[DEBUG:Readiness] Error fetching op bank details:', err);
        return null;
      }),
      getOperatorCompliance(operatorId).catch(err => {
        console.error('[DEBUG:Readiness] Error fetching op compliance:', err);
        return { status: 'non_compliant', issues: [] } as ComplianceResult;
      })
    ]);

    // Check operator bank details specifically
    const isOpBankReady = !!(
      opBankDetails && 
      opBankDetails.account_number && 
      opBankDetails.bank_name && 
      opBankDetails.account_holder_name && 
      opBankDetails.branch_code
    );
    

    if (!isOpBankReady) {
      breakdown.yourBankDetails.missing = true;
      breakdown.operatorBankDetailsMissing = true;
      criticalIssues.push('Platform Bank Details Missing');
      score -= 40; // High penalty
    }

    if (opCompliance.status === 'non_compliant') {
      const expiredCount = opCompliance.issues.filter((i: any) => i.problem === 'expired' && i.isRequired).length;
      if (expiredCount > 0) {
        breakdown.expiredDocuments += expiredCount;
        criticalIssues.push('Entity Compliance Documents Expired');
        score -= 20;
      }
    }

    // 2. Dispute Check
    const [disputesData, ledgerData] = await Promise.all([
      supabase.from('payout_disputes')
        .select(`booking_id, status, bookings(booking_reference, start_date)`)
        .eq('operator_id', operatorId)
        .eq('status', 'open'),
      supabase.from('payout_ledger')
        .select(`booking_id, amount_net, adjusted_amount, is_on_hold, status, hold_reason, bookings(booking_reference, start_date)`)
        .eq('operator_id', operatorId)
    ]);

    const activeDisputeMap = new Map<string, DisputeIssueDetail>();

    // Process open disputes explicitly
    (disputesData.data || []).forEach(d => {
      activeDisputeMap.set(d.booking_id, {
        booking_id: d.booking_id,
        booking_ref: (d.bookings as any)?.booking_reference || 'Unknown',
        start_date: (d.bookings as any)?.start_date || '',
        dispute_status: 'open',
        impact_amount: 0
      });
    });

    let hasBlockedPayouts = false;

    // Process ledger anomalies
    (ledgerData.data || []).forEach(l => {
      if (l.status === 'paid' && !l.is_on_hold) return;

      const isDisputedHold = l.is_on_hold && l.hold_reason === 'dispute';
      const isAdjusted = l.adjusted_amount !== null && l.adjusted_amount !== l.amount_net;
      
      if (isDisputedHold || isAdjusted) {
        hasBlockedPayouts = hasBlockedPayouts || isDisputedHold;
        const currentImpact = isAdjusted ? Math.abs(l.amount_net - l.adjusted_amount) : (l.amount_net || 0);

        if (activeDisputeMap.has(l.booking_id)) {
          const existing = activeDisputeMap.get(l.booking_id)!;
          existing.dispute_status = isDisputedHold ? 'hold_pending_resolution' : 'adjusted';
          existing.impact_amount += currentImpact;
        } else {
          activeDisputeMap.set(l.booking_id, {
            booking_id: l.booking_id,
            booking_ref: (l.bookings as any)?.booking_reference || 'Unknown',
            start_date: (l.bookings as any)?.start_date || '',
            dispute_status: isDisputedHold ? 'hold_pending_resolution' : 'adjusted',
            impact_amount: currentImpact
          });
        }
      }
    });

    const disputeIssues = Array.from(activeDisputeMap.values());
    
    breakdown.disputes = {
      count: disputeIssues.length,
      items: disputeIssues
    };
    breakdown.activeDisputes = disputeIssues.length;
    
    if (disputeIssues.length > 0) {
      if (hasBlockedPayouts) {
        criticalIssues.push('Payout Blocked Due to Active Dispute');
        score -= 30;
      } else {
        score -= (disputeIssues.length * 5);
      }
    }

    // 3. Escrow Funding Check
    const { data: activeBookings } = await supabase
      .from('bookings')
      .select('id, booking_reference, start_date, total_revenue, payout_total, escrow_total, escrow_status')
      .eq('operator_id', operatorId)
      .in('status', ['confirmed', 'assigned', 'completed']);

    const escrowIssues: EscrowIssueDetail[] = [];
    (activeBookings || []).forEach(b => {
      const isUnfunded = !['funds_received', 'fully_released', 'partially_released'].includes(b.escrow_status || '');
      const hasShortfall = (b.escrow_total || 0) < (b.payout_total || 0);

      if (isUnfunded || hasShortfall) {
        escrowIssues.push({
          booking_id: b.id,
          booking_ref: b.booking_reference,
          start_date: b.start_date,
          expected_payout: b.payout_total || 0,
          escrow_amount: b.escrow_total || 0,
          shortfall_amount: Math.max(0, (b.payout_total || 0) - (b.escrow_total || 0))
        });
      }
    });

    breakdown.escrowFunding = {
      count: escrowIssues.length,
      items: escrowIssues
    };
    breakdown.unfundedEscrow = escrowIssues.length;
    score -= (breakdown.unfundedEscrow * 5);

    // 4. Provider Level Checks
    const { data: assignments } = await supabase
      .from('booking_assignments')
      .select(`
        resource_id,
        resource_type,
        status,
        bookings!inner(id, booking_reference, start_date, operator_id, status)
      `)
      .eq('bookings.operator_id', operatorId)
      .in('bookings.status', ['pending', 'confirmed', 'assigned', 'completed'])
      .not('resource_id', 'is', null);

    const { data: vehicleOwnerRows } = await supabase
      .from('bookings')
      .select(`
        id,
        booking_reference,
        start_date,
        vehicle_id,
        vehicles!inner(owner_id, id, make, model)
      `)
      .eq('operator_id', operatorId)
      .in('status', ['pending', 'confirmed', 'assigned', 'completed'])
      .not('vehicle_id', 'is', null);

    // Collect all provider IDs to fetch names and roles
    const allProviderIds = new Set<string>();
    (assignments || []).forEach(a => allProviderIds.add(a.resource_id));
    (vehicleOwnerRows || []).forEach((row: any) => {
      if (row.vehicles?.owner_id) allProviderIds.add(row.vehicles.owner_id);
    });

    if (allProviderIds.size > 0) {
      const [bankDetailsList, profilesData] = await Promise.all([
        supabase.from('provider_bank_details')
          .select('provider_id, account_holder_name, bank_name, account_number, branch_code')
          .in('provider_id', Array.from(allProviderIds)),
        supabase.from('profiles')
          .select('id, full_name, role, verification_status, is_active')
          .in('id', Array.from(allProviderIds))
      ]);

      const profileMap = (profilesData.data || []).reduce(
        (acc, p) => ({ ...acc, [p.id]: { name: p.full_name || 'Unknown', role: p.role, verification_status: p.verification_status, is_active: p.is_active } }),
        {} as Record<string, { name: string, role: string, verification_status: string, is_active: boolean }>
      );

      // Fetch specific documents for assigned vehicles by using the existing vehicle compliance RPC
      const assignedVehicleIds = Array.from(new Set(
        (vehicleOwnerRows || []).map((v: any) => v.vehicle_id).filter(id => !!id)
      ));

      const vehicleComplianceResults: Record<string, { can_assign: boolean, blockers: string[], warnings: string[] }> = {};
      
      if (assignedVehicleIds.length > 0) {
        await Promise.all(assignedVehicleIds.map(async (vId) => {
          const { data, error } = await supabase.rpc('rpc_check_vehicle_assignment_compliance', { p_vehicle_id: vId });
          if (!error && data && data.length > 0) {
             vehicleComplianceResults[vId] = {
               can_assign: data[0].can_assign,
               blockers: data[0].blockers || [],
               warnings: data[0].warnings || []
             };
          } else {
             vehicleComplianceResults[vId] = { 
               can_assign: false, 
               blockers: ['Vehicle compliance check failed'], 
               warnings: [] 
             };
          }
        }));
      }

      const validBankProviderIds = new Set(
        (bankDetailsList.data || [])
          .filter(b => !!b.account_holder_name && !!b.bank_name && !!b.account_number && !!b.branch_code)
          .map(b => b.provider_id)
      );

      // Track items to avoid double scoring but show all links
      const uniqueProviderIds = Array.from(allProviderIds);
      const providerDocsCache: Record<string, Record<string, AppDocument>> = {};
      const seenBankIssues = new Set<string>();
      const seenCompIssues = new Set<string>();
      const vehicleBlockerMap = new Map<string, Set<string>>(); // vehicleId -> Set of documents missing

      // 4a. Provider Summary Check (Score and Blocker Counts)
      for (const providerId of uniqueProviderIds) {
        const profile = profileMap[providerId];
        if (!profile) continue;

        // Check Profile Verification Status
        const isVerified = profile.verification_status === 'verified';
        if (!isVerified) {
          if (!seenCompIssues.has(`${providerId}:verification`)) {
            score -= 20;
            criticalIssues.push(`Provider Not Verified: ${profile.name} (${providerId})`);
            seenCompIssues.add(`${providerId}:verification`);
          }
        }

        const docs = await getLatestDocumentsForReadiness(providerId);
        providerDocsCache[providerId] = docs;

        const role = profile.role;
        const requirements = getRequirementsForRole(role as any);

        for (const req of requirements.filter(r => r.required)) {
          const doc = docs[req.docId];
          const status = computeDerivedStatus(doc, req.requiresExpiry);

          const isBlocker = ['missing', 'pending', 'rejected', 'expired'].includes(status);
          const isWarning = status === 'expiring_soon';

          if (!seenCompIssues.has(`${providerId}:${req.docId}`)) {
            if (isBlocker) {
              breakdown.expiredDocuments++;
              score -= 15;
              criticalIssues.push(`Provider Compliance Blocker: ${profile.name} (${req.docId} ${status})`);
            } else if (isWarning) {
              score -= 2;
            }
            seenCompIssues.add(`${providerId}:${req.docId}`);
          }
        }
        // Bank Check for Summary
        if (!validBankProviderIds.has(providerId)) {
          if (!seenBankIssues.has(providerId)) {
            breakdown.providerBankDetailsMissing++;
            score -= 10;
            seenBankIssues.add(providerId);
          }
        }
      }

      const formatFriendlyDocText = (text: string) => {
        return text
          .replace(/vehicle_registration/g, 'Vehicle Registration')
          .replace(/insurance_certificate/g, 'Insurance Certificate')
          .replace(/operating_license/g, 'Operating License');
      };

      // 4a-bis. Vehicle Specific Summary Check
      for (const vehicleId of assignedVehicleIds) {
        const result = vehicleComplianceResults[vehicleId];
        if (!result) continue;

        if (!result.can_assign) {
          result.blockers.forEach(b => {
            const blocker = formatFriendlyDocText(b);
            if (!seenCompIssues.has(`vehicle:${vehicleId}:${blocker}`)) {
              breakdown.expiredDocuments++;
              score -= 15;
              
              if (!vehicleBlockerMap.has(vehicleId)) {
                vehicleBlockerMap.set(vehicleId, new Set());
              }
              vehicleBlockerMap.get(vehicleId)?.add(blocker);
              seenCompIssues.add(`vehicle:${vehicleId}:${blocker}`);
            }
          });
        }
        
        if (result.warnings && result.warnings.length > 0) {
          result.warnings.forEach(w => {
            const warning = formatFriendlyDocText(w);
            if (!seenCompIssues.has(`vehicle:${vehicleId}:${warning}`)) {
              score -= 2;
              seenCompIssues.add(`vehicle:${vehicleId}:${warning}`);
            }
          });
        }
      }

      // Add consolidated vehicle issues to criticalIssues
      for (const [vehicleId, blockers] of Array.from(vehicleBlockerMap.entries())) {
        const docList = Array.from(blockers).join(' | ');
        criticalIssues.push(`Vehicle Compliance Blocker: [${vehicleId.slice(0, 8)}] - ${docList}`);
      }

      // 4b. Provider Detail Check (Fill items breakdown)
      const processProviderIssue = async (providerId: string, booking: any, resourceType: string, vehicleId?: string) => {
        const profile = profileMap[providerId];
        const vehicleInfo = vehicleId && (booking as any).vehicles ? (booking as any).vehicles : null;
        const vehicleName = vehicleInfo ? `${vehicleInfo.make} ${vehicleInfo.model}` : undefined;
        
        const providerType = resourceType === 'vehicle' ? 'fleet' : (profile?.role || 'provider');
        const providerName = profile?.name || vehicleName || 'Vehicle Provider';

        // Bank Check (Items)
        if (!validBankProviderIds.has(providerId)) {
          breakdown.providerBankDetails.items.push({
            booking_id: booking.id,
            booking_ref: booking.booking_reference,
            start_date: booking.start_date,
            provider_id: providerId,
            provider_name: providerName,
            provider_type: providerType
          });
        }

        // Verification Status Check (Items)
        if (profile && profile.verification_status !== 'verified') {
          breakdown.providerCompliance.items.push({
            booking_id: booking.id,
            booking_ref: booking.booking_reference,
            start_date: booking.start_date,
            provider_id: providerId,
            provider_name: providerName,
            provider_type: providerType,
            document_name: 'Identity Verification',
            issue_type: 'Not Verified',
            issue: `Profile Verification: ${profile.verification_status}`,
            vehicle_id: vehicleId,
            vehicle_name: vehicleName
          });
        }

        // Compliance Check (Items)
        if (resourceType === 'vehicle' && vehicleId) {
          const result = vehicleComplianceResults[vehicleId];
          if (result && !result.can_assign) {
            result.blockers.forEach(blocker => {
              breakdown.providerCompliance.items.push({
                  booking_id: booking.id,
                  booking_ref: booking.booking_reference,
                  start_date: booking.start_date,
                  provider_id: providerId,
                  provider_name: providerName,
                  provider_type: providerType,
                  document_name: 'Vehicle Requirement',
                  issue_type: 'Compliance Blocker',
                  issue: formatFriendlyDocText(blocker),
                  vehicle_id: vehicleId,
                  vehicle_name: vehicleName
              });
            });
          }
          if (result && result.warnings) {
            result.warnings.forEach(warning => {
              breakdown.providerCompliance.items.push({
                  booking_id: booking.id,
                  booking_ref: booking.booking_reference,
                  start_date: booking.start_date,
                  provider_id: providerId,
                  provider_name: providerName,
                  provider_type: providerType,
                  document_name: 'Vehicle Requirement',
                  issue_type: 'Expiring Soon',
                  issue: formatFriendlyDocText(warning),
                  vehicle_id: vehicleId,
                  vehicle_name: vehicleName
              });
            });
          }
        } else {
          const docs = providerDocsCache[providerId] || {};
          const requirements = getRequirementsForResource(resourceType);

          requirements
            .filter(req => req.required)
            .forEach(req => {
              const doc = docs[req.docId];
              const status = computeDerivedStatus(doc, req.requiresExpiry);

              const isBlocker = ['missing', 'pending', 'rejected', 'expired'].includes(status);
              const isWarning = status === 'expiring_soon';

              if (!isBlocker && !isWarning) return;

              const issueLabel =
                status === 'expired' ? 'Expired' :
                status === 'pending' ? 'Pending Review' :
                status === 'rejected' ? 'Rejected' :
                status === 'missing' ? 'Missing' :
                'Expiring Soon';

              const documentName = DOCUMENT_DEFINITIONS[req.docId]?.label || req.docId;

              breakdown.providerCompliance.items.push({
                booking_id: booking.id,
                booking_ref: booking.booking_reference,
                start_date: booking.start_date,
                provider_id: providerId,
                provider_name: providerName,
                provider_type: providerType,
                document_name: documentName,
                issue_type: issueLabel,
                issue: `${issueLabel}: ${documentName}`,
                expiry_date: doc?.expiry_date || undefined,
                vehicle_id: vehicleId,
                vehicle_name: vehicleName
              });
            });
        }
      };

      for (const a of (assignments || [])) {
        await processProviderIssue(a.resource_id, a.bookings, a.resource_type);
      }
      for (const row of (vehicleOwnerRows || [])) {
        if ((row as any).vehicles?.owner_id) {
          await processProviderIssue((row as any).vehicles.owner_id, row, 'vehicle', (row as any).vehicle_id);
        }
      }
      
      breakdown.providerBankDetails.missingCount = breakdown.providerBankDetailsMissing;
      breakdown.providerCompliance.expiredCount = breakdown.expiredDocuments;
    }


  } catch (err) {
    console.error('Error computing readiness score:', err);
  }

  // Bound score
  score = Math.max(0, Math.min(100, score));

  // Determine Status
  let status: 'ready' | 'at_risk' | 'blocked' = 'ready';
  
  if (score < 40 || criticalIssues.length > 0) {
    status = 'blocked';
  } else if (score < 80) {
    status = 'at_risk';
  }


  return {
    score,
    status,
    breakdown,
    criticalIssues
  };
};
