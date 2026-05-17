import React, { useState, useEffect } from 'react';
import { downloadCSV } from '../../lib/csvExportService';
import { ShieldAlert, CheckCircle2, XCircle, AlertCircle, Clock, Search, Filter, ArrowRight, Wallet, User, Building, X, Loader2, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { listPayoutDisputes, resolvePayoutDispute, releasePayoutHold } from '../../lib/adminPayoutService';
import { PayoutDispute } from '../../types';
import { formatCurrency, formatDate } from '../../lib/formatUtils';
import { useAuth } from '../../contexts/AuthContext';
import { ChevronDown, ChevronUp, FileText, History, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const getDisputeAmount = (payout: any) => {
  if (!payout) return 0;
  // Use amount_net as first priority for pre-dispute net payout, falling back to original_amount
  return Number(payout.amount_net ?? payout.original_amount ?? 0);
};

const getDisputeSettlement = (payout: any) => {
  if (!payout) return 0;
  // Settlement is the final adjusted amount after resolution
  if (payout.adjusted_amount !== null && payout.adjusted_amount !== undefined) {
    return Number(payout.adjusted_amount);
  }
  return getDisputeAmount(payout);
};

const getModalOriginalAmount = (payout: any) => {
  return getDisputeAmount(payout);
};

export const PayoutDisputesPage: React.FC = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [disputes, setDisputes] = useState<PayoutDispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'resolved'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Resolve Modal State
  const [resolveModalOpen, setResolveModalOpen] = useState(false);
  const [resolveNotes, setResolveNotes] = useState('');
  const [resolveDisputeId, setResolveDisputeId] = useState<string | null>(null);
  const [resolvePayoutId, setResolvePayoutId] = useState<string | null>(null);
  const [selectedDispute, setSelectedDispute] = useState<PayoutDispute | null>(null);
  const [resolveAction, setResolveAction] = useState<'FULL_RELEASE' | 'PARTIAL_RELEASE' | 'CANCEL'>('FULL_RELEASE');
  const [adjustedAmount, setAdjustedAmount] = useState<number>(0);
  const [originalAmount, setOriginalAmount] = useState<number>(0);
  const [resolveSubmitting, setResolveSubmitting] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);

  const fetchDisputes = async () => {
    try {
      setLoading(true);
      const data = await listPayoutDisputes();
      setDisputes(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDisputes();
  }, []);

  const handleResolveClick = (dispute: PayoutDispute) => {
    setSelectedDispute(dispute);
    setResolveDisputeId(dispute.id);
    setResolvePayoutId(dispute.payout_id);
    const original = getModalOriginalAmount(dispute.payout);
    setOriginalAmount(original);
    setAdjustedAmount(getDisputeAmount(dispute.payout)); // Full Release defaults to current payout amount
    setResolveAction('FULL_RELEASE');
    setResolveNotes('');
    setResolveError(null);
    setResolveModalOpen(true);
  };

  const confirmResolve = async () => {
    if (!profile || !resolveDisputeId || !resolvePayoutId) return;

    if (resolveAction === 'PARTIAL_RELEASE' && (adjustedAmount < 0 || adjustedAmount > originalAmount)) {
      setResolveError(`Adjusted amount must be between 0 and ${formatCurrency(originalAmount)}`);
      return;
    }

    if (!resolveNotes.trim()) {
      setResolveError('Resolution notes are required');
      return;
    }

    setResolveSubmitting(true);
    setResolveError(null);
    try {
      await resolvePayoutDispute(
        resolveDisputeId, 
        profile.id, 
        resolveNotes, 
        resolveAction, 
        resolveAction === 'PARTIAL_RELEASE' ? adjustedAmount : undefined
      );
      setResolveModalOpen(false);
      await fetchDisputes();
    } catch (err: any) {
      console.error(err);
      setResolveError(err.message || "We couldn't resolve this dispute. Please try again.");
    } finally {
      setResolveSubmitting(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const handleExportDisputes = () => {
    const headers = ['Booking Reference', 'Provider', 'Provider Type', 'Original Amount', 'Settlement Amount', 'Adjustment Amount', 'Dispute Reason', 'Resolution Note', 'Status', 'Raised Date', 'Resolved Date'];
    const data = filteredDisputes.map(d => [
      d.booking?.booking_reference || 'N/A',
      d.provider?.company_name || d.provider?.full_name || 'N/A',
      d.payout?.provider_type || 'N/A',
      getDisputeAmount(d.payout),
      getDisputeSettlement(d.payout),
      getDisputeAmount(d.payout) - getDisputeSettlement(d.payout),
      d.reason,
      d.resolution || 'N/A',
      d.status,
      d.created_at,
      d.resolved_at || 'N/A'
    ]);
    downloadCSV(`tourflow-disputes-${new Date().toISOString().split('T')[0]}.csv`, headers, data);
  };

  const filteredDisputes = disputes.filter(d => {
    const matchesSearch = 
      d.payout?.payout_reference?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.booking?.booking_reference?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.provider?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.operator?.company_name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || d.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: disputes.length,
    open: disputes.filter(d => d.status === 'open').length,
    resolved: disputes.filter(d => d.status === 'resolved').length,
    inDisputeTotal: disputes
      .filter(d => d.status === 'open')
      .reduce((sum, d) => sum + getDisputeAmount(d.payout), 0)
  };

  if (loading) return (
    <div className="p-20 text-center text-gray-400 flex flex-col items-center gap-3">
      <Loader2 className="animate-spin text-brand-teal" size={32} />
      <p className="font-medium">Fetching dispute queue...</p>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-brand-charcoal flex items-center gap-3">
            <ShieldAlert className="text-brand-coral" size={32} /> Payout Disputes
          </h1>
          <p className="text-gray-500 mt-1">Review and resolve platform-wide payment discrepancies.</p>
        </div>
        <button 
          onClick={handleExportDisputes}
          className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-gray-50 transition-colors"
        >
          <Download size={18} /> Export CSV
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Active Disputes</p>
          <div className="flex items-center justify-between">
            <span className="text-2xl font-bold text-brand-coral">{stats.open}</span>
            <div className="p-2 bg-red-50 text-brand-coral rounded-lg">
              <ShieldAlert size={18} />
            </div>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">In Dispute Amount</p>
          <div className="flex items-center justify-between">
            <span className="text-2xl font-bold text-brand-charcoal">{formatCurrency(stats.inDisputeTotal)}</span>
            <div className="p-2 bg-brand-charcoal/5 text-gray-500 rounded-lg">
              <Wallet size={18} />
            </div>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Resolved (Total)</p>
          <div className="flex items-center justify-between">
            <span className="text-2xl font-bold text-green-600">{stats.resolved}</span>
            <div className="p-2 bg-green-50 text-green-600 rounded-lg">
              <CheckCircle2 size={18} />
            </div>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Resolution Rate</p>
          <div className="flex items-center justify-between">
            <span className="text-2xl font-bold text-brand-teal">
              {stats.total > 0 ? Math.round((stats.resolved / stats.total) * 100) : 0}%
            </span>
            <div className="p-2 bg-brand-teal/5 text-brand-teal rounded-lg">
              <History size={18} />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 mb-8 flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search by reference, provider, or operator..."
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={18} className="text-gray-400" />
          <select
            className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal/20"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
          >
            <option value="all">All Statuses</option>
            <option value="open">Open Disputes</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="mb-8 p-4 bg-red-50 text-red-700 rounded-xl border border-red-100 flex items-center gap-2">
          <AlertCircle size={20} />
          {error}
        </div>
      )}

      {/* Disputes Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Payout / Booking</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Parties</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Original Net</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Settlement</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Issue</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Created</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredDisputes.length > 0 ? (
                filteredDisputes.map((dispute) => (
                  <React.Fragment key={dispute.id}>
                    <tr 
                      className={`hover:bg-gray-50 transition-colors group cursor-pointer ${expandedId === dispute.id ? 'bg-gray-50' : ''}`}
                      onClick={() => toggleExpand(dispute.id)}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {expandedId === dispute.id ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                          <div className="flex flex-col">
                            <span className="font-mono text-sm font-bold text-brand-teal">{dispute.payout?.payout_reference || dispute.payout?.id || dispute.booking?.booking_reference || 'N/A'}</span>
                            <span className="text-xs text-gray-400 font-mono">{dispute.booking?.booking_reference || 'N/A'}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5 text-xs">
                            <User size={12} className="text-gray-400" />
                            <span className="font-medium text-gray-700">{dispute.provider?.company_name || dispute.provider?.full_name || 'Unknown Provider'}</span>
                            {dispute.payout?.resource_type && (
                              <span className="ml-1 bg-gray-100 text-gray-600 text-[10px] font-bold px-1.5 py-0.5 rounded capitalize">
                                {dispute.payout.resource_type}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 text-xs">
                            <Building size={12} className="text-gray-400" />
                            <span className="text-gray-500">{dispute.operator?.company_name || dispute.operator?.full_name || 'Unknown Operator'}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-bold text-gray-500">
                          {formatCurrency(getDisputeAmount(dispute.payout))}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-bold text-brand-teal">
                          {(() => {
                            const settlement = getDisputeSettlement(dispute.payout);
                            return formatCurrency(settlement);
                          })()}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-brand-charcoal uppercase">{dispute.type}</span>
                          <p className="text-sm text-gray-600 line-clamp-1">{dispute.reason}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {dispute.status === 'resolved' ? (
                          <div className="flex flex-col gap-1">
                            {(() => {
                              const original = getDisputeAmount(dispute.payout);
                              const final = getDisputeSettlement(dispute.payout);
                              
                              let label = 'Resolved: Approved';
                              let colorClass = 'bg-green-100 text-green-700 border-green-200';
                              let Icon = CheckCircle2;

                              if (final === 0) {
                                label = 'Resolved: Rejected';
                                colorClass = 'bg-red-100 text-red-700 border-red-200';
                                Icon = XCircle;
                              } else if (final < original) {
                                label = 'Resolved: Reduced';
                                colorClass = 'bg-amber-100 text-amber-700 border-amber-200';
                                Icon = AlertCircle;
                              }

                              return (
                                <>
                                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[10px] font-bold uppercase ${colorClass}`}>
                                    <Icon size={10} />
                                    {label}
                                  </span>
                                  {final !== original && (
                                    <span className="text-[10px] font-bold text-gray-400 pl-1">
                                      {Math.round((final / original) * 100)}% Released
                                    </span>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-amber-200 bg-amber-50 text-amber-700 text-[10px] font-bold uppercase animate-pulse">
                            <Clock size={10} />
                            In Review
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs text-gray-500">{formatDate(dispute.created_at)}</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-3">
                          {dispute.status === 'open' ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleResolveClick(dispute);
                              }}
                              className="text-xs font-bold text-brand-teal hover:text-brand-teal-dark transition-colors flex items-center gap-1"
                            >
                              Review <ArrowRight size={14} />
                            </button>
                          ) : (
                            <span className="text-xs text-gray-400 italic">Resolved</span>
                          )}
                        </div>
                      </td>
                    </tr>
                    <AnimatePresence>
                      {expandedId === dispute.id && (
                        <tr>
                          <td colSpan={8} className="px-6 py-0 border-b border-gray-100">
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="py-6 grid grid-cols-1 md:grid-cols-3 gap-8">
                                {/* Dispute Info */}
                                <div className="space-y-4">
                                  <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                    <Info size={14} /> Dispute Details
                                  </h4>
                                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 space-y-3">
                                    <div className="grid grid-cols-2 gap-4 pb-2 border-b border-gray-200">
                                      <div>
                                        <span className="block text-[10px] text-gray-400 uppercase font-bold">Original Amount</span>
                                        <p className="text-sm font-bold text-gray-600">{formatCurrency(getDisputeAmount(dispute.payout))}</p>
                                      </div>
                                      <div>
                                        <span className="block text-[10px] text-gray-400 uppercase font-bold">Settlement Amount</span>
                                        <p className="text-sm font-bold text-brand-teal">{formatCurrency(getDisputeSettlement(dispute.payout))}</p>
                                      </div>
                                      {getDisputeAmount(dispute.payout) !== getDisputeSettlement(dispute.payout) && (
                                        <div className="col-span-2">
                                          <span className="block text-[10px] text-gray-400 uppercase font-bold">Difference</span>
                                          <p className="text-sm font-bold text-brand-coral">
                                            -{formatCurrency(getDisputeAmount(dispute.payout) - getDisputeSettlement(dispute.payout))}
                                          </p>
                                        </div>
                                      )}
                                    </div>
                                    <div>
                                      <span className="block text-[10px] text-gray-400 uppercase font-bold">Reason for Hold</span>
                                      <p className="text-sm text-gray-700 mt-1">{dispute.reason}</p>
                                    </div>
                                    {dispute.notes && (
                                      <div>
                                        <span className="block text-[10px] text-gray-400 uppercase font-bold">Additional Notes</span>
                                        <p className="text-sm text-gray-600 mt-1 italic">"{dispute.notes}"</p>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Resolution Info */}
                                <div className="space-y-4">
                                  <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                    <CheckCircle2 size={14} /> Resolution History
                                  </h4>
                                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 space-y-3">
                                    {dispute.status === 'resolved' ? (
                                      <>
                                        <div>
                                          <span className="block text-[10px] text-gray-400 uppercase font-bold">Resolution Text</span>
                                          <p className="text-sm text-gray-700 mt-1">{dispute.resolution || 'No resolution notes provided.'}</p>
                                        </div>
                                        <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                                          <div className="flex items-center gap-2">
                                            <User size={12} className="text-gray-400" />
                                            <span className="text-xs text-gray-600">{dispute.resolved_by_profile?.full_name || 'Admin'}</span>
                                          </div>
                                          <span className="text-[10px] text-gray-400 uppercase font-bold">{formatDate(dispute.resolved_at)}</span>
                                        </div>
                                      </>
                                    ) : (
                                      <div className="flex flex-col items-center justify-center py-4 text-gray-400">
                                        <Clock size={24} className="mb-2 opacity-50" />
                                        <p className="text-xs font-bold">Awaiting Resolution</p>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Related Links */}
                                <div className="space-y-4">
                                  <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                    <History size={14} /> Related Records
                                  </h4>
                                  <div className="space-y-2">
                                    <button 
                                      onClick={() => navigate(`/admin/payouts/${dispute.payout_id}`)}
                                      className="w-full flex items-center justify-between p-3 bg-white border border-gray-200 rounded-xl hover:border-brand-teal hover:shadow-sm transition-all group/link"
                                    >
                                      <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-brand-teal/10 text-brand-teal flex items-center justify-center group-hover/link:bg-brand-teal group-hover/link:text-white transition-colors">
                                          <Wallet size={16} />
                                        </div>
                                        <div className="text-left">
                                          <span className="block text-[10px] text-gray-400 uppercase font-bold">Payout Record</span>
                                          <span className="text-xs font-bold text-gray-700">{dispute.payout?.payout_reference || dispute.payout?.id || dispute.booking?.booking_reference || 'N/A'}</span>
                                        </div>
                                      </div>
                                      <ArrowRight size={14} className="text-gray-300 group-hover/link:text-brand-teal transition-colors" />
                                    </button>
                                    <button 
                                      onClick={() => navigate(`/admin/bookings/${dispute.booking_id}`)}
                                      className="w-full flex items-center justify-between p-3 bg-white border border-gray-200 rounded-xl hover:border-brand-teal hover:shadow-sm transition-all group/link"
                                    >
                                      <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-brand-coral/10 text-brand-coral flex items-center justify-center group-hover/link:bg-brand-coral group-hover/link:text-white transition-colors">
                                          <FileText size={16} />
                                        </div>
                                        <div className="text-left">
                                          <span className="block text-[10px] text-gray-400 uppercase font-bold">Booking Record</span>
                                          <span className="text-xs font-bold text-gray-700">{dispute.booking?.booking_reference}</span>
                                        </div>
                                      </div>
                                      <ArrowRight size={14} className="text-gray-300 group-hover/link:text-brand-coral transition-colors" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          </td>
                        </tr>
                      )}
                    </AnimatePresence>
                  </React.Fragment>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center justify-center gap-2 text-gray-400">
                      <ShieldAlert size={48} className="opacity-20 mb-2" />
                      <p className="font-bold text-lg">Clean Queue</p>
                      <p className="text-sm">No disputes found matching your current filters.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Resolve Dispute Modal */}
      <AnimatePresence>
        {resolveModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !resolveSubmitting && setResolveModalOpen(false)}
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
                    <CheckCircle2 size={20} className="text-green-600" />
                    Resolve Dispute
                  </h3>
                  <button
                    onClick={() => setResolveModalOpen(false)}
                    disabled={resolveSubmitting}
                    className="p-1 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-50"
                  >
                    <X size={20} className="text-gray-400" />
                  </button>
                </div>

                <p className="text-gray-500 text-sm mb-4">
                  Select a resolution action and enter notes. This will update the payout amount and release the hold.
                </p>

                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 mb-6 space-y-4">
                  {selectedDispute && (
                    <div className="grid grid-cols-2 gap-4 pb-4 border-b border-gray-200">
                      <div>
                        <span className="block text-[10px] text-gray-400 uppercase font-bold">Payout Ref</span>
                        <span className="text-xs font-mono font-bold text-brand-teal">{selectedDispute.payout?.payout_reference || selectedDispute.payout?.id || selectedDispute.booking?.booking_reference || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] text-gray-400 uppercase font-bold">Booking Ref</span>
                        <span className="text-xs font-mono font-bold text-gray-700">{selectedDispute.booking?.booking_reference}</span>
                      </div>
                      <div className="col-span-2">
                        <span className="block text-[10px] text-gray-400 uppercase font-bold">Provider</span>
                        <span className="text-xs font-bold text-gray-700">{selectedDispute.provider?.company_name || selectedDispute.provider?.full_name}</span>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-between items-center" title="The net amount the provider was originally intended to receive based on the booking snapshot and current assignment rates.">
                    <span className="text-xs font-bold text-gray-400 uppercase">Original Amount</span>
                    <span className="text-sm font-bold text-brand-charcoal">{formatCurrency(originalAmount)}</span>
                  </div>

                  <div className="space-y-2">
                    <span className="text-xs font-bold text-gray-400 uppercase">Resolution Action</span>
                    <div className="grid grid-cols-3 gap-2">
                      {(['FULL_RELEASE', 'PARTIAL_RELEASE', 'CANCEL'] as const).map((act) => (
                        <button
                          key={act}
                          onClick={() => {
                            setResolveAction(act);
                            if (act === 'FULL_RELEASE') setAdjustedAmount(originalAmount);
                            if (act === 'CANCEL') setAdjustedAmount(0);
                          }}
                          className={`px-2 py-2 rounded-lg text-[10px] font-bold uppercase transition-all border ${
                            resolveAction === act 
                              ? 'bg-brand-teal text-white border-brand-teal' 
                              : 'bg-white text-gray-500 border-gray-200 hover:border-brand-teal/50'
                          }`}
                        >
                          {act.replace('_', ' ')}
                        </button>
                      ))}
                    </div>
                  </div>

                  {resolveAction === 'PARTIAL_RELEASE' && (
                    <div className="space-y-2" title="The final net amount that will be released to the provider. Adjusting this will trigger a PARTIAL_RELEASE and reflect the adjustment in the payout ledger.">
                      <label className="text-xs font-bold text-gray-400 uppercase">Adjusted Amount (Net)</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-bold">R</span>
                        <input
                          type="number"
                          value={adjustedAmount}
                          onChange={(e) => setAdjustedAmount(Number(e.target.value))}
                          className="w-full pl-8 pr-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal text-sm font-bold"
                          max={originalAmount}
                          min={0}
                          step="0.01"
                        />
                      </div>
                      {originalAmount - adjustedAmount > 0 && (
                        <div className="flex justify-between items-center bg-red-50 border border-red-100 rounded-lg p-2.5 mt-2">
                          <span className="text-red-600 uppercase font-bold text-[10px] tracking-wider">Difference / Penalty</span>
                          <span className="text-red-700 font-bold text-sm">-{formatCurrency(originalAmount - adjustedAmount)}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {resolveAction === 'CANCEL' && (
                    <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg flex items-start gap-2">
                      <AlertCircle size={14} className="text-amber-600 mt-0.5" />
                      <p className="text-[10px] text-amber-700 leading-relaxed">
                        Cancelling will set the payout amount to zero and mark it as cancelled. This cannot be undone.
                      </p>
                    </div>
                  )}
                </div>

                {resolveError && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-lg text-red-600 text-sm flex items-center gap-2">
                    <AlertCircle size={16} />
                    {resolveError}
                  </div>
                )}

                <textarea
                  autoFocus
                  value={resolveNotes}
                  onChange={(e) => setResolveNotes(e.target.value)}
                  placeholder="Enter resolution details..."
                  className="w-full h-32 p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal resize-none text-sm"
                  disabled={resolveSubmitting}
                />

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => setResolveModalOpen(false)}
                    disabled={resolveSubmitting}
                    className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 font-bold rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmResolve}
                    disabled={resolveSubmitting}
                    className="flex-1 px-4 py-2 bg-brand-teal text-white font-bold rounded-lg hover:bg-brand-teal-dark transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {resolveSubmitting ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        Processing...
                      </>
                    ) : (
                      resolveAction === 'FULL_RELEASE' ? 'Resolve with Full Pay' :
                      resolveAction === 'PARTIAL_RELEASE' ? 'Resolve with Partial Pay' :
                      'Cancel Payout'
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
