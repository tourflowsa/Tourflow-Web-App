
import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { CalendarDays, CheckCircle2, Check, Loader2, ChevronRight, Clock, Banknote, TrendingUp, AlertTriangle, FileCheck, Star, AlertCircle, X } from 'lucide-react';
import { StatusBanner } from '../../components/onboarding/StatusBanner';
import { DocumentManager } from '../../components/documents/DocumentManager';
import { calculateOnboardingStatus, OnboardingStep } from '../../lib/onboardingUtils';
import { Document } from '../../types';
import { checkComplianceGate } from '../../lib/complianceGate';
import { getLatestDocumentsForUser } from '../../lib/documentService';
import { getArchivedAssignmentIdsForResource, getGuideAssignments, acceptAssignment } from '../../lib/assignmentService';
import { getProviderPayoutSummary, listProviderPayouts } from '../../lib/payoutService';
import { getProviderRatingSummary, RatingSummary } from '../../lib/reviewService';
import { formatDate, formatCurrency } from '../../lib/formatUtils';
import { getPayableAmount, getOriginalAmount } from '../../lib/payoutUtils';
import { useNavigate } from 'react-router-dom';
import { ProviderReviewSection } from '../../components/reviews/ProviderReviewSection';

export const GuideDashboard: React.FC = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState<any[]>([]);
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
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadPayouts = async () => {
    if (!user) return;
    try {
      const data = await listProviderPayouts(user.id, { status: payoutFilter });
      setPayouts(data);
    } catch (e) {
      console.error('[GuideDashboard] Payouts load error:', e);
    }
  };

  const fetchData = async () => {
    if (!user || !profile) return;
    
    try {
      const [assignmentsResult, archivedIdsResult, summaryResult, docsResult, ratingResult] = await Promise.allSettled([
        getGuideAssignments(user.id),
        getArchivedAssignmentIdsForResource(user.id, 'guide'),
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
        console.error('[GuideDashboard] Failed to load archived IDs:', archivedIdsResult.reason);
      }

      if (assignmentsResult.status === 'fulfilled') {
        activeAssignments = (assignmentsResult.value || []).filter((a: any) => !archivedIds.includes(a.id));
        setAssignments(activeAssignments);
      } else {
        console.error('[GuideDashboard] Failed to load assignments:', assignmentsResult.reason);
        setAssignments([]);
      }

      if (summaryResult.status === 'fulfilled') {
        summary = summaryResult.value;
        setPayoutSummary(summary);
      } else {
        console.error('[GuideDashboard] Failed to load payout summary:', summaryResult.reason);
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
        console.error('[GuideDashboard] Failed to load documents:', docsResult.reason);
      }

      if (ratingResult.status === 'fulfilled') {
        setRatingSummary(ratingResult.value);
      }

      const calculatedStatus = calculateOnboardingStatus(profile, docsArray);

      setOnboardingStatus(calculatedStatus);
    } catch (e) {
      console.error('Failed to load guide dashboard', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user, profile]);

  useEffect(() => {
    if (user) {
      loadPayouts();
    }
  }, [user, payoutFilter]);

  const handleAccept = async (assignmentId: string, bookingId?: string) => {
    if (!user || !profile) return;
    setProcessingId(assignmentId);
    setError(null);
    setSuccess(null);

    try {
      const gate = await checkComplianceGate({
        action: 'accept_assignment',
        actorRole: profile.role,
        actorUserId: user.id,
        targetBookingId: bookingId
      });

      if (!gate.allowed) {
        setError(gate.message);
        setProcessingId(null);
        return;
      }

      await acceptAssignment(assignmentId);
      
      await fetchData();
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
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-2 text-red-700 animate-in fade-in">
          <AlertTriangle size={20} />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">
            <X size={16} />
          </button>
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-2xl flex items-center gap-2 text-green-700 animate-in fade-in">
          <Check size={20} />
          <span>{success}</span>
          <button onClick={() => setSuccess(null)} className="ml-auto text-green-400 hover:text-green-600">
            <X size={16} />
          </button>
        </div>
      )}

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-brand-charcoal">Guide Portal</h1>
        <p className="text-gray-500 mt-1">Manage your upcoming tours and compliance</p>
      </div>
      
      <StatusBanner status={onboardingStatus} />

      <div className="mb-8">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Assignments</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <div 
            onClick={() => navigate('/guide/assignments')}
            className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm cursor-pointer hover:shadow-md hover:border-brand-teal/30 transition-all group"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl group-hover:bg-amber-100 transition-colors">
                <CalendarDays size={24} />
              </div>
            </div>
            <p className="text-3xl font-bold text-brand-charcoal mb-1">
              {pendingCount}
            </p>
            <p className="font-bold text-gray-600">Pending Tours</p>
            <p className="text-sm text-gray-400 mt-1">Require action</p>
          </div>

          <div 
            onClick={() => navigate('/guide/assignments')}
            className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm cursor-pointer hover:shadow-md hover:border-brand-teal/30 transition-all group"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-green-50 text-green-600 rounded-2xl group-hover:bg-green-100 transition-colors">
                <CheckCircle2 size={24} />
              </div>
            </div>
            <p className="text-3xl font-bold text-brand-charcoal mb-1">
              {acceptedCount}
            </p>
            <p className="font-bold text-gray-600">Accepted Tours</p>
            <p className="text-sm text-gray-400 mt-1">Upcoming schedule</p>
          </div>

          <div 
            onClick={() => navigate('/guide/assignments')}
            className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm cursor-pointer hover:shadow-md hover:border-brand-teal/30 transition-all group"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl group-hover:bg-indigo-100 transition-colors">
                <CheckCircle2 size={24} />
              </div>
            </div>
            <p className="text-3xl font-bold text-brand-charcoal mb-1">
              {completedCount}
            </p>
            <p className="font-bold text-gray-600">Completed Tours</p>
            <p className="text-sm text-gray-400 mt-1">Past work</p>
          </div>
        </div>
      </div>

      <div className="mb-8">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Payments</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
          <div 
            onClick={() => navigate('/guide/earnings')}
            className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm cursor-pointer hover:shadow-md hover:border-brand-teal/30 transition-all"
          >
            <p className="text-lg font-bold text-brand-teal mb-1">{formatCurrency(payoutSummary.available)}</p>
            <p className="font-bold text-gray-600 text-sm">Available</p>
          </div>

          <div 
            onClick={() => navigate('/guide/earnings')}
            className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm cursor-pointer hover:shadow-md hover:border-brand-teal/30 transition-all"
          >
            <p className="text-lg font-bold text-blue-600 mb-1">{formatCurrency(payoutSummary.withdrawalRequested)}</p>
            <p className="font-bold text-gray-600 text-sm">Requested</p>
          </div>

          <div 
            onClick={() => navigate('/guide/earnings')}
            className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm cursor-pointer hover:shadow-md hover:border-brand-teal/30 transition-all"
          >
            <p className="text-lg font-bold text-red-600 mb-1">{formatCurrency(payoutSummary.onHold)}</p>
            <p className="font-bold text-gray-600 text-sm">On Hold</p>
          </div>

          <div 
            onClick={() => navigate('/guide/earnings')}
            className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm cursor-pointer hover:shadow-md hover:border-brand-teal/30 transition-all"
          >
            <p className="text-lg font-bold text-gray-600 mb-1">{formatCurrency(payoutSummary.pending)}</p>
            <p className="font-bold text-gray-600 text-sm">Pending Authorization</p>
          </div>

          <div 
            onClick={() => navigate('/guide/earnings')}
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
              <h2 className="font-bold text-lg flex items-center gap-2 text-brand-charcoal">
                <CalendarDays className="text-brand-teal" />
                Upcoming Assignments
              </h2>
              <span className="text-xs bg-gray-200 text-gray-700 px-2.5 py-1 rounded-full font-bold uppercase tracking-wider">
                {assignments.length} Total
              </span>
            </div>
            
            {assignments.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CalendarDays className="text-gray-400" size={24} />
                </div>
                <h3 className="text-lg font-bold text-brand-charcoal mb-1">No assignments found</h3>
                <p className="text-gray-500">Make sure your profile is active and documents are up to date.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {assignments.map((a: any, i) => (
                  <div key={i} className="p-6 hover:bg-gray-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex-1 cursor-pointer" onClick={() => navigate(`/guide/assignments/${a.id}`)}>
                      <div className="flex items-center gap-3 mb-2">
                        <span className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${
                          a.status === 'accepted' || a.status === 'completed' ? 'bg-green-100 text-green-700 border border-green-200' :
                          a.status === 'pending' ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                          'bg-red-100 text-red-700 border border-red-200'
                        }`}>
                          {a.status === 'pending' ? 'Pending Acceptance' : a.status === 'rejected' ? 'Declined' : a.status}
                        </span>
                        <span className="text-sm font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                          {a.bookings?.booking_reference || 'Unknown Booking'}
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-brand-charcoal mb-2 group-hover:text-brand-teal transition-colors">
                        {a.bookings?.tours?.title || 'Untitled Tour'}
                      </h3>
                      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                        <div className="flex items-center gap-1.5">
                          <CalendarDays size={16} className="text-gray-400" />
                          {a.bookings?.start_date ? formatDate(a.bookings.start_date) : 'Date TBD'}
                        </div>
                        {a.bookings?.start_time && (
                          <div className="flex items-center gap-1.5">
                            <Clock size={16} className="text-gray-400" />
                            {a.bookings.start_time}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 flex items-center gap-3">
                       {a.status === 'accepted' ? (
                         <button 
                           onClick={() => navigate(`/guide/assignments/${a.id}`)}
                           className="flex items-center text-brand-teal font-bold text-sm group"
                         >
                           View Details <ChevronRight size={16} className="ml-1 group-hover:translate-x-1 transition-transform" />
                         </button>
                       ) : a.status === 'pending' ? (
                         <button 
                           onClick={(e) => { e.stopPropagation(); handleAccept(a.id, a.bookings?.id); }}
                           disabled={processingId === a.id}
                           className="flex items-center gap-2 bg-brand-teal text-white text-sm font-bold px-5 py-2.5 rounded-xl hover:bg-brand-teal/90 transition-colors disabled:opacity-50 shadow-sm"
                         >
                           {processingId === a.id ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                           Accept Tour
                         </button>
                       ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <h2 className="font-bold text-lg text-brand-charcoal">Payout History</h2>
              <div className="flex items-center gap-2 text-brand-charcoal">
                {['All', 'Available', 'Withdrawal Requested', 'On Hold', 'Paid', 'Pending Authorization'].map(f => (
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
                            p.is_on_hold ? 'bg-red-100 text-red-700 border border-red-200' :
                            p.withdrawal_request_status === 'requested' ? 'bg-blue-100 text-blue-700 border border-blue-200' :
                            p.withdrawal_request_status === 'approved' ? 'bg-purple-100 text-purple-700 border border-purple-200' :
                            p.withdrawal_request_status === 'rejected' ? 'bg-red-100 text-red-700 border border-red-200' :
                            p.status === 'paid' ? 'bg-green-100 text-green-700 border border-green-200' :
                            p.status === 'approved' ? 'bg-brand-teal/10 text-brand-teal border border-brand-teal/20' :
                            'bg-gray-100 text-gray-500 border border-gray-200'
                          }`}>
                            {p.is_on_hold ? 'On Hold' : 
                             p.withdrawal_request_status === 'requested' ? 'Requested' :
                             p.withdrawal_request_status === 'approved' ? 'Processing' :
                             p.withdrawal_request_status === 'rejected' ? 'Rejected' :
                             p.status === 'paid' ? 'Paid' :
                             p.status === 'approved' ? 'Available' : 
                             p.status === 'pending' ? 'Pending Authorization' : p.status.toUpperCase()}
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

        <div>
          {user && (
            <div className="mb-8">
               <ProviderReviewSection providerId={user.id} />
            </div>
          )}
          {user && profile && (
             <DocumentManager 
                role={profile.role} 
                userId={user.id} 
                onUpdate={fetchData}
             />
          )}
        </div>
      </div>
    </div>
  );
};
