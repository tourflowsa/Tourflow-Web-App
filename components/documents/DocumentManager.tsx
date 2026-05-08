
import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Document, DocumentType, UserRole } from '../../types';
import { getRequirementsForRole, DOCUMENT_DEFINITIONS, checkComplianceSummary, computeDerivedStatus } from '../../lib/complianceRequirements';
import { Upload, FileText, Trash2, Calendar, Loader2, Eye, RefreshCw, AlertCircle, CheckCircle2, Clock, XCircle, ShieldAlert } from 'lucide-react';
import { getLatestDocumentsForUser, uploadDocumentFile, upsertDocumentRecord } from '../../lib/documentService';

interface Props {
  role: UserRole;
  userId: string;
  onUpdate: () => void;
}

export const DocumentManager: React.FC<Props> = ({ role, userId, onUpdate }) => {
  const [documents, setDocuments] = useState<Record<string, Document>>({});
  const [loading, setLoading] = useState(true);

  // Requirements from Compliance Service
  const requiredList = getRequirementsForRole(role);

  useEffect(() => {
    fetchDocuments();
  }, [userId]);

  const fetchDocuments = async () => {
    try {
      const docs = await getLatestDocumentsForUser(userId);
      setDocuments(docs);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const deleteDocument = async (docId: string) => {
    if(!confirm("Are you sure you want to remove this document?")) return;
    await supabase.from('documents').delete().eq('id', docId);
    fetchDocuments();
    onUpdate();
  };

  const handleView = async (path: string) => {
    if (!path) return alert("File path not found.");
    let { data } = await supabase.storage
      .from('provider-documents')
      .createSignedUrl(path, 3600);

    if (!data?.signedUrl) {
       const { data: fallbackData } = await supabase.storage
        .from('compliance-docs')
        .createSignedUrl(path, 3600);
       if (fallbackData?.signedUrl) {
         window.open(fallbackData.signedUrl, '_blank');
         return;
       }
    }

    if (data?.signedUrl) {
      window.open(data.signedUrl, '_blank');
    } else {
      alert("Could not generate preview URL.");
    }
  };

  // Compliance Check
  const compliance = checkComplianceSummary(role, documents);

  if (loading) return <div className="p-4 text-center text-gray-400">Loading documents...</div>;

  return (
    <div className="space-y-6">
      {/* Compliance Banner */}
      {!compliance.isCompliant && (
        <div className={`p-4 rounded-xl border flex items-start gap-3 ${
          compliance.expiredCount > 0 
            ? 'bg-red-50 border-red-200 text-red-800' 
            : 'bg-amber-50 border-amber-200 text-amber-800'
        }`}>
          <ShieldAlert className="shrink-0 mt-0.5" size={20} />
          <div>
            <h4 className="font-bold text-sm">
              {compliance.expiredCount > 0 ? "Action Required: Documents Expired" : "Attention Needed"}
            </h4>
            <p className="text-xs mt-1">
              {compliance.expiredCount > 0 
                ? "You have expired compliance documents. Account access may be restricted."
                : compliance.expiringSoonCount > 0 
                  ? "Some documents are expiring soon. Please prepare renewals."
                  : "You have missing required documents."}
            </p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h3 className="font-bold text-lg text-brand-charcoal">Compliance Documents</h3>
          <p className="text-sm text-gray-500">Upload required documentation to verify your account.</p>
        </div>

        <div className="divide-y divide-gray-100">
          {requiredList.length === 0 ? (
            <div className="p-6 text-center text-gray-400 italic">
              No specific documents required for this role.
            </div>
          ) : (
            requiredList.map((req) => {
              const def = DOCUMENT_DEFINITIONS[req.docId];
              if (!def) return null;

              const doc = documents[req.docId];
              // Pass requiresExpiry to compute status correctly
              const displayStatus = computeDerivedStatus(doc, req.requiresExpiry);
              const isUploaded = !!doc;

              // Status Config
              const statusConfig = {
                valid: { color: 'bg-green-100 text-green-700', icon: <CheckCircle2 size={16}/>, label: 'Approved' },
                pending: { color: 'bg-amber-100 text-amber-700', icon: <Clock size={16}/>, label: 'Pending Review' },
                rejected: { color: 'bg-red-100 text-red-700', icon: <XCircle size={16}/>, label: 'Rejected' },
                expired: { color: 'bg-red-100 text-red-700', icon: <AlertCircle size={16}/>, label: 'Expired' },
                expiring_soon: { color: 'bg-yellow-100 text-yellow-700', icon: <AlertCircle size={16}/>, label: 'Expiring Soon' },
                missing: { color: 'bg-gray-100 text-gray-500', icon: <AlertCircle size={16}/>, label: 'Missing' }
              };
              
              const currentStatus = isUploaded ? statusConfig[displayStatus as keyof typeof statusConfig] : null;

              // Override label for Operator Insurance
              const displayLabel = (role === 'operator' && req.docId === 'insurance_cert') ? 'Liability Insurance' : def.label;

              return (
                <div key={req.docId} className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-4 min-w-0 flex-1">
                    <div className={`p-3 rounded-lg shrink-0 ${currentStatus ? currentStatus.color.split(' ')[0] : 'bg-gray-100 text-gray-400'}`}>
                      <FileText size={24} />
                    </div>
                    <div className="min-w-0 flex-1">
                       <h4 className="font-bold text-brand-charcoal flex flex-wrap items-center gap-2 mb-0.5">
                         <span className="truncate">{displayLabel}</span>
                         {currentStatus && (
                           <span className={`text-[10px] uppercase px-2 py-0.5 rounded-full flex items-center gap-1 font-bold shrink-0 ${currentStatus.color}`}>
                             {currentStatus.icon} {currentStatus.label}
                           </span>
                         )}
                         {req.required && !isUploaded && (
                            <span className="text-[10px] uppercase px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-bold shrink-0">Required</span>
                         )}
                         {!req.required && !isUploaded && (
                            <span className="text-[10px] uppercase px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-bold shrink-0">Optional</span>
                         )}
                       </h4>
                       <p className="text-sm text-gray-500 mb-1 break-words">
                         {isUploaded ? `Uploaded: ${new Date(doc.created_at).toLocaleDateString()}` : def.description}
                       </p>
                       
                       {doc?.expiry_date && (
                         <p className={`text-xs font-medium flex items-center gap-1 ${
                           displayStatus === 'expired' ? 'text-red-600' : 
                           displayStatus === 'expiring_soon' ? 'text-amber-600' : 'text-gray-500'
                         }`}>
                           <Calendar size={12} />
                           Expires: {doc.expiry_date}
                         </p>
                       )}
 
                       {doc?.rejection_reason && displayStatus === 'rejected' && (
                         <p className="text-xs text-red-600 mt-1 bg-red-50 p-2 rounded border border-red-100 break-words">
                           <strong>Reason:</strong> {doc.rejection_reason}
                         </p>
                       )}
                    </div>
                  </div>
 
                  <div className="flex items-center gap-3 shrink-0 flex-none sm:justify-end">
                    {isUploaded ? (
                      <>
                         <button
                           onClick={(e) => { e.preventDefault(); handleView(doc.file_path); }}
                           className="text-sm font-bold text-brand-teal hover:underline flex items-center gap-1"
                         >
                           <Eye size={14} /> View
                         </button>
                         
                         <LabelForUpload reqType={req.docId as DocumentType} role={role} userId={userId} currentDoc={doc} onUpdate={() => { fetchDocuments(); onUpdate(); }} />
                         
                         <button 
                           onClick={() => deleteDocument(doc.id)}
                           className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                           title="Remove document"
                         >
                           <Trash2 size={18} />
                         </button>
                      </>
                    ) : (
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <LabelForUpload reqType={req.docId as DocumentType} role={role} userId={userId} onUpdate={() => { fetchDocuments(); onUpdate(); }} />
                        <div className="text-[10px] text-gray-400 text-right leading-tight">
                           <p>{def.acceptedFormats.join(', ').replace(/\./g, '').toUpperCase()} • Max 10 MB</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

const LabelForUpload = ({ reqType, role, userId, currentDoc, onUpdate }: { reqType: DocumentType, role: UserRole, userId: string, currentDoc?: Document, onUpdate: () => void }) => {
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setUploading(true);
    try {
      const file = e.target.files[0];
      const path = await uploadDocumentFile(userId, role, reqType, file);
      await upsertDocumentRecord(userId, role, reqType, path, {
        originalName: file.name,
        size: file.size,
        mimeType: file.type
      });
      onUpdate();
    } catch (err: any) {
      alert("Upload failed: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <label className="cursor-pointer">
      <input 
        type="file" 
        accept=".pdf,.jpg,.png,.jpeg" 
        className="hidden" 
        onChange={handleUpload}
        disabled={uploading}
      />
      {currentDoc ? (
        <div className="p-2 text-gray-400 hover:text-brand-charcoal transition-colors" title="Replace File">
           {uploading ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
        </div>
      ) : (
        <div className="flex items-center gap-2 bg-brand-charcoal hover:bg-brand-charcoal/90 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors">
          {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
          Upload
        </div>
      )}
    </label>
  );
};
