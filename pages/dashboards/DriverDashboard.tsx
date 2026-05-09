import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { CalendarDays, AlertTriangle, FileCheck, CheckCircle2, ChevronRight, MapPin, Clock, Banknote, TrendingUp, Star, Check, Loader2, ShieldAlert } from 'lucide-react';
import { StatusBanner } from '../../components/onboarding/StatusBanner';
import { calculateOnboardingStatus, OnboardingStep } from '../../lib/onboardingUtils';
import { BookingAssignment, Document } from '../../types';
import { getProviderRatingSummary, RatingSummary } from '../../lib/reviewService';
import { getDriverAssignments, getArchivedAssignmentIdsForResource, acceptAssignment } from '../../lib/assignmentService';
import { getLatestDocumentsForUser } from '../../lib/documentService';
import { getProviderPayoutSummary, listProviderPayouts } from '../../lib/payoutService';
import { checkComplianceGate, ComplianceGateResult } from '../../lib/complianceGate';
import { useNavigate } from 'react-router-dom';
import { formatDate, formatCurrency } from '../../lib/formatUtils';
import { getPayableAmount, getOriginalAmount } from '../../lib/payoutUtils';
import { ProviderReviewSection } from '../../components/reviews/ProviderReviewSection';
import { DocumentManager } from '../../components/documents/DocumentManager';

export const DriverDashboard: React.FC = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState<BookingAssignment[]>([]);
  const [payoutSummary, setPayoutSummary] = useState({ 
    available: 0, 
    withdrawalRequested: 0,
    onHold: 0, 
    paid: 0, 
    pending: 0,
    totalPaidOut: 0 
  });
  const [payouts, setPayouts] = useState<any[]>([]);
  const [payoutFilter, setPayoutFilter] = useState('All');
  const [onboardingStatus, setOnboardingStatus] = useState<OnboardingStep>('not_started');
  const [ratingSummary, setRatingSummary] = useState<RatingSummary>({ average_rating: 0, total_reviews: 0 });
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [gateResult, setGateResult] = useState<ComplianceGateResult | null>(null);

  useEffect(() => {
    loadData();
  }, [user, profile]);

  useEffect(() => {
    if (user) {
      loadPayouts();
    }
  }, [user, payoutFilter]);

  const loadPayouts = async () => {
    if (!user) return;
    try {
      const data = await listProviderPayouts(user.id, { status: payoutFilter });
      setPayouts(data);
    } catch (e) {
      console.error('[DriverDashboard] Payouts load error:', e);
    }
  };

  const loadData = async () => {
    if (!user || !profile) return;
    
    setLoading(true);
    setError(null);
    setSuccess(null);
    setGateResult(null);
    try {
      const [assignmentsResult, archivedIdsResult, summaryResult, docsResult, ratingResult] = await Promise.allSettled([
        getDriverAssignments(user.id),
        getArchivedAssignmentIdsForResource(user.id, 'driver'),
        getProviderPayoutSummary(user.id),
        getLatestDocumentsForUser(user.id),
        getProviderRatingSummary(user.id)
      ]);

      let activeAssignments: any[] = [];
      let archivedIds: string[] = [];
      let summary: any = null;
      let docsArray: Document[] = [];

      if (archivedIdsResult.status === 'fulfilled') {
        archivedIds = archivedIdsResult.value;
      } else {
        console.error('[DriverDashboard] Failed to load archived IDs:', archivedIdsResult.reason);
      }

      if (assignmentsResult.status === 'fulfilled') {
        activeAssignments = (assignmentsResult.value || []).filter((a: any) => !archivedIds.includes(a.id));
        setAssignments(activeAssignments);
      } else {
        console.error('[DriverDashboard] Failed to load assignments:', assignmentsResult.reason);
        setAssignments([]);
      }

      if (summaryResult.status === 'fulfilled') {
        summary = summaryResult.value;
        setPayoutSummary(summary);
      } else {
        console.error('[DriverDashboard] Failed to load payout summary:', summaryResult.reason);
        setPayoutSummary({ 
          available: 0, 
          withdrawalRequested: 0,
          onHold: 0, 
          paid: 0, 
          pending: 0,
          totalPaidOut: 0 
        });
      }

      if (docsResult.status === 'fulfilled') {
        docsArray = Object.values(docsResult.value);
      } else {
        console.error('[DriverDashboard] Failed to load documents:', docsResult.reason);
      }

      if (ratingResult.status === 'fulfilled') {
        setRatingSummary(ratingResult.value);
      }

      const calculatedStatus = calculateOnboardingStatus(profile, docsArray);

      setOnboardingStatus(calculatedStatus);
    } catch (e) {
      console.error('[DriverDashboard] Data load error:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (assignmentId: string, bookingId: string) => {
    if (!user || !profile) return;
    setProcessingId(assignmentId);
    setError(null);
    setSuccess(null);
    setGateResult(null);

    try {
      // Check compliance gate
      const gate = await checkComplianceGate({
        action: 'accept_assignment',
        actorRole: 'driver',
        actorUserId: user.id,
        targetBookingId: bookingId
      });

      if (!gate.allowed) {
        setGateResult(gate);
        setProcessingId(null);
        return;
      }

      await acceptAssignment(assignmentId);
      await loadData();
      setSuccess("Assignment accepted successfully.");
    } catch (err: any) {
      console.error('Acceptance failed:', err);
      setError('Failed to accept assignment: ' + err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const pendingCount = assignments.filter(a => a.status === 'pending').length;
  const acceptedCount = assignments.filter(a => a.status === 'accepted').length;
  const completedCount = assignments.filter(a => a.status === 'completed').length;

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-teal"></div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-brand-charcoal">Driver Portal</h1>
        <p className="text-gray-500 mt-1">Manage your upcoming trips and compliance</p>
      </div>
      
      <StatusBanner status={onboardingStatus} />

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center justify-between text-red-700 animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertTriangle size={20} />
            <span className="font-bold text-sm">{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-xs font-bold opacity-60 hover:opacity-100">Dismiss</button>
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-2xl flex items-center justify-between text-green-700 animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={20} />
            <span className="font-bold text-sm">{success}</span>
          </div>
          <button onClick={() => setSuccess(null)} className="text-xs font-bold opacity-60 hover:opacity-100">Dismiss</button>
        </div>
      )}

      {gateResult && !gateResult.allowed && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3 shadow-sm animate-in slide-in-from-top-2">
          <ShieldAlert className="text-red-700 shrink-0 mt-0.5" size={24} />
          <div className="flex-1">
            <h3 className="font-bold text-red-900">Assignment Blocked</h3>
            <p className="text-red-700 text-sm mt-1 mb-3">{gateResult.message}</p>

            {gateResult.missing && (
              <ul className="list-disc pl-4 mb-4 text-xs text-red-800 space-y-1">
                {gateResult.missing.map(m => (
                  <li key={m}>Missing: {m}</li>
                ))}
              </ul>
            )}

            {gateResult.ctaTo && (
              <button 
                onClick={() => gateResult.ctaTo && navigate(gateResult.ctaTo)}
                className="bg-white border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm font-bold hover:bg-red-50 transition-colors shadow-sm"
              >
                {gateResult.ctaLabel}
              </button>
            )}
          </div>
          <button onClick={() => setGateResult(null)} className="text-gray-400 hover:text-gray-600 font-bold p-1">
            <ChevronRight size={20} className="rotate-90" />
          </button>
        </div>
      )}

      <div className="mb-8">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Assignments</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <div 
            onClick={() => navigate('/driver/assignments')}
            className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm cursor-pointer hover:shadow-md hover:border-brand-teal/30 transition-all group"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl group-hover:bg-amber-100 transition-colors">
                <CalendarDays size={24} />
              </div>
            </div>
            <p className="text-3xl font-bold text-brand-charcoal mb-1">{pendingCount}</p>
            <p className="font-bold text-gray-600">Pending Trips</p>
            <p className="text-sm text-gray-400 mt-1">Require action</p>
          </div>

          <div 
            onClick={() => navigate('/driver/assignments')}
            className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm cursor-pointer hover:shadow-md hover:border-brand-teal/30 transition-all group"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-green-50 text-green-600 rounded-2xl group-hover:bg-green-100 transition-colors">
                <CheckCircle2 size={24} />
              </div>
            </div>
            <p className="text-3xl font-bold text-brand-charcoal mb-1">{acceptedCount}</p>
            <p className="font-bold text-gray-600">Accepted Trips</p>
            <p className="text-sm text-gray-400 mt-1">Upcoming schedule</p>
          </div>

          <div 
            onClick={() => navigate('/driver/assignments')}
            className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm cursor-pointer hover:shadow-md hover:border-brand-teal/30 transition-all group"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl group-hover:bg-indigo-100 transition-colors">
                <CheckCircle2 size={24} />
              </div>
            </div>
            <p className="text-3xl font-bold text-brand-charcoal mb-1">{completedCount}</p>
            <p className="font-bold text-gray-600">Completed Trips</p>
            <p className="text-sm text-gray-400 mt-1">Past work</p>
          </div>
        </div>
      </div>

      <div className="mb-8">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Payments</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
          <div 
            onClick={() => navigate('/driver/earnings')}
            className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm cursor-pointer hover:shadow-md hover:border-brand-teal/30 transition-all"
          >
            <p className="text-lg font-bold text-brand-teal mb-1">{formatCurrency(payoutSummary.available)}</p>
            <p className="font-bold text-gray-600 text-sm">Available</p>
          </div>

          <div 
            onClick={() => navigate('/driver/earnings')}
            className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm cursor-pointer hover:shadow-md hover:border-brand-teal/30 transition-all"
          >
            <p className="text-lg font-bold text-blue-600 mb-1">{formatCurrency(payoutSummary.withdrawalRequested)}</p>
            <p className="font-bold text-gray-600 text-sm">Requested</p>
          </div>

          <div 
            onClick={() => navigate('/driver/earnings')}
            className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm cursor-pointer hover:shadow-md hover:border-brand-teal/30 transition-all"
          >
            <p className="text-lg font-bold text-red-600 mb-1">{formatCurrency(payoutSummary.onHold)}</p>
            <p className="font-bold text-gray-600 text-sm">On Hold</p>
          </div>

          <div 
            onClick={() => navigate('/driver/earnings')}
            className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm cursor-pointer hover:shadow-md hover:border-brand-teal/30 transition-all"
          >
            <p className="text-lg font-bold text-gray-600 mb-1">{formatCurrency(payoutSummary.pending)}</p>
            <p className="font-bold text-gray-600 text-sm">Pending</p>
          </div>

          <div 
            onClick={() => navigate('/driver/earnings')}
            className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm cursor-pointer hover:shadow-md hover:border-brand-teal/30 transition-all"
          >
            <p className="text-lg font-bold text-green-600 mb-1">{formatCurrency(payoutSummary.totalPaidOut)}</p>
            <p className="font-bold text-gray-600 text-sm">Paid Out</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mb-8">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <h2 className="font-bold text-lg text-brand-charcoal">Recent Assignments</h2>
              <button onClick={() => navigate('/driver/assignments')} className="text-brand-teal font-bold text-sm hover:underline flex items-center gap-1">
                View All <ChevronRight size={16} />
              </button>
            </div>
            
            {assignments.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CalendarDays className="text-gray-400" size={24} />
                </div>
                <h3 className="text-lg font-bold text-brand-charcoal mb-1">No assignments yet</h3>
                <p className="text-gray-500">When you receive trip requests, they will appear here.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {assignments.slice(0, 5).map(a => (
                  <div 
                    key={a.id} 
                    onClick={() => navigate(`/driver/assignments/${a.id}`)}
                    className="p-6 hover:bg-gray-50 transition-colors cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${
                          a.status === 'accepted' || a.status === 'completed' ? 'bg-green-100 text-green-700 border border-green-200' :
                          a.status === 'rejected' || a.status === 'cancelled' ? 'bg-red-100 text-red-700 border border-red-200' :
                          'bg-amber-100 text-amber-700 border border-amber-200'
                        }`}>
                          {a.status === 'pending' ? 'Pending Acceptance' : a.status === 'rejected' ? 'Declined' : a.status}
                        </span>
                        <span className="text-sm font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                          {a.bookings?.booking_reference}
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-brand-charcoal mb-2">
                        {a.bookings?.tours?.title || 'Untitled Tour'}
                      </h3>
                      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                        <div className="flex items-center gap-1.5">
                          <CalendarDays size={16} className="text-gray-400" />
                          {a.bookings?.start_date ? formatDate(a.bookings.start_date) : 'Date TBD'}
                        </div>
                      </div>
                    </div>
                    <div className="shrink-0 flex items-center gap-3">
                       {a.status === 'accepted' ? (
                         <button 
                           onClick={() => navigate(`/driver/assignments/${a.id}`)}
                           className="flex items-center text-brand-teal font-bold text-sm group"
                         >
                           View Details <ChevronRight size={16} className="ml-1 group-hover:translate-x-1 transition-transform" />
                         </button>
                       ) : a.status === 'pending' ? (
                         <button 
                           onClick={(e) => { e.stopPropagation(); handleAccept(a.id, a.booking_id); }}
                           disabled={processingId === a.id}
                           className="flex items-center gap-2 bg-brand-teal text-white text-sm font-bold px-5 py-2.5 rounded-xl hover:bg-brand-teal/90 transition-colors disabled:opacity-50 shadow-sm"
                         >
                           {processingId === a.id ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                           Accept Trip
                         </button>
                       ) : (
                         <button 
                           onClick={() => navigate(`/driver/assignments/${a.id}`)}
                           className="flex items-center text-gray-400 font-bold text-sm group"
                         >
                           View <ChevronRight size={16} className="ml-1 group-hover:translate-x-1 transition-transform" />
                         </button>
                       )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <h2 className="font-bold text-lg text-brand-charcoal">Payout History</h2>
              <div className="flex items-center gap-2">
                {['All', 'Available', 'Withdrawal Requested', 'On Hold', 'Paid', 'Pending'].map(f => (
                  <button
                    key={f}
                    onClick={() => setPayoutFilter(f)}
                    className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                      payoutFilter === f 
                        ? 'bg-brand-teal text-white shadow-sm' 
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/50 border-b border-gray-100">
                    <th className="px-6 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Booking Ref</th>
                    <th className="px-6 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Tour</th>
                    <th className="px-6 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Amount</th>
                    <th className="px-6 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {payouts.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                        No payouts found for the selected filter.
                      </td>
                    </tr>
                  ) : (
                    payouts.map(p => (
                      <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 font-mono text-sm text-gray-500">
                          {p.bookings?.booking_reference || 'N/A'}
                        </td>
                        <td className="px-6 py-4 font-bold text-brand-charcoal">
                          {p.bookings?.tours?.title || 'N/A'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {p.bookings?.start_date ? formatDate(p.bookings.start_date) : 'N/A'}
                        </td>
                        <td className="px-6 py-4 font-bold text-brand-charcoal">
                          <div className="flex flex-col">
                            <span>{formatCurrency(getPayableAmount(p))}</span>
                            {p.adjusted_amount !== null && p.adjusted_amount !== undefined && p.adjusted_amount < getOriginalAmount(p) && (
                              <span className="text-[10px] text-gray-400 font-normal">Reduced from {formatCurrency(getOriginalAmount(p))}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                            p.is_on_hold ? 'bg-red-100 text-red-700' :
                            p.withdrawal_request_status === 'requested' ? 'bg-blue-100 text-blue-700' :
                            p.withdrawal_request_status === 'approved' ? 'bg-purple-100 text-purple-700' :
                            p.withdrawal_request_status === 'rejected' ? 'bg-red-100 text-red-700' :
                            p.status === 'paid' ? 'bg-green-50 text-green-600' :
                            p.status === 'approved' ? 'bg-brand-teal/10 text-brand-teal' :
                            'bg-gray-100 text-gray-500'
                          }`}>
                            {p.is_on_hold ? 'On Hold' : 
                             p.withdrawal_request_status === 'requested' ? 'Requested' :
                             p.withdrawal_request_status === 'approved' ? 'Ready for Payout' :
                             p.withdrawal_request_status === 'rejected' ? 'Rejected' :
                             p.status === 'paid' ? (p.adjusted_amount !== null && p.adjusted_amount !== undefined && p.adjusted_amount < getOriginalAmount(p) ? 'Paid, Reduced' : 'Paid') :
                             p.status === 'approved' ? 'Ready for Payout' : p.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          {user && (
            <ProviderReviewSection providerId={user.id} />
          )}
          {user && profile && (
            <DocumentManager 
              role={profile.role} 
              userId={user.id} 
              onUpdate={loadData}
            />
          )}
        </div>
      </div>
    </div>
  );
};
