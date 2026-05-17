
import { Document, DocumentDisplayStatus, DocumentType, UserRole, ComplianceSummary } from '../types';

export type DocumentTypeId = 
  | 'business_reg' 
  | 'bank_proof' 
  | 'vat_cert'
  | 'id_document'
  | 'tour_guide_permit'
  | 'first_aid'
  | 'driver_license'
  | 'pdp_license'
  | 'vehicle_reg'
  | 'operating_license'
  | 'insurance_cert';

export interface DocumentDefinition {
  id: DocumentTypeId;
  label: string;
  description: string;
  acceptedFormats: string[];
}

export interface RoleRequirement {
  docId: DocumentTypeId;
  required: boolean;
  requiresExpiry?: boolean; // New flag to enforce expiry checks
}

export const EXPIRING_SOON_DAYS = 30;

// Documents that generally support expiry dates (for Admin UI hints)
export const EXPIRY_SENSITIVE_DOCS: DocumentTypeId[] = [
  'tour_guide_permit',
  'first_aid',
  'insurance_cert',
  'operating_license',
  'driver_license',
  'pdp_license'
];

export const DOCUMENT_DEFINITIONS: Record<DocumentTypeId, DocumentDefinition> = {
  business_reg: {
    id: 'business_reg',
    label: 'Business Registration',
    description: 'Official company registration documents (e.g., CIPC).',
    acceptedFormats: ['.pdf', '.jpg', '.png']
  },
  bank_proof: {
    id: 'bank_proof',
    label: 'Proof of Bank Account',
    description: 'Official bank confirmation letter or bank-stamped account confirmation not older than 3 months.',
    acceptedFormats: ['.pdf', '.jpg', '.png']
  },
  vat_cert: {
    id: 'vat_cert',
    label: 'VAT Certificate',
    description: 'SARS VAT registration certificate (if applicable).',
    acceptedFormats: ['.pdf', '.jpg', '.png']
  },
  id_document: {
    id: 'id_document',
    label: 'ID Document',
    description: 'South African ID book/card or Passport.',
    acceptedFormats: ['.pdf', '.jpg', '.png']
  },
  tour_guide_permit: {
    id: 'tour_guide_permit',
    label: 'Tour Guide Permit',
    description: 'Valid CATHSSETA Tour Guide badge/card.',
    acceptedFormats: ['.pdf', '.jpg', '.png']
  },
  first_aid: {
    id: 'first_aid',
    label: 'First Aid Certificate',
    description: 'Valid Level 1 or higher First Aid certificate.',
    acceptedFormats: ['.pdf', '.jpg', '.png']
  },
  driver_license: {
    id: 'driver_license',
    label: 'Driver License',
    description: 'Valid South African driver\'s license.',
    acceptedFormats: ['.pdf', '.jpg', '.png']
  },
  pdp_license: {
    id: 'pdp_license',
    label: 'PrDP',
    description: 'Professional Driving Permit.',
    acceptedFormats: ['.pdf', '.jpg', '.png']
  },
  vehicle_reg: {
    id: 'vehicle_reg',
    label: 'Vehicle Registration',
    description: 'Upload the vehicle registration certificate, RC1 document, or valid licence disc.',
    acceptedFormats: ['.pdf', '.jpg', '.png']
  },
  operating_license: {
    id: 'operating_license',
    label: 'Operating License',
    description: 'Valid business operating license or registration certificate.',
    acceptedFormats: ['.pdf', '.jpg', '.png']
  },
  insurance_cert: {
    id: 'insurance_cert',
    label: 'Insurance Certificate',
    description: 'Proof of insurance coverage.',
    acceptedFormats: ['.pdf', '.jpg', '.png']
  }
};

export const ROLE_REQUIREMENTS: Record<UserRole, RoleRequirement[]> = {
  operator: [
    { docId: 'business_reg', required: true },
    { docId: 'bank_proof', required: true },
    { docId: 'insurance_cert', required: true, requiresExpiry: true }, // Liability Insurance
    { docId: 'vat_cert', required: false }
  ],
  guide: [
    { docId: 'id_document', required: true },
    { docId: 'tour_guide_permit', required: true, requiresExpiry: true }, 
    { docId: 'pdp_license', required: false, requiresExpiry: true }, // Optional PrDP
    { docId: 'vat_cert', required: false },
    { docId: 'bank_proof', required: false }
  ],
  driver: [
    { docId: 'id_document', required: true },
    { docId: 'driver_license', required: true, requiresExpiry: true },
    { docId: 'pdp_license', required: true, requiresExpiry: true },
    { docId: 'vat_cert', required: false },
    { docId: 'bank_proof', required: false }
  ],
  vehicle_owner: [
    { docId: 'vehicle_reg', required: true },
    { docId: 'insurance_cert', required: true, requiresExpiry: true },
    { docId: 'operating_license', required: true, requiresExpiry: true },
    { docId: 'vat_cert', required: false },
    { docId: 'bank_proof', required: false }
  ],
  admin: []
};

export const getRequirementsForRole = (role: UserRole): RoleRequirement[] => {
  return ROLE_REQUIREMENTS[role] || [];
};

/**
 * Maps a resource type to its required compliance documents.
 * For vehicles, it uses the 'vehicle_owner' role requirements.
 */
export const getRequirementsForResource = (type: string): RoleRequirement[] => {
  if (type === 'vehicle') return ROLE_REQUIREMENTS['vehicle_owner'];
  return ROLE_REQUIREMENTS[type as UserRole] || [];
};

/**
 * Computes the derived status of a document based on its DB status and expiry rules.
 */
export const computeDerivedStatus = (doc: Document | undefined, requiresExpiry: boolean = false): DocumentDisplayStatus | 'missing' => {
  if (!doc) return 'missing';
  
  if (doc.status === 'rejected') return 'rejected';
  if (doc.status === 'pending') return 'pending';
  
  // Status is valid/approved
  if (doc.status === 'valid') {
    if (requiresExpiry && doc.expiry_date) {
      const now = new Date();
      now.setHours(0,0,0,0);
      const exp = new Date(doc.expiry_date);
      exp.setHours(0,0,0,0);
      
      const diffTime = exp.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays < 0) return 'expired';
      if (diffDays <= EXPIRING_SOON_DAYS) return 'expiring_soon';
    }
    return 'valid';
  }
  
  return 'pending';
};

// Legacy wrapper for simple valid checks, defaulting to false for expiry requirement
export const getDocumentDisplayStatus = (doc: Document): DocumentDisplayStatus => {
  const status = computeDerivedStatus(doc, false); // Default no expiry check if not specified
  return status === 'missing' ? 'pending' : status;
};

/**
 * Calculates overall compliance summary for a user based on their docs and role requirements.
 */
export const checkComplianceSummary = (
  role: UserRole, 
  uploadedDocs: Record<string, Document>
): ComplianceSummary => {
  const requirements = getRequirementsForRole(role);
  // Filter for ONLY required docs for the strict counts
  const requiredReqs = requirements.filter(r => r.required);
  
  let missingCount = 0;
  let expiredCount = 0;
  let expiringSoonCount = 0;
  let pendingReviewCount = 0;
  let rejectedCount = 0;

  // We only count blocking issues against REQUIRED documents
  requiredReqs.forEach(req => {
    const doc = uploadedDocs[req.docId];
    const status = computeDerivedStatus(doc, req.requiresExpiry);
    
    if (status === 'missing') {
      missingCount++;
    } else if (status === 'pending') {
      pendingReviewCount++;
    } else if (status === 'rejected') {
      rejectedCount++;
    } else if (status === 'expired') {
      expiredCount++;
    } else if (status === 'expiring_soon') {
      expiringSoonCount++;
    }
  });

  return {
    isCompliant: missingCount === 0 && expiredCount === 0 && pendingReviewCount === 0 && rejectedCount === 0,
    missingCount,
    expiredCount,
    expiringSoonCount,
    pendingReviewCount,
    rejectedCount,
    totalRequired: requiredReqs.length
  };
};
