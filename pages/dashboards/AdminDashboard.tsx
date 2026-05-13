import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Users,
  AlertTriangle,
  Loader2,
  Mail,
  Shield,
  ShieldAlert,
  Calendar,
  AlertCircle,
  Info,
  FileWarning,
  Clock,
  UserCheck,
  CalendarDays,
  Bug,
  TrendingUp,
  BookOpen,
  Archive,
  DollarSign,
  CreditCard,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { startOfMonth, endOfMonth, format } from 'date-fns';
import { getAdminFinancialSummary } from '../../lib/payoutService';
import { getActiveDisputeCount } from '../../lib/adminPayoutService';
import { FinancialSummary } from '../../types';
import { formatCurrency } from '../../lib/formatUtils';

interface AdminMetrics {
  total_users: number;
  pending_verification: number;
}

interface ExtendedAdminMetrics {
  drivers_missing_required_docs: number;
  docs_expiring_30d: number;
  unassigned_bookings: number;
  pending_driver_acceptance: number;
  starting_24h_without_accepted_driver: number;
  bookings_today: number;
}

interface AdminUser {
  id: string;
  email: string;
  role: string;
  created_at: string;
}

type RpcRowish = Record<string, any> | Record<string, any>[] | null;

function firstRow<T>(data: RpcRowish): T | null {
  if (!data) return null;
  if (Array.isArray(data)) return (data[0] as T) ?? null;
  if (typeof data === 'object') return data as T;
  return null;
}

export const AdminDashboard: React.FC = () => {
  const [searchParams] = useSearchParams();
  const isDebugMode = searchParams.get('debug') === '1';

  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [row, setRow] = useState<ExtendedAdminMetrics | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [financialSummary, setFinancialSummary] = useState<FinancialSummary | null>(null);
  const [activeDisputeCount, setActiveDisputeCount] = useState(0);
  const [dateRange, setDateRange] = useState({
    start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    end: format(endOfMonth(new Date()), 'yyyy-MM-dd')
  });
  const [selectedOperator, setSelectedOperator] = useState('all');
  const [operators, setOperators] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingFinancials, setLoadingFinancials] = useState(false);
  const [loadingBacklog, setLoadingBacklog] = useState(false);
  const [loadingHealth, setLoadingHealth] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debugData, setDebugData] = useState<any>(null);

  const [pipelineBacklog, setPipelineBacklog] = useState({
    pendingDocs: 0,
    readyForPayout: 0,
    payoutsOnHold: 0
  });

  const [bookingHealth, setBookingHealth] = useState({
    upcomingConfirmed: 0,
    completed: 0,
    cancelledNoShow: 0
  });

  useEffect(() => {
    fetchAdminData();
    fetchOperators();

    const handleDisputesUpdated = () => {
      getActiveDisputeCount().then(setActiveDisputeCount);
    };
    window.addEventListener('DISPUTE_UPDATED', handleDisputesUpdated);

    return () => {
      window.removeEventListener('DISPUTE_UPDATED', handleDisputesUpdated);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchFinancials();
    fetchBookingHealth();
  }, [dateRange, selectedOperator]);

  const fetchBookingHealth = async () => {
    setLoadingHealth(true);
    try {
      // 1. Upcoming Confirmed
      const upcomingQuery = supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'confirmed')
        .gt('start_date', new Date().toISOString());
      
      if (selectedOperator !== 'all') upcomingQuery.eq('operator_id', selectedOperator);
      
      const { count: upcomingCount } = await upcomingQuery;

      // 2. Completed
      const completedQuery = supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'completed')
        .gte('start_date', dateRange.start)
        .lte('start_date', dateRange.end);
        
      if (selectedOperator !== 'all') completedQuery.eq('operator_id', selectedOperator);
      
      const { count: completedCount } = await completedQuery;

      // 3. Cancelled / No-Show
      const cancelledNoShowQuery = supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .in('status', ['cancelled', 'no_show'])
        .gte('start_date', dateRange.start)
        .lte('start_date', dateRange.end);
        
      if (selectedOperator !== 'all') cancelledNoShowQuery.eq('operator_id', selectedOperator);
      
      const { count: cancelledCount } = await cancelledNoShowQuery;

      setBookingHealth({
        upcomingConfirmed: upcomingCount || 0,
        completed: completedCount || 0,
        cancelledNoShow: cancelledCount || 0
      });
    } catch (err) {
      console.error('Booking Health Error:', err);
    } finally {
      setLoadingHealth(false);
    }
  };

  const fetchOperators = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, company_name, full_name')
      .eq('role', 'operator');
    if (data) {
      setOperators(data.map(o => ({
        id: o.id,
        name: o.company_name || o.full_name || 'Unknown'
      })));
    }
  };

  const fetchFinancials = async () => {
    setLoadingFinancials(true);
    try {
      const summary = await getAdminFinancialSummary({
        startDate: dateRange.start,
        endDate: dateRange.end,
        operatorId: selectedOperator
      });
      setFinancialSummary(summary);
    } catch (err) {
      console.error('Financial Summary Error:', err);
    } finally {
      setLoadingFinancials(false);
    }
  };

  const fetchAdminData = async () => {
    setLoading(true);
    setLoadingBacklog(true);
    setError(null);

    try {
      const [metricsRes, extendedRes, usersRes, dCount, pendingDocsRes, readyPayoutsRes, holdPayoutsRes] = await Promise.all([
        supabase.rpc('admin_overview'),
        supabase.rpc('admin_overview_extended_secure_v2'),
        supabase.rpc('admin_users', { limit_count: 50, offset_count: 0 }),
        getActiveDisputeCount(),
        supabase.from('documents').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('payout_ledger').select('*', { count: 'exact', head: true }).eq('status', 'pending').eq('is_on_hold', false),
        supabase.from('payout_ledger').select('*', { count: 'exact', head: true }).eq('is_on_hold', true)
      ]);

      if (metricsRes.error) throw metricsRes.error;
      if (extendedRes.error) throw extendedRes.error;
      if (usersRes.error) throw usersRes.error;

      const m = metricsRes.data as AdminMetrics;
      const r = firstRow<ExtendedAdminMetrics>(extendedRes.data as any);
      const u = (usersRes.data as AdminUser[]) || [];

      setMetrics(m);
      setRow(r);
      setUsers(u);
      setActiveDisputeCount(dCount);
      setPipelineBacklog({
        pendingDocs: pendingDocsRes.count || 0,
        readyForPayout: readyPayoutsRes.count || 0,
        payoutsOnHold: holdPayoutsRes.count || 0
      });
    } catch (err: any) {
      console.error('Admin Dashboard Fetch Error:', err);
      setError(err?.message || 'Dashboard failed to load.');
    } finally {
      setLoading(false);
      setLoadingBacklog(false);
    }
  };

  const handleDebug = async () => {
    const res = await supabase.rpc('admin_overview_extended_secure_v2');
    const r = firstRow<any>(res.data as any);
    setDebugData(r || res.error || null);
  };

  const bookingsOverview = useMemo(() => {
    const bookingsToday = row?.bookings_today ?? 0;
    const unassigned = row?.unassigned_bookings ?? 0;
    const pendingAcceptance = row?.pending_driver_acceptance ?? 0;
    const urgent = row?.starting_24h_without_accepted_driver ?? 0;

    return {
      bookingsToday,
      unassigned,
      pendingAcceptance,
      urgent
    };
  }, [row]);

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-brand-charcoal">System Overview</h1>
          <p className="text-gray-500 mt-1">Platform-wide analytics and user management.</p>
        </div>

        <div className="flex items-center gap-3">
          {isDebugMode && (
            <button
              onClick={handleDebug}
              className="flex items-center gap-2 bg-brand-charcoal text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-black transition-colors shadow-sm"
            >
              <Bug size={16} />
              Debug Metrics
            </button>
          )}

          <button
            onClick={fetchAdminData}
            disabled={loading}
            className="flex items-center gap-2 bg-white border border-gray-200 px-4 py-2 rounded-lg text-gray-600 font-bold text-sm hover:bg-gray-50 transition-colors shadow-sm disabled:opacity-50"
            title="Refresh all metrics"
          >
            <Loader2 className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh Data
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3 text-red-700">
          <AlertCircle className="shrink-0 mt-0.5" size={20} />
          <div>
            <h3 className="font-bold">Database Error</h3>
            <p className="text-sm opacity-90">{error}</p>
          </div>
        </div>
      )}

      {/* Financial Summary Section */}
      <div className="mb-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-2">
            <DollarSign className="text-brand-teal" size={24} />
            <h2 className="text-xl font-bold text-brand-charcoal">Financial Summary</h2>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-1.5 shadow-sm">
              <Filter size={14} className="text-gray-400" />
              <select
                value={selectedOperator}
                onChange={(e) => setSelectedOperator(e.target.value)}
                className="text-sm font-medium text-gray-600 bg-transparent border-none focus:ring-0 cursor-pointer"
              >
                <option value="all">All Operators</option>
                {operators.map(op => (
                  <option key={op.id} value={op.id}>{op.name}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-1.5 shadow-sm">
              <Calendar size={14} className="text-gray-400" />
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                className="text-sm font-medium text-gray-600 bg-transparent border-none focus:ring-0 cursor-pointer"
              />
              <span className="text-gray-300">to</span>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                className="text-sm font-medium text-gray-600 bg-transparent border-none focus:ring-0 cursor-pointer"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
              <TrendingUp size={48} className="text-brand-teal" />
            </div>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Total Revenue</p>
            <p className="text-2xl font-bold text-brand-charcoal">
              {loadingFinancials ? '...' : formatCurrency(financialSummary?.totalRevenue || 0)}
            </p>
            <div className="mt-2 flex items-center gap-1 text-[10px] text-green-600 font-bold">
              <ArrowUpRight size={12} />
              <span>Gross Booking Value</span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
              <Shield size={48} className="text-brand-teal" />
            </div>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Total Platform Fees</p>
            <p className="text-2xl font-bold text-brand-teal">
              {loadingFinancials ? '...' : formatCurrency(financialSummary?.totalPlatformFees || 0)}
            </p>
            <div className="mt-2 flex items-center gap-1 text-[10px] text-brand-teal font-bold">
              <TrendingUp size={12} />
              <span>Platform Earnings</span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
              <CreditCard size={48} className="text-brand-charcoal" />
            </div>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Total Paid Out</p>
            <p className="text-2xl font-bold text-brand-charcoal">
              {loadingFinancials ? '...' : formatCurrency(financialSummary?.totalPaidOut || 0)}
            </p>
            <div className="mt-2 flex items-center gap-1 text-[10px] text-gray-500 font-bold">
              <Clock size={12} />
              <span>Settled Payouts</span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm relative overflow-hidden group bg-brand-teal/5 border-brand-teal/20">
            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
              <TrendingUp size={48} className="text-brand-teal" />
            </div>
            <p className="text-[10px] text-brand-teal font-bold uppercase tracking-wider mb-1">Platform Margin</p>
            <p className="text-2xl font-bold text-brand-teal">
              {loadingFinancials ? '...' : formatCurrency(financialSummary?.platformMargin || 0)}
            </p>
            <div className="mt-2 flex items-center gap-1 text-[10px] text-brand-teal font-bold">
              <ArrowUpRight size={12} />
              <span>Net Platform Revenue</span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
              <AlertCircle size={48} className="text-brand-coral" />
            </div>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Pending Liability</p>
            <p className="text-2xl font-bold text-brand-coral">
              {loadingFinancials ? '...' : formatCurrency(financialSummary?.pendingLiability || 0)}
            </p>
            <div className="mt-2 flex items-center gap-1 text-[10px] text-brand-coral font-bold">
              <ArrowDownRight size={12} />
              <span>Unpaid Payout Rows</span>
            </div>
          </div>
        </div>
      </div>

      {/* Pipeline Backlog Section */}
      <div className="mb-10">
        <div className="flex items-center gap-2 mb-6">
          <Clock className="text-brand-teal" size={24} />
          <h2 className="text-xl font-bold text-brand-charcoal">Pipeline Backlog</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link to="/admin/reviews" className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all group">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-2xl ${pipelineBacklog.pendingDocs > 0 ? 'bg-brand-gold/10 text-brand-gold' : 'bg-gray-50 text-gray-400'}`}>
                <FileWarning size={24} />
              </div>
              <div>
                <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Pending Document Reviews</p>
                <p className="text-3xl font-bold text-brand-charcoal">{loadingBacklog ? '...' : pipelineBacklog.pendingDocs}</p>
              </div>
              <ArrowUpRight className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-brand-gold" size={16} />
            </div>
          </Link>

          <Link to="/admin/payouts" className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all group">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-2xl ${pipelineBacklog.readyForPayout > 0 ? 'bg-brand-teal/10 text-brand-teal' : 'bg-gray-50 text-gray-400'}`}>
                <CreditCard size={24} />
              </div>
              <div>
                <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Ready for Payout</p>
                <p className="text-3xl font-bold text-brand-charcoal">{loadingBacklog ? '...' : pipelineBacklog.readyForPayout}</p>
              </div>
              <ArrowUpRight className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-brand-teal" size={16} />
            </div>
          </Link>

          <Link to="/admin/payouts" className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all group">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-2xl ${pipelineBacklog.payoutsOnHold > 0 ? 'bg-red-50 text-brand-coral' : 'bg-gray-50 text-gray-400'}`}>
                <AlertCircle size={24} />
              </div>
              <div>
                <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Payouts on Hold</p>
                <p className="text-3xl font-bold text-brand-charcoal">{loadingBacklog ? '...' : pipelineBacklog.payoutsOnHold}</p>
              </div>
              <ArrowUpRight className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-brand-coral" size={16} />
            </div>
          </Link>
        </div>
      </div>

      {/* Booking Health Section */}
      <div className="mb-10">
        <div className="flex items-center gap-2 mb-6">
          <Calendar className="text-brand-teal" size={24} />
          <h2 className="text-xl font-bold text-brand-charcoal">Booking Health</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-brand-charcoal/10 text-brand-charcoal rounded-2xl" title="Bookings starting today.">
                <TrendingUp size={24} />
              </div>
              <div>
                <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Bookings Today</p>
                <p className="text-3xl font-bold text-brand-charcoal">{loading ? '...' : bookingsOverview.bookingsToday}</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-brand-teal/10 text-brand-teal rounded-2xl">
                <CalendarDays size={24} />
              </div>
              <div>
                <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Upcoming Confirmed</p>
                <p className="text-3xl font-bold text-brand-charcoal">{loadingHealth ? '...' : bookingHealth.upcomingConfirmed}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                <CheckCircle size={24} />
              </div>
              <div>
                <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Completed</p>
                <p className="text-3xl font-bold text-brand-charcoal">{loadingHealth ? '...' : bookingHealth.completed}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-red-50 text-red-600 rounded-2xl">
                <XCircle size={24} />
              </div>
              <div>
                <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Cancelled / No-Show</p>
                <p className="text-3xl font-bold text-brand-charcoal">{loadingHealth ? '...' : bookingHealth.cancelledNoShow}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <Link 
          to="/admin/payouts/disputes"
          className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm transition-all hover:shadow-md hover:border-brand-coral group"
        >
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-2xl transition-colors ${activeDisputeCount > 0 ? 'bg-red-50 text-brand-coral group-hover:bg-red-100' : 'bg-gray-50 text-gray-400'}`}>
              <ShieldAlert size={24} />
            </div>
            <div>
              <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Active Payout Disputes</p>
              <div className="flex items-center gap-2">
                <p className={`text-3xl font-bold ${activeDisputeCount > 0 ? 'text-brand-coral' : 'text-brand-charcoal'}`}>
                  {loading ? '...' : activeDisputeCount}
                </p>
                {activeDisputeCount > 0 && (
                  <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full animate-pulse font-bold">Action Required</span>
                )}
              </div>
            </div>
            <ArrowUpRight className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-brand-coral" size={16} />
          </div>
        </Link>

        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-brand-teal/10 text-brand-teal rounded-2xl">
              <Users size={24} />
            </div>
            <div>
              <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Total Users</p>
              <p className="text-3xl font-bold text-brand-charcoal">{loading ? '...' : metrics?.total_users ?? 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-brand-gold/10 text-brand-gold rounded-2xl">
              <AlertTriangle size={24} className="text-yellow-600" />
            </div>
            <div>
              <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Accounts Pending</p>
              <p className="text-3xl font-bold text-brand-charcoal">{loading ? '...' : metrics?.pending_verification ?? 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Action Required: Bookings */}
      <div className="mb-10">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <BookOpen className="text-brand-teal" size={20} />
            <h2 className="text-xl font-bold text-brand-charcoal">Action Required: Bookings</h2>
          </div>

          <Link
            to="/admin/bookings"
            className="text-sm font-bold text-brand-teal hover:underline"
            title="Open Global Bookings"
          >
            View Global Bookings
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
            <div className="flex items-start justify-between mb-4">
              <div className="p-2 bg-brand-charcoal/10 text-brand-charcoal rounded-lg">
                <Users size={20} />
              </div>
              <span title="Confirmed bookings with no driver or guide assigned.">
                <Info size={14} className="text-gray-300 cursor-help" />
              </span>
            </div>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Unassigned Bookings</p>
            <p className="text-3xl font-bold text-brand-charcoal">{loading ? '...' : bookingsOverview.unassigned}</p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
            <div className="flex items-start justify-between mb-4">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                <UserCheck size={20} />
              </div>
              <span title="Assigned driver has not accepted.">
                <Info size={14} className="text-gray-300 cursor-help" />
              </span>
            </div>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Pending Acceptance</p>
            <p className="text-3xl font-bold text-brand-charcoal">{loading ? '...' : bookingsOverview.pendingAcceptance}</p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm border-l-4 border-l-brand-coral">
            <div className="flex items-start justify-between mb-4">
              <div className="p-2 bg-red-100 text-red-600 rounded-lg">
                <CalendarDays size={20} />
              </div>
              <span title="Starts within 24 hours with no accepted driver.">
                <Info size={14} className="text-gray-300 cursor-help" />
              </span>
            </div>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Urgent: 24h No Driver</p>
            <p className="text-3xl font-bold text-red-600">{loading ? '...' : bookingsOverview.urgent}</p>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2 text-xs text-gray-500">
          <Archive size={14} />
          <span>Global Bookings includes archived records via the toggle on that page.</span>
        </div>
      </div>

      {/* Compliance Health Section */}
      <div className="mb-10">
        <div className="flex items-center gap-2 mb-6">
          <Shield className="text-brand-teal" size={20} />
          <h2 className="text-xl font-bold text-brand-charcoal">Compliance Health</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
            <div className="flex items-start justify-between mb-4">
              <div className="p-2 bg-brand-coral/10 text-brand-coral rounded-lg">
                <FileWarning size={20} />
              </div>
              <span title="Active drivers missing required documents.">
                <Info size={14} className="text-gray-300 cursor-help" />
              </span>
            </div>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Drivers Missing Docs</p>
            <p className="text-3xl font-bold text-brand-charcoal">{loading ? '...' : row?.drivers_missing_required_docs ?? 0}</p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
            <div className="flex items-start justify-between mb-4">
              <div className="p-2 bg-brand-gold/10 text-brand-gold rounded-lg">
                <Clock size={20} className="text-yellow-600" />
              </div>
              <span title="Documents expiring within 30 days.">
                <Info size={14} className="text-gray-300 cursor-help" />
              </span>
            </div>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Docs Expiring 30 Days</p>
            <p className="text-3xl font-bold text-brand-charcoal">{loading ? '...' : row?.docs_expiring_30d ?? 0}</p>
          </div>
        </div>
      </div>

      {/* Top Performing Tours */}
      <div className="mb-10">
        <div className="flex items-center gap-2 mb-6">
          <TrendingUp className="text-brand-teal" size={20} />
          <h2 className="text-xl font-bold text-brand-charcoal">Top Performing Tours</h2>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase font-bold border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3">Tour Title</th>
                  <th className="px-6 py-3 text-right">Revenue</th>
                  <th className="px-6 py-3 text-right">Platform Margin</th>
                  <th className="px-6 py-3 text-right">Margin %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loadingFinancials ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-gray-400">Loading tour data...</td>
                  </tr>
                ) : !financialSummary?.topTours || financialSummary.topTours.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-gray-400 italic">No tour data found for this period.</td>
                  </tr>
                ) : (
                  financialSummary.topTours.map((tour) => (
                    <tr key={tour.tour_id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-brand-charcoal">{tour.title}</td>
                      <td className="px-6 py-4 text-right">{formatCurrency(tour.revenue)}</td>
                      <td className="px-6 py-4 text-right text-brand-teal font-bold">{formatCurrency(tour.margin)}</td>
                      <td className="px-6 py-4 text-right text-gray-500">
                        {tour.revenue > 0 ? ((tour.margin / tour.revenue) * 100).toFixed(1) : '0.0'}%
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {isDebugMode && debugData && (
        <div className="mb-10 p-6 bg-gray-900 text-green-400 rounded-2xl border border-gray-800 shadow-inner overflow-hidden">
          <div className="flex items-center justify-between mb-4 border-b border-gray-800 pb-4">
            <div className="flex items-center gap-2">
              <Bug size={18} className="text-brand-teal" />
              <h2 className="text-sm font-bold uppercase tracking-widest">Extended Metrics Debug Output</h2>
            </div>
            <button
              onClick={() => setDebugData(null)}
              className="text-[10px] font-bold uppercase text-gray-500 hover:text-white transition-colors"
            >
              Clear Debug View
            </button>
          </div>
          <div className="max-h-96 overflow-auto">
            <pre className="text-xs font-mono leading-relaxed whitespace-pre-wrap">
              {JSON.stringify(debugData, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {/* User Directory Quick Link */}
      <div className="bg-brand-teal/5 rounded-2xl border border-brand-teal/20 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-brand-charcoal flex items-center gap-2">
            <Users size={20} className="text-brand-teal" />
            User Directory
          </h2>
          <p className="text-sm text-gray-600 mt-1">Browse, search and review all {metrics?.total_users ?? '...'} users on the platform.</p>
        </div>
        <Link 
          to="/admin/users"
          className="bg-brand-teal text-white px-5 py-2.5 rounded-lg font-bold text-sm hover:bg-brand-teal/90 transition-colors shadow-sm whitespace-nowrap flex items-center gap-2"
        >
          View Full Directory <ArrowUpRight size={16} />
        </Link>
      </div>
    </div>
  );
};