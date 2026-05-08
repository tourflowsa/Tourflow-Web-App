
import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  Map, CalendarDays, Plus, TrendingUp, CheckCircle2, AlertCircle, 
  Truck, CreditCard, DollarSign, Clock, Calendar, FileCheck, 
  ShieldAlert, ShieldCheck, ShieldX, AlertTriangle, ChevronRight, 
  ArrowUpRight, ArrowDownRight, Filter, Info, HelpCircle, Percent 
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useOperatorReadiness } from '../../hooks/useOperatorReadiness';
import { StatusBanner } from '../../components/onboarding/StatusBanner';
import { calculateOnboardingStatus, OnboardingStep } from '../../lib/onboardingUtils';
import { Document, Booking, Payout } from '../../types';
import { useNavigate } from 'react-router-dom';
import { BookingCalendar } from '../../components/bookings/BookingCalendar';
import { fetchBookingsForOperator } from '../../lib/bookingService';
import { getActiveFleetCountForOperator } from '../../lib/fleetService';
import { getOperatorPayoutOverview, listOperatorPayouts, PayoutStats, getOperatorPayoutReminders, PayoutReminders, getOperatorFinancialSummary } from '../../lib/payoutService';
import { resolveOperatorFee } from '../../lib/feeService';
import { formatCurrency, formatDate } from '../../lib/formatUtils';
import { ReadinessDetailModal } from '../../components/readiness/ReadinessDetailModal';
import { getPayableAmount } from '../../lib/payoutUtils';
import { getOperatorCompliance, ComplianceResult } from '../../lib/compliance';
import { getLatestDocumentsForUser } from '../../lib/documentService';
import { startOfMonth, endOfMonth, format } from 'date-fns';

export const OperatorDashboard: React.FC = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  
  const { readiness, loading: readinessLoading } = useOperatorReadiness(user?.id);
  
  // Stats State
  const [stats, setStats] = useState({ 
    tours: 0, 
    bookings: 0, 
    activeVehicles: 0
  });
  
  // Financial State
  const [payoutStats, setPayoutStats] = useState<PayoutStats | null>(null);
  const [recentPayouts, setRecentPayouts] = useState<Payout[]>([]);
  const [reminders, setReminders] = useState<PayoutReminders | null>(null);
  const [financialSummary, setFinancialSummary] = useState<any>(null);
  const [dateRange, setDateRange] = useState({
    start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    end: format(endOfMonth(new Date()), 'yyyy-MM-dd')
  });
  const [loadingFinancials, setLoadingFinancials] = useState(false);

  // Bookings state
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [disputeCount, setDisputeCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [onboardingStatus, setOnboardingStatus] = useState<OnboardingStep>('not_started');

  // Compliance State
  const [compliance, setCompliance] = useState<ComplianceResult | null>(null);

  // Fee Tier State
  const [feeTier, setFeeTier] = useState<{ 
    code: string; 
    percent: number; 
    isDefault: boolean;
    loading: boolean;
    error: boolean;
  }>({ code: '', percent: 0, isDefault: true, loading: true, error: false });

  // Weekly Stats derived from bookings state
  const weeklyStats = useMemo(() => {
    if (!bookings || bookings.length === 0) {
      return { confirmed: 0, completed: 0, cancelled: 0 };
    }

    const now = new Date();
    const currentDay = now.getDay();
    const diffToMonday = currentDay === 0 ? 6 : currentDay - 1;
    
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - diffToMonday);
    weekStart.setHours(0, 0, 0, 0);
    
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);

    const stats = { confirmed: 0, completed: 0, cancelled: 0 };

    for (const booking of bookings) {
      if (!booking.start_date) continue;
      const start = new Date(booking.start_date);
      if (start >= weekStart && start < weekEnd) {
        if (booking.status === 'confirmed') stats.confirmed += 1;
        if (booking.status === 'completed') stats.completed += 1;
        if (booking.status === 'cancelled') stats.cancelled += 1;
      }
    }
    return stats;
  }, [bookings]);

  const loadData = async () => {
    if (!profile || !user) return;

    try {
      const { count: tourCount } = await supabase.from('tours').select('*', { count: 'exact', head: true }).eq('operator_id', user.id);
      const activeFleetCount = await getActiveFleetCountForOperator(user.id);
      const bookingsData = await fetchBookingsForOperator(user.id);
      setBookings(bookingsData);
      
      const docsMap = await getLatestDocumentsForUser(user.id);
      const docsArray = Object.values(docsMap);
      
      // Compliance Check
      const compResult = await getOperatorCompliance(user.id);
      setCompliance(compResult);

      // Fee Tier Check
      try {
        const feeRes = await resolveOperatorFee(user.id);
        setFeeTier({
          code: feeRes.feeTierCode || 'Standard',
          percent: feeRes.feePercent,
          isDefault: !feeRes.feeTierId,
          loading: false,
          error: false
        });
      } catch (err) {
        console.error("Error resolving fee tier:", err);
        setFeeTier(prev => ({ ...prev, loading: false, error: true }));
      }

      const [finStats, payouts, remindersData, disputesData, holdLedgers] = await Promise.all([
        getOperatorPayoutOverview(user.id),
        listOperatorPayouts(user.id, { limit: 5 }),
        getOperatorPayoutReminders(user.id),
        supabase.from('payout_disputes').select('booking_id').eq('operator_id', user.id).eq('status', 'open'),
        supabase.from('payout_ledger').select('booking_id').eq('operator_id', user.id).eq('is_on_hold', true)
      ]);
      setPayoutStats(finStats);
      setRecentPayouts(payouts);
      setReminders(remindersData);

      const uniqueBookingIds = new Set<string>();
      if (disputesData.data) disputesData.data.forEach(d => uniqueBookingIds.add(d.booking_id));
      if (holdLedgers.data) holdLedgers.data.forEach(l => uniqueBookingIds.add(l.booking_id));
      setDisputeCount(uniqueBookingIds.size);

      setStats({
        tours: tourCount || 0,
        bookings: bookingsData.length,
        activeVehicles: activeFleetCount
      });
      
      setOnboardingStatus(calculateOnboardingStatus(profile, docsArray));
    } catch (e) {
      console.error("Dashboard Load Error", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [profile, user]);

  useEffect(() => {
    if (user?.id) {
      fetchFinancials();
    }
  }, [user?.id, dateRange]);

  const fetchFinancials = async () => {
    if (!user?.id) return;
    setLoadingFinancials(true);
    try {
      const summary = await getOperatorFinancialSummary(user.id, {
        startDate: dateRange.start,
        endDate: dateRange.end
      });
      setFinancialSummary(summary);
    } catch (err) {
      console.error('Operator Financial Summary Error:', err);
    } finally {
      setLoadingFinancials(false);
    }
  };

  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showCriticalIssues, setShowCriticalIssues] = useState(false);
  const [readinessModal, setReadinessModal] = useState<{ isOpen: boolean; type: 'bank' | 'compliance' | 'disputes' | 'escrow'; title: string; items: any[] }>({
    isOpen: false,
    type: 'bank',
    title: '',
    items: []
  });

  const handleCriticalIssueClick = (issue: string) => {
    const lowerIssue = issue.toLowerCase();
    if (lowerIssue.includes('bank')) {
      setReadinessModal({
        isOpen: true,
        type: 'bank',
        title: 'Partner Bank Details Issues',
        items: readiness?.breakdown.providerBankDetails.items || []
      });
    } else {
      setReadinessModal({
        isOpen: true,
        type: 'compliance',
        title: 'Compliance & Verification Issues',
        items: readiness?.breakdown.providerCompliance.items || []
      });
    }
  };

  const totalScheduled = weeklyStats.confirmed + weeklyStats.completed + weeklyStats.cancelled;

  if (loading) return <div>Loading dashboard data...</div>;

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Compliance Banner */}
      {compliance && compliance.status !== 'compliant' && (
        <div className={`mb-8 p-4 rounded-2xl border flex items-start justify-between gap-4 ${
          compliance.status === 'non_compliant' 
            ? 'bg-red-50 border-red-200 text-red-800' 
            : 'bg-amber-50 border-amber-200 text-amber-800'
        }`}>
          <div className="flex items-start gap-3">
            {compliance.status === 'non_compliant' ? (
              <ShieldAlert className="shrink-0 mt-0.5" size={24} />
            ) : (
              <AlertTriangle className="shrink-0 mt-0.5" size={24} />
            )}
            <div>
              <h3 className="font-bold text-lg">
                {compliance.status === 'non_compliant' 
                  ? "Account Action Required" 
                  : "Compliance Warning"}
              </h3>
              <p className="text-sm mt-1 mb-2">
                {compliance.status === 'non_compliant'
                  ? "You have missing, rejected, or expired documents. Booking actions are currently blocked."
                  : "Some documents are expiring soon. Please renew them to avoid service interruption."}
              </p>
              <ul className="text-sm list-disc list-inside space-y-0.5 opacity-90">
                {compliance.issues.map((issue, idx) => (
                  <li key={idx}>
                    <strong>{issue.title}:</strong> {issue.problem.replace('_', ' ')}
                    {issue.expiry_date && ` (${issue.expiry_date})`}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <button 
            onClick={() => navigate('/operator/documents')}
            className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap flex items-center gap-2 transition-colors ${
              compliance.status === 'non_compliant'
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
            }`}
          >
            Update Documents <ChevronRight size={16} />
          </button>
        </div>
      )}

      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-white border border-gray-200 shadow-sm flex items-center justify-center overflow-hidden">
            {profile?.avatar_url || profile?.profile_image_url ? (
              <img src={(profile.avatar_url || profile.profile_image_url) ?? undefined} alt={profile.full_name || 'Profile'} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-full h-full bg-gray-50 flex items-center justify-center text-brand-charcoal">
                <Map size={32} strokeWidth={1.5} />
              </div>
            )}
          </div>
          <div>
            <h1 className="text-3xl font-bold text-brand-charcoal">Operator Dashboard</h1>
            <p className="text-gray-500 mt-1">Manage your inventory and operations</p>
          </div>
        </div>
        <button 
          onClick={() => navigate('/operator/tours/new')}
          disabled={onboardingStatus !== 'verified' || compliance?.status === 'non_compliant'}
          className="bg-brand-teal text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-brand-teal/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus size={18} />
          Create Tour
        </button>
      </div>

      <StatusBanner status={onboardingStatus} />

      {/* Payment Readiness Widget */}
      {!readinessLoading && readiness && (
        <div className={`mb-8 p-6 rounded-2xl border ${
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
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <div onClick={() => navigate('/operator/financials')} className="cursor-pointer group">
                      <h3 className="text-lg font-bold text-gray-900 leading-tight group-hover:text-brand-teal transition-colors flex items-center gap-2">
                        Payment Readiness: {readiness.status.toUpperCase().replace('_', ' ')}
                        <ChevronRight size={18} className="text-gray-400 group-hover:text-brand-teal group-hover:translate-x-1 transition-all" />
                      </h3>
                    </div>
                    <button 
                      onClick={() => setShowInfoModal(true)}
                      className="p-1 text-gray-400 hover:text-brand-teal transition-colors"
                      title="How readiness works"
                    >
                      <HelpCircle size={16} />
                    </button>
                  </div>
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
                    <button 
                      onClick={() => setShowCriticalIssues(!showCriticalIssues)}
                      className="mt-3 text-[10px] font-bold text-red-600 uppercase flex items-center gap-1 hover:underline group/btn"
                    >
                      <ShieldAlert size={12} className="group-hover/btn:scale-110 transition-transform" />
                      {readiness.criticalIssues.length} Critical Issues Detected
                      <ChevronRight size={12} className={`transition-transform grow-0 ${showCriticalIssues ? 'rotate-90' : ''}`} />
                    </button>
                  )}

                  {showCriticalIssues && readiness.criticalIssues.length > 0 && (
                    <div className="mt-3 p-3 bg-red-100/50 rounded-xl border border-red-200/50 animate-in slide-in-from-top-2 duration-300">
                      <div className="space-y-1.5">
                        {readiness.criticalIssues.map((issue, idx) => (
                          <button 
                            key={idx} 
                            onClick={() => handleCriticalIssueClick(issue)}
                            className="flex items-start gap-2 text-[10px] text-red-700 font-bold leading-tight text-left w-full hover:bg-red-200/50 p-1 rounded transition-colors group/issue"
                          >
                            <AlertCircle size={10} className="shrink-0 mt-0.5 group-hover/issue:scale-110 transition-transform" />
                            <span className="flex-1">{issue}</span>
                            <ArrowUpRight size={10} className="shrink-0 opacity-0 group-hover/issue:opacity-100 transition-opacity" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 flex-1 min-w-0 md:min-w-[500px]">
                <ReadinessSignal 
                  label="Bank Info" 
                  helpText="Your bank details must be saved for finance operations."
                  count={readiness.breakdown.operatorBankDetailsMissing ? 1 : 0} 
                  isGood={!readiness.breakdown.operatorBankDetailsMissing}
                  critical={readiness.breakdown.operatorBankDetailsMissing}
                />
                <ReadinessSignal 
                  label="Partner Bank" 
                  helpText="Assigned partners need bank details for payouts."
                  count={readiness.breakdown.providerBankDetailsMissing} 
                  isGood={readiness.breakdown.providerBankDetailsMissing === 0}
                  critical={readiness.breakdown.providerBankDetailsMissing > 0}
                  onClick={readiness.breakdown.providerBankDetails.items.length > 0 ? () => setReadinessModal({
                    isOpen: true,
                    type: 'bank',
                    title: 'Partner Bank Details Issues',
                    items: readiness.breakdown.providerBankDetails.items
                  }) : undefined}
                />
                <ReadinessSignal 
                  label="Compliance" 
                  helpText="Assigned partners must have valid required documents."
                  count={readiness.breakdown.expiredDocuments} 
                  isGood={readiness.breakdown.expiredDocuments === 0}
                  critical={readiness.breakdown.expiredDocuments > 0}
                  onClick={readiness.breakdown.providerCompliance.items.length > 0 ? () => setReadinessModal({
                    isOpen: true,
                    type: 'compliance',
                    title: 'Partner Compliance Issues',
                    items: readiness.breakdown.providerCompliance.items
                  }) : undefined}
                />
                <ReadinessSignal 
                  label="Disputes" 
                  helpText="Active disputes or adjusted payouts delay readiness."
                  count={readiness.breakdown.activeDisputes} 
                  isGood={readiness.breakdown.activeDisputes === 0}
                  critical={readiness.breakdown.activeDisputes > 0}
                  onClick={readiness.breakdown.disputes.items.length > 0 ? () => setReadinessModal({
                    isOpen: true,
                    type: 'disputes',
                    title: 'Active Disputes',
                    items: readiness.breakdown.disputes.items
                  }) : undefined}
                />
                <ReadinessSignal 
                  label="Escrow" 
                  helpText="Bookings must have sufficient escrow funding."
                  count={readiness.breakdown.unfundedEscrow} 
                  isGood={readiness.breakdown.unfundedEscrow === 0}
                  critical={readiness.breakdown.unfundedEscrow > 0}
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

      <ReadinessDetailModal 
        isOpen={readinessModal.isOpen}
        onClose={() => setReadinessModal(prev => ({ ...prev, isOpen: false }))}
        title={readinessModal.title}
        type={readinessModal.type}
        items={readinessModal.items}
      />

      {/* How readiness works Modal */}
      {showInfoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2 text-brand-teal">
                <Info size={20} />
                <h3 className="font-bold text-lg">Payment Readiness Guide</h3>
              </div>
              <button 
                onClick={() => setShowInfoModal(false)}
                className="p-2 hover:bg-black/5 rounded-full transition-colors"
              >
                <Plus size={20} className="rotate-45" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div>
                <h4 className="font-bold text-brand-charcoal mb-2">Statuses</h4>
                <div className="space-y-3">
                  <div className="flex gap-3">
                    <div className="p-1 bg-green-500 text-white rounded-lg h-fit"><ShieldCheck size={16} /></div>
                    <div>
                      <p className="font-bold text-sm text-green-700">READY</p>
                      <p className="text-xs text-gray-500">Everything is set. Payouts will process as scheduled.</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="p-1 bg-amber-500 text-white rounded-lg h-fit"><ShieldAlert size={16} /></div>
                    <div>
                      <p className="font-bold text-sm text-amber-700">AT RISK</p>
                      <p className="text-xs text-gray-500">Some minor issues detected. Payouts might be delayed or held for specific bookings.</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="p-1 bg-red-500 text-white rounded-lg h-fit"><ShieldX size={16} /></div>
                    <div>
                      <p className="font-bold text-sm text-red-700">BLOCKED</p>
                      <p className="text-xs text-gray-500">Critical issues require immediate action. No payouts will be processed.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-brand-charcoal mb-2">The 5 Checks</h4>
                <ul className="text-sm space-y-2 list-inside list-disc text-gray-600">
                  <li><strong>Your Bank Details:</strong> Platform requires your bank info for disbursements.</li>
                  <li><strong>Provider Bank Details:</strong> Partners must have bank info registered.</li>
                  <li><strong>Provider Compliance:</strong> Active partners must have valid required documents.</li>
                  <li><strong>Active Disputes:</strong> Open disputes hold funds for the affected booking.</li>
                  <li><strong>Escrow Funding:</strong> Bookings must have enough funds to cover cost components.</li>
                </ul>
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end">
              <button 
                onClick={() => setShowInfoModal(false)}
                className="px-6 py-2 bg-brand-teal text-white rounded-lg font-bold hover:bg-brand-teal/90 transition-colors shadow-sm"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Financial Summary Section */}
      <div className="mb-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="text-brand-teal" size={24} />
              <h2 className="text-xl font-bold text-brand-charcoal">Performance Summary</h2>
            </div>
            <button 
              onClick={() => navigate('/operator/financials')}
              className="text-xs font-bold text-brand-teal hover:underline flex items-center gap-1"
            >
              View Full Dashboard <ChevronRight size={14} />
            </button>
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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
              <DollarSign size={48} className="text-brand-teal" />
            </div>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Total Booking Revenue</p>
            <p className="text-2xl font-bold text-brand-charcoal">
              {loadingFinancials ? '...' : formatCurrency(financialSummary?.totalRevenue || 0)}
            </p>
            <div className="mt-2 flex items-center gap-1 text-[10px] text-green-600 font-bold">
              <ArrowUpRight size={12} />
              <span>Gross Sales</span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
              <Truck size={48} className="text-brand-charcoal" />
            </div>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Total Provider Costs</p>
            <p className="text-2xl font-bold text-brand-charcoal">
              {loadingFinancials ? '...' : formatCurrency(financialSummary?.totalProviderCosts || 0)}
            </p>
            <div className="mt-2 flex items-center gap-1 text-[10px] text-gray-500 font-bold">
              <ArrowDownRight size={12} />
              <span>Fleet & Resource Costs</span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm relative overflow-hidden group bg-brand-teal/5 border-brand-teal/20">
            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
              <TrendingUp size={48} className="text-brand-teal" />
            </div>
            <p className="text-[10px] text-brand-teal font-bold uppercase tracking-wider mb-1">Net Margin</p>
            <p className="text-2xl font-bold text-brand-teal">
              {loadingFinancials ? '...' : formatCurrency(financialSummary?.netMargin || 0)}
            </p>
            <div className="mt-2 flex items-center gap-1 text-[10px] text-brand-teal font-bold">
              <ArrowUpRight size={12} />
              <span>Operating Profit</span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
              <TrendingUp size={48} className="text-brand-gold" />
            </div>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Margin %</p>
            <p className="text-2xl font-bold text-brand-charcoal">
              {loadingFinancials ? '...' : `${(financialSummary?.marginPercentage || 0).toFixed(1)}%`}
            </p>
            <div className="mt-2 flex items-center gap-1 text-[10px] text-brand-gold font-bold">
              <TrendingUp size={12} />
              <span>Efficiency Ratio</span>
            </div>
          </div>
        </div>

        <h2 className="text-xl font-bold text-brand-charcoal mb-4 flex items-center gap-2">
          <CreditCard className="text-brand-teal" size={24} /> Payout Status
        </h2>

        {/* Payout Reminders Widget */}
        {(disputeCount > 0 || (reminders && (reminders.completedAwaitingPayout > 0 || reminders.pendingApproval > 0 || reminders.approvedAwaitingPayment > 0))) && (
          <div className="mb-6 bg-amber-50 border border-amber-200 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4 text-amber-800">
              <AlertCircle size={20} />
              <h3 className="font-bold">Action Required: Payout Settlements</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {disputeCount > 0 && (
                <div 
                  onClick={() => navigate('/operator/bookings')}
                  className="bg-red-50 p-4 rounded-xl border border-red-100 shadow-sm hover:shadow-md transition-all cursor-pointer flex justify-between items-center group"
                >
                  <div>
                    <p className="text-xs font-bold text-red-500 uppercase tracking-wider mb-1">Disputes / Holds</p>
                    <p className="text-2xl font-bold text-red-700">{disputeCount}</p>
                    <p className="text-[10px] text-red-400 mt-1">Requires attention</p>
                  </div>
                  <ChevronRight size={20} className="text-red-300 group-hover:translate-x-1 transition-transform" />
                </div>
              )}

              <div 
                onClick={() => navigate('/operator/bookings?filter=awaiting_settlement')}
                className="bg-white p-4 rounded-xl border border-amber-100 shadow-sm hover:shadow-md transition-all cursor-pointer flex justify-between items-center group"
              >
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Awaiting Payout</p>
                  <p className="text-2xl font-bold text-brand-charcoal">{reminders?.completedAwaitingPayout || 0}</p>
                  <p className="text-[10px] text-gray-400 mt-1">Completed bookings</p>
                </div>
                <ChevronRight size={20} className="text-amber-400 group-hover:translate-x-1 transition-transform" />
              </div>

              <div 
                onClick={() => navigate('/operator/payouts?status=pending')}
                className="bg-white p-4 rounded-xl border border-amber-100 shadow-sm hover:shadow-md transition-all cursor-pointer flex justify-between items-center group"
              >
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Ready for Approval</p>
                  <p className="text-2xl font-bold text-brand-charcoal">{reminders?.pendingApproval || 0}</p>
                  <p className="text-[10px] text-gray-400 mt-1">Pending payout rows</p>
                </div>
                <ChevronRight size={20} className="text-amber-400 group-hover:translate-x-1 transition-transform" />
              </div>

              <div 
                onClick={() => navigate('/operator/payouts?status=approved')}
                className="bg-white p-4 rounded-xl border border-amber-100 shadow-sm hover:shadow-md transition-all cursor-pointer flex justify-between items-center group"
              >
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Awaiting Payment</p>
                  <p className="text-2xl font-bold text-brand-charcoal">{reminders?.approvedAwaitingPayment || 0}</p>
                  <p className="text-[10px] text-gray-400 mt-1">Approved payouts</p>
                </div>
                <ChevronRight size={20} className="text-amber-400 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
            <div className="flex items-center gap-2 mb-2 text-gray-500 text-sm font-bold uppercase tracking-wider">
              <DollarSign size={16} /> Available Balance
            </div>
            <p className="text-2xl font-bold text-brand-charcoal">
              {formatCurrency(payoutStats?.currentBalance || 0)}
            </p>
            <p className="text-xs text-gray-400 mt-1">Ready for payout</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
            <div className="flex items-center gap-2 mb-2 text-gray-500 text-sm font-bold uppercase tracking-wider">
              <Clock size={16} /> Pending Payouts
            </div>
            <p className="text-2xl font-bold text-brand-charcoal">
              {formatCurrency(payoutStats?.pendingPipeline || 0)}
            </p>
            <p className="text-xs text-gray-400 mt-1">Includes confirmed bookings</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
            <div className="flex items-center gap-2 mb-2 text-gray-500 text-sm font-bold uppercase tracking-wider">
              <CheckCircle2 size={16} /> Paid Out
            </div>
            <p className="text-2xl font-bold text-brand-charcoal">
              {formatCurrency(payoutStats?.lifetimePayouts || 0)}
            </p>
            <p className="text-xs text-gray-400 mt-1">Lifetime earnings</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
            <div className="flex items-center gap-2 mb-2 text-gray-500 text-sm font-bold uppercase tracking-wider">
              <Calendar size={16} /> Next Payout
            </div>
            <p className="text-xl font-bold text-brand-charcoal">
              {payoutStats?.nextPayoutDate ? formatDate(payoutStats.nextPayoutDate) : 'Not Scheduled'}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {payoutStats?.nextPayoutDate ? 'Processing soon' : 'No pending payments'}
            </p>
          </div>
        </div>

        {/* Recent Payouts Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
            <h3 className="font-bold text-brand-charcoal">Recent Payouts</h3>
            <button onClick={() => navigate('/operator/payouts')} className="text-sm text-brand-teal font-bold hover:underline">View All</button>
          </div>
          {recentPayouts.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">No recent payout history found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase font-bold border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-3">Reference</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3 text-right">Gross Amount</th>
                    <th className="px-6 py-3 text-right">Platform Fee</th>
                    <th className="px-6 py-3 text-right">Net Amount</th>
                    <th className="px-6 py-3">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {recentPayouts.map(p => (
                    <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-3 font-mono font-medium text-brand-charcoal">{p.payout_reference}</td>
                      <td className="px-6 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${
                          p.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-right text-gray-600">{formatCurrency(p.amount_gross, p.currency)}</td>
                      <td className="px-6 py-3 text-right text-red-600">-{formatCurrency(p.platform_fee, p.currency)}</td>
                      <td className="px-6 py-3 text-right font-bold text-brand-charcoal">{formatCurrency(getPayableAmount(p), p.currency)}</td>
                      <td className="px-6 py-3 text-gray-500">{formatDate(p.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div 
              onClick={() => navigate('/operator/tours')}
              className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer group"
            >
               <div className="flex items-center gap-3 mb-2">
                 <div className="p-2 bg-brand-teal/10 rounded-lg group-hover:bg-brand-teal group-hover:text-white transition-colors text-brand-teal">
                    <Map size={20} />
                 </div>
                 <span className="font-bold text-gray-600 text-sm">Active Tours</span>
               </div>
               <p className="text-3xl font-bold text-brand-charcoal">{stats.tours}</p>
            </div>

            <div 
              onClick={() => navigate('/operator/bookings')}
              className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer group"
            >
               <div className="flex items-center gap-3 mb-2">
                 <div className="p-2 bg-brand-coral/10 rounded-lg group-hover:bg-brand-coral group-hover:text-white transition-colors text-brand-coral">
                    <CalendarDays size={20} />
                 </div>
                 <span className="font-bold text-gray-600 text-sm">Total Bookings</span>
               </div>
               <p className="text-3xl font-bold text-brand-charcoal">{stats.bookings}</p>
            </div>

            <div 
              onClick={() => navigate('/operator/vehicles')}
              className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer group"
            >
               <div className="flex items-center gap-3 mb-2">
                 <div className="p-2 bg-brand-charcoal/10 rounded-lg group-hover:bg-brand-charcoal group-hover:text-white transition-colors text-brand-charcoal">
                    <Truck size={20} />
                 </div>
                 <span className="font-bold text-gray-600 text-sm">Active Fleet</span>
               </div>
               <div className="flex items-end gap-2">
                  <p className="text-3xl font-bold text-brand-charcoal">{stats.activeVehicles}</p>
               </div>
            </div>
          </div>
          
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-[750px]">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-brand-charcoal">Booking Schedule</h3>
              <div className="flex gap-4 text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-brand-teal"></div> Confirmed
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-gray-400"></div> Completed
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-red-400"></div> Cancelled
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-auto">
               <BookingCalendar bookings={bookings} />
            </div>
          </div>
        </div>

        <div className="space-y-8">
          {/* Platform Fee Tier Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Percent className="text-brand-teal" size={20} />
              <h3 className="font-bold text-brand-charcoal">Platform Fee Tier</h3>
            </div>
            
            {feeTier.loading ? (
              <div className="animate-pulse flex flex-col gap-3">
                <div className="h-8 w-24 bg-gray-100 rounded-lg"></div>
                <div className="h-3 w-full bg-gray-50 rounded"></div>
                <div className="h-3 w-2/3 bg-gray-50 rounded"></div>
              </div>
            ) : feeTier.error ? (
              <p className="text-sm text-gray-400 py-2 italic font-medium">Fee tier unavailable</p>
            ) : (
              <div>
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-2xl font-bold text-brand-charcoal uppercase tracking-tighter">
                    {feeTier.code}
                  </span>
                  <span className="text-lg font-bold text-brand-teal">
                    {feeTier.percent}%
                  </span>
                </div>
                
                {feeTier.isDefault && (
                  <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-2">
                    Default tier applied
                  </p>
                )}
                
                <p className="text-xs text-gray-500 leading-relaxed mb-4">
                  This tier determines the platform fee applied to new booking calculations.
                </p>
                
                <button 
                  onClick={() => navigate('/operator/financials')}
                  className="text-xs font-bold text-brand-teal hover:underline flex items-center gap-1"
                >
                  View Financials <ChevronRight size={14} />
                </button>
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="text-brand-teal" size={20} />
              <h3 className="font-bold text-brand-charcoal">This Week</h3>
            </div>
            
            <div className="text-center mb-6">
              <span className="text-4xl font-bold text-brand-charcoal">{totalScheduled}</span>
              <span className="block text-sm text-gray-500">Scheduled Bookings</span>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center text-sm p-2 rounded bg-green-50 text-green-700">
                <span className="flex items-center gap-2"><CheckCircle2 size={14}/> Confirmed</span>
                <span className="font-bold">{weeklyStats.confirmed}</span>
              </div>
              <div className="flex justify-between items-center text-sm p-2 rounded bg-gray-100 text-gray-700">
                <span className="flex items-center gap-2"><CheckCircle2 size={14}/> Completed</span>
                <span className="font-bold">{weeklyStats.completed}</span>
              </div>
              <div className="flex justify-between items-center text-sm p-2 rounded bg-red-50 text-red-700">
                <span className="flex items-center gap-2"><AlertCircle size={14}/> Cancelled</span>
                <span className="font-bold">{weeklyStats.cancelled}</span>
              </div>
            </div>
          </div>

          {/* Minimal Compliance Card (since banner is present) */}
          <div className={`rounded-2xl shadow-sm border p-6 transition-colors bg-white border-gray-200`}>
            <div className="flex items-center gap-3 mb-3">
              <div className={`p-2 rounded-lg bg-gray-100 text-gray-600`}>
                <FileCheck size={20} />
              </div>
              <h3 className="font-bold text-brand-charcoal">Documents</h3>
            </div>
            <p className={`text-sm mb-4 text-gray-600`}>
              Manage your compliance docs and expiry dates.
            </p>
            <button 
              onClick={() => navigate('/operator/documents')}
              className="w-full py-2 rounded-lg font-bold text-sm transition-colors bg-white text-brand-charcoal border border-gray-300 hover:bg-gray-50"
            >
              Manage Documents
            </button>
          </div>

        </div>
      </div>
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
