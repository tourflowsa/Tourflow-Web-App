import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import {
  ArrowLeft,
  Calendar,
  Clock,
  User,
  Mail,
  Phone,
  MapPin,
  FileText,
  Car,
  Compass,
  Wallet,
  Loader2,
  AlertCircle,
  Info,
  History,
  Lock,
  ShieldCheck,
  DollarSign,
  RefreshCw,
  X
} from 'lucide-react';
import { BookingStatusBadge } from '../../components/bookings/BookingStatusBadge';
import { BookingFinancialBreakdownView } from '../../components/bookings/BookingFinancialBreakdown';
import { formatCurrency, formatDate } from '../../lib/formatUtils';
import { markBookingFundsReceived, refreshBookingEscrowState } from '../../lib/escrowService';
import { getBookingFinancialBreakdown, BookingFinancialBreakdown } from '../../lib/financialService';
import { useAuth } from '../../contexts/AuthContext';

type AnyRow = Record<string, any>;

export const AdminBookingDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [booking, setBooking] = useState<AnyRow | null>(null);
  const [vehicle, setVehicle] = useState<AnyRow | null>(null);
  const [assignments, setAssignments] = useState<AnyRow[]>([]);
  const [payoutLedgers, setPayoutLedgers] = useState<AnyRow[]>([]);
  const [financials, setFinancials] = useState<BookingFinancialBreakdown | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showEscrowModal, setShowEscrowModal] = useState(false);
  const [escrowAmount, setEscrowAmount] = useState('');
  const [processingEscrow, setProcessingEscrow] = useState(false);

  useEffect(() => {
    if (id) fetchDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchDetail = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: bData, error: bError } = await supabase
        .from('bookings')
        .select(
          `
          *,
          tours (*),
          operator_profile:profiles!bookings_operator_id_fkey (*)
        `
        )
        .eq('id', id)
        .single();

      if (bError) throw bError;
      setBooking(bData as AnyRow);

      if (bData?.vehicle_id) {
        const { data: vData } = await supabase
          .from('vehicles')
          .select(`
            *,
            owner:profiles!vehicles_owner_id_fkey (*)
          `)
          .eq('id', bData.vehicle_id)
          .maybeSingle();
        
        if (vData) {
          setVehicle(vData);
        }
      }

      const { data: aData, error: aError } = await supabase
        .from('booking_assignments')
        .select('*')
        .eq('booking_id', id);

      if (aError) throw aError;

      const rows = (aData || []) as AnyRow[];

      const enhancedAssignments = await Promise.all(
        rows.map(async (a) => {
          if (!a?.resource_id) return { ...a, profile: null };

          const { data: pData, error: pError } = await supabase
            .from('profiles')
            .select('id, full_name, email, phone, role, company_name')
            .eq('id', a.resource_id)
            .maybeSingle();

          if (pError) {
            console.warn('Assignment profile lookup failed', { assignment_id: a.id, error: pError });
            return { ...a, profile: null };
          }

          return { ...a, profile: pData || null };
        })
      );

      setAssignments(enhancedAssignments);

      const { data: pData, error: pError } = await supabase
        .from('payout_ledger')
        .select('status, amount_net, adjusted_amount, provider_id')
        .eq('booking_id', id);

      if (!pError) {
        setPayoutLedgers(pData || []);
      }

      const breakdown = await getBookingFinancialBreakdown(id as string);
      setFinancials(breakdown);
    } catch (err: any) {
      console.error('Admin Booking Detail Error:', err);
      setError(err?.message || 'Could not load booking details.');
    } finally {
      setLoading(false);
    }
  };

  const driverAssign = useMemo(() => assignments.find((a) => a.resource_type === 'driver'), [assignments]);
  const guideAssign = useMemo(() => assignments.find((a) => a.resource_type === 'guide'), [assignments]);

  const isFinanciallyLocked = useMemo(() => {
    return payoutLedgers.some(p => p.status === 'paid');
  }, [payoutLedgers]);

  const actualReleased = useMemo(() => {
    const sum = payoutLedgers
      .filter(l => l.status === 'paid')
      .reduce((sum, l) => sum + (l.adjusted_amount !== null && l.adjusted_amount !== undefined ? Number(l.adjusted_amount) : Number(l.amount_net || 0)), 0);
    return sum || booking?.funds_released_amount || 0;
  }, [payoutLedgers, booking?.funds_released_amount]);

  const fundsReceived = booking?.funds_received_amount || 0;
  const fundsHeld = booking?.funds_held_amount || booking?.escrow_held || 0;
  const remainingBalance = Math.max(0, (Number(fundsHeld) || Number(fundsReceived)) - actualReleased);

  useEffect(() => {
    if (booking) {
      const hasEscrowFundsReceived = (b: any) => {
        const paymentStatus = String(b?.payment_status || '').toLowerCase();
        const escrowStatus = String(b?.escrow_status || '').toLowerCase();

        return (
          paymentStatus === 'paid' ||
          paymentStatus === 'funds_received' ||
          paymentStatus === 'funds_held' ||
          escrowStatus === 'funds_received' ||
          escrowStatus === 'partially_released' ||
          escrowStatus === 'fully_released' ||
          Number(b?.funds_received_amount || 0) > 0 ||
          Number(b?.funds_held_amount || 0) > 0 ||
          Number(b?.escrow_total || 0) > 0 ||
          Number(b?.escrow_held || 0) > 0
        );
      };
    }
  }, [booking]);

  const payoutSignal = useMemo(() => {
    const total = payoutLedgers.length;
    const paid = payoutLedgers.filter(p => p.status === 'paid').length;
    const isCompleted = booking?.status === 'completed';

    if (total > 0 && paid === total) {
      return { label: 'Paid', className: 'bg-green-100 text-green-700' };
    }
    if (paid > 0) {
      return { label: 'Partially Paid', className: 'bg-amber-100 text-amber-700' };
    }
    if (isCompleted || booking?.payment_status === 'payout_ready' || booking?.payment_status === 'funds_received') {
      return { label: 'Payout Ready', className: 'bg-blue-100 text-blue-700' };
    }
    const hasSpentFunds = Number(booking?.funds_received_amount || 0) > 0 || Number(booking?.funds_held_amount || 0) > 0 || Number(booking?.escrow_held || 0) > 0;
    const isEscrowFunded = booking?.payment_status === 'funds_held' || booking?.escrow_status === 'funds_received';
    
    if ((!booking?.payment_status || booking?.payment_status === 'payment_pending') && (hasSpentFunds || isEscrowFunded)) {
      return { label: 'FUNDS HELD', className: 'bg-blue-100 text-blue-700' };
    }
    return { label: booking?.payment_status?.replace('_', ' ') || 'Pending', className: 'bg-gray-100 text-gray-500' };
  }, [payoutLedgers, booking?.status, booking?.payment_status, booking?.funds_received_amount, booking?.funds_held_amount, booking?.escrow_held, booking?.escrow_status]);

  if (loading) {
    return (
      <div className="p-12 text-center text-gray-500 flex flex-col items-center gap-2">
        <Loader2 className="animate-spin text-brand-teal" />
        Loading booking detail...
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="max-w-4xl mx-auto mt-8 p-6 bg-red-50 border border-red-200 rounded-xl text-center">
        <AlertCircle className="mx-auto text-red-500 mb-2" size={32} />
        <h3 className="text-lg font-bold text-red-800">Error Loading Booking</h3>
        <p className="text-red-600 mb-4">{error || 'This booking could not be found.'}</p>
        <button onClick={() => navigate('/admin/bookings')} className="text-brand-teal hover:underline font-bold">
          Back to List
        </button>
      </div>
    );
  }

  const handleMarkFundsReceived = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!id || !user) return;
    
    // Read value directly from form if possible to ensure we have the latest committed value
    const form = e?.currentTarget as HTMLFormElement;
    const input = form?.querySelector('input[type="number"]') as HTMLInputElement;
    const rawValue = input ? input.value : escrowAmount;
    const parsedAmount = parseFloat(rawValue);
    
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Please enter a valid amount greater than 0');
      return;
    }

    if (processingEscrow) return;

    setProcessingEscrow(true);
    try {
      await markBookingFundsReceived(id, parsedAmount, user.id);
      await fetchDetail();
      setShowEscrowModal(false);
      setEscrowAmount('');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to mark funds as received');
    } finally {
      setProcessingEscrow(false);
    }
  };

  const operatorProfile = booking.operator_profile || null;
  const operatorId = operatorProfile?.id ?? booking.operator_id ?? null;

  return (
    <div className="max-w-6xl mx-auto pb-12">
      {isFinanciallyLocked && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-6 py-4 mb-6 flex items-center gap-4 text-amber-800 shadow-sm">
          <div className="p-2 bg-amber-100 rounded-full">
            <Lock size={20} className="text-amber-600" />
          </div>
          <div>
            <p className="font-bold text-sm">Financial Lock Active</p>
            <p className="text-xs opacity-90">
              At least one payout for this booking has been marked as <span className="font-bold uppercase">Paid</span>. 
              This record is now locked for financial integrity.
            </p>
          </div>
        </div>
      )}
      <div className="mb-6 flex items-center justify-between">
        <button
          onClick={() => navigate('/admin/bookings')}
          className="flex items-center gap-2 text-gray-500 hover:text-brand-charcoal transition-colors font-bold text-sm"
        >
          <ArrowLeft size={16} /> Back to Global List
        </button>
        <div className="text-xs text-gray-400 font-mono">Booking ID: {booking.id}</div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {financials && (
            <BookingFinancialBreakdownView 
              data={financials} 
              isAdmin={true} 
            />
          )}

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-8 py-6 border-b border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row justify-between items-start gap-4">
              <div>
                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-1">Global Record</span>
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl font-mono font-bold text-brand-charcoal">{booking.booking_reference}</h1>
                  <BookingStatusBadge status={booking.status} className="mt-1" />
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-1">Created Date</span>
                <div className="font-medium text-gray-700 flex items-center justify-end gap-1.5">
                  <Calendar size={14} className="text-brand-teal" />
                  {formatDate(booking.created_at)}
                </div>
              </div>
            </div>

            <div className="p-8 space-y-8">
              <div>
                <h3 className="text-xs font-bold text-gray-400 uppercase mb-4 flex items-center gap-2">
                  <MapPin size={14} /> Associated Tour
                </h3>
                <div className="p-4 bg-brand-teal/5 rounded-xl border border-brand-teal/10 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-brand-teal rounded-lg flex items-center justify-center text-white">
                      <Compass size={24} />
                    </div>
                    <div>
                      <p className="font-bold text-brand-charcoal">{booking.tours?.title || 'Tour'}</p>
                      <p className="text-sm text-gray-500">{booking.tours?.region || 'Multiple Regions'}</p>
                    </div>
                  </div>
                  <Link to={`/operator/tours/${booking.tour_id}`} className="text-sm font-bold text-brand-teal hover:underline">
                    View Tour →
                  </Link>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
                <div>
                  <h3 className="text-xs font-bold text-gray-400 uppercase mb-4 flex items-center gap-2">
                    <Clock size={14} /> Operational Schedule
                  </h3>
                  <div className="space-y-4 border-l-2 border-brand-teal/20 pl-4 py-1">
                    <div>
                      <span className="text-[10px] text-gray-400 uppercase block font-bold">Pick-up / Start</span>
                      <div className="font-bold text-brand-charcoal">{new Date(booking.start_date).toLocaleString()}</div>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-400 uppercase block font-bold">Drop-off / End</span>
                      <div className="font-bold text-brand-charcoal">{new Date(booking.end_date).toLocaleString()}</div>
                    </div>
                    {(booking.pickup_location || booking.dropoff_location) && (
                      <div className="pt-2 grid grid-cols-1 gap-2">
                        {booking.pickup_location && (
                          <div>
                            <span className="text-[9px] text-gray-400 uppercase block font-bold">Pickup Place</span>
                            <div className="text-xs font-medium text-brand-charcoal">{booking.pickup_location}</div>
                          </div>
                        )}
                        {booking.dropoff_location && (
                          <div>
                            <span className="text-[9px] text-gray-400 uppercase block font-bold">Dropoff Place</span>
                            <div className="text-xs font-medium text-brand-charcoal">{booking.dropoff_location}</div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-bold text-gray-400 uppercase mb-4 flex items-center gap-2">
                    <User size={14} /> End-Customer (Guest)
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
                        <User size={14} />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-brand-charcoal">{booking.guest_name || 'No Name Provided'}</div>
                        <div className="text-xs text-gray-500">Total guests: {booking.num_guests ?? 0}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
                        <Mail size={14} />
                      </div>
                      <div className="text-sm text-brand-teal truncate font-medium">{booking.guest_email || 'N/A'}</div>
                    </div>
                    {booking.guest_phone && (
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
                          <Phone size={14} />
                        </div>
                        <div className="text-sm text-brand-charcoal font-medium">{booking.guest_phone}</div>
                      </div>
                    )}
                    {(booking as any).special_requests && (
                      <div className="flex items-start gap-3 pt-2">
                        <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center text-amber-500 shrink-0">
                          <Info size={14} />
                        </div>
                        <div>
                          <span className="text-[9px] text-gray-400 uppercase block font-bold">Special Requests</span>
                          <div className="text-xs text-brand-charcoal italic">{(booking as any).special_requests}</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <h3 className="text-xs font-bold text-gray-400 uppercase mb-3 flex items-center gap-2">
                  <FileText size={14} /> Internal Operator Notes
                </h3>
                <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 text-sm text-amber-900 whitespace-pre-wrap leading-relaxed">
                  {(booking as any).internal_notes || booking.notes || 'No notes added by the operator for this booking.'}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-brand-charcoal font-bold">
                  <Car size={20} className="text-brand-teal" /> Driver
                </div>
                {driverAssign ? (
                  <span
                    className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                      driverAssign.status === 'accepted' || driverAssign.status === 'completed'
                        ? 'bg-green-100 text-green-700'
                        : driverAssign.status === 'rejected'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {driverAssign.status}
                  </span>
                ) : (
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-gray-100 text-gray-400">
                    Not Assigned
                  </span>
                )}
              </div>

              {driverAssign?.profile ? (
                <div className="space-y-3">
                  <p className="text-sm font-bold text-brand-charcoal">{driverAssign.profile.full_name || 'Driver'}</p>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Mail size={12} /> {driverAssign.profile.email || 'N/A'}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Phone size={12} /> {driverAssign.profile.phone || 'N/A'}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-400 italic py-4">No driver assigned to this trip.</p>
              )}

              <Car size={80} className="absolute -bottom-4 -right-4 opacity-[0.03] text-brand-teal" />
            </div>

            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-brand-charcoal font-bold">
                  <Compass size={20} className="text-brand-coral" /> Guide
                </div>
                {guideAssign ? (
                  <span
                    className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                      guideAssign.status === 'accepted' || guideAssign.status === 'completed'
                        ? 'bg-green-100 text-green-700'
                        : guideAssign.status === 'rejected'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {guideAssign.status}
                  </span>
                ) : (
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-gray-100 text-gray-400">
                    Not Assigned
                  </span>
                )}
              </div>

              {guideAssign?.profile ? (
                <div className="space-y-3">
                  <p className="text-sm font-bold text-brand-charcoal">{guideAssign.profile.full_name || 'Guide'}</p>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Mail size={12} /> {guideAssign.profile.email || 'N/A'}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Phone size={12} /> {guideAssign.profile.phone || 'N/A'}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-400 italic py-4">No guide assigned to this trip.</p>
              )}

              <Compass size={80} className="absolute -bottom-4 -right-4 opacity-[0.03] text-brand-coral" />
            </div>

            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-brand-charcoal font-bold">
                  <Car size={20} className="text-brand-teal" /> Vehicle / Fleet
                </div>
                {vehicle ? (
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-green-100 text-green-700">
                    Assigned
                  </span>
                ) : (
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-gray-100 text-gray-400">
                    Not Assigned
                  </span>
                )}
              </div>

              {vehicle ? (
                <div className="space-y-3">
                  <p className="text-sm font-bold text-brand-charcoal">
                    {vehicle.make} {vehicle.model}
                    <span className="ml-2 text-[10px] text-gray-400 font-mono">({vehicle.license_plate})</span>
                  </p>
                  <div className="pt-2 border-t border-gray-50">
                    <p className="text-[10px] text-gray-400 uppercase font-bold mb-1">Fleet Owner</p>
                    <p className="text-xs font-medium text-brand-charcoal">
                      {vehicle.owner?.company_name || vehicle.owner?.full_name || 'Unknown Owner'}
                    </p>
                    <p className="text-[10px] text-gray-500">{vehicle.owner?.email || 'No email'}</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-400 italic py-4">No vehicle assigned to this trip.</p>
              )}

              <Car size={80} className="absolute -bottom-4 -right-4 opacity-[0.03] text-brand-teal" />
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                <ShieldCheck size={16} className="text-brand-teal" /> Escrow Management
              </h3>
              <div className="flex items-center gap-2">
                <button 
                  onClick={async () => {
                    if (!id) return;
                    setProcessingEscrow(true);
                    try {
                      await refreshBookingEscrowState(id);
                      await fetchDetail();
                    } catch (err: any) {
                      console.error(err);
                      setError('Failed to refresh escrow state: ' + (err.message || 'Unknown error'));
                    } finally {
                      setProcessingEscrow(false);
                    }
                  }}
                  disabled={processingEscrow}
                  className="p-1 hover:bg-gray-100 rounded text-gray-400 transition-colors"
                  title="Recalculate Escrow State"
                >
                  <RefreshCw size={12} className={processingEscrow ? 'animate-spin' : ''} />
                </button>
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${payoutSignal.className}`}>
                  {payoutSignal.label}
                </span>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500">Funds Received</span>
                <span className="font-mono font-bold text-brand-charcoal">
                  {formatCurrency(fundsReceived, booking.currency)}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500">Funds Held</span>
                <span className="font-mono font-bold text-brand-charcoal">
                  {formatCurrency(fundsHeld, booking.currency)}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500">Funds Released</span>
                <span className="font-mono font-bold text-green-600">
                  {formatCurrency(actualReleased, booking.currency)}
                </span>
              </div>
              <div className="pt-3 border-t border-gray-100 flex justify-between items-center">
                <span className="text-xs font-bold text-gray-400 uppercase">Remaining</span>
                <span className="font-mono font-bold text-brand-charcoal">
                  {formatCurrency(remainingBalance, booking.currency)}
                </span>
              </div>
            </div>

            {booking.payment_status && (
              <button
                onClick={() => {
                  setEscrowAmount(booking.funds_received_amount?.toString() || booking.total_amount?.toString() || '');
                  setShowEscrowModal(true);
                }}
                className="w-full mt-6 py-2.5 bg-brand-teal text-white font-bold rounded-lg text-xs flex items-center justify-center gap-2 hover:bg-brand-teal/90 transition-colors shadow-sm"
              >
                <DollarSign size={14} /> 
                {booking.payment_status === 'payment_pending' ? 'Mark Funds Received' : 'Update Funds Received'}
              </button>
            )}
            
            {booking.payment_received_at && (
              <p className="mt-4 text-[10px] text-gray-400 text-center">
                Payment received on {new Date(booking.payment_received_at).toLocaleString()}
              </p>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Operator Relationship</h3>
            <div className="flex items-center gap-4 mb-4">
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-500">
                {operatorProfile?.full_name?.charAt(0) || operatorProfile?.company_name?.charAt(0) || 'O'}
              </div>
              <div>
                <p className="text-sm font-bold text-brand-charcoal">
                  {operatorProfile?.company_name || operatorProfile?.full_name || 'Operator'}
                </p>
                <p className="text-xs text-gray-500">{operatorProfile?.email || 'N/A'}</p>
              </div>
            </div>
            {operatorId ? (
  <Link
    to={`/admin/verification/${operatorId}`}
    className="w-full py-2.5 bg-gray-100 text-gray-700 font-bold rounded-lg text-xs flex items-center justify-center gap-2 hover:bg-gray-200 transition-colors"
  >
    <User size={14} /> View Account Detail
  </Link>
) : (
  <div className="w-full py-2.5 bg-gray-100 text-gray-400 font-bold rounded-lg text-xs flex items-center justify-center gap-2">
    <User size={14} /> View Account Detail
  </div>
)}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <History size={14} /> System Activity
            </h3>
            <div className="space-y-4 text-[11px]">
              <div className="flex items-start gap-3">
                <div className="w-1 h-1 rounded-full bg-brand-teal mt-1.5" />
                <div>
                  <p className="text-gray-700 font-bold">Created</p>
                  <p className="text-gray-400">{new Date(booking.created_at).toLocaleString()}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-1 h-1 rounded-full bg-gray-300 mt-1.5" />
                <div>
                  <p className="text-gray-700 font-bold">Last Updated</p>
                  <p className="text-gray-400">{new Date(booking.updated_at).toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>

      {showEscrowModal && (
        <div className="fixed inset-0 bg-brand-charcoal/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <h3 className="font-bold text-brand-charcoal flex items-center gap-2">
                <DollarSign size={18} className="text-brand-teal" /> Mark Funds Received
              </h3>
              <button onClick={() => setShowEscrowModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleMarkFundsReceived} className="p-6">
              <p className="text-sm text-gray-500 mb-6">
                Enter the amount received from the customer for booking <span className="font-mono font-bold text-brand-charcoal">{booking.booking_reference}</span>. 
                This is an <span className="font-bold text-brand-charcoal">escrow simulation</span> only and does not move real money.
              </p>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5 ml-1">Received Amount ({booking.currency})</label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-mono text-sm">
                      {booking.currency}
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      value={escrowAmount}
                      onChange={(e) => setEscrowAmount(e.target.value)}
                      className="w-full pl-14 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal outline-none transition-all font-mono text-lg"
                      placeholder="0.00"
                      autoFocus
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowEscrowModal(false)}
                    className="flex-1 py-3 border border-gray-200 text-gray-600 font-bold rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={processingEscrow || !escrowAmount || parseFloat(escrowAmount) <= 0}
                    className="flex-1 py-3 bg-brand-teal text-white font-bold rounded-xl hover:bg-brand-teal/90 transition-colors shadow-lg shadow-brand-teal/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:shadow-none"
                  >
                    {processingEscrow ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <>Confirm Receipt</>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
