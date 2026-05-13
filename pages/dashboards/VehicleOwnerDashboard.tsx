import React, { useEffect, useState } from 'react';
import { Truck, X, Link as LinkIcon, Check, XCircle, Loader2, AlertCircle, ChevronRight, PlayCircle, Wrench, Banknote, TrendingUp, AlertTriangle, Clock, FileCheck, Star } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { StatusBanner } from '../../components/onboarding/StatusBanner';
import { DocumentManager } from '../../components/documents/DocumentManager';
import { calculateOnboardingStatus, OnboardingStep } from '../../lib/onboardingUtils';
import { getLatestDocumentsForUser } from '../../lib/documentService';
import { useNavigate } from 'react-router-dom';
import {
  getFleetOwnerVehicles,
  listVehicleAvailabilityBlocks,
  createVehicleAvailabilityBlock,
  deleteVehicleAvailabilityBlock,
  getOwnerLinkRequestCounts,
  setVehicleStatus,
} from '../../lib/fleetService';
import { getProviderPayoutSummary, listProviderPayouts } from '../../lib/payoutService';
import { getProviderRatingSummary, RatingSummary } from '../../lib/reviewService';
import { formatDate, formatCurrency } from '../../lib/formatUtils';
import { getPayableAmount, getOriginalAmount } from '../../lib/payoutUtils';
import { ProviderReviewSection } from '../../components/reviews/ProviderReviewSection';

type ToastState = { type: 'success' | 'error'; message: string } | null;

export const VehicleOwnerDashboard: React.FC = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [vehicles, setVehicles] = useState<any[]>([]);
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

  const [linkCounts, setLinkCounts] = useState({ pending: 0, approved: 0, revoked: 0 });
  const [countsLoading, setCountsLoading] = useState(false);

  const [selectedVehicle, setSelectedVehicle] = useState<any | null>(null);
  const [availability, setAvailability] = useState<any[]>([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');

  const [toast, setToast] = useState<ToastState>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadPayouts = async () => {
    if (!user) return;
    try {
      const data = await listProviderPayouts(user.id, { status: payoutFilter });
      setPayouts(data);
    } catch (e) {
      console.error('[VehicleOwnerDashboard] Payouts load error:', e);
    }
  };

  const fetchData = async () => {
    if (!user || !profile) return;

    try {
      const [vehiclesData, summary, rating] = await Promise.all([
        getFleetOwnerVehicles(user.id),
        getProviderPayoutSummary(user.id),
        getProviderRatingSummary(user.id)
      ]);
      setVehicles(vehiclesData || []);
      setPayoutSummary(summary);
      setRatingSummary(rating);
    } catch (e) {
      console.error('Dashboard fleet fetch failed', e);
    }

    try {
      const docsMap = await getLatestDocumentsForUser(user.id);
      const docsArray = Object.values(docsMap);
      setOnboardingStatus(calculateOnboardingStatus(profile, docsArray));
    } catch (e) {
      console.error('Dashboard docs fetch failed', e);
    }

    await fetchCounts();
    setLoading(false);
  };

  const fetchCounts = async () => {
    if (!user) return;
    setCountsLoading(true);
    try {
      const counts = await getOwnerLinkRequestCounts(user.id);
      setLinkCounts(counts);
    } catch (e) {
      console.error('Failed to fetch link counts', e);
    } finally {
      setCountsLoading(false);
    }
  };

  const loadAvailability = async (vehicleId: string) => {
    setAvailabilityLoading(true);
    setToast(null);

    try {
      const blocks = await listVehicleAvailabilityBlocks(vehicleId);
      setAvailability(blocks || []);
    } catch (e: any) {
      setToast({ type: 'error', message: e?.message || 'Failed to load availability' });
    } finally {
      setAvailabilityLoading(false);
    }
  };

  const openManageAvailability = async (v: any) => {
    setSelectedVehicle(v);
    setStartDate('');
    setEndDate('');
    setReason('');
    await loadAvailability(v.id);
  };

  const closeManageAvailability = () => {
    setSelectedVehicle(null);
    setAvailability([]);
    setToast(null);
    setStartDate('');
    setEndDate('');
    setReason('');
  };

  const addBlock = async () => {
    if (!user || !selectedVehicle) return;

    if (!startDate || !endDate) {
      setToast({ type: 'error', message: 'Select start and end dates.' });
      return;
    }

    setToast(null);

    try {
      await createVehicleAvailabilityBlock(selectedVehicle.id, user.id, startDate, endDate, reason || undefined);
      setToast({ type: 'success', message: 'Unavailable dates saved.' });
      await loadAvailability(selectedVehicle.id);
      setStartDate('');
      setEndDate('');
      setReason('');
    } catch (e: any) {
      setToast({ type: 'error', message: e?.message || 'Failed to add block' });
    }
  };

  const handleToggleStatus = async (vehicleId: string, currentStatus: string) => {
    if (!user) return;
    
    const nextStatus = currentStatus.toLowerCase() === 'maintenance' ? 'active' : 'maintenance';
    setIsUpdatingStatus(vehicleId);
    setToast(null);

    try {
      const res = await setVehicleStatus(vehicleId, user.id, nextStatus);

      if (!res.ok) {
        setToast({ type: 'error', message: res.reason || `Failed to set ${nextStatus}` });
        return;
      }

      setToast({ type: 'success', message: `Vehicle marked as ${nextStatus.charAt(0).toUpperCase() + nextStatus.slice(1)}.` });
      await fetchData(); 
    } catch (e: any) {
      setToast({ type: 'error', message: e?.message || 'Update failed' });
    } finally {
      setIsUpdatingStatus(null);
    }
  };

  const removeBlock = async (blockId: string) => {
    if (!selectedVehicle) return;

    setToast(null);

    try {
      await deleteVehicleAvailabilityBlock(blockId);
      setToast({ type: 'success', message: 'Unavailable dates removed.' });
      await loadAvailability(selectedVehicle.id);
    } catch (e: any) {
      setToast({ type: 'error', message: e?.message || 'Failed to remove block' });
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

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-teal"></div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8 flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-white border border-gray-200 shadow-sm flex items-center justify-center overflow-hidden">
          {profile?.avatar_url || profile?.profile_image_url ? (
            <img src={(profile.avatar_url || profile.profile_image_url) ?? undefined} alt={profile.full_name || 'Profile'} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            <div className="text-xl font-bold text-brand-teal uppercase">
              {(profile?.company_name || profile?.full_name || '??').substring(0, 2)}
            </div>
          )}
        </div>
        <div>
          <h1 className="text-3xl font-bold text-brand-charcoal">Fleet Management</h1>
          <p className="text-gray-500 mt-1">Manage your vehicles, availability, and operator links</p>
        </div>
      </div>

      <StatusBanner status={onboardingStatus} />

      <div className="mb-8">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Fleet & Operations</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <div 
            onClick={() => navigate('/owner/vehicles')}
            className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm cursor-pointer hover:shadow-md hover:border-brand-teal/30 transition-all group"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-brand-teal/5 text-brand-teal rounded-2xl group-hover:bg-brand-teal/10 transition-colors">
                <Truck size={24} />
              </div>
            </div>
            <p className="text-3xl font-bold text-brand-charcoal mb-1">{vehicles.length}</p>
            <p className="font-bold text-gray-600">Total Vehicles</p>
            <p className="text-sm text-gray-400 mt-1">In your fleet</p>
          </div>

          <div 
            onClick={() => navigate('/owner/link-requests')}
            className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm cursor-pointer hover:shadow-md hover:border-brand-teal/30 transition-all group"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl group-hover:bg-amber-100 transition-colors">
                <LinkIcon size={24} />
              </div>
            </div>
            <p className="text-3xl font-bold text-brand-charcoal mb-1">{linkCounts.pending}</p>
            <p className="font-bold text-gray-600">Pending Links</p>
            <p className="text-sm text-gray-400 mt-1">Operator requests</p>
          </div>
        </div>
      </div>

      <div className="mb-8">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Payments</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
          <div 
            onClick={() => navigate('/owner/earnings')}
            className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm cursor-pointer hover:shadow-md hover:border-brand-teal/30 transition-all"
          >
            <p className="text-lg font-bold text-brand-teal mb-1">{formatCurrency(payoutSummary.available)}</p>
            <p className="font-bold text-gray-600 text-sm">Available</p>
          </div>

          <div 
            onClick={() => navigate('/owner/earnings')}
            className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm cursor-pointer hover:shadow-md hover:border-brand-teal/30 transition-all"
          >
            <p className="text-lg font-bold text-blue-600 mb-1">{formatCurrency(payoutSummary.withdrawalRequested)}</p>
            <p className="font-bold text-gray-600 text-sm">Requested</p>
          </div>

          <div 
            onClick={() => navigate('/owner/earnings')}
            className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm cursor-pointer hover:shadow-md hover:border-brand-teal/30 transition-all"
          >
            <p className="text-lg font-bold text-red-600 mb-1">{formatCurrency(payoutSummary.onHold)}</p>
            <p className="font-bold text-gray-600 text-sm">On Hold</p>
          </div>

          <div 
            onClick={() => navigate('/owner/earnings')}
            className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm cursor-pointer hover:shadow-md hover:border-brand-teal/30 transition-all"
          >
            <p className="text-lg font-bold text-gray-600 mb-1">{formatCurrency(payoutSummary.pending)}</p>
            <p className="font-bold text-gray-600 text-sm">Pending Authorization</p>
          </div>

          <div 
            onClick={() => navigate('/owner/earnings')}
            className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm cursor-pointer hover:shadow-md hover:border-brand-teal/30 transition-all"
          >
            <p className="text-lg font-bold text-green-600 mb-1">{formatCurrency(payoutSummary.totalPaidOut)}</p>
            <p className="font-bold text-gray-600 text-sm">Paid Out</p>
          </div>
        </div>
      </div>


      {toast && (
        <div
          className={`fixed top-4 right-4 z-[60] px-6 py-3 rounded-lg shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-4 duration-300 ${
            toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
          }`}
        >
          {toast.type === 'success' ? <Check size={20} /> : <AlertCircle size={20} />}
          <span className="font-bold">{toast.message}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-8">
            <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
              <h3 className="font-bold text-brand-charcoal flex items-center gap-2">
                <LinkIcon size={20} className="text-brand-teal" />
                Operator Link Requests
              </h3>
              {countsLoading && <Loader2 size={16} className="animate-spin text-gray-400" />}
            </div>
            <div className="p-6">
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 text-center">
                  <span className="block text-3xl font-bold text-amber-700 mb-1">{linkCounts.pending}</span>
                  <span className="text-[10px] uppercase font-bold text-amber-600 tracking-wider">Pending</span>
                </div>
                <div className="bg-green-50 p-4 rounded-2xl border border-green-100 text-center">
                  <span className="block text-3xl font-bold text-green-700 mb-1">{linkCounts.approved}</span>
                  <span className="text-[10px] uppercase font-bold text-green-600 tracking-wider">Approved</span>
                </div>
                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 text-center">
                  <span className="block text-3xl font-bold text-gray-700 mb-1">{linkCounts.revoked}</span>
                  <span className="text-[10px] uppercase font-bold text-gray-600 tracking-wider">Historical</span>
                </div>
              </div>
              <button
                onClick={() => navigate('/owner/link-requests')}
                className="w-full py-3 bg-brand-charcoal text-white rounded-lg font-bold hover:bg-black transition-colors flex items-center justify-center gap-2 text-sm"
              >
                Manage link requests
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mb-8">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <h2 className="font-bold text-lg text-brand-charcoal">Payout History</h2>
              <div className="flex items-center gap-2">
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

         <div className="flex items-center justify-between mb-4 mt-8">
            <div>
              <h3 className="font-bold text-lg text-brand-charcoal">Fleet Preview</h3>
              <p className="text-sm text-gray-500">Showing recent vehicles. Manage your full fleet from My Vehicles.</p>
            </div>
            {vehicles.length > 4 && (
              <button 
                onClick={() => navigate('/owner/vehicles')}
                className="text-brand-teal font-bold text-sm hover:underline flex items-center gap-1"
              >
                View all vehicles <ChevronRight size={16} />
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {vehicles.slice(0, 4).map((v) => {
              const currentStatus = String(v.status ?? 'Active').trim();
              const isMaintenance = currentStatus.toLowerCase() === 'maintenance';
              
              const cls = isMaintenance
                ? 'bg-orange-100 text-orange-700 border-orange-200'
                : currentStatus.toLowerCase() === 'inactive'
                ? 'bg-gray-100 text-gray-500 border-gray-200'
                : 'bg-green-100 text-green-700 border-green-200';

              const label = currentStatus.toLowerCase() === 'inactive' ? 'Archived' : currentStatus;

              return (
                <div
                  key={v.id}
                  className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm hover:border-brand-teal/50 hover:shadow-md transition-all group flex flex-col"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-3 bg-gray-50 rounded-2xl group-hover:bg-brand-teal/10 transition-colors">
                      <Truck className="text-gray-400 group-hover:text-brand-teal transition-colors" size={24} />
                    </div>
                    <span className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider border ${cls}`}>{label}</span>
                  </div>

                  <h3 className="text-xl font-bold text-brand-charcoal">
                    {v.make} {v.model}
                  </h3>
                  <p className="text-sm font-mono text-gray-500 mt-1 bg-gray-50 inline-block px-2 py-0.5 rounded border border-gray-100">{v.license_plate || v.registration_number}</p>

                  <div className="mt-4 pt-4 border-t border-gray-100 flex flex-col gap-3 flex-1 justify-end">
                    <div className="text-sm text-gray-600 flex items-center gap-2">
                      <span className="font-bold">{v.seat_count}</span> Seats • {v.body_type || 'Vehicle'}
                    </div>

                    <div className="flex items-center gap-2 mt-2">
                      <button
                        className="flex-1 text-xs px-3 py-2.5 rounded-lg border border-gray-200 hover:border-brand-teal hover:text-brand-teal hover:bg-brand-teal/5 transition-colors cursor-pointer font-bold flex items-center justify-center gap-1.5"
                        onClick={() => openManageAvailability(v)}
                        type="button"
                      >
                        <AlertCircle size={14} /> Mark unavailable
                      </button>

                      <button
                        className={`flex-1 text-xs px-3 py-2.5 rounded-lg border font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 ${
                          isMaintenance 
                            ? 'border-green-200 text-green-700 hover:bg-green-50' 
                            : 'border-orange-200 text-orange-700 hover:bg-orange-50'
                        }`}
                        onClick={() => handleToggleStatus(v.id, currentStatus)}
                        disabled={isUpdatingStatus === v.id}
                        type="button"
                      >
                        {isUpdatingStatus === v.id ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : isMaintenance ? (
                          <PlayCircle size={14} />
                        ) : (
                          <Wrench size={14} />
                        )}
                        {isMaintenance ? 'Set active' : 'Set maintenance'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {vehicles.length === 0 && (
              <div className="col-span-1 md:col-span-2 p-12 text-center border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50/50">
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm border border-gray-100">
                  <Truck className="text-gray-400" size={24} />
                </div>
                <h3 className="text-lg font-bold text-brand-charcoal mb-1">No vehicles registered</h3>
                <p className="text-gray-500 mb-6">Add your first vehicle to start accepting bookings.</p>
                <button
                  onClick={() => navigate('/owner/vehicles/new')}
                  className="bg-brand-teal text-white px-6 py-2.5 rounded-lg font-bold hover:bg-brand-teal/90 transition-colors"
                >
                  Add Vehicle
                </button>
              </div>
            )}
          </div>
        </div>

        <div>
          {user && (
            <div className="mb-8">
              <ProviderReviewSection providerId={user.id} />
            </div>
          )}
          {user && profile && <DocumentManager role={profile.role} userId={user.id} onUpdate={fetchData} />}
        </div>
      </div>

      {selectedVehicle && (
        <div className="fixed inset-0 bg-brand-charcoal/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-gray-50/50">
              <div>
                <div className="text-xl font-bold text-brand-charcoal">Mark unavailable</div>
                <div className="text-sm text-gray-500 mt-1">These dates will not be available for hire.</div>
                <div className="text-sm font-bold text-brand-teal mt-2 flex items-center gap-2">
                  <Truck size={16} />
                  {selectedVehicle.make} {selectedVehicle.model}
                </div>
              </div>

              <button onClick={closeManageAvailability} type="button" className="p-2 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer text-gray-500">
                <X size={20} />
              </button>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div>
                  <label className="block text-xs font-bold text-brand-charcoal mb-1.5">Start date</label>
                  <input
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-brand-teal focus:border-transparent outline-none"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-brand-charcoal mb-1.5">End date</label>
                  <input
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-brand-teal focus:border-transparent outline-none"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-brand-charcoal mb-1.5">Reason</label>
                  <input
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-brand-teal focus:border-transparent outline-none"
                    type="text"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Optional, e.g. servicing"
                  />
                </div>
              </div>

              <div className="flex justify-end mb-8">
                <button
                  className="px-6 py-2.5 rounded-lg bg-brand-teal text-white text-sm hover:bg-brand-teal/90 transition-colors cursor-pointer font-bold"
                  onClick={addBlock}
                  type="button"
                >
                  Confirm Dates
                </button>
              </div>

              <div className="text-sm font-bold text-brand-charcoal mb-4">Unavailable dates</div>

              {availabilityLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="animate-spin text-brand-teal" size={24} />
                </div>
              ) : availability.length === 0 ? (
                <div className="text-sm text-gray-500 bg-gray-50 p-4 rounded-lg border border-gray-100 text-center">No unavailable dates yet.</div>
              ) : (
                <div className="space-y-3">
                  {availability.map((b) => (
                    <div key={b.id} className="flex items-center justify-between gap-3 border border-gray-200 rounded-2xl p-4 bg-white shadow-sm">
                      <div className="text-sm text-brand-charcoal font-medium">
                        {formatDate(b.start_date)} <span className="text-gray-400 mx-2">to</span> {formatDate(b.end_date)}
                        {b.reason ? <span className="text-gray-500 block mt-1 text-xs font-normal">{b.reason}</span> : null}
                      </div>

                      <button
                        className="text-xs px-4 py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors cursor-pointer font-bold"
                        onClick={() => removeBlock(b.id)}
                        type="button"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};