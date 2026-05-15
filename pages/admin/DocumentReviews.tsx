
import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { getAllDocumentsAdmin, reviewDocument } from '../../lib/documentService';
import { useAuth } from '../../contexts/AuthContext';
import { CheckCircle2, XCircle, Eye, FileText, Filter, Loader2, AlertCircle, Check, ArrowUpDown, Calendar } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Document } from '../../types';
import { getRequirementsForRole, computeDerivedStatus } from '../../lib/complianceRequirements';

// Custom Modal for Approval with optional Expiry
const ApproveModal = ({ 
  isOpen, onClose, onConfirm, doc, isProcessing 
}: { 
  isOpen: boolean; onClose: () => void; onConfirm: (date?: string) => void; doc: Document | null; isProcessing: boolean;
}) => {
  const [expiryDate, setExpiryDate] = useState('');
  
  if (!isOpen || !doc) return null;

  // Determine if this doc type needs expiry for this specific user role
  const userRole = doc.role as any; // Cast to known UserRole type if needed
  const requirements = getRequirementsForRole(userRole);
  
  // Find the specific requirement config for this document type
  const requirement = requirements.find(r => r.docId === doc.document_type);
  const requiresExpiry = requirement ? requirement.requiresExpiry : false;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in zoom-in duration-200">
      <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
        <h3 className="text-lg font-bold text-green-700 flex items-center gap-2 mb-2">
          <CheckCircle2 size={24} /> Approve Document
        </h3>
        <p className="text-sm text-gray-500 mb-6">
          Are you sure you want to mark this document as valid?
        </p>

        {requiresExpiry && (
          <div className="mb-6">
            <label className="block text-sm font-bold text-gray-700 mb-1">Expiry Date <span className="text-red-500">*</span></label>
            <input 
              type="date" 
              className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-brand-teal focus:border-transparent outline-none"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
            />
            <p className="text-xs text-gray-400 mt-1">This document type requires an expiry date for {userRole}s.</p>
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-gray-600 font-bold hover:bg-gray-100 rounded-lg transition-colors"
            disabled={isProcessing}
          >
            Cancel
          </button>
          <button 
            onClick={() => onConfirm(expiryDate)}
            disabled={isProcessing || (requiresExpiry && !expiryDate)}
            className="px-4 py-2 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2 transition-colors"
          >
            {isProcessing && <Loader2 size={16} className="animate-spin" />}
            Confirm Approval
          </button>
        </div>
      </div>
    </div>
  );
};

export const DocumentReviews: React.FC = () => {
  const { user } = useAuth();
  const [docs, setDocs] = useState<any[]>([]); 
  const [loading, setLoading] = useState(true);
  
  // Filter State
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('pending'); // Default to pending
  
  // Sort State
  const [sortBy, setSortBy] = useState<'created_at' | 'expiry_date'>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Action State
  const [actionDocId, setActionDocId] = useState<string | null>(null); // For Reject
  const [approveDoc, setApproveDoc] = useState<Document | null>(null); // For Approve
  const [rejectReason, setRejectReason] = useState('');
  
  const [processing, setProcessing] = useState(false);
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{type: 'success'|'error', text: string} | null>(null);
  const [limit, setLimit] = useState(100);

  useEffect(() => {
    setLimit(100);
  }, [statusFilter, roleFilter]);

  useEffect(() => {
    loadDocs();
  }, [limit, statusFilter, roleFilter]);

  const loadDocs = async () => {
    setLoading(true);
    try {
      const data = await getAllDocumentsAdmin({
        limit,
        status: statusFilter === 'expiring_soon' || statusFilter === 'expired' ? undefined : (statusFilter !== 'all' ? statusFilter : undefined),
        role: roleFilter
      });
      setDocs(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handlePreview = async (docId: string, filePath: string) => {
    console.log('Document preview request:', { bucket: 'provider-documents', path: filePath }); // Temporary QA console log
    if (!filePath) {
      setMessage({ type: 'error', text: "Document file path is missing. Please re-upload the document." });
      return;
    }

    setPreviewingId(docId);
    setMessage(null);
    try {
      const { data, error } = await supabase.functions.invoke('get-document-signed-url', {
        body: { 
          bucket: 'provider-documents',
          path: filePath,
          expiresIn: 3600
        }
      });

      if (error) throw error;
      if (!data?.signedUrl) throw new Error("Could not generate URL from any bucket.");

      window.open(data.signedUrl, '_blank');
    } catch (err: any) {
      console.error(err);
      setMessage({ type: 'error', text: "Could not open this document. Please try again." });
    } finally {
      setPreviewingId(null);
    }
  };

  const handleApprove = async (expiryDate?: string) => {
    if (!user || !approveDoc) return;
    
    setProcessing(true);
    setMessage(null);
    try {
      await reviewDocument(approveDoc.id, user.id, 'valid', undefined, expiryDate);
      
      // Update local state
      setDocs(prev => prev.map(d => d.id === approveDoc.id ? { 
        ...d, 
        status: 'valid', 
        expiry_date: expiryDate || null,
        reviewed_at: new Date().toISOString()
      } : d));

      setMessage({ type: 'success', text: "Document approved successfully" });
      setApproveDoc(null);
    } catch (err: any) {
      setMessage({ type: 'error', text: "Approval Failed: " + err.message });
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!user || !actionDocId || !rejectReason.trim()) return;
    
    setProcessing(true);
    try {
      await reviewDocument(actionDocId, user.id, 'rejected', rejectReason);
      
      setDocs(prev => prev.map(d => d.id === actionDocId ? { 
        ...d, 
        status: 'rejected',
        rejection_reason: rejectReason,
        reviewed_at: new Date().toISOString()
      } : d));
      
      setActionDocId(null);
      setRejectReason('');
      setMessage({ type: 'success', text: "Document rejected successfully" });
    } catch (err: any) {
      setMessage({ type: 'error', text: "Reject Failed: " + err.message });
    } finally {
      setProcessing(false);
    }
  };

  // Filter & Sort Logic
  const filteredDocs = docs.filter(doc => {
    const roleMatch = roleFilter === 'all' || doc.role === roleFilter;
    if (!roleMatch) return false;

    // Use computed status for filtering so admin sees expired docs correctly
    // We need to look up if expiry is required for this specific doc
    const userRole = doc.role as any;
    const requirements = getRequirementsForRole(userRole);
    const requirement = requirements.find(r => r.docId === doc.document_type);
    const requiresExpiry = requirement ? requirement.requiresExpiry : false;
    
    const displayStatus = computeDerivedStatus(doc, requiresExpiry);
    
    if (statusFilter === 'all') return true;
    return displayStatus === statusFilter;
  }).sort((a, b) => {
    const valA = a[sortBy];
    const valB = b[sortBy];
    
    if (!valA) return 1;
    if (!valB) return -1;

    if (sortOrder === 'asc') return valA > valB ? 1 : -1;
    return valA < valB ? 1 : -1;
  });

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-brand-charcoal flex items-center gap-3">
          <FileText className="text-brand-teal" size={32} />
          Document Reviews
        </h1>
        <p className="text-gray-500 mt-2">
          Review pending documents and manage compliance expiry.
        </p>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-xl flex items-center gap-2 border ${
          message.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'
        }`}>
          {message.type === 'success' ? <Check size={20} /> : <AlertCircle size={20} />}
          <span className="font-bold">{message.text}</span>
        </div>
      )}

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm mb-6 flex flex-wrap gap-4 items-center justify-between">
        <div className="flex gap-4">
          <div className="relative">
            <Filter className="absolute left-3 top-2.5 text-gray-400" size={16} />
            <select 
              className="pl-9 pr-8 py-2 border border-gray-200 rounded-lg bg-white text-sm focus:outline-none focus:border-brand-teal cursor-pointer hover:bg-gray-50"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending Review</option>
              <option value="valid">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="expiring_soon">Expiring Soon</option>
              <option value="expired">Expired</option>
            </select>
          </div>

          <select 
            className="px-4 py-2 border border-gray-200 rounded-lg bg-white text-sm focus:outline-none focus:border-brand-teal cursor-pointer hover:bg-gray-50"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <option value="all">All Roles</option>
            <option value="operator">Operators</option>
            <option value="guide">Guides</option>
            <option value="driver">Drivers</option>
            <option value="vehicle_owner">Vehicle Owners</option>
          </select>
        </div>

        <div className="flex gap-2 items-center text-sm text-gray-500">
          <span className="font-bold">Sort by:</span>
          <button 
            onClick={() => { setSortBy('created_at'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); }}
            className={`px-3 py-1 rounded border flex items-center gap-1 ${sortBy === 'created_at' ? 'bg-brand-charcoal text-white' : 'bg-white hover:bg-gray-50'}`}
          >
            Uploaded {sortBy === 'created_at' && <ArrowUpDown size={12} />}
          </button>
          <button 
            onClick={() => { setSortBy('expiry_date'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); }}
            className={`px-3 py-1 rounded border flex items-center gap-1 ${sortBy === 'expiry_date' ? 'bg-brand-charcoal text-white' : 'bg-white hover:bg-gray-50'}`}
          >
            Expiry {sortBy === 'expiry_date' && <ArrowUpDown size={12} />}
          </button>
          <button onClick={loadDocs} className="ml-2 text-brand-teal font-bold hover:underline">Refresh</button>
        </div>
      </div>

      <ApproveModal 
        isOpen={!!approveDoc} 
        doc={approveDoc}
        onClose={() => setApproveDoc(null)} 
        onConfirm={handleApprove}
        isProcessing={processing}
      />

      {/* Reject Modal */}
      {actionDocId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in zoom-in duration-200">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-red-600 flex items-center gap-2 mb-4">
              <AlertCircle size={20} /> Reject Document
            </h3>
            <textarea 
              className="w-full border border-gray-300 rounded-lg p-3 h-32 text-sm mb-4 focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
              placeholder="Reason for rejection (required)..."
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
            />
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => { setActionDocId(null); setRejectReason(''); }}
                className="px-4 py-2 text-gray-600 font-bold hover:bg-gray-100 rounded-lg transition-colors"
                disabled={processing}
              >
                Cancel
              </button>
              <button 
                onClick={handleReject}
                disabled={processing || !rejectReason.trim()}
                className="px-4 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2 transition-colors"
              >
                {processing && <Loader2 size={16} className="animate-spin" />}
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-24 text-center">
            <Loader2 className="animate-spin mx-auto text-brand-teal mb-4" size={32} />
            <p className="text-gray-500 font-medium font-mono text-sm uppercase tracking-widest">Scanning Document Vault...</p>
          </div>
        ) : filteredDocs.length === 0 ? (
          <div className="p-24 text-center">
            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-300">
              <FileText size={40} className="opacity-30" />
            </div>
            <h3 className="text-lg font-bold text-brand-charcoal mb-1">Queue Clear</h3>
            <p className="text-gray-500 max-w-xs mx-auto">No documents currently match your review criteria.</p>
          </div>
        ) : (
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase">
              <tr>
                <th className="px-6 py-4">Uploaded</th>
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Document Type</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Expiry</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredDocs.map(doc => {
                // Determine display status based on role rules
                const userRole = doc.role as any;
                const requirements = getRequirementsForRole(userRole);
                const requirement = requirements.find(r => r.docId === doc.document_type);
                const requiresExpiry = requirement ? requirement.requiresExpiry : false;
                const isRequired = requirement ? requirement.required : false;
                
                const displayStatus = computeDerivedStatus(doc, requiresExpiry);
                
                return (
                  <tr key={doc.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(doc.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <Link to={`/admin/verification/${doc.user_id}`} className="block group">
                        <div className="font-bold text-brand-charcoal group-hover:text-brand-teal transition-colors underline-offset-2 group-hover:underline">                
                          {doc.profiles?.full_name || doc.profiles?.company_name || 'Unknown'}
                        </div>
                        {doc.profiles?.email && (
                          <div className="text-xs text-gray-500 truncate max-w-[200px]">{doc.profiles.email}</div>
                        )}
                      </Link>
                      <div className="text-xs text-gray-400 font-mono mt-0.5 capitalize">{doc.role.replace('_', ' ')}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="font-bold text-brand-charcoal text-sm capitalize">{doc.document_type.replace(/_/g, ' ')}</div>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isRequired ? 'bg-brand-coral/10 text-brand-coral' : 'bg-gray-100 text-gray-600'}`}>
                          {isRequired ? 'Required' : 'Optional'}
                        </span>
                      </div>
                      <div className="text-xs text-gray-400">{doc.metadata?.mime_type || 'PDF'}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                        displayStatus === 'valid' ? 'bg-green-100 text-green-700' :
                        displayStatus === 'pending' ? 'bg-amber-100 text-amber-700' :
                        displayStatus === 'rejected' ? 'bg-red-100 text-red-700' :
                        displayStatus === 'expired' ? 'bg-red-100 text-red-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {displayStatus.replace('_', ' ')}
                      </span>
                      {displayStatus === 'rejected' && doc.rejection_reason && (
                        <div className="text-[10px] text-red-600 mt-1 max-w-[150px] truncate" title={doc.rejection_reason}>
                          {doc.rejection_reason}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm font-mono text-gray-600">
                      {doc.expiry_date ? new Date(doc.expiry_date).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => handlePreview(doc.id, doc.file_path || doc.file_url)}
                          disabled={previewingId === doc.id || processing}
                          className="p-2 text-gray-500 hover:text-brand-teal hover:bg-brand-teal/10 rounded-lg transition-colors"
                          title="Preview"
                        >
                          {previewingId === doc.id ? <Loader2 size={18} className="animate-spin text-brand-teal" /> : <Eye size={18} />}
                        </button>
                        <button 
                          onClick={() => setApproveDoc(doc)}
                          disabled={processing}
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          title="Approve / Update"
                        >
                          <CheckCircle2 size={18} />
                        </button>
                        <button 
                          onClick={() => setActionDocId(doc.id)}
                          disabled={processing}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Reject"
                        >
                          <XCircle size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        
        {!loading && docs.length === limit && (
          <div className="p-4 border-t border-gray-100 flex justify-center">
            <button 
              onClick={() => setLimit(prev => prev + 100)}
              className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-brand-charcoal font-medium hover:bg-gray-50 transition-colors"
            >
              Load More
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
