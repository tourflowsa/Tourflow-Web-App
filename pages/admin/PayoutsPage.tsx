import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { listAllPayouts, processPayouts, PAYOUT_STATUS_LABELS, archiveAdminPayout, getPayoutBatchStats, listPayoutBatches, updateBatchStatus, getPayoutFinanceReport, reconcileBatch, approveWithdrawal, rejectWithdrawal } from '../../lib/payoutService';
import { placePayoutOnHold, getPayoutEvents, exportBatchToCSV, exportToCsv } from '../../lib/adminPayoutService';
import { formatCurrency, formatDate } from '../../lib/formatUtils';
import { supabase } from '../../lib/supabase';
import { Loader2, Archive, Search, Lock, ShieldAlert, X, Send, History, AlertCircle, List, Layers, Download, CheckCircle2, FileText, Clock, Filter, Calendar, DollarSign, Scale, ChevronRight, ChevronDown } from 'lucide-react';
import { downloadCSV } from '../../lib/csvExportService';
import { motion, AnimatePresence } from 'motion/react';
import { filterPayouts, getPayableAmount, getSettlementAmount } from '../../lib/payoutUtils';

const parseCurrencyInput = (value: string): number => {
  if (!value) return 0;

  let cleaned = String(value)
    .replace(/[^\d,.-]/g, '')
    .replace(/\s/g, '');

  if (cleaned.includes(',') && !cleaned.includes('.')) {
    cleaned = cleaned.replace(',', '.');
  } else if (cleaned.includes(',') && cleaned.includes('.')) {
    cleaned = cleaned.replace(/,/g, '');
  }

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const AdminPayoutsPage: React.FC = () => {
  const { user, profile } = useAuth();
  const [payouts, setPayouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [processing, setProcessing] = useState(false);
  const [statusFilter, setStatusFilter] = useState('All');
  const [withdrawalFilter, setWithdrawalFilter] = useState('All');
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [viewMode, setViewMode] = useState<'grouped' | 'individual'>('grouped');
  const [expandedBatches, setExpandedBatches] = useState<Set<string>>(new Set());

  const [batchStats, setBatchStats] = useState({ today: 0, month: 0 });
  const [activeTab, setActiveTab] = useState<'payouts' | 'batches'>('payouts');
  const [batches, setBatches] = useState<any[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [batchStatusFilter, setBatchStatusFilter] = useState('All');
  const [reconciliationFilter, setReconciliationFilter] = useState('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [financeReport, setFinanceReport] = useState<any>(null);
  const [loadingReport, setLoadingReport] = useState(false);

  // Reconciliation Modal State
  const [reconcileModalOpen, setReconcileModalOpen] = useState(false);
  const [reconcileBatchItem, setReconcileBatchItem] = useState<any>(null);
  const [actualPaidInput, setActualPaidInput] = useState('');
  const [reconcileNotes, setReconcileNotes] = useState('');
  const [reconciling, setReconciling] = useState(false);

  // Hold Modal State
  const [holdModalOpen, setHoldModalOpen] = useState(false);
  const [holdReason, setHoldReason] = useState('');
  const [holdPayoutId, setHoldPayoutId] = useState<string | null>(null);
  const [holdError, setHoldError] = useState<string | null>(null);

  // History Modal State
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [selectedPayoutForHistory, setSelectedPayoutForHistory] = useState<any | null>(null);
  const [payoutEvents, setPayoutEvents] = useState<any[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);

  // Batch Detail Modal State
  const [batchDetailModalOpen, setBatchDetailModalOpen] = useState(false);
  const [selectedBatchForDetail, setSelectedBatchForDetail] = useState<any | null>(null);
  const [batchPayouts, setBatchPayouts] = useState<any[]>([]);
  const [loadingBatchPayouts, setLoadingBatchPayouts] = useState(false);

  useEffect(() => {
    if (user) {
      if (activeTab === 'payouts') {
        loadPayouts();
      } else {
        loadBatches();
      }
      getPayoutBatchStats().then(setBatchStats).catch(console.error);
      loadFinanceReport();
    }
  }, [user, statusFilter, withdrawalFilter, includeArchived, activeTab, batchStatusFilter, reconciliationFilter, startDate, endDate]);

  const loadFinanceReport = async () => {
    setLoadingReport(true);
    try {
      const report = await getPayoutFinanceReport();
      setFinanceReport(report);
    } catch (err) {
      console.error("Error loading finance report:", err);
    } finally {
      setLoadingReport(false);
    }
  };

  const loadBatches = async () => {
    setLoadingBatches(true);
    try {
      const data = await listPayoutBatches({ 
        status: batchStatusFilter,
        reconciliationStatus: reconciliationFilter,
        startDate: startDate || undefined,
        endDate: endDate || undefined
      });
      setBatches(data);
    } catch (err) {
      console.error("Error loading batches:", err);
    } finally {
      setLoadingBatches(false);
    }
  };

  const loadPayouts = async () => {
    setLoading(true);
    setSuccess(null);
    try {
      const status = statusFilter === 'All' ? undefined : statusFilter.toLowerCase();
      const withdrawalStatus = withdrawalFilter === 'All' ? undefined : withdrawalFilter.toLowerCase();
      const data = await listAllPayouts({ 
        status: status === 'ready' ? 'pending' : status, 
        withdrawalStatus,
        includeArchived 
      });
      
      const enriched = await Promise.all(data.map(async (p: any) => {
        const { data: context } = await supabase.rpc('get_payout_statement_context', { p_payout_id: p.id });
        const ctx = context?.[0] || {};
        let providerDisplayName = ctx.provider_display_name || 'Unknown Provider';

        // Fallback for vehicle provider if RPC returns Unknown
        if (providerDisplayName === 'Unknown Provider' && p.provider_id) {
          const { data: vehicle } = await supabase
            .from('vehicles')
            .select('name, owner_id, profiles:owner_id(company_name, full_name)')
            .eq('id', p.provider_id)
            .maybeSingle();
          
          if (vehicle) {
            const ownerName = (vehicle as any).profiles?.company_name || (vehicle as any).profiles?.full_name || vehicle.name || 'Vehicle Provider';
            providerDisplayName = `${ownerName} (Vehicle)`;
          } else if (p.payout_reference?.includes('-VEHICLE')) {
            providerDisplayName = 'Vehicle Provider';
          }
        }

        return {
          ...p,
          ...ctx,
          provider_display_name: providerDisplayName
        };
      }));
      setPayouts(enriched);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const isSelectable = useCallback((p: any) => {
    const isProcessableStatus = ['pending', 'approved'].includes((p.status || '').toLowerCase());
    const allowedWithdrawal = !p.withdrawal_request_status || 
                             ['requested', 'approved', 'queued'].includes(p.withdrawal_request_status);
    return isProcessableStatus && !p.is_on_hold && allowedWithdrawal && !p.batch_id;
  }, []);

  const processableSelectedIds = useMemo(() => {
    return selectedIds.filter(id => {
      const p = payouts.find(item => item.id === id);
      return p && isSelectable(p);
    });
  }, [selectedIds, payouts, isSelectable]);

  const filteredPayouts = useMemo(() => {
    return filterPayouts(payouts, searchTerm, ['operator_display_name', 'provider_display_name', 'booking_reference', 'payout_reference']);
  }, [payouts, searchTerm]);

  const groupedBatches = useMemo(() => {
    if (viewMode !== 'grouped') return [];

    const groups: Record<string, {
      batch: any,
      payouts: any[],
      total: number,
      actualPaid: number,
      operatorName: string
    }> = {};

    const getBatchMetadata = (row: any) => {
      return {
        id:
          row.payout_batches?.id ??
          row.payout_batch?.id ??
          row.batch?.id ??
          row.batch_id ??
          null,
        batch_ref:
          row.payout_batches?.batch_ref ??
          row.payout_batches?.batch_reference ??
          row.payout_batch?.batch_ref ??
          row.payout_batch?.batch_reference ??
          row.batch?.batch_ref ??
          row.batch?.batch_reference ??
          row.batchRef ??
          row.batch_ref ??
          row.batch_reference ??
          null,
        created_at:
          row.payout_batches?.created_at ??
          row.payout_batch?.created_at ??
          row.batch?.created_at ??
          row.createdAt ??
          row.batch_created_at ??
          null,
        status:
          row.payout_batches?.status ??
          row.payout_batch?.status ??
          row.batch?.status ??
          'pending',
        reconciliation_status:
          row.payout_batches?.reconciliation_status ??
          row.payout_batch?.reconciliation_status ??
          row.batch?.reconciliation_status ??
          'pending'
      };
    };

    filteredPayouts.forEach(p => {
      const rowMetadata = getBatchMetadata(p);

      const groupKey =
        rowMetadata.id ??
        p.payout_batches?.id ??
        p.payout_batch?.id ??
        p.batch?.id ??
        p.batch_id ??
        'unbatched';

      if (!groups[groupKey]) {
        groups[groupKey] = {
          batch: rowMetadata,
          payouts: [],
          total: 0,
          actualPaid: 0,
          operatorName: p.operator_display_name || 'N/A'
        };
      } else {
        const currentBatch = groups[groupKey].batch;

        const nextRef = rowMetadata.batch_ref ? String(rowMetadata.batch_ref) : null;
        const currentRef = currentBatch.batch_ref ? String(currentBatch.batch_ref) : null;

        const isBetterRef =
          !!nextRef &&
          (
            !currentRef ||
            (nextRef.startsWith('BATCH-') && !currentRef.startsWith('BATCH-'))
          );

        if (isBetterRef) {
          currentBatch.batch_ref = nextRef;
        }

        if (!currentBatch.created_at && rowMetadata.created_at) {
          currentBatch.created_at = rowMetadata.created_at;
        }

        if (!currentBatch.id && rowMetadata.id) {
          currentBatch.id = rowMetadata.id;
        }
      }

      groups[groupKey].payouts.push(p);

      const amount = getSettlementAmount(p);
      groups[groupKey].total += amount;

      if (p.status === 'paid') {
        groups[groupKey].actualPaid += amount;
      }
    });

    return Object.entries(groups)
      .map(([id, group]) => {
        const batch = group.batch;
        const resolvedBatchId = batch?.id ?? id;

        const displayBatchRef =
          batch?.batch_ref && String(batch.batch_ref).startsWith('BATCH-')
            ? String(batch.batch_ref)
            : batch?.batch_reference && String(batch.batch_reference).startsWith('BATCH-')
              ? String(batch.batch_reference)
              : id === 'unbatched'
                ? 'Unbatched / Pending'
                : 'Unbatched / Pending';

        return {
          ...group,
          id: resolvedBatchId,
          batchId: resolvedBatchId,
          batchRef: displayBatchRef,
          createdAt: batch?.created_at ?? null,
          batch
        };
      })
      .sort((a, b) => {
        if (a.id === 'unbatched') return -1;
        if (b.id === 'unbatched') return 1;

        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });
  }, [filteredPayouts, viewMode]);

  const toggleBatch = (batchId: string) => {
    setExpandedBatches(prev => {
      const next = new Set(prev);
      if (next.has(batchId)) next.delete(batchId);
      else next.add(batchId);
      return next;
    });
  };

  const handleProcess = async () => {
    const actorId = user?.id || profile?.id;

    if (!actorId) {
      setError('Unable to process payouts. Missing user identity.');
      setProcessing(false);
      return;
    }

    if (processableSelectedIds.length === 0) return;
    
    setProcessing(true);
    setSuccess(null);
    try {
      const result = await processPayouts(processableSelectedIds, actorId);
      let msg = `Batch Created: ${result.batch.batch_ref ?? result.batch.id}`;
      if (result.skippedCount > 0) {
        msg += `. ${result.skippedCount} selected payouts were no longer eligible and were removed from selection.`;
      }
      setSuccess(msg);
      getPayoutBatchStats().then(setBatchStats).catch(console.error);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to process payouts");
    } finally {
      setSelectedIds([]);
      await loadPayouts();
      setProcessing(false);
    }
  };

  const handleExportCSV = async (batchId: string, reference: string) => {
    try {
      const csv = await exportBatchToCSV(batchId);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `${reference}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      console.error("Export failed:", err);
      setError("Failed to export CSV: " + err.message);
    }
  };

  const handleUpdateBatchStatus = async (batchId: string, status: 'processing' | 'completed') => {
    if (!user) return;
    try {
      await updateBatchStatus(batchId, status, user.id);
      loadBatches();
    } catch (err: any) {
      console.error("Status update failed:", err);
      setError("Failed to update status: " + err.message);
    }
  };

  const openReconcileModal = (batch: any) => {
    setReconcileBatchItem(batch);
    const batchTotal = Number(batch.batch_total ?? batch.total_amount ?? 0);
    const actualPaid = Number(batch.actual_paid ?? 0);
    
    if (batchTotal === undefined || batchTotal === null) {
      setError("Unable to open reconciliation. Batch totals are missing.");
      return;
    }
    
    setActualPaidInput(actualPaid.toFixed(2));
    setReconcileNotes(batch.reconciliation_notes || '');
    setReconcileModalOpen(true);
  };

  const handleReconcile = async () => {
    if (!user || !reconcileBatchItem) return;
    setReconciling(true);
    try {
      await reconcileBatch({
        batchId: reconcileBatchItem.id,
        actualPaidTotal: parseCurrencyInput(actualPaidInput),
        notes: reconcileNotes,
        userId: user.id
      });
      setSuccess("Batch reconciled successfully.");
      setReconcileModalOpen(false);
      loadBatches();
      loadFinanceReport();
    } catch (err: any) {
      console.error("Reconciliation failed:", err);
      setError("Failed to reconcile batch: " + err.message);
    } finally {
      setReconciling(false);
    }
  };

  const handleViewBatchDetail = async (batch: any) => {
    setSelectedBatchForDetail(batch);
    setBatchDetailModalOpen(true);
    setLoadingBatchPayouts(true);
    try {
      const { data, error } = await supabase
        .from('payout_ledger')
        .select('*, profiles:provider_id(full_name, company_name)')
        .eq('batch_id', batch.id);
      
      if (error) throw error;
      setBatchPayouts(data || []);
    } catch (err) {
      console.error("Error fetching batch payouts:", err);
    } finally {
      setLoadingBatchPayouts(false);
    }
  };

  const handleArchive = async (id: string) => {
    try {
      await archiveAdminPayout(id);
      await loadPayouts();
    } catch (err) {
      console.error(err);
    }
  };

  const handleHold = (payout: any) => {
    setHoldPayoutId(payout.id);
    setHoldReason('');
    setHoldError(null);
    setHoldModalOpen(true);
  };

  const handleViewHistory = async (payout: any) => {
    setSelectedPayoutForHistory(payout);
    setHistoryModalOpen(true);
    setLoadingEvents(true);
    try {
      const events = await getPayoutEvents(payout.id);
      setPayoutEvents(events);
    } catch (err) {
      console.error("Error fetching payout events:", err);
    } finally {
      setLoadingEvents(false);
    }
  };

  const handleApproveWithdrawal = async (payoutId: string) => {
    if (!user) return;
    try {
      await approveWithdrawal([payoutId], user.id);
      setSuccess('Withdrawal approved successfully');
      loadPayouts();
    } catch (err: any) {
      console.error('Failed to approve withdrawal', err);
      setError(err.message || 'Failed to approve withdrawal');
    }
  };

  const handleRejectWithdrawal = async (payoutId: string) => {
    if (!user) return;
    const reason = prompt('Enter rejection reason (optional):');
    if (reason === null) return; // Cancelled
    
    try {
      await rejectWithdrawal([payoutId], user.id, reason || undefined);
      setSuccess('Withdrawal rejected successfully');
      loadPayouts();
    } catch (err: any) {
      console.error('Failed to reject withdrawal', err);
      setError(err.message || 'Failed to reject withdrawal');
    }
  };

  const confirmHold = async () => {
    if (!user || !holdPayoutId || !holdReason.trim()) return;

    setProcessing(true);
    setHoldError(null);
    try {
      await placePayoutOnHold(holdPayoutId, user.id, holdReason.trim());
      setSuccess("Payout placed on hold.");
      // Remove from selectedIds if it was there
      setSelectedIds(prev => prev.filter(id => id !== holdPayoutId));
      setHoldModalOpen(false);
      await loadPayouts();
    } catch (err: any) {
      console.error(err);
      setHoldError(err.message || "Failed to place hold");
    } finally {
      setProcessing(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  if (loading) return <div className="p-12 text-center text-gray-400"><Loader2 className="w-8 h-8 animate-spin mx-auto" /></div>;

  const readyTotal = filteredPayouts.filter(p => p.status === 'pending' && !p.archived_at && !p.is_on_hold).reduce((sum, p) => sum + getPayableAmount(p), 0);
  const approvedTotal = filteredPayouts.filter(p => p.status === 'approved' && !p.archived_at && !p.is_on_hold).reduce((sum, p) => sum + getPayableAmount(p), 0);
  const requestedTotal = filteredPayouts.filter(p => ['requested', 'approved'].includes(p.withdrawal_request_status || '') && !p.archived_at && !p.is_on_hold).reduce((sum, p) => sum + getPayableAmount(p), 0);
  const paidTotal = filteredPayouts.filter(p => p.status === 'paid' && !p.archived_at).reduce((sum, p) => sum + getPayableAmount(p), 0);
  const onHoldTotal = filteredPayouts.filter(p => p.is_on_hold && !p.archived_at).reduce((sum, p) => sum + getPayableAmount(p), 0);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-brand-charcoal">Payout Management</h1>
          <p className="text-gray-500 mt-1">Review and process provider payouts</p>
        </div>
        <div className="flex gap-4">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
            <div className="p-3 bg-brand-teal/10 rounded-lg">
              <Clock className="text-brand-teal" size={24} />
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Batches Today</p>
              <p className="text-xl font-bold text-brand-charcoal">{batchStats.today}</p>
            </div>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
            <div className="p-3 bg-blue-50 rounded-lg">
              <CheckCircle2 className="text-blue-600" size={24} />
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Batches This Month</p>
              <p className="text-xl font-bold text-brand-charcoal">{batchStats.month}</p>
            </div>
          </div>
        </div>
      </div>

      {success && <div className="bg-green-100 text-green-700 p-4 rounded mb-4 flex items-center gap-2">{success}</div>}
      {error && <div className="bg-red-100 text-red-700 p-4 rounded mb-4 flex items-center gap-2">{error}</div>}

      {/* Finance Reporting Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-green-50 rounded-lg">
              <DollarSign className="text-green-600" size={20} />
            </div>
            <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Lifetime Paid</p>
          </div>
          <p className="text-2xl font-bold text-brand-charcoal">
            {loadingReport ? <Loader2 className="w-5 h-5 animate-spin" /> : formatCurrency(financeReport?.lifetimePaid || 0)}
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Clock className="text-blue-600" size={20} />
            </div>
            <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Pending (Ready)</p>
          </div>
          <p className="text-2xl font-bold text-brand-charcoal">
            {loadingReport ? <Loader2 className="w-5 h-5 animate-spin" /> : formatCurrency(financeReport?.totalPending || 0)}
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-purple-50 rounded-lg">
              <Send className="text-purple-600" size={20} />
            </div>
            <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Requested</p>
          </div>
          <p className="text-2xl font-bold text-brand-charcoal">
            {loadingReport ? <Loader2 className="w-5 h-5 animate-spin" /> : formatCurrency(financeReport?.totalRequested || 0)}
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-red-50 rounded-lg">
              <Lock className="text-red-600" size={20} />
            </div>
            <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">On Hold</p>
          </div>
          <p className="text-2xl font-bold text-brand-charcoal">
            {loadingReport ? <Loader2 className="w-5 h-5 animate-spin" /> : formatCurrency(financeReport?.totalOnHold || 0)}
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-amber-50 rounded-lg">
              <ShieldAlert className="text-amber-600" size={20} />
            </div>
            <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Mismatched Batches</p>
          </div>
          <p className="text-2xl font-bold text-brand-charcoal">
            {loadingReport ? <Loader2 className="w-5 h-5 animate-spin" /> : financeReport?.mismatchCount || 0}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('payouts')}
          className={`flex items-center gap-2 px-6 py-2 rounded-lg font-bold transition-all ${
            activeTab === 'payouts' 
              ? 'bg-white text-brand-teal shadow-sm' 
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <List size={18} />
          Payouts
        </button>
        <button
          onClick={() => setActiveTab('batches')}
          className={`flex items-center gap-2 px-6 py-2 rounded-lg font-bold transition-all ${
            activeTab === 'batches' 
              ? 'bg-white text-brand-teal shadow-sm' 
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Layers size={18} />
          Batches
        </button>
      </div>

      {activeTab === 'payouts' ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-6 hidden">
            <div className="bg-blue-50 p-4 rounded">Total READY: {formatCurrency(readyTotal)}</div>
            <div className="bg-yellow-50 p-4 rounded">Total APPROVED: {formatCurrency(approvedTotal)}</div>
            <div className="bg-purple-50 p-4 rounded">Total REQUESTED: {formatCurrency(requestedTotal)}</div>
            <div className="bg-red-50 p-4 rounded">Total ON HOLD: {formatCurrency(onHoldTotal)}</div>
            <div className="bg-green-50 p-4 rounded">Total PAID: {formatCurrency(paidTotal)}</div>
          </div>

          <div className="flex justify-between items-center mb-4">
            <div className="flex gap-2 flex-wrap">
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border p-2 rounded">
                <option value="All">All Payout Status</option>
                <option value="pending">Pending (Ready)</option>
                <option value="approved">Approved</option>
                <option value="paid">Paid</option>
              </select>
              <select value={withdrawalFilter} onChange={e => setWithdrawalFilter(e.target.value)} className="border p-2 rounded">
                <option value="All">All Withdrawal Status</option>
                <option value="requested">Requested</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="queued">Queued</option>
                <option value="processed">Processed</option>
                <option value="none">None</option>
              </select>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={includeArchived} onChange={e => setIncludeArchived(e.target.checked)} />
                Include Archived
              </label>
              <button 
                onClick={handleProcess}
                disabled={processableSelectedIds.length === 0 || processing}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
              >
                {processing ? 'Processing...' : `Process Payout (${processableSelectedIds.length})`}
              </button>
              <button 
                onClick={() => {
                  const headers = ['Payout Reference', 'Booking Reference', 'Provider', 'Provider Type', 'Original Amount', 'Adjustment Amount', 'Final Settlement Amount', 'Status', 'Paid Date', 'Created Date'];
                  const data = filteredPayouts.map(p => {
                    const final = 
                      p.adjusted_amount != null ? Number(p.adjusted_amount) :
                      p.amount_net != null ? Number(p.amount_net) :
                      p.original_amount != null ? Number(p.original_amount) :
                      0;
                      
                    const original = 
                      p.original_amount != null ? Number(p.original_amount) :
                      p.amount_net != null ? Number(p.amount_net) :
                      final;
                      
                    const adjustment = original - final;
                    
                    return [
                      p.payout_reference,
                      p.booking_reference ?? p.booking_ref,
                      p.provider_display_name || 'N/A',
                      p.provider_type || 'N/A',
                      original.toFixed(2),
                      adjustment.toFixed(2),
                      final.toFixed(2),
                      p.status,
                      p.paid_at || 'N/A',
                      p.created_at
                    ];
                  });
                  downloadCSV(`tourflow-payout-ledger-${new Date().toISOString().split('T')[0]}.csv`, headers, data);
                }}
                className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-50 flex items-center gap-2"
              >
                <Download size={16} /> Export CSV
              </button>

              <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg border border-gray-200 ml-2">
                <button 
                  onClick={() => setViewMode('grouped')}
                  className={`p-1.5 rounded-md transition-all ${viewMode === 'grouped' ? 'bg-white text-brand-teal shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  title="Group by Batch"
                >
                  <Layers size={18} />
                </button>
                <button 
                  onClick={() => setViewMode('individual')}
                  className={`p-1.5 rounded-md transition-all ${viewMode === 'individual' ? 'bg-white text-brand-teal shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  title="Individual Rows"
                >
                  <List size={18} />
                </button>
              </div>
            </div>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 text-gray-400" size={16} />
              <input 
                type="text" 
                placeholder="Search..." 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)} 
                className="border p-2 pl-8 rounded"
              />
            </div>
          </div>

          {viewMode === 'individual' ? (
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="p-2 text-left">
                    <input 
                      type="checkbox" 
                      checked={selectedIds.length > 0 && selectedIds.length === filteredPayouts.filter(isSelectable).length}
                      onChange={() => {
                        const selectableIds = filteredPayouts.filter(isSelectable).map(p => p.id);
                        setSelectedIds(selectedIds.length === selectableIds.length ? [] : selectableIds);
                      }}
                    />
                  </th>
                  <th className="p-2 text-left">Batch Ref</th>
                  <th className="p-2 text-left">Operator</th>
                  <th className="p-2 text-left">Provider</th>
                  <th className="p-2 text-left">Booking Ref</th>
                  <th className="p-2 text-left">Bank Details</th>
                  <th className="p-2 text-left">Amount</th>
                  <th className="p-2 text-left">Status</th>
                  <th className="p-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayouts.map(p => {
                  const hasBankDetails = !!p.bank_details;
                  const isMissingDetails = !hasBankDetails && p.status !== 'paid';

                  return (
                    <tr key={p.id} className={`border-b ${isMissingDetails ? 'bg-red-50/50' : ''}`}>
                      <td className="p-2">
                        <input 
                          type="checkbox" 
                          disabled={!isSelectable(p)} 
                          checked={selectedIds.includes(p.id)} 
                          onChange={() => toggleSelect(p.id)} 
                        />
                      </td>
                      <td className="p-2">
                        {p.batch_id ? (
                          <a href={`#/admin/payouts/batch/${p.batch_id}`} className="text-blue-600 hover:underline">
                            {p.payout_batches?.batch_ref ?? p.payout_batches?.batch_reference ?? p.batch_id}
                          </a>
                        ) : '-'}
                      </td>
                      <td className="p-2">
                        <div className="flex flex-col">
                          <span>{p.operator_display_name}</span>
                          {p.operator_id && (
                            <span className={`text-[9px] font-bold flex items-center gap-0.5 mt-0.5 ${
                              p.operator_bank_details ? 'text-green-600' : 'text-red-500'
                            }`}>
                              {p.operator_bank_details ? (
                                <CheckCircle2 size={8} />
                              ) : (
                                <AlertCircle size={8} />
                              )}
                              {p.operator_bank_details ? 'Bank OK' : 'Bank Missing'}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-2">{p.provider_display_name}</td>
                      <td className="p-2">{p.booking_reference}</td>
                      <td className="p-2">
                        {hasBankDetails ? (
                          <span className="text-xs font-bold text-green-600 flex items-center gap-1" title={`${p.bank_details.bank_name} (****${p.bank_details.account_number.slice(-4)})`}>
                            <CheckCircle2 size={12} /> Complete
                          </span>
                        ) : (
                          <span className="text-xs font-bold text-red-500 flex items-center gap-1">
                            <AlertCircle size={12} /> Missing
                          </span>
                        )}
                      </td>
                      <td className="p-2">{formatCurrency(getPayableAmount(p))}</td>
                    <td className="p-2">
                      <div className="flex flex-col gap-1">
                        {p.is_on_hold ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold uppercase w-fit bg-red-100 text-red-700">
                            <ShieldAlert size={10} /> {p.hold_reason === 'dispute' ? 'DISPUTED' : 'ON HOLD'}
                          </span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase w-fit border ${
                              p.status === 'paid' ? 'bg-green-50 text-green-700 border-green-100' : 
                              p.status === 'approved' && p.adjusted_amount > 0 && p.adjusted_amount < (p.original_amount || p.amount_net) ? 'bg-indigo-50 text-indigo-700 border-indigo-100' :
                              p.status === 'approved' && p.adjusted_amount > 0 ? 'bg-blue-50 text-blue-700 border-blue-100' :
                              p.withdrawal_request_status === 'requested' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                              p.withdrawal_request_status === 'approved' ? 'bg-purple-50 text-purple-700 border-purple-100' :
                              p.withdrawal_request_status === 'rejected' ? 'bg-red-50 text-red-700 border-red-100' :
                              p.status === 'approved' ? 'bg-yellow-50 text-yellow-700 border-yellow-100' : 
                              'bg-gray-50 text-gray-700 border-gray-100'
                            }`}>
                              {p.status === 'approved' && p.adjusted_amount > 0 && p.adjusted_amount < (p.original_amount || p.amount_net) ? 'Resolved: Reduced' :
                               p.status === 'approved' && p.adjusted_amount > 0 ? 'Resolved: Approved' :
                               p.status === 'paid' ? 'PAID' :
                               p.withdrawal_request_status === 'requested' ? 'REQUESTED' :
                               p.withdrawal_request_status === 'approved' ? 'APPROVED FOR PAYOUT' :
                               p.withdrawal_request_status === 'rejected' ? 'REJECTED' :
                               p.status === 'approved' ? 'AVAILABLE' :
                               PAYOUT_STATUS_LABELS[p.status] || p.status.toUpperCase()}
                            </span>
                            {p.withdrawal_request_status === 'paid' && (
                              <span className="px-2 py-1 rounded text-[10px] font-bold uppercase w-fit bg-green-100 text-green-700">
                                <Send size={10} className="inline mr-1" />
                                PAID
                              </span>
                            )}
                          </div>
                        )}
                        {p.adjustment_reason && (
                          <span className="text-[9px] text-gray-400 italic line-clamp-1 max-w-[120px]" title={p.adjustment_reason}>
                            "{p.adjustment_reason}"
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        {p.status === 'paid' && !p.archived_at && (
                          <button onClick={() => handleArchive(p.id)} className="text-gray-600 hover:underline text-sm flex items-center gap-1">
                            <Archive size={14} /> Archive
                          </button>
                        )}
                        
                        {p.status !== 'paid' && !p.is_on_hold && (
                          <button 
                            onClick={() => handleHold(p)} 
                            className="text-amber-600 hover:underline text-sm flex items-center gap-1"
                          >
                            <Lock size={14} /> Hold
                          </button>
                        )}

                        <button 
                          onClick={() => handleViewHistory(p)} 
                          className="text-blue-600 hover:underline text-sm flex items-center gap-1"
                        >
                          <History size={14} /> History
                        </button>

                        {p.withdrawal_request_status === 'requested' && p.status !== 'paid' && (
                          <>
                            <button 
                              onClick={() => handleApproveWithdrawal(p.id)} 
                              className="text-green-600 hover:underline text-sm flex items-center gap-1"
                              title="Approve Withdrawal"
                            >
                              <CheckCircle2 size={14} /> Approve
                            </button>
                            <button 
                              onClick={() => handleRejectWithdrawal(p.id)} 
                              className="text-red-600 hover:underline text-sm flex items-center gap-1"
                              title="Reject Withdrawal"
                            >
                              <X size={14} /> Reject
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b bg-gray-50 text-[10px] text-gray-500 uppercase font-bold">
                  <th className="p-2 w-8"></th>
                  <th className="p-2 text-left">Batch Ref</th>
                  <th className="p-2 text-left">Created At</th>
                  <th className="p-2 text-left">Operator</th>
                  <th className="p-2 text-right">Count</th>
                  <th className="p-2 text-right">Batch Total</th>
                  <th className="p-2 text-right">Actual Paid</th>
                  <th className="p-2 text-left">Status</th>
                  <th className="p-2 text-left">Reconciliation</th>
                  <th className="p-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {groupedBatches.map(group => {
                  return (
                    <React.Fragment key={group.id}>
                      <tr 
                        className="border-b bg-gray-50/80 hover:bg-gray-100 transition-colors cursor-pointer"
                        onClick={() => toggleBatch(group.id)}
                      >
                      <td className="p-2">
                        <div className="flex items-center justify-center">
                          {expandedBatches.has(group.id) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </div>
                      </td>
                      <td className="p-2 font-bold text-brand-charcoal">
                        {group.id === 'unbatched' ? (
                          <span className="text-gray-500 italic">{group.batchRef}</span>
                        ) : (
                          <a 
                            href={`#/admin/payouts/batch/${group.id}`} 
                            className="text-blue-600 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {group.batchRef}
                          </a>
                        )}
                      </td>
                      <td className="p-2 text-xs text-gray-500 font-mono">
                        {group.createdAt ? formatDate(group.createdAt) : '-'}
                      </td>
                      <td className="p-2 text-sm">{group.operatorName}</td>
                      <td className="p-2 text-right font-bold">{group.payouts.length}</td>
                      <td className="p-2 text-right font-bold text-brand-charcoal">{formatCurrency(group.total)}</td>
                      <td className="p-2 text-right font-bold text-green-600">{formatCurrency(group.actualPaid)}</td>
                      <td className="p-2">
                        {group.id !== 'unbatched' && (
                          <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                            group.batch.status === 'completed' ? 'bg-green-100 text-green-800' : 
                            group.batch.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {group.batch.status}
                          </span>
                        )}
                      </td>
                      <td className="p-2">
                        {group.id !== 'unbatched' && (() => {
                          const isMismatched = Math.abs(group.total - group.actualPaid) > 0.01;
                          
                          return (
                            <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                              !isMismatched ? 'bg-green-100 text-green-800' : 
                              'bg-red-100 text-red-800'
                            }`}>
                              {!isMismatched ? 'Reconciled' : 'Mismatch'}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="p-2 text-right">
                        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          {group.id !== 'unbatched' && (
                            <>
                              <button 
                                onClick={() => handleViewBatchDetail(group.batch)} 
                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                title="View Details"
                              >
                                <FileText size={16} />
                              </button>
                              <button 
                                onClick={() => handleExportCSV(group.id, group.batch.batch_ref ?? group.id)} 
                                className="p-1.5 text-gray-600 hover:bg-gray-50 rounded transition-colors"
                                title="Export CSV"
                              >
                                <Download size={16} />
                              </button>
                              <button 
                                onClick={() => openReconcileModal(group.batch)} 
                                className="p-1.5 text-brand-teal hover:bg-brand-teal/5 rounded transition-colors"
                                title="Reconcile"
                              >
                                <Scale size={16} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                    <AnimatePresence>
                      {expandedBatches.has(group.id) && (
                        <motion.tr
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                        >
                          <td colSpan={10} className="p-0 border-b border-gray-100">
                            <table className="w-full bg-white">
                              <thead>
                                <tr className="text-[9px] text-gray-400 uppercase font-bold border-b border-gray-50">
                                  <th className="p-2 w-12"></th>
                                  <th className="p-2 text-left">Provider</th>
                                  <th className="p-2 text-left">Booking Ref</th>
                                  <th className="p-2 text-left">Bank</th>
                                  <th className="p-2 text-right">Settlement Amount</th>
                                  <th className="p-2 text-left">Status</th>
                                  <th className="p-2 text-right">Actions</th>
                                </tr>
                              </thead>
                              <tbody>
                                {group.payouts.map(p => (
                                  <tr key={p.id} className="hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0">
                                    <td className="p-2 text-center">
                                      <input 
                                        type="checkbox" 
                                        disabled={!isSelectable(p)} 
                                        checked={selectedIds.includes(p.id)} 
                                        onChange={() => toggleSelect(p.id)} 
                                      />
                                    </td>
                                    <td className="p-2 text-sm font-medium text-gray-700">{p.provider_display_name}</td>
                                    <td className="p-2 text-xs text-gray-500">{p.booking_reference}</td>
                                    <td className="p-2">
                                      {p.bank_details ? (
                                        <span className="text-[10px] font-bold text-green-600 flex items-center gap-1">
                                          <CheckCircle2 size={10} /> OK
                                        </span>
                                      ) : (
                                        <span className="text-[10px] font-bold text-red-500 flex items-center gap-1">
                                          <AlertCircle size={10} /> MISSING
                                        </span>
                                      )}
                                    </td>
                                    <td className="p-2 text-right font-bold text-brand-charcoal">
                                      {formatCurrency(getSettlementAmount(p))}
                                    </td>
                                    <td className="p-2">
                                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase border ${
                                        p.status === 'paid' ? 'bg-green-50 text-green-700 border-green-100' : 
                                        p.is_on_hold ? 'bg-red-50 text-red-700 border-red-100' :
                                        p.status === 'approved' && p.adjusted_amount > 0 && p.adjusted_amount < (p.original_amount || p.amount_net) ? 'bg-indigo-50 text-indigo-700 border-indigo-100' :
                                        p.status === 'approved' && p.adjusted_amount > 0 ? 'bg-blue-50 text-blue-700 border-blue-100' :
                                        p.status === 'approved' ? 'bg-yellow-50 text-yellow-700 border-yellow-100' :
                                        'bg-gray-50 text-gray-700 border-gray-100'
                                      }`}>
                                        {p.is_on_hold ? (p.hold_reason === 'dispute' ? 'DISPUTED' : 'ON HOLD') : 
                                         p.status === 'approved' && p.adjusted_amount > 0 && p.adjusted_amount < (p.original_amount || p.amount_net) ? 'Resolved: Reduced' :
                                         p.status === 'approved' && p.adjusted_amount > 0 ? 'Resolved: Approved' :
                                         p.status === 'approved' ? 'Available' :
                                         PAYOUT_STATUS_LABELS[p.status] || p.status.toUpperCase()}
                                      </span>
                                    </td>
                                    <td className="p-2 text-right">
                                      <div className="flex items-center justify-end gap-2">
                                        <button 
                                          onClick={() => handleViewHistory(p)} 
                                          className="text-blue-600 hover:underline text-[10px] flex items-center gap-1"
                                        >
                                          <History size={10} /> History
                                        </button>
                                        {p.status !== 'paid' && !p.is_on_hold && (
                                          <button 
                                            onClick={() => handleHold(p)} 
                                            className="text-amber-600 hover:underline text-[10px] flex items-center gap-1"
                                          >
                                            <Lock size={10} /> Hold
                                          </button>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </td>
                        </motion.tr>
                      )}
                    </AnimatePresence>
                  </React.Fragment>
                );
              })}
            </tbody>
            </table>
          )}
        </>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2 bg-white px-3 py-2 border border-gray-200 rounded-lg">
                <Filter size={14} className="text-gray-400" />
                <select
                  value={batchStatusFilter}
                  onChange={(e) => setBatchStatusFilter(e.target.value)}
                  className="text-sm focus:outline-none bg-transparent"
                >
                  <option value="All">All Statuses</option>
                  <option value="processed">Processed</option>
                  <option value="processing">Processing</option>
                  <option value="completed">Completed</option>
                </select>
              </div>

              <div className="flex items-center gap-2 bg-white px-3 py-2 border border-gray-200 rounded-lg">
                <Scale size={14} className="text-gray-400" />
                <select
                  value={reconciliationFilter}
                  onChange={(e) => setReconciliationFilter(e.target.value)}
                  className="text-sm focus:outline-none bg-transparent"
                >
                  <option value="All">All Recon Status</option>
                  <option value="pending">Pending</option>
                  <option value="matched">Matched</option>
                  <option value="mismatch">Mismatch</option>
                </select>
              </div>

              <div className="flex items-center gap-2 bg-white px-3 py-2 border border-gray-200 rounded-lg">
                <Calendar size={14} className="text-gray-400" />
                <input 
                  type="date" 
                  value={startDate} 
                  onChange={e => setStartDate(e.target.value)}
                  className="text-sm focus:outline-none bg-transparent"
                />
                <span className="text-gray-300">to</span>
                <input 
                  type="date" 
                  value={endDate} 
                  onChange={e => setEndDate(e.target.value)}
                  className="text-sm focus:outline-none bg-transparent"
                />
              </div>

              {(startDate || endDate || batchStatusFilter !== 'All' || reconciliationFilter !== 'All') && (
                <button 
                  onClick={() => {
                    setStartDate('');
                    setEndDate('');
                    setBatchStatusFilter('All');
                    setReconciliationFilter('All');
                  }}
                  className="text-xs text-brand-teal font-bold hover:underline"
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>

          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-500 uppercase text-[10px] font-bold tracking-wider">
                <th className="p-4">Batch Ref</th>
                <th className="p-4">Created At</th>
                <th className="p-4">Operator</th>
                <th className="p-4 text-right">Count</th>
                <th className="p-4 text-right">Expected Total</th>
                <th className="p-4 text-right">Actual Paid</th>
                <th className="p-4">Status</th>
                <th className="p-4">Reconciliation</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loadingBatches ? (
                <tr>
                  <td colSpan={9} className="p-12 text-center">
                    <Loader2 className="animate-spin mx-auto text-brand-teal mb-2" />
                    <p className="text-gray-500">Loading batches...</p>
                  </td>
                </tr>
              ) : batches.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-12 text-center">
                    <AlertCircle className="mx-auto text-gray-300 mb-2" />
                    <p className="text-gray-500">No payout batches found.</p>
                  </td>
                </tr>
              ) : (
                batches.map((b) => (
                  <tr key={b.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="p-4 font-mono text-sm font-bold text-brand-charcoal">{b.batch_ref ?? b.batch_reference ?? b.id}</td>
                    <td className="p-4 text-sm text-gray-500">{formatDate(b.created_at)}</td>
                    <td className="p-4 text-sm text-gray-500">
                      <div className="flex flex-col">
                        <span>{b.profiles?.company_name || b.profiles?.full_name || 'System'}</span>
                        {b.operator_id && (
                          <span className={`text-[10px] font-bold flex items-center gap-1 mt-1 ${
                            b.operator_bank_details ? 'text-green-600' : 'text-red-500'
                          }`}>
                            {b.operator_bank_details ? (
                              <>
                                <CheckCircle2 size={10} /> 
                                {b.operator_bank_details.bank_name} (****{b.operator_bank_details.account_number.slice(-4)})
                              </>
                            ) : (
                              <>
                                <AlertCircle size={10} /> 
                                Bank Details Missing
                              </>
                            )}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-sm text-gray-900 text-right font-medium">{b.payout_count || b.total_count}</td>
                    <td className="p-4 text-sm text-brand-teal text-right font-bold">{formatCurrency(b.total_amount)}</td>
                    <td className="p-4 text-sm text-right font-medium">
                      {(() => {
                        const val = b.actual_paid_total !== null && b.actual_paid_total !== undefined 
                          ? b.actual_paid_total 
                          : b.derived_actual_paid;
                        const parsed = Number(val || 0);
                        return formatCurrency(parsed);
                      })()}
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                        b.status === 'completed' ? 'bg-green-100 text-green-700' :
                        b.status === 'processing' ? 'bg-blue-100 text-blue-700' :
                        b.status === 'processed' ? 'bg-purple-100 text-purple-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {b.status}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                        b.reconciliation_status === 'matched' ? 'bg-green-100 text-green-700' :
                        b.reconciliation_status === 'mismatch' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-500'
                      }`}>
                        {b.reconciliation_status || 'pending'}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleViewBatchDetail(b)}
                          className="p-2 text-gray-600 hover:text-brand-teal hover:bg-brand-teal/5 rounded-lg transition-all"
                          title="View Details"
                        >
                          <List size={18} />
                        </button>

                        <button
                          onClick={() => handleExportCSV(b.id, b.batch_ref ?? b.id)}
                          className="p-2 text-gray-600 hover:text-brand-teal hover:bg-brand-teal/5 rounded-lg transition-all"
                          title="Export CSV"
                        >
                          <Download size={18} />
                        </button>
                        
                        <button
                          onClick={() => openReconcileModal(b)}
                          className="p-2 text-gray-600 hover:text-brand-teal hover:bg-brand-teal/5 rounded-lg transition-all"
                          title="Reconcile"
                        >
                          <Scale size={18} />
                        </button>

                        {b.status === 'created' && (
                          <button
                            onClick={() => handleUpdateBatchStatus(b.id, 'processing')}
                            className="text-[10px] font-bold uppercase text-blue-600 hover:underline"
                          >
                            Start Processing
                          </button>
                        )}
                        {b.status === 'processing' && (
                          <button
                            onClick={() => handleUpdateBatchStatus(b.id, 'completed')}
                            className="text-[10px] font-bold uppercase text-green-600 hover:underline"
                          >
                            Mark Completed
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Batch Detail Modal */}
      <AnimatePresence>
        {batchDetailModalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                <div>
                  <h3 className="text-xl font-bold text-brand-charcoal">Batch Details</h3>
                  <p className="text-sm text-gray-500 font-mono">{selectedBatchForDetail?.batch_ref ?? selectedBatchForDetail?.id}</p>
                </div>
                <button
                  onClick={() => setBatchDetailModalOpen(false)}
                  className="p-2 hover:bg-gray-200 rounded-full transition-colors"
                >
                  <X size={20} className="text-gray-500" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                    <p className="text-[10px] uppercase font-bold text-gray-400 mb-1">Total Amount</p>
                    <p className="text-xl font-bold text-brand-teal">
                      {formatCurrency(batchPayouts.reduce((sum, p) => sum + getSettlementAmount(p), 0))}
                    </p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                    <p className="text-[10px] uppercase font-bold text-gray-400 mb-1">Payout Count</p>
                    <p className="text-xl font-bold text-brand-charcoal">{selectedBatchForDetail?.payout_count || selectedBatchForDetail?.total_count || 0}</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                    <p className="text-[10px] uppercase font-bold text-gray-400 mb-1">Status</p>
                    <p className="text-xl font-bold text-brand-charcoal uppercase">{selectedBatchForDetail?.status}</p>
                  </div>
                </div>

                <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <List size={18} className="text-brand-teal" />
                  Payouts in this Batch
                </h4>

                {loadingBatchPayouts ? (
                  <div className="py-12 text-center">
                    <Loader2 className="animate-spin mx-auto text-brand-teal mb-2" />
                    <p className="text-gray-500">Loading payouts...</p>
                  </div>
                ) : batchPayouts.length === 0 ? (
                  <div className="py-12 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200">
                    <p className="text-gray-500">No payouts found in this batch.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-gray-100 rounded-xl">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-gray-50 text-gray-500 uppercase text-[10px] font-bold tracking-wider">
                          <th className="p-3">Reference</th>
                          <th className="p-3">Provider</th>
                          <th className="p-3 text-right">Amount</th>
                          <th className="p-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {batchPayouts.map((p) => (
                          <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                            <td className="p-3 text-sm font-mono font-medium">{p.payout_reference}</td>
                            <td className="p-3 text-sm text-gray-600">
                              {p.profiles?.company_name || p.profiles?.full_name || 'Unknown'}
                            </td>
                            <td className="p-3 text-sm text-right font-bold text-brand-teal">
                              {(() => {
                                const settlement = getSettlementAmount(p);
                                return formatCurrency(settlement);
                              })()}
                            </td>
                            <td className="p-3">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-green-100 text-green-700">
                                {p.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-gray-100 bg-gray-50/50 flex justify-end">
                <button
                  onClick={() => setBatchDetailModalOpen(false)}
                  className="px-6 py-2 bg-white border border-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-50 transition-all"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Reconciliation Modal */}
      <AnimatePresence>
        {reconcileModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !reconciling && setReconcileModalOpen(false)}
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
                    <Scale size={20} className="text-brand-teal" />
                    Reconcile Batch
                  </h3>
                  <button
                    onClick={() => setReconcileModalOpen(false)}
                    disabled={reconciling}
                    className="p-1 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-50"
                  >
                    <X size={20} className="text-gray-400" />
                  </button>
                </div>

                <div className="space-y-4 mb-6">
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-500">Batch Reference:</span>
                      <span className="font-bold text-brand-charcoal">{reconcileBatchItem?.batch_ref ?? reconcileBatchItem?.id}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Expected Total:</span>
                      <span className="font-bold text-brand-teal">{formatCurrency(reconcileBatchItem?.total_amount || 0)}</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Actual Paid Total</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-gray-400">R</span>
                      <input
                        type="number"
                        step="0.01"
                        value={actualPaidInput}
                        onChange={(e) => setActualPaidInput(e.target.value)}
                        className="w-full pl-8 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-teal/20"
                        placeholder="0.00"
                        disabled={reconciling}
                      />
                    </div>
                    {reconcileBatchItem && parseFloat(actualPaidInput || '0') !== reconcileBatchItem.total_amount && (
                      <p className="text-[10px] text-red-500 mt-1 font-bold">
                        Difference: {formatCurrency(parseFloat(actualPaidInput || '0') - reconcileBatchItem.total_amount)}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Reconciliation Notes</label>
                    <textarea
                      value={reconcileNotes}
                      onChange={(e) => setReconcileNotes(e.target.value)}
                      className="w-full h-24 p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-teal/20 resize-none"
                      placeholder="Add any notes about mismatches or verification..."
                      disabled={reconciling}
                    />
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setReconcileModalOpen(false)}
                    disabled={reconciling}
                    className="flex-1 px-4 py-3 border border-gray-200 text-gray-600 font-bold rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleReconcile}
                    disabled={reconciling || !actualPaidInput}
                    className="flex-1 px-4 py-3 bg-brand-teal text-white font-bold rounded-xl hover:bg-brand-teal/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {reconciling ? <Loader2 size={18} className="animate-spin" /> : 'Mark Reconciled'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
                  placeholder="e.g., Banking details unverified, Dispute raised by operator..."
                  className="w-full h-32 p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-teal/20 resize-none mb-6"
                  disabled={processing}
                />

                <div className="flex gap-3">
                  <button
                    onClick={() => setHoldModalOpen(false)}
                    disabled={processing}
                    className="flex-1 px-4 py-3 border border-gray-200 text-gray-600 font-bold rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmHold}
                    disabled={processing || !holdReason.trim()}
                    className="flex-1 px-4 py-3 bg-brand-charcoal text-white font-bold rounded-xl hover:bg-brand-charcoal/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
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

      {/* History Modal */}
      <AnimatePresence>
        {historyModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setHistoryModalOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-xl font-bold text-brand-charcoal flex items-center gap-2">
                      <History size={20} className="text-blue-600" />
                      Payout History
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {selectedPayoutForHistory?.payout_reference}
                    </p>
                  </div>
                  <button
                    onClick={() => setHistoryModalOpen(false)}
                    className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                  >
                    <X size={20} className="text-gray-400" />
                  </button>
                </div>

                <div className="max-h-[60vh] overflow-y-auto pr-2">
                  {loadingEvents ? (
                    <div className="flex flex-col items-center justify-center py-12">
                      <Loader2 size={32} className="animate-spin text-brand-teal mb-4" />
                      <p className="text-gray-500">Loading history...</p>
                    </div>
                  ) : payoutEvents.length === 0 ? (
                    <div className="text-center py-12">
                      <AlertCircle size={32} className="mx-auto text-gray-300 mb-4" />
                      <p className="text-gray-500">No history events found for this payout.</p>
                    </div>
                  ) : (
                    <div className="space-y-6 relative before:absolute before:inset-y-0 before:left-4 before:w-0.5 before:bg-gray-100">
                      {payoutEvents.map((event, idx) => (
                        <div key={event.id} className="relative pl-10">
                          <div className={`absolute left-2 top-1 w-4 h-4 rounded-full border-2 border-white shadow-sm z-10 ${
                            event.event_type === 'paid' ? 'bg-green-500' :
                            event.event_type === 'hold' ? 'bg-amber-500' :
                            event.event_type === 'released' ? 'bg-blue-500' :
                            event.event_type === 'approved' ? 'bg-brand-teal' :
                            'bg-gray-400'
                          }`} />
                          
                          <div className="flex flex-col">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-brand-charcoal capitalize">
                                {event.event_type.replace('_', ' ')}
                              </span>
                              <span className="text-xs text-gray-400">
                                {formatDate(event.created_at)}
                              </span>
                            </div>
                            <p className="text-sm text-gray-500 mt-1">
                              {event.event_type === 'hold' && event.new_state?.hold_reason 
                                ? `Reason: ${event.new_state.hold_reason}`
                                : event.event_type === 'paid'
                                ? `Processed by Admin`
                                : event.event_type === 'requested'
                                ? `Withdrawal requested by Provider`
                                : `Status updated to ${event.event_type}`}
                            </p>
                            {event.triggered_role && (
                              <span className="text-[10px] uppercase tracking-wider font-semibold text-gray-400 mt-1">
                                Triggered by {event.triggered_role}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-8">
                  <button
                    onClick={() => setHistoryModalOpen(false)}
                    className="w-full px-4 py-2 bg-gray-100 text-gray-700 font-bold rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Close
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
