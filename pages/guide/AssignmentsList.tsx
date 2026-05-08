import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getGuideAssignments, acceptAssignment, rejectAssignment, archiveAssignmentForResource, unarchiveAssignmentForResource, getArchivedAssignmentIdsForResource } from '../../lib/assignmentService';
import { listProviderPayouts } from '../../lib/payoutService';
import { supabase } from '../../lib/supabase';
import { CalendarDays, Banknote, CheckCircle, XCircle, MapPin, Clock, History as HistoryIcon, ChevronRight, Archive, RotateCcw, Wallet } from 'lucide-react';

const getStatusDisplay = (status: string, bookingStatus?: string) => {
  if (bookingStatus === 'completed') return 'Completed';
  if (bookingStatus === 'cancelled') return 'Cancelled';
  
  switch (status) {
    case 'pending': return 'Pending Acceptance';
    case 'accepted': return 'Accepted';
    case 'rejected': return 'Declined';
    case 'cancelled': return 'Cancelled';
    default: return status;
  }
};

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

const getStatusBadgeClass = (status: string, bookingStatus?: string) => {
  if (bookingStatus === 'completed') return 'bg-gray-100 text-gray-700';
  if (bookingStatus === 'cancelled') return 'bg-red-100 text-red-700';

  switch (status) {
    case 'accepted': return 'bg-green-100 text-green-700';
    case 'rejected': return 'bg-red-100 text-red-700';
    case 'pending': return 'bg-amber-100 text-amber-700';
    default: return 'bg-gray-100 text-gray-700';
  }
};

export const AssignmentsList: React.FC = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [assignments, setAssignments] = useState<any[]>([]);
  const [payouts, setPayouts] = useState<Record<string, any>>({});
  const [archivedIds, setArchivedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  const [declineAssignmentId, setDeclineAssignmentId] = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState("");
  const [isDeclining, setIsDeclining] = useState(false);

  const loadAssignments = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    try {
      const [data, archived, payoutList] = await Promise.all([
        getGuideAssignments(profile.id),
        getArchivedAssignmentIdsForResource(profile.id, 'guide'),
        listProviderPayouts(profile.id)
      ]);
      
      setArchivedIds(archived);
      
      // Map payouts by booking_id
      const payoutMap: Record<string, any> = {};
      payoutList.forEach(p => {
        payoutMap[p.booking_id] = p;
      });
      setPayouts(payoutMap);

      // Fetch operator names
      const operatorIds = [...new Set(data.map((a: any) => a.bookings?.operator_id).filter(Boolean))];
      if (operatorIds.length > 0) {
        const { data: operators } = await supabase.rpc('get_public_profiles', { p_ids: operatorIds });
        
        const operatorMap = Object.fromEntries(operators?.map((o: any) => [o.id, o.company_name || o.full_name || 'Tour Operator']) || []);
        setAssignments(data.map((a: any) => ({
          ...a,
          operator_name: operatorMap[a.bookings?.operator_id] || 'Tour Operator'
        })));
      } else {
        setAssignments(data || []);
      }
    } catch (err) {
      console.error(err);
      setAssignments([]);
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    loadAssignments();
  }, [loadAssignments]);

  const handleAccept = async (id: string) => {
    setActionLoading(id);
    setErrorNotice(null);
    try {
      await acceptAssignment(id);
      await loadAssignments();
    } catch (err: any) {
      console.error(err);
      setErrorNotice(err.message || 'Failed to accept assignment');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectClick = (id: string) => {
    setDeclineAssignmentId(id);
    setDeclineReason("");
  };

  const handleConfirmReject = async () => {
    if (!declineAssignmentId) return;
    setIsDeclining(true);
    setErrorNotice(null);
    try {
      await rejectAssignment(declineAssignmentId, declineReason.trim());
      await loadAssignments();
      setDeclineAssignmentId(null);
      setDeclineReason("");
    } catch (err: any) {
      console.error(err);
      setErrorNotice(err.message || 'Failed to decline assignment');
      setDeclineAssignmentId(null);
    } finally {
      setIsDeclining(false);
    }
  };

  const handleArchive = async (id: string) => {
    if (!profile?.id) return;
    setActionLoading(id);
    setErrorNotice(null);
    try {
      await archiveAssignmentForResource(id, profile.id, 'guide');
      await loadAssignments();
    } catch (err: any) {
      console.error(err);
      setErrorNotice(err.message || 'Failed to archive assignment');
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnarchive = async (id: string) => {
    if (!profile?.id) return;
    setActionLoading(id);
    setErrorNotice(null);
    try {
      await unarchiveAssignmentForResource(id, profile.id);
      await loadAssignments();
    } catch (err: any) {
      console.error(err);
      setErrorNotice(err.message || 'Failed to restore assignment');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-400">Loading assignments...</div>;

  const upcoming = assignments
    .filter((a) => 
      !archivedIds.includes(a.id) &&
      (a.status === 'accepted' || a.status === 'pending') && 
      a.bookings?.status !== 'completed' && 
      a.bookings?.status !== 'cancelled' &&
      a.status !== 'cancelled'
    )
    .sort((a, b) => {
      const dateA = new Date(a.bookings?.start_date || a.updated_at || 0).getTime();
      const dateB = new Date(b.bookings?.start_date || b.updated_at || 0).getTime();
      return dateA - dateB;
    });

  const history = assignments
    .filter((a) => 
      !archivedIds.includes(a.id) &&
      (a.status === 'rejected' || 
      a.status === 'cancelled' ||
      a.bookings?.status === 'completed' || 
      a.bookings?.status === 'cancelled')
    )
    .sort((a, b) => {
      const dateA = new Date(a.bookings?.start_date || a.updated_at || 0).getTime();
      const dateB = new Date(b.bookings?.start_date || b.updated_at || 0).getTime();
      return dateB - dateA;
    });

  const archived = assignments
    .filter((a) => archivedIds.includes(a.id))
    .sort((a, b) => {
      const dateA = new Date(a.updated_at || 0).getTime();
      const dateB = new Date(b.updated_at || 0).getTime();
      return dateB - dateA;
    });

  const renderAssignmentCard = (a: any, section: 'upcoming' | 'history' | 'archived') => {
    const isPending = a.status === 'pending' && a.bookings?.status !== 'completed' && a.bookings?.status !== 'cancelled';
    const booking = a.bookings;
    const tour = booking?.tours;
    const payout = payouts[a.booking_id];

    return (
      <div
        key={a.id}
        onClick={() => navigate(`/guide/assignments/${a.id}`)}
        className={`bg-white p-5 rounded-2xl border shadow-sm transition-all hover:shadow-md cursor-pointer flex flex-col md:flex-row gap-4 justify-between items-start md:items-center ${
          isPending ? 'border-amber-200 bg-amber-50/10' : 'border-gray-200'
        }`}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${getStatusBadgeClass(a.status, booking?.status)}`}>
              {getStatusDisplay(a.status, booking?.status)}
            </span>
            {booking?.status === 'completed' && (
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${getPayoutStatusBadgeClass(payout?.status || 'pending')}`}>
                {payout ? getPayoutStatusDisplay(payout.status) : 'Payout Pending'}
              </span>
            )}
            <span className="text-xs font-mono text-gray-400 truncate">
              {booking?.booking_reference}
            </span>
          </div>

          <h3 className="font-bold text-brand-charcoal truncate mb-1">
            {tour?.title || 'Tour Details Unavailable'}
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-500">
            <div className="flex items-center gap-1.5">
              <CalendarDays size={14} className="text-brand-teal" />
              <span>{booking?.start_date ? new Date(booking.start_date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'TBD'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <MapPin size={14} className="text-brand-teal" />
              <span className="truncate">{tour?.region || 'No location'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Banknote size={14} className="text-brand-teal" />
              {payout ? (
                <span className="font-bold text-brand-teal">ZAR {Number(payout.amount_net).toLocaleString()} (Earned)</span>
              ) : (
                <span>ZAR {a.rate_amount?.toLocaleString()} / {a.rate_type}</span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-[10px] uppercase text-gray-400">Operator:</span>
              <span className="truncate font-medium text-gray-600">{a.operator_name}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 w-full md:w-auto">
          {section === 'upcoming' && isPending && (
            <div className="flex gap-2 flex-1 md:flex-none">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleAccept(a.id);
                }}
                disabled={actionLoading === a.id}
                className="flex-1 md:flex-none bg-brand-teal text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-brand-teal/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                Accept
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRejectClick(a.id);
                }}
                disabled={actionLoading === a.id}
                className="flex-1 md:flex-none bg-white border border-red-200 text-red-600 px-4 py-2 rounded-lg font-bold text-sm hover:bg-red-50 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                Decline
              </button>
            </div>
          )}
          {section === 'history' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleArchive(a.id);
              }}
              disabled={
                actionLoading === a.id || 
                ((a.status === 'pending' || a.status === 'accepted') && 
                 booking?.status !== 'completed' && 
                 booking?.status !== 'cancelled')
              }
              className="flex-1 md:flex-none bg-gray-50 text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg font-bold text-xs hover:bg-gray-100 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-30 disabled:cursor-not-allowed"
              title={
                (a.status === 'pending' || a.status === 'accepted') && 
                booking?.status !== 'completed' && 
                booking?.status !== 'cancelled' 
                  ? "Cannot archive active assignments" 
                  : "Archive this assignment"
              }
            >
              <Archive size={14} />
              Archive
            </button>
          )}
          {section === 'archived' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleUnarchive(a.id);
              }}
              disabled={actionLoading === a.id}
              className="flex-1 md:flex-none bg-gray-50 text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg font-bold text-xs hover:bg-gray-100 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <RotateCcw size={14} />
              Restore
            </button>
          )}
          {section === 'upcoming' && !isPending && (
            <ChevronRight size={20} className="text-gray-300 hidden md:block" />
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-brand-charcoal">Guide Assignments</h1>
          <p className="text-gray-500">View and manage your guiding jobs.</p>
        </div>
        <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-gray-200 shadow-sm self-start sm:self-auto">
          <span className="text-sm font-bold text-gray-600">Show Archived</span>
          <button
            onClick={() => setShowArchived(!showArchived)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
              showArchived ? 'bg-brand-teal' : 'bg-gray-200'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                showArchived ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      {errorNotice && (
        <div className="mb-6 p-4 bg-red-50 text-red-700 border border-red-200 rounded-2xl font-bold text-sm">
          {errorNotice}
        </div>
      )}

      <div className="space-y-12">
        <section>
          <h2 className="text-xl font-bold text-brand-charcoal mb-6 flex items-center gap-2">
            <Clock className="text-brand-teal" size={20} />
            Upcoming Jobs
          </h2>
          <div className="space-y-4">
            {upcoming.length === 0 ? (
              <div className="bg-white p-12 rounded-2xl border border-gray-200 text-center text-gray-400 shadow-sm">
                <CalendarDays size={48} className="mx-auto mb-4 opacity-20" />
                <p className="font-medium">No upcoming jobs found</p>
                <p className="text-xs mt-1">New requests will appear here when assigned.</p>
              </div>
            ) : (
              upcoming.map((a) => renderAssignmentCard(a, 'upcoming'))
            )}
          </div>
        </section>

        <section>
          <h2 className="text-xl font-bold text-brand-charcoal mb-6 flex items-center gap-2">
            <HistoryIcon className="text-gray-400" size={20} />
            History
          </h2>
          <div className="space-y-4">
            {history.length === 0 ? (
              <div className="bg-white p-12 rounded-2xl border border-gray-200 text-center text-gray-400 shadow-sm">
                <HistoryIcon size={48} className="mx-auto mb-4 opacity-20" />
                <p className="font-medium">No history available</p>
              </div>
            ) : (
              history.map((a) => renderAssignmentCard(a, 'history'))
            )}
          </div>
        </section>

        {showArchived && (
          <section>
            <h2 className="text-xl font-bold text-brand-charcoal mb-6 flex items-center gap-2">
              <Archive className="text-gray-400" size={20} />
              Archived
            </h2>
            <div className="space-y-4">
              {archived.length === 0 ? (
                <div className="bg-white p-12 rounded-2xl border border-gray-200 text-center text-gray-400 shadow-sm">
                  <Archive size={48} className="mx-auto mb-4 opacity-20" />
                  <p className="font-medium">No archived assignments</p>
                </div>
              ) : (
                archived.map((a) => renderAssignmentCard(a, 'archived'))
              )}
            </div>
          </section>
        )}
      </div>

      {declineAssignmentId && (
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
                disabled={isDeclining}
                rows={3}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-brand-teal focus:ring-1 focus:ring-brand-teal outline-none transition-all resize-none text-sm"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setDeclineAssignmentId(null);
                  setDeclineReason("");
                }}
                disabled={isDeclining}
                className="flex-1 px-4 py-3 bg-gray-100 font-bold text-gray-700 rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReject}
                disabled={isDeclining}
                className="flex-1 px-4 py-3 bg-red-600 font-bold text-white rounded-xl hover:bg-red-700 transition-colors flex justify-center items-center gap-2 disabled:opacity-50"
              >
                {isDeclining ? "Declining..." : "Confirm Decline"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
