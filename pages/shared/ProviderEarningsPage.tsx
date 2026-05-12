import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { formatCurrency, formatDate } from '../../lib/formatUtils';
import { getPayableAmount, getOriginalAmount } from '../../lib/payoutUtils';
import { 
  CreditCard, 
  Calendar, 
  TrendingUp, 
  AlertCircle, 
  RefreshCw, 
  Download, 
  Search,
  Filter,
  CheckCircle2,
  Clock,
  DollarSign,
  ArrowUpRight,
  ChevronRight,
  ShieldAlert,
  Send,
  X,
  Info
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { generatePayoutStatement } from '../../lib/pdfGenerator';
import { getProviderPayoutSummary, requestWithdrawal, listProviderPayouts } from '../../lib/payoutService';
import { getBankDetails, getBankStatus } from '../../lib/bankDetailsService';

export const ProviderEarningsPage: React.FC = () => {
  const { user, profile } = useAuth();
  
  const [earnings, setEarnings] = useState<any[]>([]);
  const [payoutSummary, setPayoutSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [selectedPayouts, setSelectedPayouts] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [bankDetails, setBankDetails] = useState<any>(null);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateRange, setDateRange] = useState({
    start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    end: format(endOfMonth(new Date()), 'yyyy-MM-dd')
  });

  useEffect(() => {
    if (user && profile) loadData();
  }, [user, profile]);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const [rows, summary] = await Promise.all([
        listProviderPayouts(user.id, { status: 'All' }),
        getProviderPayoutSummary(user.id)
      ]);

      setEarnings(rows || []);
      setPayoutSummary(summary);

      // Load bank details separately - non-blocking
      try {
        const bank = await getBankDetails(user.id);
        setBankDetails(bank);
      } catch (bankErr) {
        console.warn('[ProviderEarnings] bank details load skipped or failed', bankErr);
      }
    } catch (err: any) {
      console.error('[ProviderEarnings] Load error:', err);
      setError('Failed to load earnings data.');
    } finally {
      setLoading(false);
    }
  };

  const parseRole = (ref: string) => {
    if (!ref) return 'N/A';
    const parts = ref.split('-');
    const lastPart = parts[parts.length - 1];
    if (['DRIVER', 'GUIDE', 'VEHICLE', 'COMBINED'].includes(lastPart)) {
      return lastPart.charAt(0) + lastPart.slice(1).toLowerCase();
    }
    return 'N/A';
  };

  const stats = useMemo(() => {
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    
    return earnings.reduce((acc, e) => {
      const amount = getPayableAmount(e);
      acc.totalEarned += amount;
      
      if (e.status === 'paid') {
        acc.paid += amount;
      } else if (['pending', 'approved'].includes(e.status)) {
        acc.pending += amount;
      }
      
      const createdAt = parseISO(e.created_at);
      if (isWithinInterval(createdAt, { start: monthStart, end: monthEnd })) {
        acc.thisMonth += amount;
      }
      
      return acc;
    }, { totalEarned: 0, paid: 0, pending: 0, thisMonth: 0 });
  }, [earnings]);

  const filteredEarnings = useMemo(() => {
    return earnings.filter(e => {
      // Status filter
      if (statusFilter !== 'all') {
        const filter = statusFilter.toLowerCase();
        if (filter === 'available') {
          if (e.status !== 'approved' || e.is_on_hold || e.withdrawal_request_status) return false;
        } else if (filter === 'requested') {
          if (e.status !== 'approved' || e.withdrawal_request_status !== 'requested') return false;
        } else if (filter === 'approved') {
          if (e.withdrawal_request_status !== 'approved' || e.status === 'paid') return false;
        } else if (filter === 'rejected') {
          if (e.withdrawal_request_status !== 'rejected') return false;
        } else if (filter === 'on hold') {
          if (!e.is_on_hold) return false;
        } else if (filter === 'paid') {
          if (e.status !== 'paid') return false;
        } else if (filter === 'pending') {
          if (e.status !== 'pending' || e.is_on_hold) return false;
        } else if (e.status !== filter) {
          return false;
        }
      }
      
      // Date range filter (using service date if available, else created_at)
      const dateToCompare = e.bookings?.start_date ? parseISO(e.bookings.start_date) : parseISO(e.created_at);
      const start = parseISO(dateRange.start);
      const end = parseISO(dateRange.end);
      
      // Normalize dates to start of day for comparison
      const compareTime = dateToCompare.getTime();
      const startTime = start.getTime();
      const endTime = end.getTime() + (24 * 60 * 60 * 1000) - 1; // End of day
      
      if (compareTime < startTime || compareTime > endTime) return false;
      
      // Search term
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const refMatch = e.bookings?.booking_reference?.toLowerCase().includes(searchLower);
        const tourMatch = e.bookings?.tours?.title?.toLowerCase().includes(searchLower);
        const payoutRefMatch = e.payout_reference?.toLowerCase().includes(searchLower);
        if (!refMatch && !tourMatch && !payoutRefMatch) return false;
      }
      
      return true;
    });
  }, [earnings, statusFilter, dateRange, searchTerm]);

  const handleDownloadStatement = async (payout: any) => {
    if (!payout) return;
    
    // Determine Provider Name
    let providerName = 'Provider';
    if (profile) {
      providerName = profile.company_name || profile.full_name || providerName;
      
      // If we still have generic 'Provider', try to be more specific based on role
      if (providerName === 'Provider') {
        const role = profile.role?.toLowerCase();
        if (role === 'driver') providerName = 'Driver';
        else if (role === 'guide') providerName = 'Guide';
        else if (role === 'vehicle_owner') providerName = 'Fleet Owner';
      }
    }

    // Determine Operator Name
    let operatorName = 'Tour Operator';
    try {
      if (payout.operator_id) {
        const { data: profiles } = await supabase.rpc('get_public_profiles', { p_ids: [payout.operator_id] });
        if (profiles && profiles.length > 0) {
          const op = profiles[0];
          operatorName = op.company_name || op.full_name || operatorName;
        }
      }
    } catch (err) {
      console.warn('[ProviderEarnings] Failed to hydrate operator name:', err);
    }
    
    // Enrich payout data for the statement
    const enriched = {
      ...payout,
      tour_title: payout.bookings?.tours?.title || 'Custom Tour',
      service_date: payout.bookings?.start_date,
      booking_reference: payout.bookings?.booking_reference,
      provider_name: providerName,
      operator_name: operatorName
    };

    generatePayoutStatement(enriched);
  };

  const handleRequestWithdrawalWithIds = async (ids: string[]) => {
    if (!user || ids.length === 0) return;

    setRequesting(true);
    setError(null);
    setSuccess(null);

    try {
      await requestWithdrawal(ids, user.id);
      setSuccess(`Withdrawal requested for ${ids.length} payout(s).`);
      setSelectedPayouts([]);
      await loadData();
    } catch (err: any) {
      console.error('[ProviderEarnings] Withdrawal request error:', err);
      setError(err.message || 'Failed to request withdrawal.');
    } finally {
      setRequesting(false);
    }
  };

  const handleRequestWithdrawal = async () => {
    if (!user || selectedPayouts.length === 0) return;
    await handleRequestWithdrawalWithIds(selectedPayouts);
  };

  const handleRequestFromSummaryCard = async () => {
    const ids = eligiblePayouts.map((p: any) => p.id);
    if (!user || ids.length === 0) return;

    setSelectedPayouts(ids);

    setTimeout(() => {
      handleRequestWithdrawalWithIds(ids);
    }, 0);
  };

  const exportCsv = () => {
    if (filteredEarnings.length === 0) return;

    const headers = [
      'Payout Reference',
      'Booking Reference',
      'Tour Title',
      'Service Date',
      'Gross Amount',
      'Platform Fee',
      'Net Amount',
      'Status',
      'Withdrawal Status',
      'Paid At'
    ];

    const rows = filteredEarnings.map(e => [
      e.payout_reference,
      e.bookings?.booking_reference || 'N/A',
      e.bookings?.tours?.title || 'Custom Tour',
      e.bookings?.start_date || 'N/A',
      e.amount_gross,
      e.platform_fee,
      e.amount_net,
      e.status,
      e.withdrawal_request_status || 'N/A',
      e.paid_at || 'N/A'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `earnings_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const togglePayoutSelection = (id: string) => {
    setSelectedPayouts(prev => 
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const eligiblePayouts = useMemo(() => {
    return earnings.filter(e => 
      e.status === 'approved' && 
      !e.is_on_hold && 
      !e.withdrawal_request_status
    );
  }, [earnings]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-64 text-gray-400">
      <RefreshCw className="animate-spin mb-4" size={32} />
      <p>Loading your earnings dashboard...</p>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-brand-charcoal">Earnings Dashboard</h1>
          <p className="text-gray-500 mt-1">Track and manage your income from completed services.</p>
        </div>
        <div className="flex items-center gap-3 self-start">
          <button 
            onClick={exportCsv}
            disabled={filteredEarnings.length === 0}
            className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <Download size={18} /> Download CSV
          </button>
          <button 
            onClick={loadData}
            className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-gray-50 transition-colors"
          >
            <RefreshCw size={18} /> Refresh Data
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center gap-3">
          <AlertCircle size={20} />
          <p>{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 flex items-center gap-3">
          <CheckCircle2 size={20} />
          <p>{success}</p>
        </div>
      )}

      {getBankStatus(bankDetails) === 'Missing' && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 flex items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <AlertCircle className="text-amber-600" size={24} />
            <div>
              <p className="font-bold">Bank Details Missing</p>
              <p className="text-sm text-amber-700">Please provide your bank details to ensure you can receive payouts.</p>
            </div>
          </div>
          <a 
            href="#/profile" 
            className="bg-amber-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-amber-700 transition-colors whitespace-nowrap"
          >
            Add Bank Details
          </a>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-10">
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <RefreshCw size={18} />
            </div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Pending Authorization</span>
          </div>
          <h2 className="text-xl font-bold text-indigo-700">{formatCurrency(payoutSummary?.pending || 0)}</h2>
          <p className="text-[10px] text-gray-500 mt-1">Earned, waiting for authorization</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-brand-teal/10 text-brand-teal rounded-lg">
              <DollarSign size={18} />
            </div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Available</span>
          </div>
          <h2 className="text-xl font-bold text-brand-teal">{formatCurrency(payoutSummary?.available || 0)}</h2>
          <div className="flex items-center justify-between mt-1">
            <p className="text-[10px] text-gray-500">Ready to Withdraw</p>
            {payoutSummary?.available > 0 && (
              <button 
                onClick={handleRequestFromSummaryCard}
                disabled={requesting || eligiblePayouts.length === 0}
                className="bg-brand-teal text-white px-2 py-0.5 rounded-lg font-bold text-[9px] flex items-center gap-1 hover:bg-brand-teal/90 transition-all disabled:opacity-50"
              >
                {requesting ? <RefreshCw className="animate-spin" size={10} /> : <Send size={10} />}
                Request
              </button>
            )}
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
              <Send size={18} />
            </div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Requested</span>
          </div>
          <h2 className="text-xl font-bold text-blue-700">{formatCurrency(payoutSummary?.withdrawalRequested || 0)}</h2>
          <p className="text-[10px] text-gray-500 mt-1">Waiting for Admin</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-red-100 text-red-700 rounded-lg">
              <ShieldAlert size={18} />
            </div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">On Hold</span>
          </div>
          <h2 className="text-xl font-bold text-red-700">{formatCurrency(payoutSummary?.onHold || 0)}</h2>
          <p className="text-[10px] text-gray-500 mt-1">Blocked Earnings</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-green-100 text-green-700 rounded-lg">
              <CheckCircle2 size={18} />
            </div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Paid</span>
          </div>
          <h2 className="text-xl font-bold text-green-700">{formatCurrency(payoutSummary?.paid || 0)}</h2>
          <p className="text-[10px] text-gray-500 mt-1">Total Paid Out</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm mb-8">
        <div className="flex flex-col lg:flex-row lg:items-end gap-6">
          <div className="flex-1">
            <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                type="text" 
                placeholder="Search by reference or tour..." 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)} 
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-teal focus:border-transparent outline-none transition-all"
              />
            </div>
          </div>

          <div className="w-full lg:w-48">
            <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Status</label>
            <select 
              value={statusFilter} 
              onChange={e => setStatusFilter(e.target.value)} 
              className="w-full p-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-teal focus:border-transparent outline-none transition-all appearance-none bg-no-repeat bg-[right_0.5rem_center] bg-[length:1.5em_1.5em]"
              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%239ca3af'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")` }}
            >
            <option value="all">All Statuses</option>
            <option value="Available">Available</option>
            <option value="Requested">Requested</option>
            <option value="Approved">Approved for Processing</option>
            <option value="Rejected">Rejected</option>
            <option value="On Hold">On Hold</option>
            <option value="Paid">Paid</option>
            <option value="Pending">Pending Authorization</option>
          </select>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 flex-1">
            <div className="flex-1">
              <label className="block text-xs font-bold text-gray-400 uppercase mb-2">From</label>
              <input 
                type="date" 
                value={dateRange.start} 
                onChange={e => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                className="w-full p-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-teal focus:border-transparent outline-none transition-all"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-bold text-gray-400 uppercase mb-2">To</label>
              <input 
                type="date" 
                value={dateRange.end} 
                onChange={e => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                className="w-full p-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-teal focus:border-transparent outline-none transition-all"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Earnings Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <h3 className="font-bold text-brand-charcoal flex items-center gap-2">
              <CreditCard size={20} className="text-brand-teal" />
              Earnings History
            </h3>
            <span className="text-xs text-gray-400 font-medium">
              Showing {filteredEarnings.length} records
            </span>
          </div>

          {selectedPayouts.length > 0 && (
            <button
              onClick={handleRequestWithdrawal}
              disabled={requesting}
              className="bg-brand-teal text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-brand-teal/90 transition-all shadow-lg shadow-brand-teal/20 disabled:opacity-50"
            >
              {requesting ? <RefreshCw className="animate-spin" size={18} /> : <Send size={18} />}
              Request Withdrawal ({selectedPayouts.length})
            </button>
          )}
        </div>

        {/* Helper text explaining amounts */}
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-100">
          <p className="text-[11px] text-gray-500 flex items-center gap-1.5 font-medium">
            <Info size={14} className="text-brand-teal shrink-0" />
            Gross payout is the agreed provider amount. Platform fee is deducted before the net payout is released.
          </p>
        </div>

        {filteredEarnings.length === 0 ? (
          <div className="p-16 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-50 text-gray-300 rounded-full mb-4">
              <Filter size={32} />
            </div>
            <h4 className="text-lg font-bold text-brand-charcoal mb-1">No earnings found</h4>
            <p className="text-gray-500">Try adjusting your filters or search terms.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase font-bold border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 w-10">
                    <input 
                      type="checkbox"
                      checked={selectedPayouts.length === eligiblePayouts.length && eligiblePayouts.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedPayouts(eligiblePayouts.map(p => p.id));
                        } else {
                          setSelectedPayouts([]);
                        }
                      }}
                      className="rounded border-gray-300 text-brand-teal focus:ring-brand-teal"
                    />
                  </th>
                  <th className="px-6 py-4">Booking Ref</th>
                  <th className="px-6 py-4">Tour</th>
                  <th className="px-6 py-4">Service Date</th>
                  <th className="px-6 py-4">Role</th>
                  <th className="px-6 py-4 text-right">Gross</th>
                  <th className="px-6 py-4 text-right">Fee</th>
                  <th className="px-6 py-4 text-right">Net</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredEarnings.map((e: any) => {
                  const isEligible = e.status === 'approved' && !e.is_on_hold && !e.withdrawal_request_status;
                  return (
                    <tr key={e.id} className={`hover:bg-gray-50/50 transition-colors group ${selectedPayouts.includes(e.id) ? 'bg-brand-teal/5' : ''}`}>
                      <td className="px-6 py-4">
                        {isEligible && (
                          <input 
                            type="checkbox"
                            checked={selectedPayouts.includes(e.id)}
                            onChange={() => togglePayoutSelection(e.id)}
                            className="rounded border-gray-300 text-brand-teal focus:ring-brand-teal"
                          />
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-brand-charcoal font-mono">
                        {e.bookings?.booking_reference || 'N/A'}
                      </td>
                    <td className="px-6 py-4 text-sm text-gray-600 max-w-[200px] truncate">
                      {e.bookings?.tours?.title || 'Custom Tour'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {formatDate(e.bookings?.start_date || e.created_at)}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded">
                        {parseRole(e.payout_reference)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-gray-500 text-sm">
                      {formatCurrency(e.amount_gross, e.booking_currency)}
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-red-400 text-sm">
                      -{formatCurrency(e.platform_fee, e.booking_currency)}
                    </td>
                    <td className="px-6 py-4 text-right font-mono font-bold text-brand-charcoal text-sm">
                      <div className="flex flex-col items-end">
                        <span>{formatCurrency(getPayableAmount(e), e.booking_currency)}</span>
                        {e.adjusted_amount !== null && e.adjusted_amount !== undefined && e.adjusted_amount < getOriginalAmount(e) && (
                          <span className="text-[10px] text-gray-400 font-normal">Reduced from {formatCurrency(getOriginalAmount(e), e.booking_currency)}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        {e.is_on_hold ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-bold uppercase w-fit bg-red-100 text-red-700">
                            <ShieldAlert size={10} /> {e.hold_reason === 'dispute' ? 'ON HOLD DUE TO DISPUTE' : 'ON HOLD'}
                          </span>
                        ) : e.withdrawal_request_status === 'requested' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-bold uppercase w-fit bg-blue-100 text-blue-700">
                            <Send size={10} /> REQUESTED
                          </span>
                        ) : e.withdrawal_request_status === 'approved' && e.status !== 'paid' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-bold uppercase w-fit bg-purple-100 text-purple-700">
                            <CheckCircle2 size={10} /> APPROVED FOR PROCESSING
                          </span>
                        ) : e.withdrawal_request_status === 'rejected' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-bold uppercase w-fit bg-red-100 text-red-700" title={e.withdrawal_notes}>
                            <X size={10} /> REJECTED
                          </span>
                        ) : (
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-bold uppercase w-fit ${
                            e.status === 'paid' ? 'bg-green-100 text-green-700' : 
                            e.status === 'approved' ? 'bg-brand-teal/10 text-brand-teal' : 
                            'bg-amber-100 text-amber-700'
                          }`}>
                            {e.status === 'paid' ? <CheckCircle2 size={10} /> : <Clock size={10} />}
                            {e.status === 'paid' ? 'PAID' : (e.status === 'approved' ? 'AVAILABLE' : e.status === 'pending' ? 'PENDING AUTHORIZATION' : e.status.toUpperCase())}
                          </span>
                        )}

                        {/* Status Reasons */}
                        {e.is_on_hold && e.hold_reason && e.hold_reason !== 'dispute' && (
                          <span className="text-[10px] text-red-600 font-medium leading-tight max-w-[150px]">
                            {e.hold_reason}
                          </span>
                        )}
                        {e.is_on_hold && e.hold_reason === 'dispute' && e.dispute_reason && (
                          <span className="text-[10px] text-amber-600 font-medium leading-tight max-w-[150px]">
                            Dispute: {e.dispute_reason}
                          </span>
                        )}
                        {e.withdrawal_request_status === 'rejected' && e.withdrawal_notes && (
                          <span className="text-[10px] text-red-600 font-medium leading-tight max-w-[150px]">
                            {e.withdrawal_notes}
                          </span>
                        )}
                        {e.rejection_reason && (
                          <span className="text-[10px] text-red-600 font-medium leading-tight max-w-[150px]">
                            {e.rejection_reason}
                          </span>
                        )}

                        {e.paid_at && (
                          <span className="text-[10px] text-gray-400">Paid: {formatDate(e.paid_at)}</span>
                        )}
                        {e.withdrawal_requested_at && !e.paid_at && (
                          <span className="text-[10px] text-gray-400">Requested: {formatDate(e.withdrawal_requested_at)}</span>
                        )}
                        {e.withdrawal_approved_at && !e.paid_at && (
                          <span className="text-[10px] text-gray-400">Approved: {formatDate(e.withdrawal_approved_at)}</span>
                        )}
                        {e.withdrawal_rejected_at && (
                          <span className="text-[10px] text-red-400">Rejected: {formatDate(e.withdrawal_rejected_at)}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button 
                        onClick={() => handleDownloadStatement(e)}
                        className="p-2 text-gray-400 hover:text-brand-teal hover:bg-brand-teal/5 rounded-lg transition-all"
                        title="Download Statement"
                      >
                        <Download size={18} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
