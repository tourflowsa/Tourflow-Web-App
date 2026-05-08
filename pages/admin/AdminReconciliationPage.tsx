import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  Search, 
  Filter, 
  Calendar,
  Building,
  ArrowRight,
  RefreshCw,
  Eye,
  FileWarning,
  Copy,
  Calculator,
  Clock,
  X
} from 'lucide-react';
import { 
  getReconciliationSummary, 
  getMissingPayoutBookings, 
  getDuplicatePayoutRows, 
  getPayoutMathMismatches,
  repairPayoutLedgerRow,
  reconcileBookingFinancials
} from '../../lib/payoutService';
import { listOperators } from '../../lib/adminPayoutService';
import { formatCurrency, formatDate } from '../../lib/formatUtils';

export const AdminReconciliationPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'missing' | 'duplicates' | 'math'>('missing');
  const [loading, setLoading] = useState(true);
  const [lastChecked, setLastChecked] = useState<string>(new Date().toLocaleTimeString());
  
  // Data
  const [summary, setSummary] = useState<any>(null);
  const [missingBookings, setMissingBookings] = useState<any[]>([]);
  const [duplicateRows, setDuplicateRows] = useState<any[]>([]);
  const [mathMismatches, setMathMismatches] = useState<any[]>([]);
  const [operators, setOperators] = useState<any[]>([]);
  const [reconciling, setReconciling] = useState(false);
  const [reconcileResult, setReconcileResult] = useState<any>(null);
  const [showReconcileModal, setShowReconcileModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [operatorId, setOperatorId] = useState('all');
  const [includeArchived, setIncludeArchived] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const filters = { startDate, endDate, operatorId, includeArchived };
      
      const [
        summaryData, 
        missingData, 
        duplicatesData, 
        mathData,
        opsData
      ] = await Promise.all([
        getReconciliationSummary(filters),
        getMissingPayoutBookings(filters),
        getDuplicatePayoutRows(filters),
        getPayoutMathMismatches(filters),
        listOperators()
      ]);

      setSummary(summaryData);
      setMissingBookings(missingData);
      setDuplicateRows(duplicatesData);
      
      // Re-calculate math mismatches client-side
      const processedMathData = mathData.map((m: any) => {
        if (!m.isBookingMismatch || !m.payouts) return m;

        const finalAmounts = m.payouts.map((row: any) => 
            row.adjusted_amount != null ? Number(row.adjusted_amount) :
            row.amount_net != null ? Number(row.amount_net) :
            row.original_amount != null ? Number(row.original_amount) :
            0
        );

        const expectedTotal = finalAmounts.reduce((a: number, b: number) => a + b, 0);
        const actualPaidTotal = m.payouts
            .filter((row: any) => row.status === 'paid')
            .reduce((sum: number, row: any) => {
                 const finalAmt = (row.adjusted_amount != null ? Number(row.adjusted_amount) :
                                  row.amount_net != null ? Number(row.amount_net) :
                                  row.original_amount != null ? Number(row.original_amount) :
                                  0);
                 return sum + finalAmt;
            }, 0);
        
        const difference = expectedTotal - actualPaidTotal;

        return {
          ...m,
          expected_total: expectedTotal,
          actual_paid: actualPaidTotal,
          difference: difference
        };
      }).filter((m: any) => !m.isBookingMismatch || Math.abs(m.difference) > 0.01);
      
      setMathMismatches(processedMathData);
      setOperators(opsData);
      setLastChecked(new Date().toLocaleTimeString());
    } catch (err) {
      console.error("Failed to load reconciliation data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [startDate, endDate, operatorId, includeArchived]);

  const handleRepair = async (payoutId: string) => {
    if (!window.confirm("Are you sure you want to attempt a math repair on this payout row? This will recalculate fees based on the booking snapshot.")) return;
    try {
      await repairPayoutLedgerRow(payoutId);
      await loadData();
    } catch (err: any) {
      setToastMessage("Repair failed: " + err.message);
    }
  };

  const handleReconcile = async (bookingId: string) => {
    setReconciling(true);
    try {
      const result = await reconcileBookingFinancials(bookingId);
      
      const expectedTotal = Number(result?.expected_total ?? 0);
      const actualPaid = Number(result?.actual_paid_total ?? result?.actual_paid ?? 0);
      const difference = Number(result?.difference ?? result?.mismatch ?? (expectedTotal - actualPaid));
      const isReconciled = Boolean(result?.is_reconciled ?? Math.abs(difference) <= 0.01);
      
      if (isReconciled) {
        setToastMessage("Booking payouts reconcile successfully.");
        setMathMismatches(prev => prev.filter(m => m.booking_id !== bookingId));
      } else {
        setToastMessage(`Booking payouts still do not reconcile. Difference: R${difference.toFixed(2)}.`);
      }
      await loadData();
    } catch (err: any) {
      setToastMessage("Reconciliation failed: " + err.message);
    } finally {
      setReconciling(false);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="text-brand-teal" size={24} />
            <h1 className="text-3xl font-bold text-brand-charcoal">Reconciliation Dashboard</h1>
          </div>
          <p className="text-gray-500">Verify payout integrity and identify pipeline gaps.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-xs text-gray-400 uppercase font-bold">Last Checked</p>
            <p className="text-sm font-mono text-gray-600">{lastChecked}</p>
          </div>
          <button 
            onClick={loadData}
            disabled={loading}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-brand-teal"
            title="Refresh Data"
          >
            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm mb-8 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Calendar size={18} className="text-gray-400" />
          <input 
            type="date" 
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="text-sm border-none focus:ring-0 p-1"
          />
          <span className="text-gray-300">to</span>
          <input 
            type="date" 
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="text-sm border-none focus:ring-0 p-1"
          />
        </div>
        <div className="h-6 w-px bg-gray-100" />
        <div className="flex items-center gap-2">
          <Building size={18} className="text-gray-400" />
          <select 
            value={operatorId}
            onChange={(e) => setOperatorId(e.target.value)}
            className="text-sm border-none focus:ring-0 bg-transparent"
          >
            <option value="all">All Operators</option>
            {operators.map(op => (
              <option key={op.id} value={op.id}>{op.company_name || op.full_name}</option>
            ))}
          </select>
        </div>
        <div className="h-6 w-px bg-gray-100" />
        <label className="flex items-center gap-2 cursor-pointer">
          <input 
            type="checkbox" 
            checked={includeArchived}
            onChange={(e) => setIncludeArchived(e.target.checked)}
            className="rounded border-gray-300 text-brand-teal focus:ring-brand-teal"
          />
          <span className="text-sm text-gray-600">Include Archived</span>
        </label>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <p className="text-xs font-bold text-gray-400 uppercase mb-1">Completed Bookings</p>
          <p className="text-3xl font-bold text-brand-charcoal">{summary?.completedBookingsCount || 0}</p>
        </div>
        <div 
          className={`bg-white p-6 rounded-2xl border border-gray-100 shadow-sm ${missingBookings.length > 0 ? 'border-l-4 border-l-amber-500' : ''}`}
          title="Completed bookings that are missing one or more required payout ledger rows based on assigned resources."
        >
          <p className="text-xs font-bold text-gray-400 uppercase mb-1">Missing Payouts</p>
          <div className="flex items-center gap-2">
            <p className={`text-3xl font-bold ${missingBookings.length > 0 ? 'text-amber-600' : 'text-brand-charcoal'}`}>
              {missingBookings.length}
            </p>
            {missingBookings.length > 0 && <AlertTriangle size={20} className="text-amber-500" />}
          </div>
        </div>
        <div 
          className={`bg-white p-6 rounded-2xl border border-gray-100 shadow-sm ${duplicateRows.length > 0 ? 'border-l-4 border-l-red-500' : ''}`}
          title="Multiple payout rows detected for the same resource on a single booking. This can lead to double-payments."
        >
          <p className="text-xs font-bold text-gray-400 uppercase mb-1">Duplicate Rows</p>
          <div className="flex items-center gap-2">
            <p className={`text-3xl font-bold ${duplicateRows.length > 0 ? 'text-red-600' : 'text-brand-charcoal'}`}>
              {duplicateRows.length}
            </p>
            {duplicateRows.length > 0 && <Copy size={20} className="text-red-500" />}
          </div>
        </div>
        <div 
          className={`bg-white p-6 rounded-2xl border border-gray-100 shadow-sm ${mathMismatches.length > 0 ? 'border-l-4 border-l-red-500' : ''}`}
          title="Differences between the expected payout amount and the actual recorded payout amount. This often indicates a fee calculation error or manual override discrepancy."
        >
          <p className="text-xs font-bold text-gray-400 uppercase mb-1">Math Mismatches</p>
          <div className="flex items-center gap-2">
            <p className={`text-3xl font-bold ${mathMismatches.length > 0 ? 'text-red-600' : 'text-brand-charcoal'}`}>
              {mathMismatches.length}
            </p>
            {mathMismatches.length > 0 && <Calculator size={20} className="text-red-500" />}
          </div>
        </div>
      </div>

      {/* Payout Status Totals */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100">
          <p className="text-xs font-bold text-blue-400 uppercase mb-1">Pending Payouts</p>
          <p className="text-2xl font-bold text-blue-700">{formatCurrency(summary?.statusTotals?.pending?.total || 0)}</p>
          <p className="text-sm text-blue-600 mt-1">{summary?.statusTotals?.pending?.count || 0} rows</p>
        </div>
        <div className="bg-amber-50 p-6 rounded-2xl border border-amber-100">
          <p className="text-xs font-bold text-amber-400 uppercase mb-1">Approved Payouts</p>
          <p className="text-2xl font-bold text-amber-700">{formatCurrency(summary?.statusTotals?.approved?.total || 0)}</p>
          <p className="text-sm text-amber-600 mt-1">{summary?.statusTotals?.approved?.count || 0} rows</p>
        </div>
        <div className="bg-green-50 p-6 rounded-2xl border border-green-100">
          <p className="text-xs font-bold text-green-400 uppercase mb-1">Paid Payouts</p>
          <p className="text-2xl font-bold text-green-700">{formatCurrency(summary?.statusTotals?.paid?.total || 0)}</p>
          <p className="text-sm text-green-600 mt-1">{summary?.statusTotals?.paid?.count || 0} rows</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-100 mb-6 overflow-x-auto">
        <button 
          onClick={() => setActiveTab('missing')}
          className={`px-6 py-3 text-sm font-bold transition-colors whitespace-nowrap flex items-center gap-2 ${activeTab === 'missing' ? 'text-brand-teal border-b-2 border-brand-teal' : 'text-gray-400 hover:text-gray-600'}`}
        >
          <FileWarning size={18} />
          Missing Payouts ({missingBookings.length})
        </button>
        <button 
          onClick={() => setActiveTab('duplicates')}
          className={`px-6 py-3 text-sm font-bold transition-colors whitespace-nowrap flex items-center gap-2 ${activeTab === 'duplicates' ? 'text-brand-teal border-b-2 border-brand-teal' : 'text-gray-400 hover:text-gray-600'}`}
        >
          <Copy size={18} />
          Duplicate Rows ({duplicateRows.length})
        </button>
        <button 
          onClick={() => setActiveTab('math')}
          className={`px-6 py-3 text-sm font-bold transition-colors whitespace-nowrap flex items-center gap-2 ${activeTab === 'math' ? 'text-brand-teal border-b-2 border-brand-teal' : 'text-gray-400 hover:text-gray-600'}`}
        >
          <Calculator size={18} />
          Math Mismatches ({mathMismatches.length})
        </button>
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400">
            <RefreshCw size={32} className="animate-spin mx-auto mb-4" />
            <p>Analyzing data integrity...</p>
          </div>
        ) : (
          <>
            {activeTab === 'missing' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Booking Ref</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Tour / Date</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-center">Expected</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-center">Actual</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Operator</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {missingBookings.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                          <CheckCircle2 size={32} className="text-green-500 mx-auto mb-2" />
                          No missing payouts found.
                        </td>
                      </tr>
                    ) : (
                      missingBookings.map(b => (
                        <tr key={b.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4">
                            <p className="font-mono font-bold text-brand-teal">{b.booking_reference}</p>
                            <p className="text-[10px] text-gray-400 font-mono truncate max-w-[120px]">{b.id}</p>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-sm font-bold text-brand-charcoal truncate max-w-[200px]">{b.tours?.title}</p>
                            <p className="text-xs text-gray-500">{formatDate(b.start_date)}</p>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className="text-sm font-bold text-gray-600">{b.expectedRows}</span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={`text-sm font-bold ${b.actualRows === 0 ? 'text-red-500' : 'text-amber-500'}`}>
                              {b.actualRows}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-sm text-gray-600 truncate max-w-[150px]">{b.operator_name}</p>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col gap-1">
                              <button 
                                onClick={() => navigate(`/admin/bookings/${b.id}`)}
                                className="text-gray-400 hover:text-brand-teal transition-colors flex items-center gap-1 text-xs font-bold"
                              >
                                <Eye size={14} /> View Booking
                              </button>
                              <button 
                                onClick={() => handleReconcile(b.id)}
                                disabled={reconciling}
                                className="text-brand-teal hover:text-teal-700 transition-colors flex items-center gap-1 text-xs font-bold"
                              >
                                <RefreshCw size={14} className={reconciling ? 'animate-spin' : ''} /> Reconcile
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'duplicates' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Booking Ref</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Provider</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-center">Count</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Payout Refs</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Statuses</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {duplicateRows.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                          <CheckCircle2 size={32} className="text-green-500 mx-auto mb-2" />
                          No duplicate payout rows found.
                        </td>
                      </tr>
                    ) : (
                      duplicateRows.map((d, i) => (
                        <tr key={i} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4">
                            <p className="font-mono font-bold text-brand-teal">{d.booking_reference}</p>
                            <p className="text-[10px] text-gray-400 font-mono truncate max-w-[120px]">{d.booking_id}</p>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-sm font-bold text-brand-charcoal">{d.provider_name}</p>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className="text-sm font-bold text-red-500">{d.duplicateCount}</span>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-xs text-gray-500 font-mono">{d.payoutRefs}</p>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-xs text-gray-500 uppercase font-bold">{d.statuses}</p>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col gap-1">
                              <button 
                                onClick={() => navigate(`/admin/bookings/${d.booking_id}`)}
                                className="text-gray-400 hover:text-brand-teal transition-colors flex items-center gap-1 text-xs font-bold"
                              >
                                <Eye size={14} /> View Booking
                              </button>
                              <button 
                                onClick={() => handleReconcile(d.booking_id)}
                                disabled={reconciling}
                                className="text-brand-teal hover:text-teal-700 transition-colors flex items-center gap-1 text-xs font-bold"
                              >
                                <RefreshCw size={14} className={reconciling ? 'animate-spin' : ''} /> Reconcile
                              </button>
                              <button 
                                onClick={() => navigate(`/admin/payouts?search=${d.booking_reference}`)}
                                className="text-gray-400 hover:text-brand-teal transition-colors flex items-center gap-1 text-xs font-bold"
                              >
                                <Eye size={14} /> View Payouts
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'math' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Type / Reference</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Entity / Booking</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Expected</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Actual</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Difference</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {mathMismatches.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                          <CheckCircle2 size={32} className="text-green-500 mx-auto mb-2" />
                          No math or financial mismatches found.
                        </td>
                      </tr>
                    ) : (
                      mathMismatches.map(m => (
                        <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex flex-col gap-1">
                              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full w-fit ${
                                m.mismatch_type === 'Math Error' ? 'bg-red-100 text-red-700' :
                                m.mismatch_type === 'Escrow Sync' ? 'bg-amber-100 text-amber-700' :
                                m.mismatch_type === 'Payout Status Gap' ? 'bg-purple-100 text-purple-700' :
                                'bg-blue-100 text-blue-700'
                              }`}>
                                {m.mismatch_type}
                              </span>
                              <p className="font-mono font-bold text-brand-charcoal">
                                {m.isBookingMismatch ? m.booking_reference : m.payout_reference}
                              </p>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-sm font-bold text-brand-charcoal">
                              {m.isBookingMismatch ? m.operator_name : m.provider_name}
                            </p>
                            <p className="text-xs text-gray-500">
                              {m.isBookingMismatch ? 'Booking' : `Ref: ${m.booking_reference}`}
                            </p>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className="text-sm font-mono">
                              {formatCurrency(m.isBookingMismatch ? m.expected_total : m.expectedNet, m.currency)}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className="text-sm font-mono font-bold text-red-600">
                              {formatCurrency(m.isBookingMismatch ? m.actual_paid : m.amount_net, m.currency)}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className="text-sm font-mono font-bold text-amber-600">
                              {formatCurrency(m.isBookingMismatch ? m.difference : Math.abs(m.amount_net - m.expectedNet), m.currency)}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col gap-1">
                              {m.isBookingMismatch ? (
                                <>
                                  <button 
                                    onClick={() => navigate(`/admin/bookings/${m.booking_id}`)}
                                    className="text-gray-400 hover:text-brand-teal transition-colors flex items-center gap-1 text-xs font-bold"
                                  >
                                    <Eye size={14} /> View Booking
                                  </button>
                                  <button 
                                    onClick={() => handleReconcile(m.booking_id)}
                                    disabled={reconciling}
                                    className="text-brand-teal hover:text-teal-700 transition-colors flex items-center gap-1 text-xs font-bold"
                                  >
                                    <RefreshCw size={14} className={reconciling ? 'animate-spin' : ''} /> Reconcile
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button 
                                    onClick={() => navigate(`/admin/payouts/${m.id}`)}
                                    className="text-gray-400 hover:text-brand-teal transition-colors flex items-center gap-1 text-xs font-bold"
                                  >
                                    <Eye size={14} /> View Payout
                                  </button>
                                  <button 
                                    onClick={() => handleReconcile(m.booking_id)}
                                    disabled={reconciling}
                                    className="text-brand-teal hover:text-teal-700 transition-colors flex items-center gap-1 text-xs font-bold"
                                  >
                                    <RefreshCw size={14} className={reconciling ? 'animate-spin' : ''} /> Reconcile
                                  </button>
                                  <button 
                                    onClick={() => handleRepair(m.id)}
                                    className="text-amber-600 hover:text-amber-700 transition-colors flex items-center gap-1 text-xs font-bold"
                                  >
                                    <RefreshCw size={14} /> Repair Math
                                  </button>
                                </>
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
          </>
        )}
      </div>

      {/* Footer Info */}
      <div className="mt-8 p-6 bg-gray-50 rounded-2xl border border-gray-100">
        <h3 className="text-sm font-bold text-brand-charcoal mb-2 flex items-center gap-2">
          <ShieldCheck size={18} className="text-brand-teal" />
          Reconciliation Logic
        </h3>
        <ul className="text-xs text-gray-500 space-y-2 list-disc pl-4">
          <li><strong>Missing Payouts:</strong> Bookings marked 'completed' are checked against accepted/completed assignments (Driver, Guide) and Vehicle assignments. If the count of active payout rows doesn't match the expected count, it's flagged.</li>
          <li><strong>Duplicate Rows:</strong> Active (non-archived) payout rows are grouped by Booking ID and Provider ID. Any group with more than one row is flagged.</li>
          <li><strong>Math Mismatches:</strong> Final expected payout settlement is compared against actual paid payouts. Final settlement uses adjusted_amount first, then amount_net, then original_amount. Differences greater than 0.01 are flagged.</li>
          <li><strong>Status Gaps:</strong> This dashboard focuses on structural integrity. Status-based reconciliation (e.g., stuck in pending) is monitored via standard payout lists.</li>
        </ul>
      </div>

      {/* Reconciliation Result Modal */}
      {showReconcileModal && reconcileResult && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-xl font-bold text-brand-charcoal flex items-center gap-2">
                <Calculator className="text-brand-teal" size={24} />
                Reconciliation Result
              </h3>
              <button 
                onClick={() => setShowReconcileModal(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-8">
              <div className="space-y-6">
                <div className="flex justify-between items-center pb-4 border-b border-gray-50">
                  <span className="text-gray-500 font-medium">Expected Total</span>
                  <span className="text-lg font-mono font-bold text-brand-charcoal">
                    {formatCurrency(reconcileResult.expected_total)}
                  </span>
                </div>
                
                <div className="flex justify-between items-center pb-4 border-b border-gray-50">
                  <span className="text-gray-500 font-medium">Actual Paid</span>
                  <span className="text-lg font-mono font-bold text-green-600">
                    {formatCurrency(reconcileResult.actual_paid)}
                  </span>
                </div>

                <div className="flex justify-between items-center pb-4 border-b border-gray-50">
                  <span className="text-gray-500 font-medium">Approved Pending</span>
                  <span className="text-lg font-mono font-bold text-amber-600">
                    {formatCurrency(reconcileResult.approved_total)}
                  </span>
                </div>

                <div className="flex justify-between items-center pb-4 border-b border-gray-50">
                  <span className="text-gray-500 font-medium">Difference</span>
                  <span className={`text-lg font-mono font-bold ${reconcileResult.expected_total - (reconcileResult.actual_paid + reconcileResult.approved_total) === 0 ? 'text-gray-400' : 'text-red-500'}`}>
                    {formatCurrency(reconcileResult.expected_total - (reconcileResult.actual_paid + reconcileResult.approved_total))}
                  </span>
                </div>
              </div>

              <button 
                onClick={() => setShowReconcileModal(false)}
                className="w-full mt-8 py-4 bg-brand-charcoal text-white rounded-xl font-bold hover:bg-brand-charcoal/90 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-4 right-4 bg-brand-charcoal text-white px-6 py-3 rounded-xl shadow-lg z-[60] flex items-center gap-3">
          <p className="text-sm font-bold">{toastMessage}</p>
          <button onClick={() => setToastMessage(null)} className="text-gray-400 hover:text-white">
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
};
