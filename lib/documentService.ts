
import { supabase } from './supabase';
import { Document, DocumentType, DocumentStatus, UserRole, ComplianceSummary } from '../types';
import { logAuditEvent } from './auditService';
import { checkComplianceSummary } from './complianceRequirements';
import { createNotification } from './notificationService';

const BUCKET_NAME = 'provider-documents';

// Mapping from Frontend Types to Database Enum Values
const TO_DB_TYPE: Record<string, string> = {
  'business_reg': 'business_registration',
  'bank_proof': 'proof_of_bank_account',
  'vat_cert': 'vat_certificate',
  'id_document': 'id_document',
  'tour_guide_permit': 'tour_guide_permit',
  'guide_certificate': 'tour_guide_permit',
  'first_aid': 'first_aid_certificate',
  'driver_license': 'driver_license',
  'pdp_license': 'pdp_license',
  'prdp': 'pdp_license',
  'vehicle_reg': 'vehicle_registration',
  'operating_license': 'operating_license',
  'insurance_cert': 'insurance_certificate',
  'vehicle_insurance': 'insurance_certificate',
  'liability_insurance': 'insurance_certificate',
  'other': 'other'
};

// Mapping from Database Enum Values to Frontend Types
const FROM_DB_TYPE: Record<string, string> = {
  'business_registration': 'business_reg',
  'proof_of_bank_account': 'bank_proof',
  'vat_certificate': 'vat_cert',
  'id_document': 'id_document',
  'tour_guide_permit': 'tour_guide_permit',
  'first_aid_certificate': 'first_aid',
  'driver_license': 'driver_license',
  'pdp_license': 'pdp_license',
  'vehicle_registration': 'vehicle_reg',
  'operating_license': 'operating_license',
  'insurance_certificate': 'insurance_cert',
  'other': 'other'
};

/**
 * Normalizes a document type string to a standard snake_case key.
 * Handles common aliases and formatting variations.
 */
export const normalizeDocumentType = (type: string): string => {
  if (!type) return 'other';
  
  // Clean string
  const clean = type.toLowerCase()
    .trim()
    .replace(/[\s\-/]+/g, '_')   // Spaces, hyphens, slashes -> underscores
    .replace(/^the_/, '')        // Remove "the " prefix if exists
    .replace(/_document$/, '')   // Remove document suffix for matching
    .replace(/_certificate$/, '')
    .replace(/_permit$/, '')
    .replace(/_license$/, '');

  // Manual Alias Mapping
  const aliases: Record<string, string> = {
    'id': 'id_document',
    'id_document': 'id_document',
    'south_african_id': 'id_document',
    'passport': 'id_document',
    'driver': 'driver_license',
    'drivers': 'driver_license',
    'driver_license': 'driver_license',
    'driving_license': 'driver_license',
    'prdp': 'pdp_license',
    'pdp': 'pdp_license',
    'pdp_license': 'pdp_license',
    'tour_guide': 'tour_guide_permit',
    'guide': 'tour_guide_permit',
    'guide_permit': 'tour_guide_permit',
    'tour_guide_permit': 'tour_guide_permit',
    'guide_certificate': 'tour_guide_permit',
    'first_aid': 'first_aid',
    'business_reg': 'business_reg',
    'business_registration': 'business_reg',
    'bank_proof': 'bank_proof',
    'proof_of_bank': 'bank_proof',
    'vat': 'vat_cert',
    'vat_cert': 'vat_cert',
    'vehicle_reg': 'vehicle_reg',
    'vehicle_registration': 'vehicle_reg',
    'insurance': 'insurance_cert',
    'insurance_cert': 'insurance_cert'
  };

  return aliases[clean] || aliases[type.toLowerCase()] || clean;
};

const toDbEnum = (type: string): string => {
  const norm = normalizeDocumentType(type);
  const feToDb: Record<string, string> = {
    'business_reg': 'business_registration',
    'bank_proof': 'proof_of_bank_account',
    'vat_cert': 'vat_certificate',
    'id_document': 'id_document',
    'tour_guide_permit': 'tour_guide_permit',
    'first_aid': 'first_aid_certificate',
    'driver_license': 'driver_license',
    'pdp_license': 'pdp_license',
    'vehicle_reg': 'vehicle_registration',
    'operating_license': 'operating_license',
    'insurance_cert': 'insurance_certificate',
    'other': 'other'
  };
  return feToDb[norm] || TO_DB_TYPE[type] || type;
};

const fromDbEnum = (type: string): DocumentType => {
  const norm = normalizeDocumentType(type);
  const dbToFe: Record<string, string> = {
    'business_registration': 'business_reg',
    'proof_of_bank_account': 'bank_proof',
    'vat_certificate': 'vat_cert',
    'id_document': 'id_document',
    'tour_guide_permit': 'tour_guide_permit',
    'first_aid_certificate': 'first_aid',
    'driver_license': 'driver_license',
    'pdp_license': 'pdp_license',
    'vehicle_registration': 'vehicle_reg',
    'operating_license': 'operating_license',
    'insurance_certificate': 'insurance_cert',
    'other': 'other'
  };
  return (dbToFe[type] || dbToFe[norm] || FROM_DB_TYPE[type] || type) as DocumentType;
};

export const uploadDocumentFile = async (
  userId: string, 
  role: UserRole, 
  docType: DocumentType, 
  file: File
): Promise<string> => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileExt = file.name.split('.').pop();
  const safeDocType = toDbEnum(docType);
  const path = `${role}/${userId}/${safeDocType}/${timestamp}.${fileExt}`.replace(/\/+/g, '/');

  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(path, file);

  if (error) throw error;
  return path;
};

export const insertDocumentRecord = async (
  userId: string,
  role: UserRole,
  docType: DocumentType,
  filePath: string,
  meta: { originalName: string; size: number; mimeType: string }
) => {
  const dbDocType = toDbEnum(docType);

  const payload = {
    user_id: userId,
    role: role,
    document_type: dbDocType,
    file_path: filePath,
    status: 'pending' as DocumentStatus,
    created_at: new Date().toISOString(),
    metadata: {
      original_name: meta.originalName,
      size: meta.size,
      mime_type: meta.mimeType
    }
  };

  const { data, error } = await supabase
    .from('documents')
    .insert(payload)
    .select()
    .single();

  if (error) throw error;

  const result = { 
    ...data, 
    document_type: fromDbEnum(data.document_type),
    file_path: data.file_path 
  } as Document;

  await logAuditEvent({
    action: 'DOCUMENT_UPLOADED',
    entityType: 'document',
    entityId: data.id,
    metadata: { document_type: dbDocType, role }
  });

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('DOCUMENTS_UPDATED'));
  }

  // Notify Admins
  notifyAdminsOfNewDocument(userId, dbDocType, role).catch(err => console.error('Failed to notify admins of new document:', err));

  return result;
};

export const upsertDocumentRecord = async (
  userId: string,
  role: UserRole,
  docType: DocumentType,
  filePath: string,
  meta: { originalName: string; size: number; mimeType: string }
) => {
  const dbDocType = toDbEnum(docType);

  const { data: existing } = await supabase
    .from('documents')
    .select('id')
    .eq('user_id', userId)
    .eq('document_type', dbDocType)
    .limit(1)
    .maybeSingle();

  const payload = {
    user_id: userId,
    role: role,
    document_type: dbDocType,
    file_path: filePath,
    status: 'pending' as DocumentStatus,
    metadata: {
      original_name: meta.originalName,
      size: meta.size,
      mime_type: meta.mimeType
    }
  };

  let rawResult;
  if (existing) {
    const { data, error } = await supabase
      .from('documents')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
      .select()
      .single();
    if (error) throw error;
    rawResult = data;
  } else {
    const { data, error } = await supabase
      .from('documents')
      .insert({ ...payload, created_at: new Date().toISOString() })
      .select()
      .single();
    if (error) throw error;
    rawResult = data;
  }

  const result = { 
    ...rawResult, 
    document_type: fromDbEnum(rawResult.document_type),
    file_path: rawResult.file_path
  } as Document;

  await logAuditEvent({
    action: existing ? 'DOCUMENT_UPDATED' : 'DOCUMENT_UPLOADED',
    entityType: 'document',
    entityId: result.id,
    metadata: { document_type: dbDocType, role }
  });

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('DOCUMENTS_UPDATED'));
  }

  // Notify Admins
  notifyAdminsOfNewDocument(userId, dbDocType, role).catch(err => console.error('Failed to notify admins of new document:', err));

  return result;
};

async function notifyAdminsOfNewDocument(userId: string, docType: string, role: string) {
  try {
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('full_name, company_name')
      .eq('id', userId)
      .single();

    const userName = userProfile?.company_name || userProfile?.full_name || 'A provider';
    const cleanDocType = docType.replace(/_/g, ' ');

    const { data: admins } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'admin');

    if (admins) {
      for (const admin of admins) {
        createNotification({
          user_id: admin.id,
          type: 'NEW_DOCUMENT_UPLOADED',
          title: 'New Document Uploaded',
          message: `${userName} (${role}) uploaded a new ${cleanDocType}.`,
          link: '/admin/compliance'
        }).catch(err => console.error('Failed to notify admin:', err));
      }
    }
  } catch (err) {
    console.error('Error in notifyAdminsOfNewDocument:', err);
  }
}

export const fetchOperatorDocuments = async (userId: string) => {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data || []).map((doc: any) => ({
    ...doc,
    document_type: fromDbEnum(doc.document_type),
    file_path: doc.file_path || doc.file_url
  })) as Document[];
};

export const getLatestDocumentsForUser = async (userId: string): Promise<Record<string, Document>> => {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  const latestMap: Record<string, Document> = {};
  if (data) {
    for (const rawDoc of data) {
      const feType = fromDbEnum(rawDoc.document_type);
      const doc = { 
        ...rawDoc, 
        document_type: feType,
        file_path: rawDoc.file_path || rawDoc.file_url
      } as Document;
      
      if (!latestMap[feType]) {
        latestMap[feType] = doc;
      }
    }
  }
  return latestMap;
};

export const getLatestDocumentsForReadiness = async (providerId: string): Promise<Record<string, Document>> => {
  const { data, error } = await supabase.rpc(
    'rpc_get_provider_documents_for_readiness',
    { p_provider_id: providerId }
  );

  if (error) throw error;

  const latestMap: Record<string, Document> = {};

  for (const rawDoc of data || []) {
    const feType = fromDbEnum(rawDoc.document_type);
    const doc = {
      ...rawDoc,
      document_type: feType
    } as Document;

    if (!latestMap[feType]) {
      latestMap[feType] = doc;
    }
  }

  return latestMap;
};

export const getLatestDocumentsForAssignmentCheck = async (providerId: string): Promise<Record<string, Document>> => {
  const { data, error } = await supabase.rpc(
    'rpc_get_provider_compliance_for_assignment',
    { p_provider_id: providerId }
  );

  if (error) {
    console.error("Compliance RPC Error:", error);
    throw new Error("Could not verify provider compliance. Please try again.");
  }

  const latestMap: Record<string, Document> = {};

  for (const rawDoc of data || []) {
    const feType = fromDbEnum(rawDoc.document_type);
    const doc = {
      ...rawDoc,
      document_type: feType
    } as Document;

    if (!latestMap[feType]) {
      latestMap[feType] = doc;
    }
  }

  return latestMap;
};

// Fetch compliance summary for ANY user (Admin usage or Provider usage)
export const getComplianceForUser = async (userId: string, role?: UserRole): Promise<ComplianceSummary> => {
  // If role is not provided, fetch profile first
  let userRole = role;
  if (!userRole) {
    const { data } = await supabase.from('profiles').select('role').eq('id', userId).single();
    if (data) userRole = data.role as UserRole;
  }

  if (!userRole) throw new Error("Could not determine user role for compliance check.");

  const docs = await getLatestDocumentsForUser(userId);
  return checkComplianceSummary(userRole, docs);
};

export const getPendingDocumentsAdmin = async (roleFilter?: string, typeFilter?: string) => {
  let query = supabase
    .from('documents')
    .select('*, profiles(full_name, email, company_name)')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (roleFilter && roleFilter !== 'all') {
    query = query.eq('role', roleFilter);
  }
  
  if (typeFilter && typeFilter !== 'all') {
    query = query.eq('document_type', toDbEnum(typeFilter));
  }

  const { data, error } = await query;
  if (error) throw error;
  
  return (data || []).map((doc: any) => ({
    ...doc,
    document_type: fromDbEnum(doc.document_type),
    file_path: doc.file_path || doc.file_url
  })) as (Document & { profiles: { full_name: string; email: string; company_name: string } })[];
};

export const getAllDocumentsAdmin = async () => {
  const { data, error } = await supabase
    .from('documents')
    .select('*, profiles(full_name, email, company_name)')
    .order('created_at', { ascending: false });

  if (error) throw error;
  
  return (data || []).map((doc: any) => ({
    ...doc,
    document_type: fromDbEnum(doc.document_type),
    file_path: doc.file_path || doc.file_url
  })) as (Document & { profiles: { full_name: string; email: string; company_name: string } })[];
};

export const getDocumentSignedUrl = async (path: string) => {
  if (!path) throw new Error("File path is missing");
  
  // Sanitize path: remove leading slashes and prevent double slashes
  const cleanPath = path.replace(/^\/+/, '').replace(/\/+/g, '/');

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(cleanPath, 3600); 

  if (error) throw error;
  return data.signedUrl;
};

export const openDocument = async (path: string) => {
  try {
    const url = await getDocumentSignedUrl(path);
    window.open(url, '_blank');
  } catch (err: any) {
    console.error("Failed to open document:", err);
    alert("Could not open document: " + err.message);
  }
};

export const reviewDocument = async (
  docId: string, 
  adminId: string, 
  status: 'valid' | 'rejected', 
  reason?: string,
  expiryDate?: string
) => {
  const payload: any = {
    status: status,
    reviewed_at: new Date().toISOString(),
    reviewed_by: adminId,
    rejection_reason: status === 'rejected' ? reason : null,
    updated_at: new Date().toISOString()
  };

  if (status === 'valid' && expiryDate) {
    payload.expiry_date = expiryDate;
  }

  const { data, error } = await supabase
    .from('documents')
    .update(payload)
    .eq('id', docId)
    .select()
    .single();

  if (error) throw error;

  const result = { 
    ...data, 
    document_type: fromDbEnum(data.document_type),
    file_path: data.file_path || data.file_url
  } as Document;

  await logAuditEvent({
    action: status === 'valid' ? 'DOCUMENT_APPROVED' : 'DOCUMENT_REJECTED',
    entityType: 'document',
    entityId: docId,
    metadata: { reason, expiryDate }
  });

  // Notify Provider
  if (data?.user_id) {
    const docName = normalizeDocumentType(data.document_type).replace(/_/g, ' ');
    await createNotification({
      user_id: data.user_id,
      type: status === 'valid' ? 'DOCUMENT_APPROVED' : 'DOCUMENT_REJECTED',
      title: status === 'valid' ? 'Document Approved' : 'Document Rejected',
      message: status === 'valid' 
        ? `Your ${docName} document has been approved.`
        : `Your ${docName} document was rejected. Reason: ${reason || 'N/A'}`,
      link: '/compliance' // Assuming there's a compliance page for providers
    }).catch(err => console.error('Failed to notify provider about document review:', err));
  }

  // Notify listeners to refresh counts/badges
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('DOCUMENTS_UPDATED'));
  }

  return result;
};

export const getPendingDocumentsCountAdmin = async (): Promise<number> => {
  const { count, error } = await supabase
    .from('documents')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');

  if (error) throw error;
  return count || 0;
};
