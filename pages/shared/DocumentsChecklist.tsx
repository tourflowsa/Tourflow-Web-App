
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getRequirementsForRole, DOCUMENT_DEFINITIONS, DocumentTypeId, computeDerivedStatus } from '../../lib/complianceRequirements';
import { getLatestDocumentsForUser, insertDocumentRecord, uploadDocumentFile, openDocument } from '../../lib/documentService';
import { Document } from '../../types';
import { FileText, Shield, AlertCircle, CheckCircle2, Upload, Loader2, XCircle, Clock, Eye, Info } from 'lucide-react';

export const DocumentsChecklist: React.FC = () => {
  const { user, profile } = useAuth();
  const [documents, setDocuments] = useState<Record<string, Document>>({});
  const [loading, setLoading] = useState(true);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!profile || !user) return null;

  const requirements = getRequirementsForRole(profile.role);

  useEffect(() => {
    loadDocs();
  }, [user.id]);

  const loadDocs = async () => {
    try {
      const docs = await getLatestDocumentsForUser(user.id);
      setDocuments(docs);
    } catch (err) {
      console.error("Failed to load docs", err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>, docId: DocumentTypeId) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    const file = e.target.files[0];
    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg("File too large. Max 10MB allowed.");
      return;
    }

    setUploadingId(docId);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      // 1. Upload to bucket
      const path = await uploadDocumentFile(user.id, profile.role, docId, file);
      
      // 2. Insert record
      await insertDocumentRecord(user.id, profile.role, docId, path, {
        originalName: file.name,
        size: file.size,
        mimeType: file.type
      });

      // 3. Refresh
      await loadDocs();
      
      // 4. Show success toast
      setSuccessMsg("Uploaded. Pending review.");
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      console.error(err);
      setErrorMsg("Upload failed: " + err.message);
    } finally {
      setUploadingId(null);
    }
  };

  const getStatusDisplay = (doc?: Document, requiresExpiry: boolean = false) => {
    const status = computeDerivedStatus(doc, requiresExpiry);
    
    switch (status) {
      case 'valid':
        return { label: 'Approved', color: 'bg-green-100 text-green-700', icon: <CheckCircle2 size={16} /> };
      case 'pending':
        return { label: 'Pending Review', color: 'bg-amber-100 text-amber-700', icon: <Clock size={16} /> };
      case 'rejected':
        return { label: 'Rejected', color: 'bg-red-100 text-red-700', icon: <XCircle size={16} /> };
      case 'expired':
        return { label: 'Expired', color: 'bg-red-100 text-red-700', icon: <AlertCircle size={16} /> };
      case 'expiring_soon':
        return { label: 'Expiring Soon', color: 'bg-yellow-100 text-yellow-700', icon: <AlertCircle size={16} /> };
      default:
        return { label: 'Not Uploaded', color: 'bg-gray-100 text-gray-500', icon: <AlertCircle size={16} /> };
    }
  };

  if (loading) return <div className="p-12 text-center text-gray-400">Loading checklist...</div>;

  return (
    <div className="max-w-4xl mx-auto pb-12 relative">
      {/* Toast Notification */}
      {successMsg && (
        <div className="fixed top-4 right-4 z-50 bg-brand-charcoal text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 size={20} className="text-green-400" />
          {successMsg}
        </div>
      )}

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-brand-charcoal flex items-center gap-3">
          <Shield className="text-brand-teal" size={32} />
          Compliance Documents
        </h1>
        <p className="text-gray-500 mt-2">
          Upload required documents for your <strong className="capitalize">{profile.role.replace('_', ' ')}</strong> account.
        </p>
      </div>

      {/* Help Bar */}
      <div className="mb-8 p-4 bg-brand-charcoal text-white rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white/10 rounded-lg text-brand-aqua">
            <Info size={20} />
          </div>
          <p className="text-sm font-medium">Need help with your documents or verification status?</p>
        </div>
        <Link 
          to="/contact?topic=document" 
          className="px-4 py-2 bg-brand-teal hover:bg-brand-teal/90 text-white text-xs font-bold rounded-lg transition-colors whitespace-nowrap"
        >
          Contact Support
        </Link>
      </div>

      {errorMsg && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 flex items-center gap-2">
          <AlertCircle size={20} />
          {errorMsg}
        </div>
      )}

      {requirements.length === 0 ? (
        <div className="p-12 text-center bg-gray-50 rounded-2xl border border-gray-200">
          <p className="text-gray-500">No specific compliance documents required for this role.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {requirements.map((req) => {
            const def = DOCUMENT_DEFINITIONS[req.docId];
            const doc = documents[req.docId];
            const status = getStatusDisplay(doc, req.requiresExpiry);
            
            if (!def) return null;

            // Override label for Operator Insurance
            const displayLabel = (profile.role === 'operator' && req.docId === 'insurance_cert') 
              ? 'Liability Insurance' 
              : def.label;

            return (
              <div key={req.docId} className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col md:flex-row gap-6">
                <div className="flex-1 flex items-start gap-4">
                  <div className={`p-3 rounded-lg ${doc?.status === 'valid' ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                    <FileText size={24} />
                  </div>
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-bold text-brand-charcoal">{displayLabel}</h3>
                      {req.required ? (
                        <span className="text-[10px] font-bold uppercase bg-brand-charcoal text-white px-2 py-0.5 rounded">Required</span>
                      ) : (
                        <span className="text-[10px] font-bold uppercase bg-gray-100 text-gray-500 px-2 py-0.5 rounded">Optional</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">{def.description}</p>
                    <p className="text-xs text-gray-400 mt-1">Accepted: {def.acceptedFormats.join(', ')}</p>
                    
                    {doc?.rejection_reason && doc.status === 'rejected' && (
                      <div className="mt-3 p-3 bg-red-50 text-red-800 text-sm rounded-lg border border-red-100 italic">
                        <div className="flex items-center justify-between gap-2">
                          <span><strong>Rejection Reason:</strong> {doc.rejection_reason}</span>
                          <Link to="/contact?topic=document" className="text-brand-charcoal hover:text-brand-teal underline font-bold shrink-0">Contact Support</Link>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col items-end gap-3 min-w-[180px]">
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold w-full justify-center ${status.color}`}>
                    {status.icon}
                    {status.label}
                  </div>

                  <div className="flex items-center gap-2 w-full">
                    {doc && (
                      <button 
                        onClick={() => openDocument(doc.file_path)}
                        className="p-2 border border-gray-200 rounded-lg text-gray-500 hover:text-brand-teal hover:bg-gray-50 transition-colors"
                        title="View Document"
                      >
                        <Eye size={18} />
                      </button>
                    )}
                    
                    <label className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg font-bold text-sm transition-colors cursor-pointer ${
                      uploadingId === req.docId 
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                        : 'bg-white border border-gray-300 text-brand-charcoal hover:bg-gray-50'
                    }`}>
                      <input 
                        type="file" 
                        className="hidden" 
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => handleFileSelect(e, req.docId)}
                        disabled={!!uploadingId}
                      />
                      {uploadingId === req.docId ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                      {doc ? 'Replace' : 'Upload'}
                    </label>
                  </div>
                  
                  {doc && (
                    <div className="text-xs text-gray-400 flex flex-col items-end gap-1">
                      <span>Uploaded: {new Date(doc.created_at).toLocaleDateString()}</span>
                      {doc.expiry_date && (
                        <span className={`font-bold ${
                          new Date(doc.expiry_date) < new Date() ? 'text-red-500' : 'text-amber-600'
                        }`}>
                          Expires: {new Date(doc.expiry_date).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
