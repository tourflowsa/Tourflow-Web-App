
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getPayoutDetail, repairPayoutLedgerRow } from '../../lib/payoutService';
import { Payout } from '../../types';
import { formatCurrency, formatDate } from '../../lib/formatUtils';
import { ArrowLeft, FileText, AlertTriangle, Loader2, CheckCircle2, Building, Calendar, Wallet, Percent, Clock, Archive, Download, ShieldAlert } from 'lucide-react';
import { generatePayoutStatement } from '../../lib/pdfGenerator';
import { checkComplianceGate, ComplianceGateResult } from '../../lib/complianceGate';
import { supabase } from '../../lib/supabase';

export const PayoutDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  
  const [payout, setPayout] = useState<(Payout & { applied_fee_percent?: number }) | null>(null);
  const [bookingRef, setBookingRef] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Compliance Gate
  const [gateResult, setGateResult] = useState<ComplianceGateResult | null>(null);

  useEffect(() => {
    if (user && id && profile) {
      loadDetail();
      checkCompliance();
    }
  }, [user, id, profile]);

  const loadDetail = async () => {
    if (!user || !id) return;
    setLoading(true);
    try {
      const { payout, bookingContext } = await getPayoutDetail(id, user.id);
      setPayout(payout);
      if (bookingContext) setBookingRef(bookingContext.booking_reference);
    } catch (err: any) {
      console.error(err);
      setError("Could not load payout details. It may not exist or you don't have permission.");
    } finally {
      setLoading(false);
    }
  };

  const checkCompliance = async () => {
    if (!user || !profile) return;
    try {
      const result = await checkComplianceGate({
        action: 'receive_payout',
        actorRole: profile.role,
        actorUserId: user.id
      });
      setGateResult(result);
    } catch (e) {
      console.error("Compliance Check Failed", e);
    }
  };

  const handleDownloadPDF = async () => {
    if (!payout) return;

    // Fetch context via RPC
    const { data: context, error: contextError } = await supabase
      .rpc('get_payout_statement_context', { p_payout_id: payout.id });

    const ctx = context?.[0] || {};
    let providerDisplayName = ctx.provider_display_name || (payout as any).provider_display_name || 'Unknown Provider';

    // Fallback for vehicle provider if RPC returns Unknown
    if (providerDisplayName === 'Unknown Provider' && payout.provider_id) {
      const { data: vehicle } = await supabase
        .from('vehicles')
        .select('name, owner_id, profiles:owner_id(company_name, full_name)')
        .eq('id', payout.provider_id)
        .maybeSingle();
      
      if (vehicle) {
        const ownerName = (vehicle as any).profiles?.company_name || (vehicle as any).profiles?.full_name || vehicle.name || 'Vehicle Provider';
        providerDisplayName = `${ownerName} (Vehicle)`;
      } else if (payout.payout_reference?.includes('-VEHICLE')) {
        providerDisplayName = 'Vehicle Provider';
      }
    }

    const enriched = {
      ...payout,
      provider_display_name: providerDisplayName,
      operator_display_name: ctx.operator_display_name || (payout as any).operator_display_name || 'Unknown Operator',
      tour_title: ctx.tour_title || (payout as any).tour_title || 'Custom Tour',
      service_date: ctx.service_date || (payout as any).service_date,
      bookings: {
        ...payout.bookings,
        booking_reference: ctx.booking_reference || (payout.bookings as any)?.booking_reference
      }
    };

    generatePayoutStatement(enriched);
  };

  const [repairing, setRepairing] = useState(false);
  const handleRepair = async () => {
    if (!payout || !id) return;
    setRepairing(true);
    setError(null);
    setSuccess(null);
    try {
      await repairPayoutLedgerRow(id);
      setSuccess("Payout ledger repaired successfully.");
      await loadDetail(); // Reload to get updated values
    } catch (err: any) {
      console.error("Repair failed:", err);
      setError("Failed to repair payout: " + err.message);
    } finally {
      setRepairing(false);
    }
  };

  const getStatusColor = (status: string) => {
    if (payout?.is_on_hold) return 'bg-red-50 text-red-700 border-red-100';
    
    switch (status) {
      case 'paid': return 'bg-green-50 text-green-700 border-green-100';
      case 'pending': return 'bg-amber-50 text-amber-700 border-amber-100';
      case 'approved': return 'bg-blue-50 text-blue-700 border-blue-100';
      default: return 'bg-gray-50 text-gray-700 border-gray-100';
    }
  };

  const getStatusLabel = (status: string) => {
    if (payout?.is_on_hold) return payout.hold_reason === 'dispute' ? 'DISPUTED' : 'ON HOLD';

    if (status === 'approved' && (payout?.adjusted_amount ?? 0) > 0 && (payout?.adjusted_amount ?? 0) < (payout?.original_amount || payout?.amount_net || 0)) {
      return 'RESOLVED: REDUCED';
    }

    if (status === 'approved' && (payout?.adjusted_amount ?? 0) > 0) {
      return 'RESOLVED: APPROVED';
    }

    switch (status) {
      case 'pending': return 'READY FOR PAYOUT';
      case 'approved': return 'AVAILABLE';
      case 'paid': return 'PAID';
      default: return status.toUpperCase();
    }
  };

  const getDisplayFeePercent = (p: Payout & { applied_fee_percent?: number }) => {
    if (p.applied_fee_percent !== undefined && p.applied_fee_percent !== null) {
      return p.applied_fee_percent;
    }
    return null;
  };

  if (loading) return <div className="p-12 text-center text-gray-400 flex flex-col items-center gap-2"><Loader2 className="animate-spin text-brand-teal"/> Loading details...</div>;

  if (error || !payout) return (
    <div className="max-w-4xl mx-auto mt-8 p-6 bg-red-50 border border-red-200 rounded-xl text-center">
      <AlertTriangle className="mx-auto text-red-500 mb-2" size={32} />
      <h3 className="text-lg font-bold text-red-800">Error Loading Payout</h3>
      <p className="text-red-600 mb-4">{error}</p>
      <button onClick={() => navigate('/operator/payouts')} className="text-brand-teal hover:underline font-bold">Back to List</button>
    </div>
  );

  const isBlocked = gateResult?.allowed === false;

  return (
    <div className="max-w-5xl mx-auto pb-12">
      <div className="mb-6 flex justify-between items-center">
        <button onClick={() => navigate('/operator/payouts')} className="flex items-center gap-2 text-gray-500 hover:text-brand-charcoal font-bold text-sm transition-colors">
          <ArrowLeft size={16} /> Back to Payouts
        </button>

        {success && (
          <div className="absolute top-20 right-8 bg-green-50 text-green-700 border border-green-200 px-4 py-2 rounded-xl flex items-center gap-2 animate-in fade-in slide-in-from-right-4">
             <CheckCircle2 size={16}/>
             <span className="text-sm font-bold">{success}</span>
          </div>
        )}
        
        <div className="flex items-center gap-2">
          {payout.platform_fee === 0 && payout.amount_gross > 0 && (
            <button 
              onClick={handleRepair}
              disabled={repairing}
              className="px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg font-bold text-xs flex items-center gap-2 hover:bg-amber-100 transition-colors disabled:opacity-50"
            >
              {repairing ? <Loader2 size={14} className="animate-spin" /> : <AlertTriangle size={14} />}
              Repair Legacy Payout
            </button>
          )}
          <button 
            onClick={handleDownloadPDF}
            className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-lg font-bold text-xs flex items-center gap-2 hover:bg-gray-50 transition-colors"
          >
            <Download size={14} /> Download Statement
          </button>
        </div>
      </div>

      {/* Compliance Warning */}
      {isBlocked && gateResult && payout.status === 'pending' && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-red-900 animate-in fade-in slide-in-from-top-2">
          <ShieldAlert size={24} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-bold text-sm">Compliance Block</p>
            <p className="text-sm mt-1">{gateResult.message}</p>
            {gateResult.ctaTo && (
              <button 
                onClick={() => navigate(gateResult.ctaTo!)}
                className="mt-2 text-xs font-bold text-red-800 underline hover:text-red-950"
              >
                {gateResult.ctaLabel}
              </button>
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
               <span className={`px-2.5 py-1 rounded text-xs font-bold uppercase border ${getStatusColor(payout.status)}`}>
                 {getStatusLabel(payout.status)}
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
               <CheckCircle2 size={14} className={payout.paid_at ? "text-green-500" : "text-gray-300"} /> 
               Paid: <strong className="text-gray-700">{payout.paid_at ? formatDate(payout.paid_at) : 'Not yet'}</strong>
             </p>
           </div>
           
           <div className="text-right">
             <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Total Net Payout</span>
             <span className="block text-4xl font-bold text-brand-teal">{formatCurrency(payout.amount_net, payout.currency)}</span>
           </div>
        </div>

        <div className="p-8">
           <div className="flex items-center justify-between mb-6 h-10">
             <h3 className="text-sm font-bold text-gray-400 uppercase flex items-center gap-2">
               <FileText size={16} /> Financial Breakdown
             </h3>
             {payout.status === 'pending' && (
               <div className="flex items-center gap-2 text-amber-600 font-medium text-sm">
                 <Clock size={16} /> Pending payout processing
               </div>
             )}
             {payout.status === 'paid' && (
               <div className="flex items-center gap-2 text-green-600 font-bold text-sm bg-green-50 px-3 py-1.5 rounded-lg border border-green-100">
                 <CheckCircle2 size={16} /> Paid
               </div>
             )}
           </div>

           <div className="bg-gray-50 rounded-2xl p-8 border border-gray-100 space-y-4">
              <div className="flex justify-between items-center text-gray-700">
                <span className="font-medium">Gross Amount</span>
                <span className="font-mono font-bold">{formatCurrency(payout.amount_gross, payout.currency)}</span>
              </div>
              
              <div className="flex justify-between items-center text-red-600">
                <div className="flex items-center gap-2">
                  <span className="font-medium flex items-center gap-2"><Building size={14}/> Platform Fee</span>
                  {getDisplayFeePercent(payout) !== null && (
                    <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold flex items-center gap-1 uppercase">
                      <Percent size={10} />
                      {getDisplayFeePercent(payout)}%
                    </span>
                  )}
                </div>
                <span className="font-mono font-bold">-{formatCurrency(payout.platform_fee, payout.currency)}</span>
              </div>
              
              <div className="h-px bg-gray-200 my-2" />
              
              <div className="flex justify-between items-center text-brand-charcoal text-lg font-bold">
                <span className="flex items-center gap-2"><Wallet size={18} className="text-brand-teal"/> Net Payout Amount</span>
                <span className="font-mono text-brand-teal">{formatCurrency(payout.amount_net, payout.currency)}</span>
              </div>
              
              <div className="mt-6 pt-4 border-t border-gray-200 text-sm text-gray-500 grid grid-cols-2 gap-4">
                 <div>
                   <span className="block text-xs uppercase text-gray-400">VAT (Included)</span>
                   <span>{formatCurrency(payout.vat_amount, payout.currency)} @ {payout.vat_rate}%</span>
                 </div>
                 <div className="text-right">
                   <span className="block text-xs uppercase text-gray-400">Tour Name</span>
                   <span className="font-bold text-brand-charcoal">{(payout as any).tour_title}</span>
                 </div>
                 <div>
                   <span className="block text-xs uppercase text-gray-400">Operator</span>
                   <span className="font-bold text-brand-charcoal">{(payout as any).operator_display_name}</span>
                 </div>
                 <div className="text-right">
                   <span className="block text-xs uppercase text-gray-400">Provider</span>
                   <span className="font-bold text-brand-charcoal">{(payout as any).provider_display_name}</span>
                 </div>
                 {bookingRef && (
                   <div className="col-span-2 pt-2 border-t border-gray-100 mt-2 flex justify-between items-center">
                     <span className="text-xs uppercase text-gray-400">Related Booking</span>
                     <span className="font-mono font-bold text-brand-charcoal">{bookingRef}</span>
                   </div>
                 )}
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};
