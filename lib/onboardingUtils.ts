
import { UserProfile, Document, UserRole, DocumentType } from '../types';
import { getRequirementsForRole, computeDerivedStatus } from './complianceRequirements';

export type OnboardingStep = 'not_started' | 'in_progress' | 'awaiting_review' | 'verified' | 'rejected';

/**
 * Normalizes document types to handle mismatches between FE keys and DB enum keys.
 */
const normalizeDocType = (type: string): string => {
  const t = type.toLowerCase();
  if (t.includes('id_document') || t.includes('id_proof') || t.includes('identity')) return 'id_document';
  if (t.includes('driver_license') || t.includes('driving')) return 'driver_license';
  if (t.includes('pdp') || t.includes('professional_driving')) return 'pdp_license';
  if (t.includes('guide_certificate') || t.includes('tour_guide')) return 'guide_certificate';
  if (t.includes('vehicle_insurance') || t.includes('insurance')) return 'insurance_cert';
  if (t.includes('vehicle_reg') || t.includes('registration')) return 'vehicle_reg';
  if (t.includes('operating_license') || t.includes('permit')) return 'operating_license';
  if (t.includes('bank_proof') || t.includes('bank')) return 'bank_proof';
  if (t.includes('business_reg') || t.includes('cipc')) return 'business_reg';
  if (t.includes('vat_cert') || t.includes('vat')) return 'vat_cert';
  if (t.includes('first_aid')) return 'first_aid';
  return t;
};

export const calculateOnboardingStatus = (profile: UserProfile, documents: Document[]): OnboardingStep => {
  if (profile.verification_status === 'verified') return 'verified';
  if (profile.verification_status === 'rejected') return 'rejected';

  const requirements = getRequirementsForRole(profile.role);
  if (requirements.length === 0) return 'verified';

  const requiredReqs = requirements.filter(r => r.required);

  const docsByType = new Map(
    documents.map(d => [normalizeDocType(String(d.document_type)), d])
  );

  const requiredDocs = requiredReqs
    .map(req => docsByType.get(normalizeDocType(String(req.docId))))
    .filter(Boolean) as Document[];

  const hasAllRequired = requiredReqs.every(req =>
    docsByType.has(normalizeDocType(String(req.docId)))
  );

  const hasSomeDocs = requiredDocs.length > 0;

  const allRequiredValid = hasAllRequired && requiredDocs.every(d =>
    ['valid', 'approved'].includes(String(d.status).toLowerCase())
  );

  const anyRequiredPending = requiredDocs.some(d =>
    String(d.status).toLowerCase() === 'pending'
  );

  const anyRequiredRejected = requiredDocs.some(d =>
    String(d.status).toLowerCase() === 'rejected'
  );

  if (allRequiredValid) return 'verified';
  if (hasAllRequired && anyRequiredPending) return 'awaiting_review';
  if (anyRequiredRejected || hasSomeDocs) return 'in_progress';
  return 'not_started';
};
