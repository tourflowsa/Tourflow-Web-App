
import React, { useState, useMemo } from 'react';
import { 
  TrendingUp, 
  DollarSign, 
  Truck, 
  CreditCard, 
  Search, 
  Filter, 
  Download, 
  ChevronRight, 
  ArrowUpRight, 
  ArrowDownRight, 
  AlertCircle,
  AlertTriangle,
  X,
  Info,
  Calendar,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useOperatorFinancials } from '../../hooks/useOperatorFinancials';
import { useOperatorReadiness } from '../../hooks/useOperatorReadiness';
import { ReadinessDetailModal } from '../../components/readiness/ReadinessDetailModal';
import { formatCurrency, formatDate } from '../../lib/formatUtils';
import { BookingFinancialRow } from '../../lib/financialService';

export const FinancialDashboard: React.FC = () => {
  const { user } = useAuth();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  const { summary, bookings, loading, error } = useOperatorFinancials(user?.id, startDate, endDate);
  const { readiness, loading: readinessLoading } = useOperatorReadiness(user?.id);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [riskFilter, setRiskFilter] = useState('all');
  const [selectedBooking, setSelectedBooking] = useState<BookingFinancialRow | null>(null);
  const [readinessModal, setReadinessModal] = useState<{ isOpen: boolean; type: 'bank' | 'compliance' | 'disputes' | 'escrow'; title: string; items: any[] }>({
    isOpen: false,
    type: 'bank',
    title: '',
    items: []
  });

  const filteredBookings = useMemo(() => {
    return bookings.filter(b => {
      const matchesSearch = b.booking_ref.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || b.status === statusFilter;
      const matchesRisk = riskFilter === 'all' || 
        (riskFilter === 'negative' && b.negative_margin) ||
        (riskFilter === 'low' && b.low_margin) ||
        (riskFilter === 'dispute' && b.high_dispute_impact) ||
        (riskFilter === 'critical' && b.financial_status === 'critical') ||
        (riskFilter === 'warning' && b.financial_status === 'warning');
      
      return matchesSearch && matchesStatus && matchesRisk;
    });
  }, [bookings, searchTerm, statusFilter, riskFilter]);

  const exportSummaryCSV = () => {
    if (!summary) return;
    const headers = ['Metric', 'Value'];
    const rows = [
      ['Total Revenue', summary.total_revenue],
      ['Total Provider Costs', summary.total_provider_cost],
      ['Total Adjusted Payout Costs', summary.total_adjusted_payout_cost],
      ['Platform Fees', summary.total_platform_fees],
      ['Original Margin', summary.original_margin],
      ['Adjusted Margin', summary.adjusted_margin],
      ['Pending Payouts', summary.pending_payouts],
      ['On Hold Amount', summary.on_hold_amount],
      ['Dispute Adjustments', summary.dispute_adjustments],
      ['Booking Count', summary.booking_count],
      ['Negative Margin Count', summary.negative_margin_count],
      ['Low Margin Count', summary.low_margin_count]
    ];
    
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `financial_summary_${startDate || 'all'}_to_${endDate || 'present'}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportBookingsCSV = () => {
    if (filteredBookings.length === 0) return;
    const headers = ['Booking Ref', 'Status', 'Revenue', 'Original Cost', 'Adjusted Cost', 'Platform Fee', 'Original Margin', 'Adjusted Margin', 'Pending', 'On Hold', 'Dispute Adjustment'];
    const rows = filteredBookings.map(b => [
      b.booking_ref,
      b.status,
      b.revenue,
      b.original_provider_cost,
      b.adjusted_provider_cost,
      b.platform_fee,
      b.original_margin,
      b.adjusted_margin,
      b.pending_payout_amount,
      b.on_hold_amount,
      b.dispute_adjustment
    ]);
    
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `booking_financials_${startDate || 'all'}_to_${endDate || 'present'}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-teal"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 bg-red-50 border border-red-200 rounded-2xl text-center">
        <AlertCircle className="mx-auto text-red-500 mb-4" size={48} />
        <h2 className="text-xl font-bold text-red-800 mb-2">Failed to load financials</h2>
        <p className="text-red-600">{error.message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Payment Readiness Widget */}
      {!readinessLoading && readiness && (
        <div className={`p-6 rounded-2xl border ${
          readiness.status === 'ready' ? 'bg-green-50 border-green-100' :
          readiness.status === 'at_risk' ? 'bg-amber-50 border-amber-100' :
          'bg-red-50 border-red-100'
        }`}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className={`p-3 rounded-xl ${
                readiness.status === 'ready' ? 'bg-green-500 text-white' :
                readiness.status === 'at_risk' ? 'bg-amber-500 text-white' :
                'bg-red-500 text-white'
              }`}>
                {readiness.status === 'ready' ? <ShieldCheck size={28} /> : 
                 readiness.status === 'at_risk' ? <ShieldAlert size={28} /> : 
                 <ShieldX size={28} />}
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 leading-tight">
                  Payment Readiness: {readiness.status.toUpperCase().replace('_', ' ')}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-1000 ${
                        readiness.score >= 80 ? 'bg-green-500' :
                        readiness.score >= 40 ? 'bg-amber-500' :
                        'bg-red-500'
                      }`}
                      style={{ width: `${readiness.score}%` }}
                    />
                  </div>
                  <span className="text-sm font-bold text-gray-600">{readiness.score}/100</span>
                </div>
                {readiness.criticalIssues.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {readiness.criticalIssues.map((issue, idx) => (
                      <span key={idx} className="flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 text-[10px] font-bold uppercase rounded">
                        <AlertCircle size={10} /> Critical: {issue}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 flex-1">
              <ReadinessSignal 
                label="Your Bank Details" 
                count={readiness.breakdown.operatorBankDetailsMissing ? 1 : 0} 
                isGood={!readiness.breakdown.operatorBankDetailsMissing}
                critical={readiness.breakdown.operatorBankDetailsMissing}
                helpText="Your bank details must be saved for finance operations to work correctly."
              />
              <ReadinessSignal 
                label="Provider Bank Details" 
                count={readiness.breakdown.providerBankDetailsMissing} 
                isGood={readiness.breakdown.providerBankDetailsMissing === 0}
                critical={readiness.breakdown.providerBankDetailsMissing > 0}
                helpText="Providers linked to payable bookings need valid bank details so payouts are not delayed."
                onClick={readiness.breakdown.providerBankDetails.items.length > 0 ? () => setReadinessModal({
                  isOpen: true,
                  type: 'bank',
                  title: 'Provider Bank Details Missing',
                  items: readiness.breakdown.providerBankDetails.items
                }) : undefined}
              />
              <ReadinessSignal 
                label="Provider Compliance" 
                count={readiness.breakdown.expiredDocuments} 
                isGood={readiness.breakdown.expiredDocuments === 0}
                critical={readiness.breakdown.expiredDocuments > 0}
                helpText="Providers linked to active bookings must have valid required documents."
                onClick={readiness.breakdown.providerCompliance.items.length > 0 ? () => setReadinessModal({
                  isOpen: true,
                  type: 'compliance',
                  title: 'Provider Compliance Issues',
                  items: readiness.breakdown.providerCompliance.items
                }) : undefined}
              />
              <ReadinessSignal 
                label="Disputes" 
                count={readiness.breakdown.activeDisputes} 
                isGood={readiness.breakdown.activeDisputes === 0}
                helpText="Open disputes may delay payout readiness until resolved."
                onClick={readiness.breakdown.disputes.items.length > 0 ? () => setReadinessModal({
                  isOpen: true,
                  type: 'disputes',
                  title: 'Active Disputes & Adjustments',
                  items: readiness.breakdown.disputes.items
                }) : undefined}
              />
              <ReadinessSignal 
                label="Escrow Funding" 
                count={readiness.breakdown.unfundedEscrow} 
                isGood={readiness.breakdown.unfundedEscrow === 0}
                helpText="Bookings must have sufficient escrow funding to cover all provider payouts."
                onClick={readiness.breakdown.escrowFunding.items.length > 0 ? () => setReadinessModal({
                  isOpen: true,
                  type: 'escrow',
                  title: 'Escrow Funding Issues',
                  items: readiness.breakdown.escrowFunding.items
                }) : undefined}
              />
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-brand-charcoal">Financial Dashboard</h1>
          <p className="text-gray-500 mt-1">Real-time revenue, cost, and margin analysis</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={exportSummaryCSV}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <Download size={16} /> Summary CSV
          </button>
          <button 
            onClick={exportBookingsCSV}
            className="flex items-center gap-2 px-4 py-2 bg-brand-teal text-white rounded-lg text-sm font-bold hover:bg-brand-teal/90 transition-colors"
          >
            <Download size={16} /> Bookings CSV
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <SummaryCard 
          title="Total Revenue" 
          value={summary?.total_revenue || 0} 
          icon={<DollarSign size={20} />}
          color="teal"
        />
        <SummaryCard 
          title="Provider Costs" 
          value={summary?.total_provider_cost || 0} 
          icon={<Truck size={20} />}
          color="charcoal"
        />
        <SummaryCard 
          title="Adjusted Costs" 
          value={summary?.total_adjusted_payout_cost || 0} 
          icon={<CreditCard size={20} />}
          color="charcoal"
          subtitle="After dispute settlements"
        />
        <SummaryCard 
          title="Platform Fees" 
          value={summary?.total_platform_fees || 0} 
          icon={<Info size={20} />}
          color="charcoal"
        />
        <SummaryCard 
          title="Original Margin" 
          value={summary?.original_margin || 0} 
          icon={<TrendingUp size={20} />}
          color={summary && summary.original_margin < 0 ? 'red' : 'green'}
        />
        <SummaryCard 
          title="Adjusted Margin" 
          value={summary?.adjusted_margin || 0} 
          icon={<TrendingUp size={20} />}
          color={summary && summary.adjusted_margin < 0 ? 'red' : 'green'}
          subtitle="Final realized margin"
        />
        <SummaryCard 
          title="Pending Payouts" 
          value={summary?.pending_payouts || 0} 
          icon={<Calendar size={20} />}
          color="amber"
        />
        <SummaryCard 
          title="On Hold Amount" 
          value={summary?.on_hold_amount || 0} 
          icon={<AlertCircle size={20} />}
          color={summary && summary.on_hold_amount > 0 ? 'red' : 'charcoal'}
        />
        <SummaryCard 
          title="Dispute Adjustments" 
          value={summary?.dispute_adjustments || 0} 
          icon={<AlertCircle size={20} />}
          color={summary && summary.dispute_adjustments > 0 ? 'amber' : 'charcoal'}
          subtitle="Total cost reduction"
        />
      </div>

      {/* Risk Summary */}
      {(summary?.critical_issues_count || 0) > 0 || (summary?.warning_issues_count || 0) > 0 ? (
        <div className={`p-4 rounded-2xl border flex items-center gap-4 ${
          (summary?.critical_issues_count || 0) > 0 
            ? 'bg-red-50 border-red-200' 
            : 'bg-amber-50 border-amber-200'
        }`}>
          {(summary?.critical_issues_count || 0) > 0 ? (
            <AlertCircle className="text-red-500" size={24} />
          ) : (
            <AlertTriangle size={24} className="text-amber-500" />
          )}
          <div>
            <p className={`font-bold ${(summary?.critical_issues_count || 0) > 0 ? 'text-red-800' : 'text-amber-800'}`}>
              Financial Reconciliation Alert
            </p>
            <p className={`text-sm ${(summary?.critical_issues_count || 0) > 0 ? 'text-red-600' : 'text-amber-600'}`}>
              Found {summary?.critical_issues_count || 0} critical reconciliation issues and {summary?.warning_issues_count || 0} low-margin warnings in this period.
            </p>
          </div>
          <button 
            onClick={() => setRiskFilter((summary?.critical_issues_count || 0) > 0 ? 'critical' : 'warning')}
            className={`ml-auto px-4 py-2 rounded-lg font-bold text-sm border transition-colors ${
              (summary?.critical_issues_count || 0) > 0 
                ? 'border-red-200 text-red-700 hover:bg-red-100' 
                : 'border-amber-200 text-amber-700 hover:bg-amber-100'
            }`}
          >
            Review Issues
          </button>
        </div>
      ) : null}

      {/* Table Filters */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm space-y-4">
        {/* Date Range Section */}
        <div className="flex flex-wrap items-center gap-4 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Calendar size={18} className="text-gray-400" />
            <span className="text-sm font-bold text-gray-700">Service Period:</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-[10px] uppercase font-bold text-gray-400">From</label>
              <input 
                type="date" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-teal"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-[10px] uppercase font-bold text-gray-400">To</label>
              <input 
                type="date" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-teal"
              />
            </div>
          </div>
          {(startDate || endDate) && (
            <button 
              onClick={() => { setStartDate(''); setEndDate(''); }}
              className="px-3 py-1.5 text-xs font-bold text-red-500 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-1 border border-red-100"
            >
              <X size={14} /> Clear Range
            </button>
          )}
        </div>

        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="Search by booking ref..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-teal focus:border-transparent outline-none"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-teal"
            >
              <option value="all">All Statuses</option>
              <option value="confirmed">Confirmed</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <select 
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-teal"
            >
              <option value="all">All Risk Levels</option>
              <option value="critical">Critical (Mismatch)</option>
              <option value="warning">Warning (Low Margin)</option>
              <option value="dispute">High Dispute Impact</option>
            </select>
          </div>
        </div>
      </div>

      {/* Bookings Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-[10px] text-gray-500 uppercase font-bold border-b border-gray-100">
              <tr>
                <th className="px-6 py-4">Booking Ref</th>
                <th className="px-6 py-4 text-right">Revenue</th>
                <th className="px-6 py-4 text-right">Adj. Cost</th>
                <th className="px-6 py-4 text-right">Adj. Margin</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Reconciliation</th>
                <th className="px-6 py-4">Flags</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {filteredBookings.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-400">
                    No bookings found matching your filters.
                  </td>
                </tr>
              ) : (
                filteredBookings.map(b => (
                  <tr 
                    key={b.booking_id} 
                    className={`hover:bg-gray-50 transition-colors cursor-pointer group ${
                      b.financial_status === 'critical' ? 'bg-red-50/30' : 
                      b.financial_status === 'warning' ? 'bg-amber-50/30' : ''
                    }`}
                    onClick={() => setSelectedBooking(b)}
                  >
                    <td className="px-6 py-4">
                      <p className="font-mono font-bold text-brand-charcoal">{b.booking_ref}</p>
                      <p className="text-[10px] text-gray-400 font-medium">{formatDate(new Date().toISOString())}</p>
                    </td>
                    <td className="px-6 py-4 text-right font-medium">{formatCurrency(b.revenue)}</td>
                    <td className="px-6 py-4 text-right text-gray-600">{formatCurrency(b.adjusted_provider_cost)}</td>
                    <td className={`px-6 py-4 text-right font-bold ${b.adjusted_margin < 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {formatCurrency(b.adjusted_margin)}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        b.status === 'completed' ? 'bg-green-100 text-green-700' : 
                        b.status === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {b.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${
                          b.financial_status === 'critical' ? 'bg-red-500 animate-pulse' :
                          b.financial_status === 'warning' ? 'bg-amber-500' :
                          'bg-green-500'
                        }`} />
                        <span className={`text-[10px] font-bold uppercase ${
                          b.financial_status === 'critical' ? 'text-red-600' :
                          b.financial_status === 'warning' ? 'text-amber-600' :
                          'text-green-600'
                        }`}>
                          {b.financial_status}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {b.financial_status === 'critical' && (
                          <span className="px-1.5 py-0.5 bg-red-600 text-white text-[8px] font-bold rounded uppercase">Mismatch</span>
                        )}
                        {b.high_dispute_impact && (
                          <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 text-[8px] font-bold rounded uppercase">Dispute</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <ChevronRight size={16} className="text-gray-300 group-hover:text-brand-teal group-hover:translate-x-1 transition-all" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-charcoal/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <div>
                <h3 className="font-bold text-brand-charcoal">Booking Financials</h3>
                <p className="text-xs text-gray-500 font-mono">{selectedBooking.booking_ref}</p>
              </div>
              <button 
                onClick={() => setSelectedBooking(null)}
                className="p-2 hover:bg-gray-200 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-6 text-brand-charcoal">
              {selectedBooking.financial_status !== 'ok' && (
                <div className={`p-4 rounded-2xl border flex gap-3 ${
                  selectedBooking.financial_status === 'critical' ? 'bg-red-50 border-red-100' : 'bg-amber-50 border-amber-100'
                }`}>
                  <AlertCircle size={20} className={selectedBooking.financial_status === 'critical' ? 'text-red-500' : 'text-amber-500'} />
                  <div>
                    <p className={`font-bold text-sm ${selectedBooking.financial_status === 'critical' ? 'text-red-800' : 'text-amber-800'}`}>
                      {selectedBooking.financial_status === 'critical' ? 'Reconciliation Mismatch' : 'Low Profit Warning'}
                    </p>
                    <p className={`text-xs ${selectedBooking.financial_status === 'critical' ? 'text-red-600' : 'text-amber-600'}`}>
                      {selectedBooking.financial_status === 'critical' 
                        ? 'Total provider payouts exceed the collected booking revenue. Check your costing or dispute adjustments.'
                        : 'Final margin is below the 5% threshold. This booking has very low operational profitability.'}
                    </p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                  <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Revenue</p>
                  <p className="text-xl font-bold text-brand-charcoal">{formatCurrency(selectedBooking.revenue)}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                  <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Platform Fee</p>
                  <p className="text-xl font-bold text-red-600">-{formatCurrency(selectedBooking.platform_fee)}</p>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Cost Breakdown</h4>
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">Original Provider Cost</span>
                    <span className="font-medium">{formatCurrency(selectedBooking.original_provider_cost)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">Dispute Adjustment</span>
                    <span className="font-bold text-green-600">-{formatCurrency(selectedBooking.dispute_adjustment)}</span>
                  </div>
                  <div className="pt-2 border-t border-gray-100 flex justify-between items-center font-bold">
                    <span className="text-brand-charcoal">Final Provider Cost</span>
                    <span className="text-brand-charcoal">{formatCurrency(selectedBooking.adjusted_provider_cost)}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Margin Analysis</h4>
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">Original Margin</span>
                    <span className={selectedBooking.original_margin < 0 ? 'text-red-600' : 'text-green-600'}>
                      {formatCurrency(selectedBooking.original_margin)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">Margin Change</span>
                    <span className="text-brand-teal font-bold">+{formatCurrency(selectedBooking.dispute_adjustment)}</span>
                  </div>
                  <div className="pt-2 border-t border-gray-100 flex justify-between items-center font-bold text-lg">
                    <span className="text-brand-charcoal">Final Margin</span>
                    <span className={selectedBooking.adjusted_margin < 0 ? 'text-red-600' : 'text-green-600'}>
                      {formatCurrency(selectedBooking.adjusted_margin)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl flex justify-between items-center">
                <div>
                  <p className="text-[10px] text-amber-600 font-bold uppercase">Pending Settlement</p>
                  <p className="text-lg font-bold text-amber-700">{formatCurrency(selectedBooking.pending_payout_amount)}</p>
                </div>
                {selectedBooking.on_hold_amount > 0 && (
                  <div className="text-right">
                    <p className="text-[10px] text-red-600 font-bold uppercase">On Hold</p>
                    <p className="text-lg font-bold text-red-700">{formatCurrency(selectedBooking.on_hold_amount)}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end">
              <button 
                onClick={() => setSelectedBooking(null)}
                className="px-6 py-2 bg-brand-charcoal text-white font-bold rounded-xl hover:bg-brand-charcoal/90 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <ReadinessDetailModal 
        isOpen={readinessModal.isOpen}
        onClose={() => setReadinessModal(prev => ({ ...prev, isOpen: false }))}
        title={readinessModal.title}
        type={readinessModal.type}
        items={readinessModal.items}
      />
    </div>
  );
};

const ReadinessSignal: React.FC<{ 
  label: string; 
  count: number; 
  isGood: boolean; 
  critical?: boolean; 
  helpText?: string;
  onClick?: () => void;
}> = ({ label, count, isGood, critical, helpText, onClick }) => (
  <div 
    className={`flex items-center gap-3 relative group/signal p-2 rounded-xl transition-all ${
      onClick ? 'cursor-pointer hover:bg-black/5 hover:scale-[1.02] active:scale-[0.98]' : ''
    }`}
    onClick={onClick}
  >
    <div className={`p-2 rounded-full shrink-0 ${
      isGood ? 'bg-green-100 text-green-600' : critical ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'
    }`}>
      {isGood ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
    </div>
    <div>
      <div className="flex items-center gap-1">
        <p className="text-[10px] text-gray-400 uppercase font-bold leading-tight">{label}</p>
        {!onClick && helpText && (
          <div className="relative group/info">
            <Info size={10} className="text-gray-300 cursor-help" />
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-brand-charcoal text-white text-[10px] rounded shadow-xl opacity-0 group-hover/info:opacity-100 pointer-events-none transition-opacity z-50">
              {helpText}
              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-brand-charcoal" />
            </div>
          </div>
        )}
      </div>
      <p className={`text-sm font-bold ${isGood ? 'text-gray-900' : critical ? 'text-red-700' : 'text-amber-700'}`}>
        {isGood ? 'Ready' : count === 1 ? `1 issue` : `${count} issues`}
      </p>
      {onClick && (
        <p className="text-[8px] text-brand-teal font-bold uppercase tracking-tighter opacity-0 group-hover/signal:opacity-100 transition-opacity">
          Click for details
        </p>
      )}
    </div>
  </div>
);

interface SummaryCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: 'teal' | 'charcoal' | 'red' | 'green' | 'amber';
  subtitle?: string;
}

const SummaryCard: React.FC<SummaryCardProps> = ({ title, value, icon, color, subtitle }) => {
  const colorClasses = {
    teal: 'text-brand-teal bg-brand-teal/5 border-brand-teal/10',
    charcoal: 'text-brand-charcoal bg-gray-50 border-gray-100',
    red: 'text-red-600 bg-red-50 border-red-100',
    green: 'text-green-600 bg-green-50 border-green-100',
    amber: 'text-amber-600 bg-amber-50 border-amber-100'
  };

  return (
    <div className={`p-5 rounded-2xl border shadow-sm relative overflow-hidden group transition-all hover:shadow-md ${colorClasses[color]}`}>
      <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
        {icon}
      </div>
      <p className="text-[10px] font-bold uppercase tracking-wider mb-1 opacity-70">{title}</p>
      <p className="text-2xl font-bold truncate">{formatCurrency(value)}</p>
      {subtitle && (
        <p className="mt-1 text-[10px] font-medium opacity-60">{subtitle}</p>
      )}
    </div>
  );
};
