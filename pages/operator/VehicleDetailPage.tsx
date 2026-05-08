import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Vehicle } from '../../types';
import { supabase } from '../../lib/supabase';
import {
  getVehicleById,
  archiveVehicle,
  getVehicleLinkStatus,
  requestVehicleLink,
  VehicleLinkStatus,
  getOperatorVehicleRateLink,
  proposeRates,
  acceptRates
} from '../../lib/fleetService';
import { updateBookingVehicleSnapshots, getEffectiveVehicleRateForBookingAssignment, checkVehicleConflicts, createVehicleAvailabilityRequest } from '../../lib/bookingService';
import { resolveOperatorFee } from '../../lib/feeService';
import { getProviderRatingSummary, RatingSummary } from '../../lib/reviewService';
import {
  ArrowLeft,
  Edit2,
  Truck,
  Calendar,
  CheckCircle2,
  XCircle,
  Users,
  Fuel,
  Archive,
  Trash2,
  AlertTriangle,
  Loader2,
  Link as LinkIcon,
  Banknote,
  Send,
  Check,
  Clock,
  X,
  Info,
  MapPin,
  CalendarPlus,
  ShieldCheck,
  Building2,
  User,
  Star
} from 'lucide-react';

export const VehicleDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(true);
  const [vehicleCompliance, setVehicleCompliance] = useState<{ canAssign: boolean; blockers: string[]; warnings: string[] } | null>(null);
  const [loadingCompliance, setLoadingCompliance] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [ownerRatingSummary, setOwnerRatingSummary] = useState<RatingSummary | null>(null);

  // Link request state
  const [linkStatus, setLinkStatus] = useState<VehicleLinkStatus>(null);
  const [requestingLink, setRequestingLink] = useState(false);

  // Rate Negotiation State
  const [rateLink, setRateLink] = useState<any | null>(null);
  const [showProposeModal, setShowProposeModal] = useState(false);
  const [propDayRate, setPropDayRate] = useState('');
  const [propHourRate, setPropHourRate] = useState('');
  const [processingRate, setProcessingRate] = useState(false);

  // Archive State
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
  const [isProcessingArchive, setIsProcessingArchive] = useState(false);
  const [blockingError, setBlockingError] = useState<{ count: number } | null>(null);

  // Create Draft Booking State
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [reqStartDate, setReqStartDate] = useState('');
  const [reqEndDate, setReqEndDate] = useState('');
  const [reqRateType, setReqRateType] = useState<'day' | 'hour'>('day');
  const [reqNotes, setReqNotes] = useState('');
  const [processingRequest, setProcessingRequest] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 5000);
  };

  useEffect(() => {
    if (user && id) {
      loadVehicle();
    }
  }, [user, id]);

  useEffect(() => {
    if (location.state) {
      const { startDate, endDate } = location.state as any;
      if (startDate) setReqStartDate(new Date(startDate).toISOString().split('T')[0]);
      if (endDate) setReqEndDate(new Date(endDate).toISOString().split('T')[0]);
    }
  }, [location.state]);

  const hydrateVehicleOwnerProfile = async (ownerId: string) => {
    try {
      const { data, error } = await supabase.rpc('get_public_profiles', {
        p_ids: [ownerId]
      });

      if (error) throw error;

      const profile = Array.isArray(data) ? data[0] : null;

      if (profile) {
        setVehicle(prev => prev ? { ...prev, profiles: profile } : prev);
      }
    } catch (e) {
      console.error('Failed to hydrate vehicle owner profile', e);
    }
  };

  const loadVehicleCompliance = async (vehicleId: string) => {
    setLoadingCompliance(true);
    try {
      const { data, error } = await supabase.rpc('rpc_check_vehicle_assignment_compliance', {
        p_vehicle_id: vehicleId
      });

      if (error) throw error;

      const row = Array.isArray(data) ? data[0] : data;

      if (!row) {
        setVehicleCompliance(null);
        return;
      }

      setVehicleCompliance({
        canAssign: Boolean(row?.can_assign),
        blockers: Array.isArray(row?.blockers) ? row.blockers : [],
        warnings: Array.isArray(row?.warnings) ? row.warnings : []
      });
    } catch (error) {
      console.error('[VehicleDetail] vehicle compliance RPC failed', error);
      setVehicleCompliance(null);
    } finally {
      setLoadingCompliance(false);
    }
  };

  const loadVehicle = async () => {
    if (!user || !id) return;
    try {
      const data = await getVehicleById(id);
      setVehicle(data);
      const ownerProfileList = Array.isArray((data as any).profiles)
        ? (data as any).profiles
        : [(data as any).profiles].filter(Boolean);

      if (ownerProfileList.length === 0 && (data as any).owner_id) {
        hydrateVehicleOwnerProfile((data as any).owner_id);
      }

      if (data.photos && data.photos.length > 0) {
        const primary = data.photos.find((p: any) => p.is_primary);
        setSelectedPhoto(primary ? primary.url : data.photos[0].url);
      }

      // If operator is viewing someone else's vehicle, fetch link status and rates
      const ownerId = (data as any).owner_id;
      const operatorId = (data as any).operator_id;
      const isOwn = (ownerId === user.id) || (operatorId === user.id);

      if (ownerId && data.id) {
        loadVehicleCompliance(data.id);
      }

      if (ownerId) {
        getProviderRatingSummary(ownerId).then(setOwnerRatingSummary).catch(console.error);
      }

      if (!isOwn && ownerId) {
 
        const status = await getVehicleLinkStatus(data.id, user.id);
        setLinkStatus(status);
        
        if (status === 'approved') {
          const rl = await getOperatorVehicleRateLink(user.id, data.id);
          setRateLink(rl);
          if (rl) {
            setPropDayRate(rl.operator_proposed_day_rate?.toString() || '');
            setPropHourRate(rl.operator_proposed_hour_rate?.toString() || '');
          }
        }
      } else {
        setLinkStatus(null);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleProposeSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!user || !vehicle) return;

  const day = propDayRate.trim() === '' ? null : Number(propDayRate);
  const hour = propHourRate.trim() === '' ? null : Number(propHourRate);

  if (day === null && hour === null) {
    showToast('error', 'Enter a day rate or an hour rate.');
    return;
  }

  if ((day !== null && Number.isNaN(day)) || (hour !== null && Number.isNaN(hour))) {
    showToast('error', 'Invalid rate. Use numbers only.');
    return;
  }

  setProcessingRate(true);
  try {
    const rl = await proposeRates({
      operatorId: user.id,
      vehicleId: vehicle.id,
      actorId: user.id,
      dayRate: day,
      hourRate: hour,
      currency: vehicle.rate_currency || 'ZAR',
    });

    setRateLink(rl);
    setShowProposeModal(false);
    showToast('success', 'Proposal sent to owner.');
  } catch (err: any) {
    showToast('error', err.message || 'Failed to send proposal');
  } finally {
    setProcessingRate(false);
  }
};

  const handleAcceptCounter = async () => {
    if (!rateLink || !user) return;
    
    setProcessingRate(true);
    try {
      const rl = await acceptRates({
        rateLinkId: rateLink.id,
        actorId: user.id
      });
      setRateLink(rl);
      showToast('success', 'Rates accepted.');
    } catch (err: any) {
      showToast('error', err.message || 'Failed to accept counter');
    } finally {
      setProcessingRate(false);
    }
  };

  const handleArchive = async () => {
    if (!vehicle || !user) return;
    setIsProcessingArchive(true);
    setBlockingError(null);

    try {
      const result = await archiveVehicle(vehicle.id, user.id);

      if (result.success) {
        setIsArchiveModalOpen(false);
        navigate('/operator/vehicles');
      } else if (result.error === 'HAS_FUTURE_BOOKINGS') {
        setBlockingError({ count: result.count || 0 });
      }
    } catch (err: any) {
      showToast('error', 'Failed to remove vehicle: ' + err.message);
    } finally {
      setIsProcessingArchive(false);
    }
  };

  const handleRequestLink = async () => {
    if (!vehicle || !user?.id) return;

    setRequestingLink(true);
    try {
      // Fix: Argument order was reversed (service expects vehicleId then operatorId)
      const res = await requestVehicleLink(vehicle.id, user.id);

      // Refresh status from DB to avoid any mismatch
      const status = await getVehicleLinkStatus(vehicle.id, user.id);
      setLinkStatus(status ?? res.status);

      showToast('success', res.message);
    } catch (e: any) {
      showToast('error', e?.message || 'Failed to send link request.');
    } finally {
      setRequestingLink(false);
    }
  };

  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !vehicle) return;

    const start = new Date(reqStartDate);
    const end = new Date(reqEndDate);
    
    if (reqRateType === 'day') {
      if (end < start) {
        setRequestError('End date cannot be before start date.');
        return;
      }
    } else {
      if (end <= start) {
        setRequestError('For hourly rates, end time must be after start time.');
        return;
      }
    }

    setProcessingRequest(true);
    setRequestError(null);

    try {
      // 1. Check conflicts
      const hasConflict = await checkVehicleConflicts(vehicle.id, start.toISOString(), end.toISOString());
      if (hasConflict) {
        setRequestError('Vehicle is unavailable for the selected dates.');
        setProcessingRequest(false);
        return;
      }

      // 2. Create availability request
      await createVehicleAvailabilityRequest(
        user.id,
        vehicle.id,
        start.toISOString(),
        end.toISOString(),
        reqRateType,
        reqNotes || null
      );

      window.dispatchEvent(new CustomEvent('PENDING_REQUESTS_UPDATED'));
      setShowRequestModal(false);
      setReqStartDate('');
      setReqEndDate('');
      setReqNotes('');
      // Show success feedback
      showToast('success', 'Availability request sent successfully!');
      navigate('/operator/vehicle-requests');
    } catch (err: any) {
      console.error('Request Availability Error:', err);
      setRequestError(err.message || 'Failed to send availability request.');
    } finally {
      setProcessingRequest(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active':
        return 'bg-green-100 text-green-700';
      case 'Maintenance':
        return 'bg-orange-100 text-orange-700';
      case 'Inactive':
        return 'bg-gray-100 text-gray-500';
      default:
        return 'bg-gray-100 text-gray-500';
    }
  };

  const FeatureItem = ({ label, active }: { label: string; active: boolean }) => (
    <div className={`flex items-center gap-2 text-sm ${active ? 'text-brand-charcoal font-medium' : 'text-gray-400 line-through'}`}>
      {active ? <CheckCircle2 size={16} className="text-brand-teal" /> : <XCircle size={16} />}
      {label}
    </div>
  );

  if (loading) return <div className="p-12 text-center text-gray-400">Loading details...</div>;
  if (!vehicle) return <div className="p-12 text-center text-gray-400">Vehicle not found.</div>;

  const isInactive = vehicle.status === 'Inactive';
  const ownerId = vehicle.owner_id;
  const operatorId = vehicle.operator_id;
  const isViewingOwnVehicle = (ownerId === user?.id) || (operatorId === user?.id);

  const backTo = isViewingOwnVehicle ? '/operator/vehicles' : '/operator/directory';

  const renderLinkCta = () => {
    if (isViewingOwnVehicle) return null;

    if (linkStatus === 'approved') {
      return (
        <span className="px-4 py-2 bg-green-50 text-green-700 rounded-2xl font-bold text-sm flex items-center gap-2 border border-green-100">
          <CheckCircle2 size={16} /> Linked
        </span>
      );
    }

    if (linkStatus === 'pending') {
      return (
        <span className="px-4 py-2 bg-amber-50 text-amber-700 rounded-2xl font-bold text-sm flex items-center gap-2 border border-amber-100">
          <Loader2 size={16} className="opacity-70" /> Pending
        </span>
      );
    }

    return (
      <button
        onClick={handleRequestLink}
        disabled={requestingLink || isInactive}
        className="px-4 py-2 bg-brand-teal text-white rounded-2xl font-bold text-sm hover:bg-brand-teal/90 flex items-center gap-2 disabled:opacity-60"
      >
        {requestingLink ? <Loader2 size={16} className="animate-spin" /> : <LinkIcon size={16} />}
        Request link
      </button>
    );
  };

  return (
    <div className="max-w-6xl mx-auto pb-12">
      {toast && (
        <div className={`fixed top-24 right-8 z-[100] p-4 rounded-xl shadow-xl flex items-center gap-3 animate-in fade-in slide-in-from-right-4 duration-300 ${
          toast.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
          <p className="font-bold text-sm pr-2">{toast.message}</p>
          <button onClick={() => setToast(null)} className="ml-auto text-gray-400 hover:text-gray-600">
            <X size={16} />
          </button>
        </div>
      )}
      {isArchiveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6">
              {blockingError ? (
                <>
                  <div className="flex items-center gap-3 text-amber-600 mb-4">
                    <AlertTriangle size={24} />
                    <h3 className="text-lg font-bold">Cannot Remove Vehicle</h3>
                  </div>
                  <p className="text-gray-600 text-sm mb-6">
                    This vehicle is currently assigned to <strong>{blockingError.count} upcoming booking{blockingError.count !== 1 && 's'}</strong>.
                    <br />
                    <br />
                    Please reassign or cancel these bookings before removing the vehicle from your fleet.
                  </p>
                  <div className="flex justify-end">
                    <button
                      onClick={() => setIsArchiveModalOpen(false)}
                      className="px-4 py-2 bg-brand-charcoal text-white font-bold rounded-2xl hover:bg-gray-800 transition-colors"
                    >
                      Got it
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <h3 className="text-lg font-bold text-brand-charcoal mb-2">Remove vehicle from fleet?</h3>
                  <p className="text-gray-600 text-sm mb-6">
                    This will mark <strong>{vehicle.make} {vehicle.model}</strong> as inactive. It will not be available for new bookings, but existing history will remain.
                  </p>
                  <div className="flex gap-3 justify-end">
                    <button
                      onClick={() => setIsArchiveModalOpen(false)}
                      className="px-4 py-2 text-gray-600 font-bold hover:bg-gray-100 rounded-2xl transition-colors"
                      disabled={isProcessingArchive}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleArchive}
                      disabled={isProcessingArchive}
                      className="px-4 py-2 bg-red-600 text-white font-bold rounded-2xl hover:bg-red-700 transition-colors flex items-center gap-2"
                    >
                      {isProcessingArchive && <Loader2 size={16} className="animate-spin" />}
                      Remove Vehicle
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Propose Rates Modal */}
      {showProposeModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <h3 className="font-bold text-brand-charcoal flex items-center gap-2">
                <Banknote size={18} className="text-brand-teal" />
                Propose Rental Rates
              </h3>
              <button onClick={() => setShowProposeModal(false)} className="text-gray-400 hover:text-red-500">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleProposeSubmit} className="p-6 space-y-4">
              <p className="text-xs text-gray-500 mb-2">
                Propose custom daily and hourly rental rates for <strong>{vehicle.make} {vehicle.model}</strong>.
              </p>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Proposed Day Rate ({vehicle.rate_currency})</label>
                <input 
                  type="number"
                  step="0.01"
                  required
                  className="w-full border border-gray-300 rounded-2xl px-3 py-2 text-sm focus:ring-2 focus:ring-brand-teal outline-none"
                  value={propDayRate}
                  onChange={e => setPropDayRate(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Proposed Hour Rate ({vehicle.rate_currency})</label>
                <input 
                  type="number"
                  step="0.01"
                  required
                  className="w-full border border-gray-300 rounded-2xl px-3 py-2 text-sm focus:ring-2 focus:ring-brand-teal outline-none"
                  value={propHourRate}
                  onChange={e => setPropHourRate(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="pt-2 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setShowProposeModal(false)}
                  className="flex-1 py-2 text-sm font-bold text-gray-500 hover:bg-gray-100 rounded-2xl transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={processingRate}
                  className="flex-1 py-2 bg-brand-teal text-white rounded-2xl font-bold hover:bg-brand-teal/90 transition-colors flex items-center justify-center gap-2 text-sm shadow-sm"
                >
                  {processingRate ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  Send Proposal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <button 
          onClick={() => navigate(backTo, { state: location.state })} 
          className="flex items-center gap-2 text-gray-500 hover:text-brand-charcoal font-bold text-sm"
        >
          <ArrowLeft size={16} /> Back
        </button>

        <div className="flex items-center gap-2">
          {!isViewingOwnVehicle && !isInactive && (
            <button
              onClick={() => setShowRequestModal(true)}
              className="px-4 py-2 bg-brand-charcoal text-white rounded-2xl font-bold text-sm hover:bg-black flex items-center gap-2 shadow-sm"
            >
              <CalendarPlus size={16} />
              Request Availability
            </button>
          )}

          {renderLinkCta()}

          {isViewingOwnVehicle && (
            <>
              {!isInactive ? (
                <button
                  onClick={() => setIsArchiveModalOpen(true)}
                  className="px-4 py-2 text-red-600 font-bold text-sm hover:bg-red-50 rounded-2xl flex items-center gap-2 transition-colors border border-transparent hover:border-red-100"
                >
                  <Trash2 size={16} /> Remove Vehicle
                </button>
              ) : (
                <span className="px-4 py-2 text-gray-400 font-bold text-sm flex items-center gap-2 bg-gray-50 rounded-2xl border border-gray-200 cursor-not-allowed">
                  <Archive size={16} /> Archived
                </span>
              )}

              <Link
                to={`/operator/vehicles/${vehicle.id}/edit`}
                className="px-4 py-2 bg-brand-teal text-white rounded-2xl font-bold text-sm hover:bg-brand-teal/90 flex items-center gap-2"
              >
                <Edit2 size={16} /> Edit Vehicle
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Request Availability Modal */}
      {showRequestModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <h3 className="font-bold text-brand-charcoal flex items-center gap-2">
                <CalendarPlus size={18} className="text-brand-teal" />
                Request Availability
              </h3>
              <button onClick={() => setShowRequestModal(false)} className="text-gray-400 hover:text-red-500">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleRequestSubmit} className="p-6 space-y-4">
              <p className="text-sm text-gray-600 mb-2">
                This sends a request to the fleet owner for availability.
              </p>
              
              {requestError && (
                <div className="p-3 bg-red-50 text-red-700 text-sm rounded-xl border border-red-100 flex items-start gap-2">
                  <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                  <span>{requestError}</span>
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">
                    Start {reqRateType === 'hour' ? 'Time' : 'Date'}
                  </label>
                  <input 
                    type={reqRateType === 'hour' ? 'datetime-local' : 'date'}
                    required
                    className="w-full border border-gray-300 rounded-2xl px-3 py-2 text-sm focus:ring-2 focus:ring-brand-teal outline-none"
                    value={reqStartDate}
                    onChange={e => setReqStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">
                    End {reqRateType === 'hour' ? 'Time' : 'Date'}
                  </label>
                  <input 
                    type={reqRateType === 'hour' ? 'datetime-local' : 'date'}
                    required
                    className="w-full border border-gray-300 rounded-2xl px-3 py-2 text-sm focus:ring-2 focus:ring-brand-teal outline-none"
                    value={reqEndDate}
                    onChange={e => setReqEndDate(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Rate Type</label>
                <select
                  className="w-full border border-gray-300 rounded-2xl px-3 py-2 text-sm focus:ring-2 focus:ring-brand-teal outline-none"
                  value={reqRateType}
                  onChange={e => {
                    setReqRateType(e.target.value as 'day' | 'hour');
                    // Reset dates when switching to avoid invalid formats
                    setReqStartDate('');
                    setReqEndDate('');
                  }}
                >
                  <option value="day">Daily Rate</option>
                  <option value="hour">Hourly Rate</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Notes (Optional)</label>
                <textarea 
                  rows={3}
                  className="w-full border border-gray-300 rounded-2xl px-3 py-2 text-sm focus:ring-2 focus:ring-brand-teal outline-none resize-none"
                  value={reqNotes}
                  onChange={e => setReqNotes(e.target.value)}
                  placeholder="Any special requirements or details..."
                />
              </div>

              <div className="pt-4 flex gap-3 border-t border-gray-100">
                <button 
                  type="button"
                  onClick={() => setShowRequestModal(false)}
                  className="flex-1 py-2 text-sm font-bold text-gray-500 hover:bg-gray-100 rounded-2xl transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={processingRequest}
                  className="flex-1 py-2 bg-brand-teal text-white rounded-2xl font-bold hover:bg-brand-teal/90 transition-colors flex items-center justify-center gap-2 text-sm shadow-sm"
                >
                  {processingRequest ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  Send Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="aspect-video bg-gray-100 relative flex items-center justify-center">
              {selectedPhoto ? (
                <img src={selectedPhoto} className={`w-full h-full object-cover ${isInactive ? 'grayscale' : ''}`} alt="Vehicle" />
              ) : (
                <div className="text-gray-400 flex flex-col items-center">
                  <Truck size={48} />
                  <span className="text-sm mt-2">No photos available</span>
                </div>
              )}
              <div className="absolute top-4 right-4">
                <span className={`px-4 py-1.5 rounded-full text-sm font-bold uppercase tracking-wide shadow-sm ${getStatusColor(vehicle.status)}`}>
                  {isInactive ? 'Archived' : vehicle.status}
                </span>
              </div>
            </div>

            {vehicle.photos && vehicle.photos.length > 0 && (
              <div className="p-4 bg-white border-t border-gray-100 flex gap-3 overflow-x-auto">
                {vehicle.photos.map((p: any) => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPhoto(p.url)}
                    className={`w-20 h-20 rounded-2xl overflow-hidden border-2 flex-shrink-0 transition-all ${selectedPhoto === p.url ? 'border-brand-teal ring-2 ring-brand-teal/20' : 'border-transparent opacity-70 hover:opacity-100'}`}
                  >
                    <img src={p.url} className={`w-full h-full object-cover ${isInactive ? 'grayscale' : ''}`} alt="Thumbnail" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Completeness Card - Show only for owner */}
          {isViewingOwnVehicle && vehicle && (
            (() => {
              const checks = [
                { id: 'photo', label: 'Main photo', helper: 'Add at least one vehicle photo', done: vehicle.photos && vehicle.photos.length > 0 },
                { id: 'desc', label: 'Public description', helper: 'Add a public vehicle description', done: !!vehicle.notes },
                { id: 'basics', label: 'Make, model, year, body type', helper: 'Complete vehicle specifications', done: !!(vehicle.make && vehicle.model && vehicle.year_model && vehicle.body_type) },
                { id: 'seats', label: 'Seat count', helper: 'Add seat count', done: !!(vehicle as any).seat_count },
                { id: 'location', label: 'City and province', helper: 'Add province and city', done: !!(vehicle.province && vehicle.city) },
                { id: 'rates', label: 'Default rates', helper: 'Add a day or hourly rate', done: !!(vehicle.default_day_rate || vehicle.default_hour_rate) },
                { id: 'features', label: 'Features & amenities', helper: 'Add useful features', done: !!((vehicle as any).has_aircon || (vehicle as any).has_wifi || (vehicle as any).wheelchair_access || (vehicle as any).has_child_seat || (vehicle as any).has_tow_bar || (vehicle as any).luggage_capacity || (vehicle as any).seat_type) },
                { id: 'active', label: 'Status is active', helper: 'Set status to active', done: (vehicle.status as any) === 'active' || (vehicle.status as any) === 'Active' }
              ];
              const completedCount = checks.filter(c => c.done).length;
              const totalCount = checks.length;
              const percentage = Math.round((completedCount / totalCount) * 100);

              return (
                <div className="bg-white rounded-2xl shadow-sm border border-brand-teal/20 p-6">
                  <h3 className="text-xs font-bold text-brand-charcoal uppercase tracking-widest flex items-center gap-2 mb-4">
                    <CheckCircle2 size={16} className="text-brand-teal" />
                    Marketplace Profile Completeness
                  </h3>
                  
                  <div className="flex items-center gap-4 mb-4">
                    <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-1000 ${percentage === 100 ? 'bg-green-500' : 'bg-brand-teal'}`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="font-bold text-sm text-brand-charcoal">{percentage}%</span>
                  </div>

                  <p className="text-[11px] text-gray-500 mb-6 leading-relaxed bg-brand-teal/5 p-3 rounded-xl border border-brand-teal/10">
                    <Info size={12} className="inline mr-1 -mt-0.5" />
                    Vehicle profile completeness helps operators understand your vehicle before requesting availability. Compliance approval is handled separately through required documents.
                  </p>

                  <div className="grid grid-cols-1 gap-y-3 mb-6">
                    {checks.map(c => (
                      <div key={c.id} className="flex items-center justify-between gap-2 text-sm">
                        <div className="flex items-center gap-2">
                          {c.done ? (
                            <CheckCircle2 size={15} className="text-brand-teal shrink-0" />
                          ) : (
                            <div className="w-3.5 h-3.5 rounded-full border-2 border-gray-300 shrink-0" />
                          )}
                          <span className={c.done ? 'text-gray-700' : 'text-gray-400'}>{c.label}</span>
                        </div>
                        {!c.done && <span className="text-[10px] text-amber-600 font-bold">{c.helper}</span>}
                      </div>
                    ))}
                  </div>

                  {percentage < 100 && (
                    <Link
                      to={`/operator/vehicles/${vehicle.id}/edit`}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-brand-teal text-white rounded-xl font-bold text-sm hover:bg-brand-teal/90 transition-all shadow-sm"
                    >
                      <Edit2 size={14} /> Edit Vehicle Profile
                    </Link>
                  )}
                </div>
              );
            })()
          )}

          <div className={`bg-white rounded-2xl shadow-sm border border-gray-200 p-8 ${isInactive ? 'opacity-80' : ''}`}>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-6 border-b border-gray-100 pb-2">Specs & Features</h3>
            <div className="grid grid-cols-2 gap-y-6 gap-x-8">
              <div>
                <span className="text-xs text-gray-500 block mb-1">Make & Model</span>
                <div className="font-bold text-brand-charcoal text-lg">{vehicle.make} {vehicle.model}</div>
                <div className="text-sm text-gray-500">{vehicle.year_model} • {vehicle.body_type}</div>
              </div>

              <div>
                <span className="text-xs text-gray-500 block mb-1">License Plate</span>
                <div className="font-mono font-bold text-brand-charcoal text-lg">{(vehicle as any).license_plate}</div>
              </div>

              <div>
                <span className="text-xs text-gray-500 block mb-1">Capacity</span>
                <div className="flex items-center gap-2 font-bold text-brand-charcoal">
                  <Users size={18} className="text-brand-teal" /> {(vehicle as any).seat_count} Seats
                </div>
              </div>

              <div>
                <span className="text-xs text-gray-500 block mb-1">Fuel & Transmission</span>
                <div className="flex items-center gap-2 font-bold text-brand-charcoal">
                  <Fuel size={18} className="text-brand-coral" /> {(vehicle as any).fuel_type} / {(vehicle as any).transmission}
                </div>
              </div>

              <div>
                <span className="text-xs text-gray-500 block mb-1">Location</span>
                <div className="flex items-center gap-2 font-bold text-brand-charcoal">
                  <MapPin size={18} className="text-brand-teal" />
                  {vehicle.city ? `${vehicle.city}, ` : ''}
                  {vehicle.province ? `${vehicle.province}, ` : ''}
                  {vehicle.country || 'South Africa'}
                </div>
              </div>

              <div className="col-span-2">
                <span className="text-xs text-gray-500 block mb-3">Key Features</span>
                <div className="flex flex-wrap gap-x-6 gap-y-2">
                  <FeatureItem label="Air Conditioning" active={(vehicle as any).has_aircon} />
                  <FeatureItem label="Wi-Fi" active={(vehicle as any).has_wifi} />
                  <FeatureItem label="Tow Bar" active={(vehicle as any).has_tow_bar} />
                  <FeatureItem label="Wheelchair Access" active={(vehicle as any).wheelchair_access} />
                  <FeatureItem label="Child Seat" active={(vehicle as any).has_child_seat} />
                </div>
              </div>

              {vehicle.notes && (
                <div className="col-span-2 pt-6 border-t border-gray-100">
                  <span className="text-xs text-gray-500 block mb-2 uppercase font-bold tracking-wider">Vehicle Description</span>
                  <p className="text-sm text-brand-charcoal whitespace-pre-wrap leading-relaxed">
                    {vehicle.notes}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className={`space-y-6 ${isInactive ? 'opacity-80' : ''}`}>
          {/* Fleet Owner Profile Card */}
          {vehicle.profiles && (() => {
            const providerList = Array.isArray(vehicle.profiles) ? vehicle.profiles : [vehicle.profiles].filter(Boolean);
            const provider = providerList[0];
            if (!provider) return null;

            const providerName = provider.company_name || provider.full_name || 'Vehicle Provider';

            return (
            <div className={`bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden ${isInactive ? 'opacity-80' : ''}`}>
               <div className="p-6 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                    <User size={16} className="text-brand-teal" />
                    Fleet Provider
                  </h3>
                  {loadingCompliance ? (
                    <div className="flex items-center gap-1.5 text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                      <Loader2 size={10} className="animate-spin" /> Checking compliance...
                    </div>
                  ) : vehicleCompliance ? (
                    <div className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 border ${
                      vehicleCompliance.canAssign 
                       ? 'bg-green-50 text-green-700 border-green-100' 
                       : 'bg-red-50 text-red-700 border-red-100'
                    }`}>
                      {vehicleCompliance.canAssign ? (
                        <><CheckCircle2 size={10} /> Compliant</>
                      ) : (
                        <><XCircle size={10} /> Non Compliant</>
                      )}
                    </div>
                  ) : (
                    <div className="px-2 py-1 rounded bg-gray-50 text-gray-400 border border-gray-100 text-[10px] font-bold uppercase tracking-wider">
                      Compliance unavailable
                    </div>
                  )}
               </div>
               <div className="p-6">
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center overflow-hidden border border-gray-200 shadow-inner">
                      {provider.avatar_url || provider.profile_image_url ? (
                        <img src={(provider.avatar_url || provider.profile_image_url) ?? undefined} alt="Owner" className="w-full h-full object-cover" />
                      ) : (
                        <Building2 size={24} className="text-gray-300" />
                      )}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-brand-charcoal flex items-center gap-2">
                        {providerName}
                        {provider.verification_status?.toLowerCase() === 'verified' && (
                          <CheckCircle2 size={14} className="text-blue-500 fill-blue-50" />
                        )}
                      </h4>
                      <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                        <MapPin size={10} /> 
                        {provider.city || vehicle.city || 'Location not specified'}, 
                        {provider.province || vehicle.province || ''}
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        {ownerRatingSummary ? (
                          <div className="flex items-center gap-1.5 ml-2">
                            <span className="text-[10px] text-gray-500 font-medium">Fleet Rating:</span>
                            {ownerRatingSummary.total_reviews > 0 ? (
                              <>
                                <Star size={12} className="text-amber-400 fill-amber-400" />
                                <span className="text-[11px] font-bold text-brand-charcoal">{ownerRatingSummary.average_rating.toFixed(1)}</span>
                                <span className="text-[10px] text-gray-400">({ownerRatingSummary.total_reviews})</span>
                              </>
                            ) : (
                              <>
                                <div className="flex items-center gap-0.5">
                                  {[1,2,3,4,5].map(i => <Star key={i} size={10} className="text-gray-200 fill-gray-100" />)}
                                </div>
                                <span className="text-[10px] text-gray-400 font-bold ml-1">No fleet reviews yet</span>
                              </>
                            )}
                          </div>
                        ) : null}
                      </div>

                    </div>
                 </div>

                 <div className="mt-8 pt-6 border-t border-gray-100">
                    <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <ShieldCheck size={14} className="text-brand-teal" />
                      Vehicle Compliance Documents
                    </h3>
                    {loadingCompliance ? (
                      <div className="flex items-center gap-2 text-gray-400 italic text-[11px]">
                        <Loader2 size={12} className="animate-spin" /> Checking compliance...
                      </div>
                    ) : vehicleCompliance ? (
                      <div className="space-y-3">
                        {vehicleCompliance.canAssign ? (
                          <div className="flex flex-col gap-2">
                            <span className="inline-flex max-w-fit items-center gap-1 px-2.5 py-1 rounded bg-green-50 text-green-700 text-[11px] font-bold border border-green-200">
                              <CheckCircle2 size={12} /> Compliant
                            </span>
                            {/* Warnings output could be added here if needed */}
                          </div>
                        ) : (
                          <div className="flex flex-col gap-3">
                            <span className="inline-flex max-w-fit items-center gap-1 px-2.5 py-1 rounded bg-red-50 text-red-700 text-[11px] font-bold border border-red-200">
                              <XCircle size={12} /> Non Compliant
                            </span>
                            <div className="text-xs text-red-600 bg-red-50/50 p-2 rounded">
                              <strong className="block mb-1 font-bold">Missing Documents:</strong>
                              <ul className="list-disc pl-4 space-y-1">
                                {vehicleCompliance.blockers.map((b, i) => (
                                  <li key={i}>
                                    {b.replace(/vehicle_registration/g, 'Vehicle Registration')
                                      .replace(/insurance_certificate/g, 'Insurance Certificate')
                                      .replace(/operating_license/g, 'Operating License')}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-[11px] text-gray-400 italic">Compliance status unavailable</p>
                    )}
                 </div>
               </div>
            </div>
            );
          })()}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 border-b border-gray-100 pb-2 flex items-center gap-2">
              <Banknote size={16} className="text-brand-teal" />
              Vehicle Default Rates
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-[10px] text-gray-400 uppercase font-bold">Vehicle Default Day Rate</span>
                <div className="text-lg font-bold font-mono text-brand-charcoal">
                  {vehicle.rate_currency} {vehicle.default_day_rate || '---'}
                </div>
              </div>
              <div>
                <span className="text-[10px] text-gray-400 uppercase font-bold">Vehicle Default Hourly Rate</span>
                <div className="text-lg font-bold font-mono text-brand-charcoal">
                  {vehicle.rate_currency} {vehicle.default_hour_rate || '---'}
                </div>
              </div>
            </div>
          </div>

          {/* Rate Negotiation Card */}
          {!isViewingOwnVehicle && linkStatus === 'approved' && (
            <div className="bg-white rounded-2xl shadow-sm border border-brand-teal/20 p-6 relative overflow-hidden">
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
                <h3 className="text-xs font-bold text-brand-charcoal uppercase tracking-widest flex items-center gap-2">
                  <Banknote size={16} className="text-brand-teal" />
                  Rate Negotiation
                </h3>
                {rateLink && (
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-2xl border ${
                    rateLink.rate_status === 'accepted' ? 'bg-green-50 text-green-700 border-green-100' :
                    rateLink.rate_status === 'countered' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                    'bg-amber-50 text-amber-700 border-amber-100'
                  }`}>
                    {rateLink.rate_status}
                  </span>
                )}
              </div>

              <div className="space-y-4">
                {rateLink?.rate_status === 'accepted' ? (
                  <div className="space-y-3">
                    <div className="p-4 bg-green-50/50 rounded-2xl border border-green-100 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-green-700 uppercase font-bold">Negotiated Linked Rate</span>
                        <CheckCircle2 size={14} className="text-green-600" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <span className="text-[10px] text-gray-500 uppercase font-bold">Day Rate</span>
                          <div className="text-lg font-bold font-mono text-brand-charcoal">
                            {rateLink.rate_currency} {rateLink.owner_counter_day_rate ?? rateLink.operator_proposed_day_rate}
                          </div>
                        </div>
                        <div>
                          <span className="text-[10px] text-gray-500 uppercase font-bold">Hourly Rate</span>
                          <div className="text-lg font-bold font-mono text-brand-charcoal">
                            {rateLink.rate_currency} {rateLink.owner_counter_hour_rate ?? rateLink.operator_proposed_hour_rate}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100 flex gap-2">
                      <Info size={14} className="text-blue-500 shrink-0 mt-0.5" />
                      <p className="text-[10px] text-blue-700 leading-relaxed">
                        This is your operator-specific negotiated rate for this vehicle. It will be used as the default for your bookings.
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    {rateLink && rateLink.rate_status !== 'none' && (
                      <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100 text-xs space-y-2">
                        <div className="flex justify-between">
                          <span className="text-gray-500 font-medium">Proposed:</span>
                          <span className="font-bold">{rateLink.rate_currency} {rateLink.operator_proposed_day_rate}/{rateLink.operator_proposed_hour_rate}</span>
                        </div>
                        {rateLink.owner_counter_day_rate && (
                          <div className="flex justify-between text-blue-600">
                            <span className="font-medium">Owner Counter:</span>
                            <span className="font-bold">{rateLink.rate_currency} {rateLink.owner_counter_day_rate}/{rateLink.owner_counter_hour_rate}</span>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="pt-2">
                      {(!rateLink || rateLink.rate_status === 'none') && (
                        <button 
                          onClick={() => setShowProposeModal(true)}
                          className="w-full py-2.5 bg-brand-charcoal text-white font-bold rounded-2xl hover:bg-black transition-all text-xs flex items-center justify-center gap-2 shadow-sm"
                        >
                          <Send size={14} /> Propose custom rates
                        </button>
                      )}

                      {rateLink?.rate_status === 'proposed' && (
                        <div className="w-full py-2.5 bg-amber-50 text-amber-600 border border-amber-100 rounded-2xl text-center font-bold text-xs flex items-center justify-center gap-2">
                          <Clock size={14} /> Waiting for owner response
                        </div>
                      )}

                      {rateLink?.rate_status === 'countered' && (
                        <button 
                          onClick={handleAcceptCounter}
                          disabled={processingRate}
                          className="w-full py-2.5 bg-green-600 text-white font-bold rounded-2xl hover:bg-green-700 transition-all text-xs flex items-center justify-center gap-2 shadow-sm"
                        >
                          {processingRate ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                          Accept counter rates
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 border-b border-gray-100 pb-2">Ownership & License</h3>
            <div className="space-y-4 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">License Expiry</span>
                <span className="font-bold text-brand-charcoal flex items-center gap-2">
                  <Calendar size={14} />
                  {(vehicle as any).license_expiry ? new Date((vehicle as any).license_expiry).toLocaleDateString() : 'Not Set'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Added On</span>
                <span className="text-gray-700">{new Date((vehicle as any).created_at).toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 border-b border-gray-100 pb-2">Interior & Notes</h3>
            <div className="mb-4">
              <span className="text-xs text-gray-500 block mb-1">Seat Material</span>
              <div className="font-bold text-brand-charcoal">{(vehicle as any).seat_type}</div>
            </div>
            <div className="mb-4">
              <span className="text-xs text-gray-500 block mb-1">Luggage Capacity</span>
              <div className="text-sm text-brand-charcoal">{(vehicle as any).luggage_capacity || 'Not specified'}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
