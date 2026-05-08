import React, { useEffect, useState, useRef } from 'react';
import { Booking } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, List, Calendar as CalendarIcon, Search, Eye, Users, RefreshCw, Archive, RotateCcw, CheckCircle2, AlertCircle, AlertTriangle, Clock } from 'lucide-react';
import { BookingCalendar } from '../../components/bookings/BookingCalendar';
import { fetchBookingsForOperator, archiveBookingRpc, unarchiveBookingRpc } from '../../lib/bookingService';
import { getPayoutLedgersForBookings } from '../../lib/payoutService';
import { getCurrentAssignment } from '../../lib/assignmentService';
import { formatCurrency, formatDate } from '../../lib/formatUtils';
import { BookingStatusBadge } from '../../components/bookings/BookingStatusBadge';
import { ConfirmationModal } from '../../components/common/ConfirmationModal';
import { supabase } from '../../lib/supabase';
import { Payout } from '../../types';


export const BookingsList: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [payoutLedgers, setPayoutLedgers] = useState<Payout[]>([]);
  const [disputes, setDisputes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterSettlement, setFilterSettlement] = useState<string>(searchParams.get('filter') === 'awaiting_settlement' ? 'awaiting' : 'all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  const [showBanner, setShowBanner] = useState(true);
  
  // Assignment tracking state
  const [assignmentMap, setAssignmentMap] = useState<Record<string, { driverStatus?: string; guideStatus?: string }>>({});
  const prevMapRef = useRef<Record<string, { driverStatus?: string; guideStatus?: string }>>({});

  // Archive Modal State
  const [archiveTarget, setArchiveTarget] = useState<Booking | null>(null);
  const [isProcessingArchive, setIsProcessingArchive] = useState(false);

  // Stats
  const totalBookings = bookings.length;
  const upcomingBookings = bookings.filter(b => 
    (b.status === 'confirmed' || b.status === 'pending') && 
    new Date(b.start_date) > new Date()
  ).length;

  useEffect(() => {
    loadBookings();
  }, [user, showArchived]);


  const getAssignmentStatusLabel = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending': return 'Pending';
      case 'accepted': return 'Accepted';
      case 'rejected': return 'Declined';
      default: return status;
    }
  };

  const loadBookings = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await fetchBookingsForOperator(user.id, showArchived);
      setBookings(data);
      
      // Load assignments and payouts for the returned bookings
      if (data && data.length > 0) {
        const bookingIds = data.map(b => b.id);
        
        const [assignmentsResult, ledgers, disputesResult] = await Promise.all([
          supabase
            .from('booking_assignments')
            .select('booking_id, resource_type, status, updated_at')
            .in('booking_id', bookingIds)
            .order('updated_at', { ascending: true }),
          getPayoutLedgersForBookings(bookingIds),
          supabase
            .from('payout_disputes')
            .select('booking_id')
            .in('booking_id', bookingIds)
            .eq('status', 'open')
        ]);

        setPayoutLedgers(ledgers);
        setDisputes(disputesResult.data || []);

        if (!assignmentsResult.error && assignmentsResult.data) {
          const map: Record<string, { driverStatus?: string; guideStatus?: string }> = {};
          
          // Group assignments by booking_id
          const assignmentsByBooking: Record<string, any[]> = {};
          assignmentsResult.data.forEach(a => {
            if (!assignmentsByBooking[a.booking_id]) assignmentsByBooking[a.booking_id] = [];
            assignmentsByBooking[a.booking_id].push(a);
          });

          // Resolve current status for each booking using the shared helper
          Object.keys(assignmentsByBooking).forEach(bookingId => {
            const bookingAssignments = assignmentsByBooking[bookingId];
            const currentDriver = getCurrentAssignment(bookingAssignments, 'driver');
            const currentGuide = getCurrentAssignment(bookingAssignments, 'guide');
            
            map[bookingId] = {
              driverStatus: currentDriver?.status || undefined,
              guideStatus: currentGuide?.status || undefined
            };
          });

          // Detect transitions from pending to accepted/rejected
          // Only compare if we have a previous state (prevents notification on first mount)
          if (Object.keys(prevMapRef.current).length > 0) {
            Object.entries(map).forEach(([bId, current]) => {
              const prev = prevMapRef.current[bId];
              if (prev) {
                const booking = data.find(b => b.id === bId);
                const bookingRef = booking?.booking_reference || 'Booking';
                
                // Driver transition
                if (prev.driverStatus === 'pending' && (current.driverStatus === 'accepted' || current.driverStatus === 'rejected')) {
                  // NotificationBell handles this via backend event now
                }
                
                // Guide transition
                if (prev.guideStatus === 'pending' && (current.guideStatus === 'accepted' || current.guideStatus === 'rejected')) {
                  // NotificationBell handles this via backend event now
                }
              }
            });
          }

          setAssignmentMap(map);
          prevMapRef.current = map;
        }
      }
    } catch (error) {
      console.error("Failed to load bookings", error);
    } finally {
      setLoading(false);
    }
  };

  const getEscrowStatusBadge = (b: Booking) => {
    const settlement = getSettlementStatus(b, payoutLedgers);
    const base = "px-1.5 py-0.5 rounded text-[10px] font-bold uppercase border w-fit flex items-center gap-1";

    if (settlement.label === 'Fully paid') {
      return <span className={`${base} bg-green-50 text-green-700 border-green-100`}><CheckCircle2 size={10}/> Fully Paid</span>;
    }

    const status = b.escrow_status || b.payment_status;
    
    switch(status) {
      case 'funds_received':
      case 'funds_held':
        return <span className={`${base} bg-blue-50 text-blue-700 border-blue-100`}><AlertCircle size={10}/> Funds Held</span>;
      case 'partially_released':
        return <span className={`${base} bg-amber-50 text-amber-700 border-amber-100`}><RotateCcw size={10}/> Partially Released</span>;
      case 'fully_released':
      case 'payout_completed':
        return <span className={`${base} bg-green-50 text-green-700 border-green-100`}><CheckCircle2 size={10}/> Fully Released</span>;
      case 'pending_payment':
      case 'payment_pending':
      default:
        return <span className={`${base} bg-gray-50 text-gray-500 border-gray-100`}><Clock size={10}/> Payment Pending</span>;
    }
  };

  const getAssignmentReadinessBadge = (b: Booking) => {
    const status = assignmentMap[b.id];
    const base = "px-1.5 py-0.5 rounded text-[10px] font-bold uppercase border w-fit flex items-center gap-1";
    
    if (!status || (!status.driverStatus && !status.guideStatus)) {
      return <span className={`${base} bg-red-50 text-red-700 border-red-100`}><Users size={10}/> Missing Providers</span>;
    }
    
    const statuses = [status.driverStatus, status.guideStatus].filter(Boolean);
    
    if (statuses.some(s => s === 'rejected')) {
      return <span className={`${base} bg-red-50 text-red-700 border-red-100`}><AlertTriangle size={10}/> Declined</span>;
    }
    if (statuses.some(s => s === 'pending')) {
      return <span className={`${base} bg-amber-50 text-amber-700 border-amber-100`}><Clock size={10}/> Pending Acceptance</span>;
    }
    if (statuses.every(s => s === 'accepted' || s === 'completed')) {
      const isCompleted = statuses.every(s => s === 'completed');
      return <span className={`${base} bg-green-50 text-green-700 border-green-100`}><CheckCircle2 size={10}/> {isCompleted ? 'Completed' : 'Accepted'}</span>;
    }
    
    return <span className={`${base} bg-gray-50 text-gray-700 border-gray-100`}>Assignment Incomplete</span>;
  };

  const initArchiveToggle = (booking: Booking) => {
    setArchiveTarget(booking);
  };

  const handleConfirmArchive = async () => {
    if (!user || !archiveTarget) return;
    setIsProcessingArchive(true);
    try {
      if (archiveTarget.archived_at) {
        await unarchiveBookingRpc(archiveTarget.id);
        setToast({ message: "Booking unarchived successfully", type: 'success' });
      } else {
        await archiveBookingRpc(archiveTarget.id);
        setToast({ message: "Booking archived successfully", type: 'success' });
      }
      await loadBookings();
      setArchiveTarget(null);
      setTimeout(() => setToast(null), 3000);
    } catch (err: any) {
      setToast({ message: "Action failed: " + err.message, type: 'error' });
      setTimeout(() => setToast(null), 3000);
    } finally {
      setIsProcessingArchive(false);
    }
  };

  const getSettlementStatus = (booking: Booking, ledgers: Payout[]): { label: string, color: string } => {
    if (booking.status !== 'completed') return { label: '-', color: 'text-gray-400' };
    const bookingLedgers = ledgers.filter(l => l.booking_id === booking.id);
    if (bookingLedgers.length === 0) return { label: 'No payout yet', color: 'text-gray-500' };
    
    const pending = bookingLedgers.filter(l => l.status === 'pending');
    const approved = bookingLedgers.filter(l => l.status === 'approved');
    const paid = bookingLedgers.filter(l => l.status === 'paid');
    
    if (pending.length === bookingLedgers.length) return { label: 'Ready for payout', color: 'text-amber-600' };
    if (pending.length > 0 && approved.length > 0) return { label: 'Partially approved', color: 'text-blue-600' };
    if (approved.length === bookingLedgers.length) return { label: 'Fully approved', color: 'text-blue-600' };
    if (paid.length > 0 && (pending.length > 0 || approved.length > 0)) return { label: 'Partially paid', color: 'text-green-600' };
    if (paid.length === bookingLedgers.length) return { label: 'Fully paid', color: 'text-green-600' };
    
    return { label: 'Unknown', color: 'text-gray-400' };
  };

  // Filter Logic
  const filteredBookings = bookings.filter(b => {
    const matchesStatus = filterStatus === 'all' || b.status === filterStatus;
    const settlement = getSettlementStatus(b, payoutLedgers);
    const matchesSettlement = filterSettlement === 'all' || 
      (filterSettlement === 'awaiting' && (settlement.label === 'No payout yet' || settlement.label === 'Ready for payout')) ||
      (filterSettlement === 'approved_not_paid' && (settlement.label === 'Partially approved' || settlement.label === 'Fully approved')) ||
      (filterSettlement === 'fully_paid' && settlement.label === 'Fully paid');
    
    const matchesSearch = searchTerm === '' || 
      b.booking_reference.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (b.tours?.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (b.guest_name || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesStatus && matchesSettlement && matchesSearch;
  });

  const AssignmentStatusBadge = ({ status }: { status?: string }) => {
    if (!status) return <span className="text-[10px] text-gray-400 uppercase font-medium">None</span>;
    
    const colors: Record<string, string> = {
      pending: 'bg-amber-50 text-amber-600 border-amber-100',
      accepted: 'bg-green-50 text-green-600 border-green-100',
      rejected: 'bg-red-50 text-red-600 border-red-100'
    };

    const config = colors[status.toLowerCase()] || 'bg-gray-50 text-gray-500 border-gray-100';
    
    return (
      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase border ${config}`}>
        {getAssignmentStatusLabel(status)}
      </span>
    );
  };

  return (
    <div>
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-brand-charcoal text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 size={20} className="text-green-400" />
          {toast.message}
        </div>
      )}

      {/* Helper Banner */}
      {showBanner && totalBookings === 0 && (
        <div className="mb-6 p-4 bg-brand-teal/10 border border-brand-teal/20 rounded-2xl flex items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brand-teal/20 rounded-lg text-brand-teal">
              <AlertCircle size={20} />
            </div>
            <p className="text-sm font-medium text-brand-charcoal">
              Create a booking first, then add vehicles and staff.
            </p>
          </div>
          <button 
            onClick={() => setShowBanner(false)}
            className="text-gray-400 hover:text-gray-600 p-1"
          >
            <RefreshCw size={16} className="rotate-45" />
          </button>
        </div>
      )}


      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={!!archiveTarget}
        title={archiveTarget?.archived_at ? "Unarchive Booking?" : "Archive Booking?"}
        body={archiveTarget?.archived_at 
          ? "This will restore the booking to your main list." 
          : "This hides the record from your default list. You can restore visibility by turning on Show Archived."}
        confirmLabel={archiveTarget?.archived_at ? "Unarchive" : "Archive"}
        isDestructive={!archiveTarget?.archived_at}
        isProcessing={isProcessingArchive}
        onConfirm={handleConfirmArchive}
        onCancel={() => setArchiveTarget(null)}
      />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-brand-charcoal">Bookings</h1>
          <p className="text-gray-500 mt-1">
            Manage your trips, resources, and booking progress.
          </p>
          <div className="flex gap-4 text-sm text-gray-400 mt-2">
            <span>Total: <strong>{totalBookings}</strong></span>
            <span>Upcoming: <strong>{upcomingBookings}</strong></span>
          </div>
        </div>
        <Link 
          to="/operator/bookings/new"
          className="bg-brand-teal text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-brand-teal/90 transition-colors"
        >
          <Plus size={18} /> Create Booking
        </Link>
      </div>

      {/* Controls */}
      <div className="flex flex-col md:flex-row gap-4 mb-6 justify-between items-end md:items-center">
        <div className="flex items-center gap-4">
          <div className="flex items-center bg-white p-1 rounded-lg border border-gray-200">
             <button 
               onClick={() => setView('list')}
               className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-colors ${view === 'list' ? 'bg-brand-charcoal text-white' : 'text-gray-500 hover:bg-gray-50'}`}
             >
               <List size={16} /> List
             </button>
             <button 
               onClick={() => setView('calendar')}
               className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-colors ${view === 'calendar' ? 'bg-brand-charcoal text-white' : 'text-gray-500 hover:bg-gray-50'}`}
             >
               <CalendarIcon size={16} /> Calendar
             </button>
          </div>
          
          <label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-gray-600 hover:text-brand-charcoal select-none">
            <div className={`w-10 h-5 rounded-full relative transition-colors ${showArchived ? 'bg-brand-teal' : 'bg-gray-300'}`}>
              <input type="checkbox" className="hidden" checked={showArchived} onChange={() => setShowArchived(!showArchived)} />
              <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${showArchived ? 'left-6' : 'left-1'}`}></div>
            </div>
            Archived Only
          </label>
        </div>

        {view === 'list' && (
          <div className="flex gap-2 w-full md:w-auto">
             <div className="relative flex-1 md:w-64">
               <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
               <input 
                 type="text" 
                 placeholder="Search ref, tour, or guest..." 
                 className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-brand-teal"
                 value={searchTerm}
                 onChange={(e) => setSearchTerm(e.target.value)}
               />
             </div>
             <select 
               className="border border-gray-200 rounded-lg px-4 py-2 bg-white text-sm focus:outline-none focus:border-brand-teal"
               value={filterStatus}
               onChange={(e) => setFilterStatus(e.target.value)}
             >
               <option value="all">All Status</option>
               <option value="draft">Draft</option>
               <option value="pending">Pending</option>
               <option value="confirmed">Confirmed</option>
               <option value="completed">Completed</option>
               <option value="cancelled">Cancelled</option>
             </select>
             <select 
               className="border border-gray-200 rounded-lg px-4 py-2 bg-white text-sm focus:outline-none focus:border-brand-teal"
               value={filterSettlement}
               onChange={(e) => setFilterSettlement(e.target.value)}
             >
               <option value="all">All Settlement</option>
               <option value="awaiting">Awaiting payout</option>
               <option value="approved_not_paid">Approved not paid</option>
               <option value="fully_paid">Fully paid</option>
             </select>
          </div>
        )}
      </div>

      {/* View Content */}
      {loading ? (
        <div className="p-12 text-center text-gray-400">Loading bookings...</div>
      ) : bookings.length === 0 ? (
        <div className="bg-white rounded-3xl border-2 border-dashed border-gray-100 p-12 text-center">
          <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-gray-400">
            <CalendarIcon size={32} />
          </div>
          <h3 className="text-xl font-bold text-brand-charcoal mb-2">No bookings yet</h3>
          <p className="text-gray-500 mb-8 max-w-sm mx-auto">Start by creating your first trip.</p>
          <Link 
            to="/operator/bookings/new"
            className="inline-flex items-center gap-2 bg-brand-teal text-white px-6 py-3 rounded-xl font-bold hover:bg-brand-teal/90 transition-all shadow-sm"
          >
            <Plus size={20} /> Create Booking
          </Link>
        </div>
      ) : view === 'calendar' ? (
        <BookingCalendar bookings={filteredBookings} />
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
           {filteredBookings.length === 0 ? (
             <div className="p-12 text-center text-gray-400">No bookings found matching your filters.</div>
           ) : (
             <>
               <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Trip Details</th>
                    <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Start Date</th>
                    <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Assignments</th>
                    <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-left">Settlement</th>
                    <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Amount</th>
                    <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredBookings.map(b => (
                    <tr key={b.id} className={`hover:bg-gray-50 transition-colors ${b.archived_at ? 'bg-gray-50 opacity-75' : ''}`}>
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="font-bold text-brand-charcoal text-sm">{b.tours?.title || 'Unknown Tour'}</span>
                          {b.guest_name && (
                            <span className="text-xs text-gray-600 flex items-center gap-1 mt-0.5">
                              <Users size={10}/> {b.guest_name} <span className="text-gray-400">({b.num_guests})</span>
                            </span>
                          )}
                          <span className="font-mono text-[10px] text-gray-400 mt-1 uppercase">
                            {b.booking_reference}
                            {b.archived_at && <span className="ml-2 px-1.5 py-0.5 bg-gray-200 text-gray-600 text-[9px] rounded uppercase">Archived</span>}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 font-medium whitespace-nowrap">
                        {formatDate(b.start_date)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1.5 w-fit">
                          <BookingStatusBadge status={b.status} />
                          {getEscrowStatusBadge(b)}
                          {getAssignmentReadinessBadge(b)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1.5 w-max">
                          <div className="flex items-center gap-2 text-[10px]">
                            <span className="text-gray-400 uppercase font-bold w-12">Driver</span>
                            <AssignmentStatusBadge status={assignmentMap[b.id]?.driverStatus} />
                          </div>
                          <div className="flex items-center gap-2 text-[10px]">
                            <span className="text-gray-400 uppercase font-bold w-12">Guide</span>
                            <AssignmentStatusBadge status={assignmentMap[b.id]?.guideStatus} />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {(() => {
                          const settlement = getSettlementStatus(b, payoutLedgers);
                          const bookingLedgers = payoutLedgers.filter(l => l.booking_id === b.id);
                          const hasHold = bookingLedgers.some(l => l.is_on_hold);
                          const hasOpenDispute = disputes.some(d => d.booking_id === b.id);
                          const needsAttention =
                            b.status === 'completed' &&
                          settlement.label !== 'Fully paid';

                          return (
                            <div className="flex flex-col gap-1.5 w-fit">
                              <div className="flex items-center gap-2">
                              {needsAttention && (
                                <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0"></span>
                              )}
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase border ${
                                  settlement.label === 'Fully paid'
                                    ? 'bg-green-50 text-green-700 border-green-100'
                                    : settlement.label === 'Fully approved'
                                    ? 'bg-blue-50 text-blue-700 border-blue-100'
                                    : settlement.label === 'Partially approved'
                                    ? 'bg-amber-50 text-amber-700 border-amber-100'
                                    : settlement.label === 'Partially paid'
                                    ? 'bg-amber-50 text-amber-700 border-amber-100'
                                    : settlement.label === 'Ready for payout'
                                    ? 'bg-amber-50 text-amber-700 border-amber-100'
                                    : 'bg-gray-50 text-gray-500 border-gray-100'
                                }`}
                              >
                                {settlement.label}
                              </span>
                            </div>
                            {(hasHold || hasOpenDispute) && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-black bg-red-50 text-red-700 border border-red-200 uppercase w-fit">
                                <AlertTriangle size={10} /> {hasOpenDispute ? 'Dispute' : 'On Hold'}
                              </span>
                            )}
                          </div>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-3 font-mono text-sm text-right font-bold text-brand-charcoal whitespace-nowrap">
                        {formatCurrency(b.total_amount, b.currency)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <button 
                            onClick={() => navigate(`/operator/bookings/${b.id}`)}
                            className="text-brand-teal hover:text-brand-charcoal transition-colors flex items-center gap-1 font-bold text-sm"
                            title="View Details"
                          >
                            <Eye size={16} /> View
                          </button>
                          <button
                            onClick={() => initArchiveToggle(b)}
                            className="text-gray-400 hover:text-brand-charcoal transition-colors"
                            title={b.archived_at ? "Unarchive" : "Archive"}
                          >
                            {b.archived_at ? <RotateCcw size={16} /> : <Archive size={16} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View */}
            <div className="lg:hidden flex flex-col gap-4 p-4">
              {filteredBookings.map(b => (
                <div 
                  key={b.id} 
                  className={`bg-white rounded-2xl p-4 border border-gray-100 shadow-sm transition-colors ${b.archived_at ? 'bg-gray-50 opacity-75' : ''}`}
                >
                  <div className="flex justify-between items-start mb-3 gap-2">
                    <div className="flex flex-col gap-1 flex-1">
                      <span className="font-bold text-brand-charcoal leading-tight text-base">{b.tours?.title || 'Unknown Tour'}</span>
                      <span className="font-mono text-[10px] text-gray-400 uppercase tracking-tighter">
                        {b.booking_reference}
                        {b.archived_at && <span className="ml-2 px-1.5 py-0.5 bg-gray-200 text-gray-600 text-[8px] rounded uppercase font-bold">Archived</span>}
                      </span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-bold text-brand-charcoal text-sm block">{formatCurrency(b.total_amount, b.currency)}</span>
                      <p className="text-[10px] text-gray-400 font-medium uppercase tracking-tighter mt-1">{formatDate(b.start_date)}</p>
                    </div>
                  </div>

                  {b.guest_name && (
                    <div className="mb-4 py-2 px-3 bg-gray-50 rounded-xl flex items-center gap-2">
                      <Users size={14} className="text-gray-400" />
                      <span className="text-xs text-brand-charcoal font-bold">{b.guest_name}</span>
                      <span className="text-[10px] text-gray-400">({b.num_guests})</span>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 mb-4">
                    <BookingStatusBadge status={b.status} />
                    {getEscrowStatusBadge(b)}
                    {getAssignmentReadinessBadge(b)}
                    {(() => {
                      const settlement = getSettlementStatus(b, payoutLedgers);
                      if (settlement.label === '-' || settlement.label === 'No payout yet') return null;
                      return (
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase border ${
                          settlement.label === 'Fully paid'
                            ? 'bg-green-50 text-green-700 border-green-100'
                            : 'bg-amber-50 text-amber-700 border-amber-100'
                        }`}>
                          {settlement.label}
                        </span>
                      );
                    })()}
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                    <div className="flex gap-4">
                      <div className="flex flex-col gap-1">
                        <span className="text-[8px] text-gray-400 uppercase font-bold tracking-widest">Driver</span>
                        <AssignmentStatusBadge status={assignmentMap[b.id]?.driverStatus} />
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[8px] text-gray-400 uppercase font-bold tracking-widest">Guide</span>
                        <AssignmentStatusBadge status={assignmentMap[b.id]?.guideStatus} />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => initArchiveToggle(b)}
                        className="p-2.5 text-gray-400 hover:text-brand-charcoal transition-colors border border-gray-100 rounded-xl flex items-center justify-center"
                        title={b.archived_at ? "Unarchive" : "Archive"}
                      >
                        {b.archived_at ? <RotateCcw size={18} /> : <Archive size={18} />}
                      </button>
                      <button 
                        onClick={() => navigate(`/operator/bookings/${b.id}`)}
                        className="bg-brand-charcoal text-white px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-brand-charcoal/90 transition-all shadow-sm active:scale-95"
                      >
                        <Eye size={18} /> View
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
        </div>
      )}
    </div>
  );
};
