
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getPayoutLedgerByIdAdmin, markPayoutAsPaidAdmin, placePayoutOnHold, releasePayoutHold, createPayoutDispute } from '../../lib/adminPayoutService';
import { Payout, UserRole } from '../../types';
import { formatCurrency, formatDate } from '../../lib/formatUtils';
import { getOriginalAmount, getSettlementAmount } from '../../lib/payoutUtils';
import { ArrowLeft, CheckCircle2, AlertCircle, Building, Wallet, Calendar, FileText, Loader2, Percent, Check, AlertTriangle, Archive, Download, ShieldAlert, Lock, Unlock, X, Clock, User as UserIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../../contexts/AuthContext';
import { generatePayoutStatement } from '../../lib/pdfGenerator';
import { PayoutAuditTimeline } from '../../components/common/PayoutAuditTimeline';
import { supabase } from '../../lib/supabase';
import { checkComplianceGate, ComplianceGateResult } from '../../lib/complianceGate';

export const AdminPayoutDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [payout, setPayout] = useState<Payout | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Compliance State
  const [gateResult, setGateResult] = useState<ComplianceGateResult | null>(null);

  // Action State
  const [processing, setProcessing] = useState(false);
  const [confirmMode, setConfirmMode] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  
  // Audit State
  const [loadingAudit, setLoadingAudit] = useState(false);
  
  // Hold Modal State
  const [holdModalOpen, setHoldModalOpen] = useState(false);
  const [holdReason, setHoldReason] = useState('');
  const [holdError, setHoldError] = useState<string | null>(null);

  useEffect(() => {
    if (id) loadDetail();
  }, [id]);

  const loadDetail = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await getPayoutLedgerByIdAdmin(id);
      setPayout(data);
      
      // Check compliance for the provider linked to this payout
      if (data.provider_id) {
        checkProvider(data.provider_id);
      }
    } catch (err: any) {
      console.error(err);
      setError("Failed to load details. Record might not exist.");
    } finally {
      setLoading(false);
    }
  };

  const checkProvider = async (providerId: string) => {
    try {
      // 1. Fetch provider role (needed for gate)
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', providerId)
        .single();

      if (!profile) return;

      // 2. Check Gate
      const result = await checkComplianceGate({
        action: 'receive_payout',
        actorRole: profile.role as UserRole,
        actorUserId: providerId
      });
      
      setGateResult(result);
    } catch (e) {
      console.error("Compliance Check Failed", e);
    }
  };

  const handleMarkAsPaid = async () => {
    if (!payout || !id) return;
    
    setProcessing(true);
    setSuccessMessage(null);
    setActionError(null);
    try {
      const updated = await markPayoutAsPaidAdmin(id, user?.id || '');
      setPayout(updated); // Update local state
      setSuccessMessage("Payout marked as paid successfully.");
      setConfirmMode(false);
    } catch (err: any) {
      console.error(err);
      setActionError("Failed to update status: " + err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleHold = () => {
    setHoldReason('');
    setHoldError(null);
    setHoldModalOpen(true);
  };

  const confirmHold = async () => {
    if (!payout || !id || !user || !holdReason.trim()) return;

    setProcessing(true);
    setHoldError(null);
    try {
      await placePayoutOnHold(id, user.id, holdReason.trim());
      await loadDetail();
      setSuccessMessage("Payout placed on hold.");
      setHoldModalOpen(false);
    } catch (err: any) {
      console.error(err);
      setHoldError(err.message || "Failed to place hold");
    } finally {
      setProcessing(false);
    }
  };

  const handleReleaseHold = async () => {
    if (!payout || !id) return;
    try {
      setProcessing(true);
      await releasePayoutHold(id, user?.id);
      await loadDetail();
      setSuccessMessage("Payout hold released.");
    } catch (err: any) {
      setActionError("Failed to release hold: " + err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleDownloadPDF = () => {
    if (payout) {
      generatePayoutStatement(payout);
    }
  };

  const getStatusColor = (status: string) => {
    if (payout?.is_on_hold) return 'bg-red-100 text-red-700';
    
    // Prioritize withdrawal request status
    if (payout?.withdrawal_request_status) {
      switch (payout.withdrawal_request_status) {
        case 'requested': return 'bg-blue-100 text-blue-700';
        case 'approved': return 'bg-purple-100 text-purple-700';
        case 'rejected': return 'bg-red-100 text-red-700';
        case 'paid': return 'bg-green-100 text-green-700';
      }
    }

    switch (status) {
      case 'paid': return 'bg-green-100 text-green-700';
      case 'pending': return 'bg-amber-100 text-amber-700';
      default: return 'bg-gray-100 text-gray-500';
    }
  };

  const getStatusLabel = (payout: Payout) => {
    if (payout.is_on_hold) return 'ON HOLD';

    // Prioritize withdrawal request status
    if (payout.withdrawal_request_status) {
      switch (payout.withdrawal_request_status) {
        case 'requested': return 'WITHDRAWAL REQUESTED';
        case 'approved': return 'APPROVED FOR PAYOUT';
        case 'rejected': return 'WITHDRAWAL REJECTED';
        case 'paid': return 'PAID';
      }
    }

    if (payout.status === 'approved') return 'AVAILABLE';
    return payout.status.toUpperCase();
  };

  const calculateFeePercentage = (gross: number, fee: number) => {
    if (!gross || gross === 0) return '0';
    return ((fee / gross) * 100).toFixed(1).replace(/\.0$/, '');
  };

  if (loading) return <div className="p-12 text-center text-gray-400">Loading payout details...</div>;

  if (error || !payout) return (
    <div className="max-w-4xl mx-auto mt-8 p-6 bg-red-50 border border-red-200 rounded-2xl text-center">
      <AlertCircle className="mx-auto text-red-500 mb-2" size={32} />
      <h3 className="text-lg font-bold text-red-800">Error</h3>
      <p className="text-red-600 mb-4">{error}</p>
      <button onClick={() => navigate('/admin/payouts')} className="text-brand-teal hover:underline font-bold">Back to List</button>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto pb-12">
      <div className="mb-6 flex justify-between items-center">
        <button onClick={() => navigate('/admin/payouts')} className="flex items-center gap-2 text-gray-500 hover:text-brand-charcoal font-bold text-sm transition-colors">
          <ArrowLeft size={16} /> Back to Payout List
        </button>
        <div className="flex items-center gap-2">
          {payout.status !== 'paid' && (
            payout.is_on_hold ? (
              <button 
                onClick={handleReleaseHold}
                disabled={processing}
                className="px-3 py-1.5 bg-white border border-green-300 text-green-700 rounded-lg font-bold text-xs flex items-center gap-2 hover:bg-green-50 transition-colors disabled:opacity-50"
              >
                <Unlock size={14} /> Release Hold
              </button>
            ) : (
              <button 
                onClick={handleHold}
                disabled={processing}
                className="px-3 py-1.5 bg-white border border-red-300 text-red-700 rounded-lg font-bold text-xs flex items-center gap-2 hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                <Lock size={14} /> Place on Hold
              </button>
            )
          )}
          <button 
            onClick={handleDownloadPDF}
            className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-lg font-bold text-xs flex items-center gap-2 hover:bg-gray-50 transition-colors"
          >
            <Download size={14} /> Download Statement
          </button>
        </div>
      </div>

      {successMessage && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 size={20} />
          <span className="font-bold">{successMessage}</span>
        </div>
      )}

      {actionError && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 animate-in fade-in slide-in-from-top-2">
          <AlertTriangle size={20} />
          <span className="font-bold">{actionError}</span>
        </div>
      )}

      {/* Hold Warning */}
      {payout.is_on_hold && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3 text-red-900">
          <ShieldAlert size={24} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-bold text-sm">Payout is ON HOLD</p>
            <p className="text-xs mt-1">Reason: {payout.hold_reason || 'No reason provided'}</p>
            <p className="text-[10px] mt-1 text-red-400 uppercase font-bold">Held on {formatDate(payout.hold_at || null)}</p>
          </div>
        </div>
      )}

      {/* Compliance Warning for Admin */}
      {gateResult && !gateResult.allowed && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3 text-amber-900">
          <ShieldAlert size={24} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-bold text-sm">Compliance Alert: Provider has missing/expired documents.</p>
            {gateResult.missing && gateResult.missing.length > 0 && (
              <ul className="list-disc pl-4 mt-1 text-xs space-y-0.5">
                {gateResult.missing.map((reason, i) => (
                  <li key={i}>Missing: {reason}</li>
                ))}
              </ul>
            )}
            {gateResult.expired && gateResult.expired.length > 0 && (
              <ul className="list-disc pl-4 mt-1 text-xs space-y-0.5">
                {gateResult.expired.map((reason, i) => (
                  <li key={i}>Expired: {reason}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {payout.archived_at && (
        <div className="mb-6 p-4 bg-gray-100 border border-gray-300 rounded-2xl flex items-center gap-3 text-gray-600">
          <Archive size={20} />
          <span className="font-bold text-sm">This payout record is archived.</span>
        </div>
      )}

      <div className={`bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mb-8 ${payout.archived_at ? 'opacity-75' : ''}`}>
        <div className="p-8 border-b border-gray-100 bg-gray-50/50 flex flex-col md:flex-row justify-between md:items-start gap-6">
           <div>
             <div className="flex items-center gap-3 mb-2">
               <h1 className="text-3xl font-mono font-bold text-brand-charcoal">{payout.payout_reference}</h1>
               <span className={`px-2.5 py-1 rounded text-xs font-bold uppercase ${getStatusColor(payout.status)}`}>
                 {getStatusLabel(payout)}
               </span>
             </div>
             <p className="text-gray-500 text-sm flex items-center gap-2">
               <Calendar size={14} /> Created: <strong className="text-gray-700">{formatDate(payout.created_at)}</strong>
             </p>
             <p className="text-gray-500 text-sm flex items-center gap-2 mt-1">
               <CheckCircle2 size={14} className={payout.approved_at ? "text-amber-500" : "text-gray-300"} /> 
               Approved: <strong className="text-gray-700">{payout.approved_at ? formatDate(payout.approved_at) : 'Not yet'}</strong>
             </p>
             <p className="text-gray-500 text-sm flex items-center gap-2 mt-1">
               <CheckCircle2 size={14} className={payout.withdrawal_requested_at ? "text-blue-500" : "text-gray-300"} /> 
               Withdrawal Requested: <strong className="text-gray-700">{payout.withdrawal_requested_at ? formatDate(payout.withdrawal_requested_at) : 'Not yet'}</strong>
             </p>
             {payout.withdrawal_request_status === 'rejected' && (
               <p className="text-red-500 text-sm flex items-center gap-2 mt-1">
                 <X size={14} /> 
                 Withdrawal Rejected: <strong className="text-red-700">{payout.withdrawal_rejected_at ? formatDate(payout.withdrawal_rejected_at) : 'Rejected'}</strong>
               </p>
             )}
             <p className="text-gray-500 text-sm flex items-center gap-2 mt-1">
               <CheckCircle2 size={14} className={payout.withdrawal_approved_at ? "text-purple-500" : "text-gray-300"} /> 
               Withdrawal Approved: <strong className="text-gray-700">{payout.withdrawal_approved_at ? formatDate(payout.withdrawal_approved_at) : 'Not yet'}</strong>
             </p>
             <p className="text-gray-500 text-sm flex items-center gap-2 mt-1">
               <CheckCircle2 size={14} className={payout.paid_at ? "text-green-500" : "text-gray-300"} /> 
               Paid: <strong className="text-gray-700">{payout.paid_at ? formatDate(payout.paid_at) : 'Not yet'}</strong>
             </p>
           </div>
           
           <div className="text-right">
             <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Settlement Amount</span>
             <span className="block text-4xl font-bold text-brand-teal">{formatCurrency(getSettlementAmount(payout), payout.currency)}</span>
           </div>
        </div>

        {/* Content */}
        <div className="p-8">
          <div className="flex items-center justify-between mb-6 h-10">
             <h3 className="text-sm font-bold text-gray-400 uppercase flex items-center gap-2">
               <FileText size={16} /> Transaction Breakdown
             </h3>
             {payout.status === 'pending' && !payout.is_on_hold && (
               !confirmMode ? (
                 <button 
                   onClick={() => setConfirmMode(true)}
                   disabled={processing}
                   className="bg-brand-charcoal text-white px-6 py-2 rounded-lg font-bold text-sm hover:bg-gray-800 transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50"
                 >
                   <CheckCircle2 size={16} />
                   Mark as Paid
                 </button>
               ) : (
                  <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-2 duration-200">
                    <span className="text-sm font-bold text-gray-600 mr-2">Confirm Payment?</span>
                    <button 
                      onClick={handleMarkAsPaid}
                      disabled={processing}
                      className="bg-green-600 text-white px-3 py-2 rounded-lg font-bold text-sm hover:bg-green-700 transition-colors flex items-center gap-2 shadow-sm"
                    >
                      {processing ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                      Yes, Paid
                    </button>
                    <button 
                      onClick={() => setConfirmMode(false)}
                      disabled={processing}
                      className="bg-white border border-gray-300 text-gray-700 px-3 py-2 rounded-lg font-bold text-sm hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
               )
             )}
             {payout.is_on_hold && (
               <div className="flex items-center gap-2 text-red-600 font-bold text-sm bg-red-50 px-3 py-1.5 rounded-lg border border-red-100">
                 <ShieldAlert size={16} /> Held - Cannot Process
               </div>
             )}
             {payout.status === 'paid' && (
               <div className="flex items-center gap-2 text-green-600 font-bold text-sm bg-green-50 px-3 py-1.5 rounded-lg border border-green-100">
                 <CheckCircle2 size={16} /> Paid
               </div>
             )}
          </div>

          <div className="bg-gray-50 rounded-2xl p-8 border border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div className="flex justify-between items-center text-gray-700">
                <span className="font-medium">Gross Booking Amount</span>
                <span className="font-mono font-bold">{formatCurrency(payout.amount_gross, payout.currency)}</span>
              </div>
              <div className="flex justify-between items-center text-red-600">
                <div className="flex items-center gap-2">
                  <span className="font-medium flex items-center gap-2"><Building size={14}/> Platform Fee</span>
                  <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold flex items-center gap-1 uppercase">
                    <Percent size={10} />
                    {calculateFeePercentage(payout.amount_gross, payout.platform_fee)}%
                  </span>
                </div>
                <span className="font-mono font-bold">-{formatCurrency(payout.platform_fee, payout.currency)}</span>
              </div>
              <div className="h-px bg-gray-200 my-2" />
              
              <div className="flex justify-between items-center text-gray-600">
                <span className="font-medium">Original Net Payout</span>
                <span className="font-mono font-bold">{formatCurrency(getOriginalAmount(payout), payout.currency)}</span>
              </div>

              {getOriginalAmount(payout) !== getSettlementAmount(payout) && (
                <div className="flex justify-between items-center text-brand-coral font-bold">
                  <span className="font-medium">Dispute Adjustment</span>
                  <span className="font-mono">-{formatCurrency(getOriginalAmount(payout) - getSettlementAmount(payout), payout.currency)}</span>
                </div>
              )}

              <div className="h-px bg-gray-200 my-2" />
              <div className="flex justify-between items-center text-brand-charcoal text-lg font-bold">
                <span className="flex items-center gap-2"><Wallet size={18} className="text-brand-teal"/> Settlement Amount</span>
                <span className="font-mono text-brand-teal">{formatCurrency(getSettlementAmount(payout), payout.currency)}</span>
              </div>
            </div>

            <div className="space-y-4 text-sm text-gray-600">
              <div>
                <span className="block text-xs uppercase text-gray-400 mb-1">Operator</span>
                <span className="font-bold bg-white px-2 py-1 rounded border border-gray-200 block truncate">{(payout as any).operator_display_name}</span>
              </div>
              <div>
                <span className="block text-xs uppercase text-gray-400 mb-1">Provider</span>
                <span className="font-bold bg-white px-2 py-1 rounded border border-gray-200 block truncate">{(payout as any).provider_display_name}</span>
              </div>
               <div>
                <span className="block text-xs uppercase text-gray-400 mb-1">Tour Name</span>
                <span className="font-bold bg-white px-2 py-1 rounded border border-gray-200 block truncate">{(payout as any).tour_title}</span>
              </div>
              <div className="flex justify-between border-t border-gray-200 pt-3 mt-2">
                 <span>VAT Included ({payout.vat_rate}%)</span>
                 <span className="font-mono">{formatCurrency(payout.vat_amount, payout.currency)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Audit Timeline */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-100 bg-gray-50/30">
          <h3 className="text-sm font-bold text-gray-400 uppercase flex items-center gap-2">
            <Clock size={16} /> Audit Timeline & Exception History
          </h3>
        </div>
        <div className="p-8">
          <PayoutAuditTimeline payoutId={id || ''} />
        </div>
      </div>

      {/* Hold Reason Modal */}
      <AnimatePresence>
        {holdModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !processing && setHoldModalOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-brand-charcoal flex items-center gap-2">
                    <Lock size={20} className="text-amber-600" />
                    Put payout on hold
                  </h3>
                  <button
                    onClick={() => setHoldModalOpen(false)}
                    disabled={processing}
                    className="p-1 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-50"
                  >
                    <X size={20} className="text-gray-400" />
                  </button>
                </div>

                <p className="text-gray-500 text-sm mb-4">
                  Enter the reason for placing this payout on hold. This will be visible to other admins and recorded in the dispute log.
                </p>

                {holdError && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-lg text-red-600 text-sm flex items-center gap-2">
                    <ShieldAlert size={16} />
                    {holdError}
                  </div>
                )}

                <textarea
                  autoFocus
                  value={holdReason}
                  onChange={(e) => setHoldReason(e.target.value)}
                  placeholder="e.g., Pending verification of service delivery..."
                  className="w-full h-32 p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal resize-none text-sm"
                  disabled={processing}
                />

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => setHoldModalOpen(false)}
                    disabled={processing}
                    className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 font-bold rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmHold}
                    disabled={processing || !holdReason.trim()}
                    className="flex-1 px-4 py-2 bg-brand-charcoal text-white font-bold rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {processing ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        Processing...
                      </>
                    ) : (
                      'Confirm Hold'
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
