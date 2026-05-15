import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { X, Calendar, CheckCircle2, Clock, Wallet, Building, Percent, FileText, ExternalLink, ShieldAlert, Info } from 'lucide-react';
import { Payout } from '../../types';
import { formatCurrency, formatDate } from '../../lib/formatUtils';
import { getOriginalAmount, getSettlementAmount } from '../../lib/payoutUtils';

import { PayoutAuditTimeline } from './PayoutAuditTimeline';

interface PayoutDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  payout: Payout | null;
}

export const PayoutDetailDrawer: React.FC<PayoutDetailDrawerProps> = ({ isOpen, onClose, payout }) => {
  // Handle ESC key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  if (!payout) return null;

  const calculateFeePercentage = (gross: number, fee: number) => {
    if (!gross || gross === 0) return '0';
    return ((fee / gross) * 100).toFixed(1).replace(/\.0$/, '');
  };

  const getStatusColor = (status: string) => {
    if (payout.is_on_hold) return 'bg-red-100 text-red-700';
    
    // Prioritize withdrawal request status
    if (payout.withdrawal_request_status) {
      switch (payout.withdrawal_request_status) {
        case 'requested': return 'bg-blue-100 text-blue-700';
        case 'approved': return 'bg-purple-100 text-purple-700';
        case 'rejected': return 'bg-red-100 text-red-700';
        case 'paid': return 'bg-green-100 text-green-700';
      }
    }

    switch (status.toLowerCase()) {
      case 'paid': return 'bg-green-100 text-green-700';
      case 'approved': return 'bg-amber-100 text-amber-700';
      case 'pending': return 'bg-blue-100 text-blue-700';
      case 'cancelled': return 'bg-gray-100 text-gray-500';
      default: return 'bg-gray-100 text-gray-500';
    }
  };

  const getStatusLabel = (status: string) => {
    if (payout.is_on_hold) return payout.hold_reason === 'dispute' ? 'DISPUTED' : 'ON HOLD';

    // Prioritize withdrawal request status
    if (payout.withdrawal_request_status) {
      switch (payout.withdrawal_request_status) {
        case 'requested': return 'WITHDRAWAL REQUESTED';
        case 'approved': return 'PROCESSING';
        case 'rejected': return 'WITHDRAWAL REJECTED';
        case 'paid': return 'PAID';
      }
    }

    if (status.toLowerCase() === 'approved' && (payout.adjusted_amount ?? 0) > 0 && (payout.adjusted_amount ?? 0) < (payout.original_amount || payout.amount_net)) {
      return 'REDUCED';
    }

    if (status.toLowerCase() === 'approved' && (payout.adjusted_amount ?? 0) > 0) {
      return 'RESOLVED: AUTHORIZED';
    }

    switch (status.toLowerCase()) {
      case 'pending': return 'PENDING';
      case 'approved': return 'AVAILABLE';
      case 'paid': return 'PAID';
      case 'cancelled': return 'CANCELLED';
      default: return status.toUpperCase();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-50 overflow-y-auto"
          >
            <div className="p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-xl font-bold text-brand-charcoal">Payout Details</h2>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-600"
                >
                  <X size={24} />
                </button>
              </div>

              {/* Section 1: Header Info */}
              <div className="mb-8 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <div className="mb-4">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Provider</span>
                  <p className="text-lg font-bold text-brand-charcoal truncate">
                    {payout.provider_display_name || payout.provider_name || (payout as any).provider?.company_name || (payout as any).provider?.full_name || 'Unknown Provider'}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Booking Ref</span>
                    <p className="font-mono font-bold text-brand-teal">{payout.bookings?.booking_reference || payout.booking_id || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Service Date</span>
                    <p className="text-sm font-medium text-gray-700">{formatDate(payout.service_date || payout.bookings?.start_date || null)}</p>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Tour</span>
                  <p className="text-sm font-medium text-gray-700 truncate">{payout.tour_title || payout.bookings?.tours?.title || 'Custom Tour'}</p>
                </div>
              </div>

              {/* Section 2: Hold Info (If applicable) */}
              {payout.is_on_hold && (
                <div className="mb-8 p-4 bg-red-50 rounded-2xl border border-red-100">
                  <h3 className="text-sm font-bold text-red-700 uppercase flex items-center gap-2 mb-3">
                    <ShieldAlert size={16} /> On Hold
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <span className="text-xs font-bold text-red-400 uppercase tracking-wider">Hold Reason</span>
                      <p className="text-sm font-medium text-red-700">{payout.hold_reason || 'No reason provided'}</p>
                    </div>
                    {payout.hold_reason === 'dispute' && payout.dispute_reason && (
                      <div>
                        <span className="text-xs font-bold text-red-400 uppercase tracking-wider">Dispute Details</span>
                        <p className="text-sm font-medium text-red-700">{payout.dispute_reason}</p>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-xs font-bold text-red-400 uppercase tracking-wider">Held At</span>
                        <p className="text-xs font-medium text-red-700">{formatDate(payout.hold_at || null)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Section 2.5: Resolution Notes (If applicable) */}
              {payout.adjustment_reason && (
                <div className="mb-8 p-4 bg-blue-50 rounded-2xl border border-blue-100">
                  <h3 className="text-sm font-bold text-blue-700 uppercase flex items-center gap-2 mb-3">
                    <Info size={16} /> Resolution Information
                  </h3>
                  <div>
                    <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">Resolution Note</span>
                    <p className="text-sm font-medium text-blue-700">{payout.adjustment_reason}</p>
                  </div>
                </div>
              )}

              {/* Section 2: Financial Breakdown */}
              <div className="mb-8">
                <h3 className="text-sm font-bold text-gray-400 uppercase flex items-center gap-2 mb-4">
                  <Wallet size={16} /> Financial Breakdown
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-gray-600">
                    <span>Gross Amount</span>
                    <span className="font-mono font-bold">{formatCurrency(payout.amount_gross, payout.currency)}</span>
                  </div>
                  <div className="flex justify-between items-center text-red-600">
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1"><Building size={14}/> Platform Fee</span>
                      <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-bold">
                        {calculateFeePercentage(payout.amount_gross, payout.platform_fee)}%
                      </span>
                    </div>
                    <span className="font-mono font-bold">-{formatCurrency(payout.platform_fee, payout.currency)}</span>
                  </div>
                  <div className="h-px bg-gray-100 my-2" />
                  
                  <div className="flex justify-between items-center text-gray-600">
                    <span>Original Net Payout</span>
                    <span className="font-mono font-bold">{formatCurrency(getOriginalAmount(payout), payout.currency)}</span>
                  </div>

                  {getOriginalAmount(payout) !== getSettlementAmount(payout) && (
                    <div className="flex flex-col gap-1 my-2">
                      <div className="flex justify-between items-center text-brand-coral font-bold">
                        <span>{payout.status === 'cancelled' ? 'Cancellation Adjustment' : 'Dispute/Cancellation Adjustment'}</span>
                        <span className="font-mono">-{formatCurrency(getOriginalAmount(payout) - getSettlementAmount(payout), payout.currency)}</span>
                      </div>
                      {payout.adjustment_reason && (
                        <p className="text-[11px] text-gray-500 italic bg-gray-50 p-2 rounded border border-dashed border-gray-200">
                          "{payout.adjustment_reason}"
                        </p>
                      )}
                    </div>
                  )}

                  <div className="h-px bg-gray-100 my-2" />
                  <div className="flex justify-between items-center text-lg font-bold text-brand-charcoal">
                    <span>Settlement Amount</span>
                    <span className="font-mono text-brand-teal">{formatCurrency(getSettlementAmount(payout), payout.currency)}</span>
                  </div>
                </div>
              </div>

              {/* Section 3: Status */}
              <div className="mb-8">
                <h3 className="text-sm font-bold text-gray-400 uppercase flex items-center gap-2 mb-4">
                  <CheckCircle2 size={16} /> Status
                </h3>
                <span className={`inline-flex px-3 py-1 rounded-full text-xs font-bold uppercase ${getStatusColor(payout.status)}`}>
                  {getStatusLabel(payout.status)}
                </span>
              </div>

              {/* Section 4: Audit History */}
              <div className="mb-8">
                <h3 className="text-sm font-bold text-gray-400 uppercase flex items-center gap-2 mb-6">
                  <Clock size={16} /> Audit History
                </h3>
                <PayoutAuditTimeline payoutId={payout.id} />
              </div>

              {/* Section 5: References */}
              <div className="mb-8">
                <h3 className="text-sm font-bold text-gray-400 uppercase flex items-center gap-2 mb-4">
                  <FileText size={16} /> References
                </h3>
                <div className="space-y-4">
                  <div>
                    <span className="text-xs text-gray-400 uppercase block mb-1">Payout Reference</span>
                    <p className="font-mono text-sm bg-gray-50 p-2 rounded border border-gray-100 text-brand-charcoal break-all">
                      {payout.payout_reference}
                    </p>
                  </div>
                  {(payout.batch_ref || payout.batch_id) && (
                    <div>
                      <span className="text-xs text-gray-400 uppercase block mb-1">Batch Reference</span>
                      <p className="font-mono text-sm bg-gray-50 p-2 rounded border border-gray-100 text-brand-charcoal break-all">
                        {payout.batch_ref ?? payout.batch_reference ?? payout.batch_id}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="p-6 border-t-2 border-gray-200 bg-gray-50 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-brand-charcoal">Questions about this payout?</p>
                <p className="text-xs text-gray-500 mt-0.5">Contact our support team for assistance.</p>
              </div>
              <Link 
                to={`/contact?topic=payout&ref=${payout.payout_reference || payout.id}`} 
                className="px-4 py-2 bg-brand-charcoal hover:bg-black text-white text-sm font-bold rounded-lg transition-colors whitespace-nowrap shadow-md"
              >
                Contact Support
              </Link>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
