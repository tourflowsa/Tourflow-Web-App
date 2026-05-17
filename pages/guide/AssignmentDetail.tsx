import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getAssignmentById, respondToAssignment } from '../../lib/assignmentService';
import { getBookingPayoutForProvider } from '../../lib/payoutService';
import { checkComplianceGate, ComplianceGateResult } from '../../lib/complianceGate';
import { supabase } from '../../lib/supabase';
import {
  ArrowLeft,
  Calendar,
  MapPin,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  Loader2,
  Info,
  Banknote,
  Lock,
  Wallet
} from 'lucide-react';

function getDisplayStatus(a: any) {
  const bookingStatus = String(a?.bookings?.status || a?.booking?.status || '').toLowerCase();
  const assignmentStatus = String(a?.status || '').toLowerCase();

  if (bookingStatus === 'completed') return 'completed';
  if (bookingStatus === 'cancelled') return 'cancelled';

  return assignmentStatus || 'pending';
}

const getPayoutStatusDisplay = (status: string) => {
  switch (status) {
    case 'pending': return 'Ready for payout';
    case 'approved': return 'Approved';
    case 'paid': return 'Paid';
    default: return status;
  }
};

const getPayoutStatusBadgeClass = (status: string) => {
  switch (status) {
    case 'paid': return 'bg-green-100 text-green-700';
    case 'approved': return 'bg-blue-100 text-blue-700';
    case 'pending': return 'bg-amber-100 text-amber-700';
    default: return 'bg-gray-100 text-gray-700';
  }
};

type ToastState = { type: 'success' | 'error'; message: string } | null;

export const AssignmentDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  const [assignment, setAssignment] = useState<any | null>(null);
  const [payout, setPayout] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [gateResult, setGateResult] = useState<ComplianceGateResult | null>(null);
  const [toast, setToast] = useState<ToastState>(null);

  const loadData = async () => {
    if (!id || !user) return;
    setLoading(true);
    try {
      const data = await getAssignmentById(id, user.id);
      
      if (data?.bookings?.operator_id) {
        const { data: opData } = await supabase.rpc('get_public_profiles', { p_ids: [data.bookings.operator_id] });
        if (opData && opData.length > 0) {
           data.bookings.profiles = { 
             ...data.bookings.profiles,
             company_name: opData[0].company_name,
             full_name: opData[0].full_name
           };
        }
      }

      setAssignment(data);

      if (data?.booking_id) {
        const p = await getBookingPayoutForProvider(data.booking_id, user.id);
        setPayout(p);
      }
    } catch (e) {
      console.error(e);
      setToast({ type: 'error', message: 'Failed to load assignment details.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id && user) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const blockReason = useMemo(() => {
    if (!assignment) return null;

    const bookingStatus = String(assignment.bookings?.status || '').toLowerCase();
    const assignmentStatus = String(getDisplayStatus(assignment) || '').toLowerCase();

    if (bookingStatus === 'completed') return 'This booking is completed. You cannot respond to this assignment.';
    if (bookingStatus === 'cancelled') return 'This booking is cancelled. You cannot respond to this assignment.';
    if (assignmentStatus === 'cancelled') return 'This assignment is cancelled. You cannot respond to it.';

    return null;
  }, [assignment]);

  const [declineModalOpen, setDeclineModalOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState('');

  const handleActionClick = (action: 'accepted' | 'rejected') => {
    if (action === 'rejected') {
      setDeclineReason('');
      setDeclineModalOpen(true);
    } else {
      executeAction('accepted', '');
    }
  };

  const executeAction = async (action: 'accepted' | 'rejected', reason: string) => {
    if (!assignment || !user || !profile) return;

    const bookingStatus = String(assignment.bookings?.status || '').toLowerCase();
    const assignmentStatus = String(getDisplayStatus(assignment) || '').toLowerCase();

    if (bookingStatus === 'completed') {
      setToast({ type: 'error', message: 'This booking is completed. You cannot accept or reject this assignment.' });
      return;
    }

    if (bookingStatus === 'cancelled') {
      setToast({ type: 'error', message: 'This booking is cancelled. You cannot accept or reject this assignment.' });
      return;
    }

    if (assignmentStatus === 'cancelled') {
      setToast({ type: 'error', message: 'This assignment is cancelled. You cannot accept or reject it.' });
      return;
    }

    if (action === 'accepted') {
      const gate = await checkComplianceGate({
        action: 'accept_assignment',
        actorRole: profile.role,
        actorUserId: user.id,
        targetBookingId: assignment.booking_id
      });

      if (!gate.allowed) {
        setGateResult(gate);
        return;
      }
    }

    setProcessing(true);
    try {
      await respondToAssignment(assignment.id, action, reason);
      setToast({ type: 'success', message: action === 'accepted' ? 'Assignment accepted.' : 'Assignment declined.' });
      setDeclineModalOpen(false);
      await loadData();
    } catch (err: any) {
      console.error(err);

      const msg =
        String(err?.message || '').includes('completed bookings are locked')
          ? 'This booking is completed. You cannot respond.'
          : String(err?.message || '').toLowerCase().includes('cancelled')
          ? 'This booking is cancelled. You cannot respond.'
          : err?.message || 'Failed to update assignment status.';

      setToast({ type: 'error', message: msg });
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-gray-400 flex flex-col items-center gap-2">
        <Loader2 className="animate-spin text-brand-teal" />
        Loading assignment details...
      </div>
    );
  }

  if (!assignment) return <div className="p-12 text-center text-gray-400">Assignment not found.</div>;

  const isAccepted = String(getDisplayStatus(assignment) || '').toLowerCase() === 'accepted';
  const isPending = String(getDisplayStatus(assignment) || '').toLowerCase() === 'pending' && !blockReason;

  return (
    <div className="max-w-3xl mx-auto">
      {toast && (
        <div
          className={`mb-6 p-4 rounded-2xl border flex items-start gap-3 ${
            toast.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <div className="flex-1 text-sm font-bold">{toast.message}</div>
          <button onClick={() => setToast(null)} className="text-xs font-bold opacity-70 hover:opacity-100">
            Close
          </button>
        </div>
      )}

      <button
        onClick={() => navigate('/guide/assignments')}
        className="flex items-center gap-2 text-gray-500 hover:text-brand-charcoal mb-6 font-bold text-sm transition-colors"
      >
        <ArrowLeft size={16} /> Back to Assignments
      </button>

      {gateResult && !gateResult.allowed && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3">
          <ShieldAlert className="text-red-700 shrink-0 mt-0.5" size={24} />
          <div className="flex-1">
            <h3 className="font-bold text-red-900">Action Blocked</h3>
            <p className="text-red-700 text-sm mt-1">{gateResult.message}</p>

            {gateResult.missing && (
              <ul className="list-disc pl-4 mt-2 text-xs text-red-800">
                {gateResult.missing.map((m) => (
                  <li key={m}>Missing: {m}</li>
                ))}
              </ul>
            )}

            {gateResult.ctaTo && (
              <button
                onClick={() => gateResult.ctaTo && navigate(gateResult.ctaTo)}
                className="mt-3 bg-white border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm font-bold hover:bg-red-50 transition-colors shadow-sm"
              >
                {gateResult.ctaLabel}
              </button>
            )}
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex justify-between items-start">
          <div>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Assignment Status</span>
            <div
              className={`mt-1 inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-bold uppercase ${
                getDisplayStatus(assignment) === 'accepted' || getDisplayStatus(assignment) === 'completed'
                  ? 'bg-green-100 text-green-700 border border-green-200'
                  : getDisplayStatus(assignment) === 'rejected' || getDisplayStatus(assignment) === 'cancelled'
                  ? 'bg-red-100 text-red-700 border border-red-200'
                  : 'bg-amber-100 text-amber-700 border border-amber-200'
              }`}
            >
              {getDisplayStatus(assignment) === 'accepted' ? <CheckCircle2 size={16} /> : null}
              {getDisplayStatus(assignment) === 'rejected' ? <XCircle size={16} /> : null}
              {getDisplayStatus(assignment) === 'pending'
                ? 'Pending Acceptance'
                : getDisplayStatus(assignment) === 'rejected'
                ? 'Declined'
                : getDisplayStatus(assignment)}
            </div>
          </div>

          <div className="text-right">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Booking Ref</span>
            <div className="font-mono font-bold text-brand-charcoal text-lg">{assignment.bookings?.booking_reference}</div>
            <div className="text-xs text-gray-500 mt-1">
              Operator: <span className="font-semibold text-gray-700">{assignment.bookings?.profiles?.company_name || assignment.bookings?.profiles?.full_name || 'Tour Operator'}</span>
            </div>
          </div>
        </div>

        <div className="p-8 space-y-8">
          {getDisplayStatus(assignment) === 'rejected' && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3">
              <XCircle className="text-red-700 shrink-0 mt-0.5" size={24} />
              <div>
                <h3 className="font-bold text-red-900">You declined this assignment.</h3>
              </div>
            </div>
          )}

          <div>
            <h1 className="text-2xl font-bold text-brand-charcoal mb-2">
              {assignment.bookings?.tours?.title || 'Tour Details Unavailable'}
            </h1>
            {assignment.bookings?.tours?.region && (
              <div className="flex items-center gap-2 text-gray-500">
                <MapPin size={18} className="text-brand-teal" />
                <span>{assignment.bookings.tours.region}</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
              <h3 className="font-bold text-gray-700 mb-3 flex items-center gap-2">
                <Calendar size={18} className="text-brand-teal" /> Schedule
              </h3>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="block text-xs text-gray-400 uppercase font-bold mb-0.5">Start</span>
                  <span className="font-bold text-brand-charcoal">
                    {assignment.bookings?.start_date ? new Date(assignment.bookings.start_date).toLocaleString() : 'TBD'}
                  </span>
                </div>
                <div>
                  <span className="block text-xs text-gray-400 uppercase font-bold mb-0.5">End</span>
                  <span className="font-bold text-brand-charcoal">
                    {assignment.bookings?.end_date ? new Date(assignment.bookings.end_date).toLocaleString() : 'TBD'}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
              <div className="flex justify-between items-start mb-3">
                <h3 className="font-bold text-gray-700 flex items-center gap-2">
                  <Banknote size={18} className="text-brand-teal" /> Agreed Rate Snapshot
                </h3>
                {isAccepted && (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-gray-400 uppercase">
                    <Lock size={10} /> Locked
                  </span>
                )}
              </div>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="block text-xs text-gray-400 uppercase font-bold mb-0.5 text-gray-400">Payment</span>
                  <span className="font-bold text-brand-charcoal">
                    ZAR {assignment.rate_amount?.toLocaleString()} / {assignment.rate_type}
                  </span>
                  <p className="text-[10px] text-gray-400 mt-1 italic">This is the rate captured when the assignment was sent.</p>
                </div>
                {assignment.rate_overridden && (
                  <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-brand-teal/10 text-brand-teal text-[10px] font-bold uppercase rounded">
                    Negotiated Rate
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="p-6 bg-gray-50/50 rounded-2xl border border-gray-100">
            <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2">
              <Info size={18} className="text-brand-teal" /> Trip Logistics
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <span className="block text-xs text-gray-400 uppercase font-bold mb-1">Pickup Location</span>
                <span className="text-sm font-medium text-brand-charcoal">
                  {assignment.bookings?.pickup_location || 'Not provided'}
                </span>
              </div>
              <div>
                <span className="block text-xs text-gray-400 uppercase font-bold mb-1">Dropoff Location</span>
                <span className="text-sm font-medium text-brand-charcoal">
                  {assignment.bookings?.dropoff_location || 'Not provided'}
                </span>
              </div>
              <div>
                <span className="block text-xs text-gray-400 uppercase font-bold mb-1">Number of Guests</span>
                <span className="text-sm font-medium text-brand-charcoal">
                  {assignment.bookings?.num_guests || 'Not provided'}
                </span>
              </div>
            </div>

            {assignment.bookings?.special_requests && (
              <div className="mt-6 p-4 bg-blue-50 border border-blue-100 rounded-xl">
                <span className="block text-xs text-blue-600 uppercase font-bold mb-2">Special Requests</span>
                <p className="text-sm text-blue-800 leading-relaxed italic">
                  "{assignment.bookings.special_requests}"
                </p>
              </div>
            )}
          </div>

          {assignment.bookings?.status === 'completed' && (
            <div className="p-6 bg-brand-teal/5 rounded-2xl border border-brand-teal/20">
              <h3 className="font-bold text-brand-charcoal mb-4 flex items-center gap-2">
                <Wallet size={20} className="text-brand-teal" /> Payout Information
              </h3>
              {payout ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <span className="block text-xs text-gray-400 uppercase font-bold mb-0.5">Net Amount</span>
                    <span className="text-xl font-bold text-brand-teal">
                      ZAR {Number(payout.amount_net).toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="block text-xs text-gray-400 uppercase font-bold mb-0.5">Payout Status</span>
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-bold uppercase ${getPayoutStatusBadgeClass(payout.status)}`}>
                      {getPayoutStatusDisplay(payout.status)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-gray-500 italic flex items-center gap-2">
                  <Info size={16} />
                  Payout record not available yet. It will be generated shortly.
                </div>
              )}
            </div>
          )}

          {assignment.bookings?.notes && (
            <div>
              <h3 className="font-bold text-gray-700 mb-2 flex items-center gap-2">
                <Info size={18} className="text-brand-teal" /> Dispatch Notes
              </h3>
              <div className="bg-yellow-50 p-4 rounded-lg text-sm text-yellow-800 border border-yellow-100 whitespace-pre-wrap leading-relaxed">
                {assignment.bookings.notes}
              </div>
            </div>
          )}

          {blockReason && (
            <div className="p-4 rounded-2xl border border-amber-200 bg-amber-50 text-amber-900 text-sm font-bold">
              {blockReason}
            </div>
          )}

          {isPending && (
            <div className="pt-6 border-t border-gray-100 flex flex-col md:flex-row gap-4">
              <button
                onClick={() => handleActionClick('accepted')}
                disabled={processing}
                className="flex-1 bg-brand-teal text-white py-3 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-brand-teal/90 transition-colors disabled:opacity-50 shadow-md"
              >
                {processing ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle2 size={20} />}
                Accept Assignment
              </button>

              <button
                onClick={() => handleActionClick('rejected')}
                disabled={processing}
                className="flex-1 bg-white border border-red-200 text-red-600 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                <XCircle size={20} />
                Decline
              </button>
            </div>
          )}
        </div>
      </div>

      {declineModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Decline Assignment?</h2>
            <p className="text-gray-500 mb-6 font-medium text-sm">
              You can add an optional reason for the operator.
            </p>
            <div className="mb-6">
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Reason (optional)
              </label>
              <textarea
                value={declineReason}
                onChange={e => setDeclineReason(e.target.value)}
                placeholder="e.g. Schedule conflict"
                disabled={processing}
                rows={3}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-brand-teal focus:ring-1 focus:ring-brand-teal outline-none transition-all resize-none text-sm"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setDeclineModalOpen(false)}
                disabled={processing}
                className="flex-1 px-4 py-3 bg-gray-100 font-bold text-gray-700 rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => executeAction('rejected', declineReason.trim())}
                disabled={processing}
                className="flex-1 px-4 py-3 bg-red-600 font-bold text-white rounded-xl hover:bg-red-700 transition-colors flex justify-center items-center gap-2 disabled:opacity-50"
              >
                {processing ? "Declining..." : "Confirm Decline"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
