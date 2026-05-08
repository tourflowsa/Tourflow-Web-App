
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { UserProfile, Document, VerificationStatus, DocumentStatus, ComplianceSummary } from '../../types';
import { ArrowLeft, CheckCircle2, XCircle, FileText, Calendar, ExternalLink, Loader2, AlertTriangle, Check, Shield, Star } from 'lucide-react';
import { logAuditEvent } from '../../lib/auditService';
import { ComplianceBadge } from '../../components/common/ComplianceBadge';
import { getProviderReviews, getProviderRatingSummary, Review, RatingSummary } from '../../lib/reviewService';
import { getRequirementsForRole } from '../../lib/complianceRequirements';
import { format } from 'date-fns';

// Internal Confirmation Modal Component
const ConfirmationModal: React.FC<{
  isOpen: boolean;
  title: string;
  body: React.ReactNode;
  confirmLabel: string;
  isDestructive?: boolean;
  isProcessing: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ isOpen, title, body, confirmLabel, isDestructive, isProcessing, onConfirm, onCancel }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden scale-100">
        <div className="p-6">
          <div className={`flex items-center gap-3 mb-4 ${isDestructive ? 'text-red-600' : 'text-brand-charcoal'}`}>
            {isDestructive ? <AlertTriangle size={24} /> : <CheckCircle2 size={24} className="text-green-600" />}
            <h3 className="text-lg font-bold">{title}</h3>
          </div>
          
          <div className="text-gray-600 text-sm mb-6 leading-relaxed">
            {body}
          </div>
          
          <div className="flex gap-3 justify-end pt-2">
            <button 
              onClick={onCancel}
              disabled={isProcessing}
              className="px-4 py-2 text-gray-600 font-bold hover:bg-gray-100 rounded-lg transition-colors text-sm"
            >
              Cancel
            </button>
            <button 
              onClick={onConfirm}
              disabled={isProcessing}
              className={`px-6 py-2 text-white font-bold rounded-lg transition-colors flex items-center gap-2 text-sm shadow-sm ${
                isDestructive 
                  ? 'bg-red-600 hover:bg-red-700' 
                  : 'bg-green-600 hover:bg-green-700'
              }`}
            >
              {isProcessing && <Loader2 size={16} className="animate-spin" />}
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const UserDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [ratingSummary, setRatingSummary] = useState<RatingSummary>({ average_rating: 0, total_reviews: 0 });
  const [loading, setLoading] = useState(true);
  const [loadingReviews, setLoadingReviews] = useState(false);
  
  // Feedback State
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Compliance State
  const [complianceSummary, setComplianceSummary] = useState<ComplianceSummary | null>(null);
  const [isComplianceLoaded, setIsComplianceLoaded] = useState(false);
  const requirementsForRole = profile ? getRequirementsForRole(profile.role) : [];

  // Modal State
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    action: 'approve' | 'reject' | null;
  }>({ isOpen: false, action: null });
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    fetchDetails();
  }, [id]);

  const fetchDetails = async () => {
    if (!id) return;
    setLoading(true);
    const { data: pData } = await supabase.from('profiles').select('*').eq('id', id).single();
    const { data: dData } = await supabase.from('documents').select('*').eq('user_id', id);
    
    setProfile(pData as UserProfile);
    setDocuments(dData as Document[] || []);
    
    if (pData?.id && (pData.role === 'driver' || pData.role === 'guide' || pData.role === 'vehicle_owner')) {
      loadReviews(pData.id);
    }
    
    setLoading(false);
  };

  const loadReviews = async (userId: string) => {
    setLoadingReviews(true);
    try {
      const [rData, sData] = await Promise.all([
        getProviderReviews(userId),
        getProviderRatingSummary(userId)
      ]);
      setReviews(rData);
      setRatingSummary(sData);
    } catch (e) {
      console.error("Failed to load reviews:", e);
    } finally {
      setLoadingReviews(false);
    }
  };

  const handleOpenModal = (action: 'approve' | 'reject') => {
    setModalState({ isOpen: true, action });
    setSuccessMessage(null);
    setErrorMessage(null);
  };

  const handleConfirmAction = async () => {
    if (!id || !profile || !modalState.action) return;
    
    setIsProcessing(true);
    const newStatus: VerificationStatus = modalState.action === 'approve' ? 'verified' : 'rejected';

    try {
      // 1. Update Profile
      const { error } = await supabase
        .from('profiles')
        .update({ verification_status: newStatus })
        .eq('id', id);

      if (error) throw error;

      // 2. Audit Log
      await logAuditEvent({
        action: newStatus === 'verified' ? 'USER_VERIFICATION_APPROVED' : 'USER_VERIFICATION_REJECTED',
        entityType: 'Profile',
        entityId: id,
        metadata: { 
          previous_status: profile.verification_status, 
          new_status: newStatus,
          target_role: profile.role, 
          target_email: profile.email
        }
      });

      // 3. Success & Cleanup
      await fetchDetails();
      setSuccessMessage(newStatus === 'verified' ? 'User successfully verified.' : 'User verification rejected.');
      setModalState({ isOpen: false, action: null });
    } catch (err: any) {
      console.error("Failed to update user status:", err);
      setErrorMessage(err.message || "An error occurred while updating the user.");
      setModalState({ isOpen: false, action: null });
    } finally {
      setIsProcessing(false);
    }
  };

  const updateDocStatus = async (docId: string, status: DocumentStatus) => {
    await supabase.from('documents').update({ status }).eq('id', docId);
    
    await logAuditEvent({
      action: `DOCUMENT_${status.toUpperCase()}`,
      entityType: 'Document',
      entityId: docId,
      metadata: { userId: id }
    });

    fetchDetails();
  };

  if (loading) return <div className="p-12 text-center text-gray-400">Loading details...</div>;
  if (!profile) return <div className="p-12 text-center text-gray-400">User not found</div>;

  return (
    <div>
      {/* Confirmation Dialog */}
      <ConfirmationModal 
        isOpen={modalState.isOpen}
        isProcessing={isProcessing}
        title={modalState.action === 'approve' ? 'Approve User Verification' : 'Reject User Verification'}
        isDestructive={modalState.action === 'reject'}
        confirmLabel={modalState.action === 'approve' ? 'Approve User' : 'Reject User'}
        onCancel={() => setModalState({ isOpen: false, action: null })}
        onConfirm={handleConfirmAction}
        body={
          modalState.action === 'approve' ? (
            <div className="space-y-4">
              <p>
                Are you sure you want to approve <strong>{profile.full_name || profile.email}</strong>? 
                <br/>
                This will grant them full access to the platform as a <strong>{profile.role}</strong>.
              </p>
              
              {!isComplianceLoaded ? (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2 text-amber-800">
                  <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                  <p className="text-xs leading-relaxed font-medium">Document compliance could not be confirmed yet. Verify the profile only if you have reviewed the required documents.</p>
                </div>
              ) : (complianceSummary && !complianceSummary.isCompliant) ? (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2 text-amber-800">
                  <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                  <p className="text-xs leading-relaxed font-medium">This profile can be verified, but required documents are still incomplete. The provider will remain blocked from assignments until document compliance is complete.</p>
                </div>
              ) : null}
            </div>
          ) : (
            <p>
              Are you sure you want to reject <strong>{profile.full_name || profile.email}</strong>?
              <br/>
              They will be notified and required to resubmit their details.
            </p>
          )
        }
      />

      <button onClick={() => navigate('/admin/verification')} className="flex items-center gap-2 text-gray-500 hover:text-brand-charcoal mb-6 font-bold text-sm transition-colors">
        <ArrowLeft size={16} /> Back to List
      </button>

      {successMessage && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700 animate-in fade-in slide-in-from-top-2">
          <Check size={20} />
          <span className="font-bold">{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 animate-in fade-in slide-in-from-top-2">
          <AlertTriangle size={20} />
          <span className="font-bold">{errorMessage}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Profile Card */}
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm h-fit">
          <div className="text-center mb-6">
            <div className="w-20 h-20 bg-gray-200 rounded-full mx-auto mb-4 flex items-center justify-center text-2xl font-bold text-gray-500">
              {profile.full_name?.charAt(0) || profile.email.charAt(0)}
            </div>
            <h1 className="text-xl font-bold text-brand-charcoal">{profile.full_name || 'Unnamed User'}</h1>
            <p className="text-brand-charcoal/60 text-sm mt-1">{profile.email}</p>
            <div className="mt-4 flex flex-col items-center">
               <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border ${
                 profile.verification_status === 'verified' ? 'bg-green-100 text-green-700 border-green-200' :
                 profile.verification_status === 'pending' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                 profile.verification_status === 'rejected' ? 'bg-red-100 text-red-700 border-red-200' :
                 'bg-gray-100 text-gray-500 border-gray-200'
               }`}>
                 {profile.verification_status}
               </span>
               <div className="mt-2">
                 <ComplianceBadge 
                   userId={profile.id} 
                   role={profile.role} 
                   onStatusLoad={(s) => {
                     setComplianceSummary(s);
                     setIsComplianceLoaded(true);
                   }}
                 />
               </div>
            </div>
            
            <p className="text-[10px] text-gray-400 mt-4 leading-relaxed max-w-[220px] mx-auto">
              Profile verification confirms the account has been reviewed. Document compliance is checked separately and may still block assignments.
            </p>
          </div>

          <div className="space-y-4 border-t border-gray-100 pt-4 text-sm">
            <div>
              <span className="block text-xs text-gray-400 uppercase font-bold mb-1">Role</span>
              <span className="font-medium capitalize bg-gray-50 px-2 py-1 rounded text-brand-charcoal">
                {profile.role.replace('_', ' ')}
              </span>
            </div>
            <div>
              <span className="block text-xs text-gray-400 uppercase font-bold mb-1">Company</span>
              <span className="font-medium text-brand-charcoal">{profile.company_name || 'N/A'}</span>
            </div>
            <div>
              <span className="block text-xs text-gray-400 uppercase font-bold mb-1">Phone</span>
              <span className="font-medium text-brand-charcoal">{profile.phone || 'N/A'}</span>
            </div>
            <div>
              <span className="block text-xs text-gray-400 uppercase font-bold mb-1">Joined</span>
              <span className="font-medium text-brand-charcoal">{new Date(profile.created_at).toLocaleDateString()}</span>
            </div>
            {profile.vat_registered && (
              <div className="pt-2 border-t border-gray-100">
                <span className="block text-xs text-brand-teal uppercase font-bold mb-1">VAT Registered</span>
                <span className="font-bold text-brand-charcoal font-mono text-xs">
                  {profile.vat_number || 'No VAT Number'}
                </span>
                {profile.vat_rate && (
                  <span className="ml-2 text-xs text-gray-400">({profile.vat_rate}%)</span>
                )}
              </div>
            )}
          </div>

          <div className="mt-8 space-y-3">
            {profile.verification_status !== 'verified' && (
              <button 
                onClick={() => handleOpenModal('approve')}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors shadow-sm"
              >
                <CheckCircle2 size={18} /> Approve User
              </button>
            )}
            
            {profile.verification_status !== 'rejected' && (
              <button 
                onClick={() => handleOpenModal('reject')}
                className="w-full bg-white border border-gray-300 hover:bg-red-50 hover:border-red-200 hover:text-red-600 text-gray-700 font-bold py-2.5 rounded-lg flex items-center justify-center gap-2 transition-all"
              >
                <XCircle size={18} /> Reject User
              </button>
            )}
          </div>
        </div>

        {/* Documents List */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
             <div className="p-6 border-b border-gray-100 flex justify-between items-center">
               <h2 className="font-bold text-lg text-brand-charcoal">Compliance Documents</h2>
               <span className="text-xs font-bold bg-gray-100 text-gray-600 px-2 py-1 rounded-full">{documents.length} Files</span>
             </div>
             
             {documents.length === 0 ? (
               <div className="p-12 text-center">
                 <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                   <FileText className="text-gray-300" size={32} />
                 </div>
                 <p className="text-gray-500 font-medium">No documents uploaded yet.</p>
               </div>
             ) : (
               <div className="divide-y divide-gray-100">
                 {documents.map(doc => {
                   const requirement = requirementsForRole.find(r => r.docId === doc.document_type);
                   const isRequired = requirement ? requirement.required : false;
                   
                   return (
                     <div key={doc.id} className="p-6 flex flex-col gap-4 hover:bg-gray-50/50 transition-colors">
                       <div className="flex items-start justify-between">
                         <div className="flex items-center gap-4">
                           <div className="p-3 bg-brand-teal/5 text-brand-teal rounded-lg">
                             <FileText size={24} />
                           </div>
                           <div>
                             <p className="font-bold text-brand-charcoal capitalize text-sm">
                               {doc.document_type.replace(/_/g, ' ')}
                               <span className={`ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded ${isRequired ? 'bg-brand-coral/10 text-brand-coral' : 'bg-gray-100 text-gray-600'}`}>
                                 {isRequired ? 'Required' : 'Optional'}
                               </span>
                             </p>
                             <p className="text-xs text-gray-500 mt-0.5">
                               Uploaded: {new Date(doc.created_at).toLocaleDateString()}
                             </p>
                           </div>
                         </div>
                         <div className="flex gap-2">
                           {doc.status !== 'valid' && (
                             <button onClick={() => updateDocStatus(doc.id, 'valid')} className="p-2 text-green-600 hover:bg-green-100 rounded-lg transition-colors" title="Mark Valid">
                               <CheckCircle2 size={20} />
                             </button>
                           )}
                           {doc.status !== 'rejected' && (
                             <button onClick={() => updateDocStatus(doc.id, 'rejected')} className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors" title="Reject">
                               <XCircle size={20} />
                             </button>
                           )}
                         </div>
                       </div>
 
                       <div className="flex items-center gap-4 text-sm pl-[60px]">
                          <div className={`px-2 py-0.5 rounded text-xs font-bold uppercase border ${
                            doc.status === 'valid' ? 'bg-green-50 text-green-700 border-green-100' :
                            doc.status === 'rejected' ? 'bg-red-50 text-red-700 border-red-100' :
                            'bg-amber-50 text-amber-700 border-amber-100'
                          }`}>
                            {doc.status}
                          </div>
                          {doc.expiry_date && (
                            <div className="flex items-center gap-1 text-gray-500 text-xs">
                              <Calendar size={14} />
                              Expires: {doc.expiry_date}
                            </div>
                          )}
                          <a href="#" onClick={(e) => e.preventDefault()} className="flex items-center gap-1 text-brand-teal hover:underline font-bold ml-auto text-xs">
                            <ExternalLink size={14} /> View File
                          </a>
                       </div>
                     </div>
                   );
                 })}
               </div>
             )}
          </div>

          {(profile.role === 'driver' || profile.role === 'guide' || profile.role === 'vehicle_owner') && (
            <div className="mt-8 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                <h2 className="font-bold text-lg text-brand-charcoal flex items-center gap-2">
                  <Star size={20} className="text-amber-500 fill-amber-500" />
                  Provider Reviews
                </h2>
                {ratingSummary.total_reviews > 0 && (
                  <div className="flex items-center gap-3">
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star 
                          key={s} 
                          size={14} 
                          className={s <= Math.round(ratingSummary.average_rating) ? "fill-amber-500 text-amber-500" : "text-gray-200"} 
                        />
                      ))}
                    </div>
                    <span className="text-sm font-bold text-brand-charcoal">{ratingSummary.average_rating.toFixed(1)}</span>
                    <span className="text-xs text-gray-400">({ratingSummary.total_reviews} reviews)</span>
                  </div>
                )}
              </div>

              {loadingReviews ? (
                <div className="p-12 text-center text-gray-400 italic">
                  <Loader2 size={24} className="animate-spin mx-auto mb-2" />
                  Loading reviews...
                </div>
              ) : reviews.length === 0 ? (
                <div className="p-16 text-center text-gray-400 italic">
                  <Star size={40} className="mx-auto mb-4 text-gray-200" />
                  No reviews submitted for this provider yet.
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {reviews.map((review) => (
                    <div key={review.id} className="p-6 hover:bg-gray-50/50 transition-colors">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <div className="flex gap-0.5">
                              {[1, 2, 3, 4, 5].map((s) => (
                                <Star 
                                  key={s} 
                                  size={10} 
                                  className={s <= review.rating ? "fill-amber-500 text-amber-500" : "text-gray-200"} 
                                />
                              ))}
                            </div>
                            <span className="text-xs font-bold text-brand-charcoal">
                              {review.operator?.company_name || review.operator?.full_name || 'Tour Operator'}
                            </span>
                          </div>
                          <p className="text-[10px] text-gray-400">
                            Booking: <span className="font-mono bg-gray-100 px-1 py-0.5 rounded ml-1">{review.bookings?.booking_reference || review.booking_id.split('-')[0].toUpperCase()}</span>
                          </p>
                        </div>
                        <span className="text-[10px] text-gray-400 font-medium bg-gray-100 px-2 py-0.5 rounded-full">
                          {format(new Date(review.created_at), 'MMM d, yyyy')}
                        </span>
                      </div>
                      {review.review_text && (
                        <p className="text-sm text-gray-600 leading-relaxed italic border-l-3 border-amber-100 pl-4 mt-3 py-1">
                          "{review.review_text}"
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
