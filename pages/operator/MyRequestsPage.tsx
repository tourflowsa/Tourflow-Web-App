import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { 
  listVehicleAvailabilityRequestsForOperator, 
  convertAcceptedVehicleRequestToDraftBooking,
  fetchBookingsForOperator,
  getEffectiveVehicleRateForBookingAssignment,
  updateBookingVehicleSnapshots,
  markVehicleRequestConverted,
  listDriverAvailabilityRequestsForOperator,
  updateDriverAvailabilityRequestStatus,
  listGuideAvailabilityRequestsForOperator,
  updateGuideAvailabilityRequestStatus,
  convertAcceptedGuideRequestToDraftBooking,
  markGuideRequestConverted,
  convertAcceptedDriverRequestToDraftBooking,
  markDriverRequestConverted
} from '../../lib/bookingService';
import { assignGuide, assignDriver } from '../../lib/assignmentService';
import { VehicleAvailabilityRequest, Tour, Booking, DriverAvailabilityRequest, GuideAvailabilityRequest } from '../../types';
import { CalendarDays, Loader2, Clock, Check, X, FilePlus, AlertCircle, Link as LinkIcon, PlusCircle, Search, RefreshCw, List, Eye, Users, XCircle } from 'lucide-react';
import { useNavigate, useLocation, Link } from 'react-router-dom';

export const MyRequestsPage: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<'vehicles' | 'drivers' | 'guides'>(
    location.state?.tab === 'drivers' ? 'drivers' : 
    location.state?.tab === 'guides' ? 'guides' : 'vehicles'
  );
  const [requests, setRequests] = useState<VehicleAvailabilityRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [driverRequests, setDriverRequests] = useState<DriverAvailabilityRequest[]>([]);
  const [driverLoading, setDriverLoading] = useState(false);
  const [guideRequests, setGuideRequests] = useState<GuideAvailabilityRequest[]>([]);
  const [guideLoading, setGuideLoading] = useState(false);
  const [tours, setTours] = useState<Tour[]>([]);
  const navigate = useNavigate();

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<VehicleAvailabilityRequest | GuideAvailabilityRequest | DriverAvailabilityRequest | null>(null);
  const [selectedRequestType, setSelectedRequestType] = useState<'vehicle' | 'guide' | 'driver'>('vehicle');
  const [selectedTourId, setSelectedTourId] = useState('');
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [numGuests, setNumGuests] = useState(1);
  const [converting, setConverting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showBanner, setShowBanner] = useState(true);

  // New Modal State for Options
  const [modalMode, setModalMode] = useState<'options' | 'create' | 'attach'>('options');
  const [draftBookings, setDraftBookings] = useState<Booking[]>([]);
  const [loadingDrafts, setLoadingDrafts] = useState(false);
  const [selectedBookingId, setSelectedBookingId] = useState('');

  // Success message from location state
  const [successMessage, setSuccessMessage] = useState<string | null>(
    location.state?.message || null
  );

  const lastProcessedKey = useRef<string | null>(null);

  useEffect(() => {
    if (user) {
      // Apply state from navigation if new
      if (location.key !== lastProcessedKey.current) {
        lastProcessedKey.current = location.key;
        if (location.state?.tab) {
          setActiveTab(location.state.tab);
        }
        if (location.state?.message) {
          setSuccessMessage(location.state.message);
        }
      }

      // Fetch all to ensure counts are accurate and current tab is fresh
      loadRequests();
      loadDriverRequests();
      loadGuideRequests();
      fetchTours();
    }
  }, [user, activeTab, location.key]);

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const loadRequests = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await listVehicleAvailabilityRequestsForOperator(user.id);
      setRequests(data);
    } catch (err: any) {
      console.error('Failed to load requests:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadDriverRequests = async () => {
    if (!user) return;
    setDriverLoading(true);
    try {
      const data = await listDriverAvailabilityRequestsForOperator(user.id);
      setDriverRequests(data);
    } catch (err: any) {
      console.error('Failed to load driver requests:', err);
    } finally {
      setDriverLoading(false);
    }
  };

  const handleCancelDriverRequest = async (requestId: string) => {
    if (!user || !window.confirm('Are you sure you want to cancel this request?')) return;
    try {
      await updateDriverAvailabilityRequestStatus(requestId, user.id, 'cancelled');
      window.dispatchEvent(new CustomEvent('PENDING_REQUESTS_UPDATED'));
      loadDriverRequests();
    } catch (err) {
      console.error('Failed to cancel driver request:', err);
    }
  };

  const loadGuideRequests = async () => {
    if (!user) return;
    setGuideLoading(true);
    try {
      const data = await listGuideAvailabilityRequestsForOperator(user.id);
      setGuideRequests(data);
    } catch (err: any) {
      console.error('Failed to load guide requests:', err);
    } finally {
      setGuideLoading(false);
    }
  };

  const handleCancelGuideRequest = async (requestId: string) => {
    if (!user || !window.confirm('Are you sure you want to cancel this request?')) return;
    try {
      await updateGuideAvailabilityRequestStatus(requestId, user.id, 'cancelled');
      window.dispatchEvent(new CustomEvent('PENDING_REQUESTS_UPDATED'));
      loadGuideRequests();
    } catch (err) {
      console.error('Failed to cancel guide request:', err);
    }
  };

  const fetchTours = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('tours')
      .select('*')
      .eq('operator_id', user.id)
      .eq('is_active', true)
      .eq('status', 'published')
      .order('title');
    
    if (error) {
      console.error("Error fetching tours:", error);
    } else {
      setTours(data as Tour[]);
    }
  };

  const openConvertModal = (req: VehicleAvailabilityRequest | GuideAvailabilityRequest | DriverAvailabilityRequest, type: 'vehicle' | 'guide' | 'driver' = 'vehicle') => {
    setSelectedRequest(req);
    setSelectedRequestType(type);
    setShowModal(true);
    setModalMode('options');
    setError(null);
    setSelectedTourId('');
    setGuestName('');
    setGuestEmail('');
    setNumGuests(1);
    setSelectedBookingId('');
  };

  const fetchDraftBookings = async () => {
    if (!user) return;
    setLoadingDrafts(true);
    try {
      const allBookings = await fetchBookingsForOperator(user.id);
      // Include draft and confirmed bookings as per requirements
      const validBookings = allBookings.filter(b => 
        (b.status === 'draft' || b.status === 'confirmed') && !b.archived_at
      );
      setDraftBookings(validBookings);
    } catch (err) {
      console.error('Failed to fetch bookings:', err);
      setError('Failed to load bookings.');
    } finally {
      setLoadingDrafts(false);
    }
  };

  const getFriendlyErrorMessage = (error: any, fallback: string) => {
    const msg = error?.message || '';
    if (msg.includes('PAYOUT_APPROVED')) {
      return "You cannot change this assignment because payout has already been approved.";
    }
    if (msg.includes('PAYOUT_PAID')) {
      return "You cannot change this assignment because payout has already been paid.";
    }
    if (msg.includes('completed') || msg.includes('stage')) {
      return "This assignment cannot be changed at this stage of the booking.";
    }
    return fallback;
  };

  const handleAttach = async () => {
    if (!selectedRequest || !selectedBookingId || !user) {
      setError('Please select a booking.');
      return;
    }

    setConverting(true);
    setError(null);

    try {
      if (selectedRequestType === 'vehicle') {
        const vReq = selectedRequest as VehicleAvailabilityRequest;
        // 1. Get effective rate for the vehicle
        const { effectiveRate } = await getEffectiveVehicleRateForBookingAssignment(
          user.id,
          vReq.vehicle_id,
          vReq.rate_type || 'day'
        );

        // 2. Update booking with vehicle and rate
        await updateBookingVehicleSnapshots(selectedBookingId, user.id, {
          vehicleId: vReq.vehicle_id,
          vehicleRateType: vReq.rate_type || 'day',
          vehicleRateAmount: effectiveRate,
          vehicleRateOverridden: false
        });

        // 3. Mark request as converted
        await markVehicleRequestConverted(vReq.id, selectedBookingId);
        
        setShowModal(false);
        navigate(`/operator/bookings/${selectedBookingId}`, { 
          state: { message: 'Vehicle successfully attached to booking.' } 
        });
      } else if (selectedRequestType === 'guide') {
        const gReq = selectedRequest as GuideAvailabilityRequest;
        
        // 1. Assign guide to the booking
        await assignGuide(selectedBookingId, gReq.guide_id);
        
        // 2. Mark request as converted
        await markGuideRequestConverted(gReq.id, selectedBookingId);
        
        setShowModal(false);
        navigate(`/operator/bookings/${selectedBookingId}`, { 
          state: { message: 'Guide successfully attached to booking.' } 
        });
      } else if (selectedRequestType === 'driver') {
        const dReq = selectedRequest as DriverAvailabilityRequest;
        
        // 1. Assign driver to the booking
        await assignDriver(selectedBookingId, dReq.driver_id);
        
        // 2. Mark request as converted
        await markDriverRequestConverted(dReq.id, selectedBookingId);
        
        setShowModal(false);
        navigate(`/operator/bookings/${selectedBookingId}`, { 
          state: { message: 'Driver successfully attached to booking.' } 
        });
      }
    } catch (err: any) {
      console.error('Failed to attach:', err);
      setError(getFriendlyErrorMessage(err, 'Failed to attach.'));
    } finally {
      setConverting(false);
    }
  };

  const handleConvert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest || !selectedTourId || !guestName || !guestEmail || numGuests < 1) {
      setError('Please fill in all required fields.');
      return;
    }

    setConverting(true);
    setError(null);

    try {
      let booking;
      if (selectedRequestType === 'vehicle') {
        booking = await convertAcceptedVehicleRequestToDraftBooking(
          selectedRequest.id,
          selectedTourId,
          numGuests,
          guestName,
          guestEmail
        );
      } else if (selectedRequestType === 'guide') {
        booking = await convertAcceptedGuideRequestToDraftBooking(
          selectedRequest.id,
          selectedTourId,
          numGuests,
          guestName,
          guestEmail
        );
      } else if (selectedRequestType === 'driver') {
        booking = await convertAcceptedDriverRequestToDraftBooking(
          selectedRequest.id,
          selectedTourId,
          numGuests,
          guestName,
          guestEmail
        );
      }
      
      setShowModal(false);
      navigate(`/operator/bookings/${booking?.id}`, { 
        state: { message: 'Request successfully converted to draft booking.' } 
      });
    } catch (err: any) {
      console.error('Failed to convert request:', err);
      setError(err.message || 'Failed to convert request.');
    } finally {
      setConverting(false);
    }
  };

  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin" size={32} /></div>;

  const pendingVehiclesCount = requests.filter(r => r.status === 'pending').length;
  const pendingDriversCount = driverRequests.filter(r => r.status === 'pending').length;
  const pendingGuidesCount = guideRequests.filter(r => r.status === 'pending').length;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-brand-charcoal">
            My Availability Requests {activeTab === 'drivers' && <span className="text-sm font-normal text-gray-400 ml-2">(Driver Requests)</span>}
          </h1>
          <p className="text-gray-500 mt-1">
            Track availability requests. Once accepted, attach them to a booking.
          </p>
        </div>
        <Link 
          to="/operator/directory"
          className="bg-brand-teal text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-brand-teal/90 transition-colors"
        >
          <Search size={18} /> Provider Directory
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-8">
        <button 
          onClick={() => setActiveTab('vehicles')}
          className={`px-6 py-3 font-bold text-sm border-b-2 transition-colors cursor-pointer ${activeTab === 'vehicles' ? 'border-brand-teal text-brand-teal' : 'border-transparent text-gray-500 hover:text-brand-charcoal'}`}
        >
          Vehicle Requests {pendingVehiclesCount > 0 && `(${pendingVehiclesCount})`}
        </button>
        <button 
          onClick={() => setActiveTab('drivers')}
          className={`px-6 py-3 font-bold text-sm border-b-2 transition-colors cursor-pointer ${activeTab === 'drivers' ? 'border-brand-teal text-brand-teal' : 'border-transparent text-gray-500 hover:text-brand-charcoal'}`}
        >
          Driver Requests {pendingDriversCount > 0 && `(${pendingDriversCount})`}
        </button>
        <button 
          onClick={() => setActiveTab('guides')}
          className={`px-6 py-3 font-bold text-sm border-b-2 transition-colors cursor-pointer ${activeTab === 'guides' ? 'border-brand-teal text-brand-teal' : 'border-transparent text-gray-500 hover:text-brand-charcoal'}`}
        >
          Guide Requests {pendingGuidesCount > 0 && `(${pendingGuidesCount})`}
        </button>
      </div>

      {activeTab === 'vehicles' ? (
        <>
          {/* Helper Banner */}
          {showBanner && (
            <div className="mb-6 p-4 bg-brand-teal/10 border border-brand-teal/20 rounded-2xl flex items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-brand-teal/20 rounded-lg text-brand-teal">
                  <AlertCircle size={20} />
                </div>
                <p className="text-sm font-medium text-brand-charcoal">
                  Request vehicle availability first, then use accepted requests in a booking.
                </p>
              </div>
              <button 
                onClick={() => setShowBanner(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <XCircle size={16} />
              </button>
            </div>
          )}

      {successMessage && (
        <div className="mb-6 p-4 bg-green-50 border border-green-100 rounded-xl text-green-700 flex items-center gap-2">
          <Check size={20} />
          {successMessage}
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Vehicle</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Dates</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Status</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={4} className="px-6 py-12 text-center"><Loader2 className="animate-spin mx-auto text-brand-teal" /></td></tr>
            ) : requests.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center">
                  <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-gray-400">
                    <List size={32} />
                  </div>
                  <h3 className="text-xl font-bold text-brand-charcoal mb-2">No requests yet</h3>
                  <p className="text-gray-500 mb-8 max-w-sm mx-auto">Browse vehicles and request availability to get started.</p>
                  <Link 
                    to="/operator/directory"
                    className="inline-flex items-center gap-2 bg-brand-teal text-white px-6 py-3 rounded-xl font-bold hover:bg-brand-teal/90 transition-all shadow-sm"
                  >
                    <Search size={20} /> Go to Directory
                  </Link>
                </td>
              </tr>
            ) : (
              requests.map(req => (
                <tr key={req.id}>
                  <td className="px-6 py-4">
                    {req.vehicles ? `${req.vehicles.make} ${req.vehicles.model}` : 'Unknown Vehicle'}
                  </td>
                  <td className="px-6 py-4">{new Date(req.start_date).toLocaleDateString()} - {new Date(req.end_date).toLocaleDateString()}</td>
                  <td className="px-6 py-4 capitalize">
                    <div className="flex flex-col gap-1">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        req.status === 'accepted' ? 'bg-green-100 text-green-800' :
                        req.status === 'declined' ? 'bg-red-100 text-red-800' :
                        req.status === 'cancelled' ? 'bg-gray-100 text-gray-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {req.status}
                      </span>
                      <span className="text-[10px] text-gray-400 leading-tight">
                        {req.status === 'pending' && "Waiting for fleet owner response"}
                        {req.status === 'accepted' && "Ready to use in a booking"}
                        {req.status === 'declined' && "Request declined, try another vehicle"}
                        {req.status === 'cancelled' && "Request was cancelled"}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {req.status === 'accepted' && !req.converted_booking_id && (
                      <div className="flex flex-col items-end gap-1">
                        <button 
                          onClick={() => openConvertModal(req)} 
                          className="text-brand-teal font-bold flex items-center gap-1 justify-end hover:text-brand-teal/80 transition-colors"
                        >
                          <FilePlus size={16} /> Use in Booking
                        </button>
                        <span className="text-[10px] text-brand-teal font-medium">
                          Attach this vehicle to a booking to continue.
                        </span>
                      </div>
                    )}
                    {req.converted_booking_id && (
                      <span className="inline-flex items-center gap-1 text-gray-500 text-sm">
                        <Check size={14} /> Linked to Booking
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      </>
      ) : activeTab === 'drivers' ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Driver</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Dates</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {driverLoading ? (
                <tr><td colSpan={4} className="px-6 py-12 text-center"><Loader2 className="animate-spin mx-auto text-brand-teal" /></td></tr>
              ) : driverRequests.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center">
                    <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-gray-400">
                      <Users size={32} />
                    </div>
                    <h3 className="text-xl font-bold text-brand-charcoal mb-2">No driver requests yet</h3>
                    <p className="text-gray-500 mb-8 max-w-sm mx-auto">Browse drivers and request availability to get started.</p>
                    <Link 
                      to="/operator/directory"
                      className="inline-flex items-center gap-2 bg-brand-teal text-white px-6 py-3 rounded-xl font-bold hover:bg-brand-teal/90 transition-all shadow-sm"
                    >
                      <Search size={20} /> Go to Directory
                    </Link>
                  </td>
                </tr>
              ) : (
                driverRequests.map(req => (
                  <tr key={req.id}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden shrink-0">
                          {req.driver?.avatar_url || req.driver?.profile_image_url ? (
                            <img 
                              src={req.driver?.avatar_url || req.driver?.profile_image_url || undefined} 
                              alt={req.driver?.full_name || ''} 
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <span className="font-bold text-gray-400">{req.driver?.full_name?.charAt(0)}</span>
                          )}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold text-brand-charcoal">{req.driver?.full_name || 'Unknown Driver'}</span>
                          <span className="text-xs text-gray-400">{req.driver?.email}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {new Date(req.start_date).toLocaleDateString()} - {new Date(req.end_date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          req.status === 'accepted' ? 'bg-green-100 text-green-800' :
                          req.status === 'declined' ? 'bg-red-100 text-red-800' :
                          req.status === 'cancelled' ? 'bg-gray-100 text-gray-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {req.status}
                        </span>
                        <span className="text-[10px] text-gray-400 leading-tight">
                          {req.status === 'pending' && "Waiting for driver response"}
                          {req.status === 'accepted' && "Driver is available"}
                          {req.status === 'declined' && "Driver declined request"}
                          {req.status === 'cancelled' && "Request was cancelled"}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {req.status === 'pending' && (
                        <button 
                          onClick={() => handleCancelDriverRequest(req.id)}
                          className="text-red-500 hover:text-red-700 font-bold text-sm flex items-center justify-end gap-1 ml-auto"
                        >
                          <XCircle size={14} /> Cancel
                        </button>
                      )}
                      {req.status === 'accepted' && !req.converted_booking_id && (
                        <div className="flex flex-col items-end gap-1">
                          <button 
                            onClick={() => openConvertModal(req, 'driver')}
                            className="bg-brand-teal text-white px-4 py-2 rounded-lg font-bold hover:bg-brand-teal/90 transition-colors text-sm flex items-center gap-2"
                          >
                            <FilePlus size={16} /> Use in Booking
                          </button>
                          <span className="text-[10px] text-brand-teal font-medium">
                            Attach this driver to a booking to continue.
                          </span>
                        </div>
                      )}
                      {req.converted_booking_id && (
                        <span className="inline-flex items-center gap-1 text-gray-500 text-sm justify-end w-full">
                          <Check size={14} /> Linked to Booking
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Guide</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Dates</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {guideLoading ? (
                <tr><td colSpan={4} className="px-6 py-12 text-center"><Loader2 className="animate-spin mx-auto text-brand-teal" /></td></tr>
              ) : guideRequests.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center">
                    <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-gray-400">
                      <Users size={32} />
                    </div>
                    <h3 className="text-xl font-bold text-brand-charcoal mb-2">No guide requests yet</h3>
                    <p className="text-gray-500 mb-8 max-w-sm mx-auto">Browse guides and request availability to get started.</p>
                    <Link 
                      to="/operator/directory"
                      className="inline-flex items-center gap-2 bg-brand-teal text-white px-6 py-3 rounded-xl font-bold hover:bg-brand-teal/90 transition-all shadow-sm"
                    >
                      <Search size={20} /> Go to Directory
                    </Link>
                  </td>
                </tr>
              ) : (
                guideRequests.map(req => (
                  <tr key={req.id}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden shrink-0">
                          {req.guide?.avatar_url || req.guide?.profile_image_url ? (
                            <img 
                              src={req.guide?.avatar_url || req.guide?.profile_image_url || undefined} 
                              alt={req.guide?.full_name || ''} 
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <span className="font-bold text-gray-400">{req.guide?.full_name?.charAt(0)}</span>
                          )}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold text-brand-charcoal">{req.guide?.full_name || 'Unknown Guide'}</span>
                          <span className="text-xs text-gray-400">{req.guide?.email}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {new Date(req.start_date).toLocaleDateString()} - {new Date(req.end_date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          req.status === 'accepted' ? 'bg-green-100 text-green-800' :
                          req.status === 'declined' ? 'bg-red-100 text-red-800' :
                          req.status === 'cancelled' ? 'bg-gray-100 text-gray-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {req.status}
                        </span>
                        <span className="text-[10px] text-gray-400 leading-tight">
                          {req.status === 'pending' && "Waiting for guide response"}
                          {req.status === 'accepted' && "Guide is available"}
                          {req.status === 'declined' && "Guide declined request"}
                          {req.status === 'cancelled' && "Request was cancelled"}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {req.status === 'pending' && (
                        <button 
                          onClick={() => handleCancelGuideRequest(req.id)}
                          className="text-red-500 hover:text-red-700 font-bold text-sm flex items-center justify-end gap-1 ml-auto"
                        >
                          <XCircle size={14} /> Cancel
                        </button>
                      )}
                      {req.status === 'accepted' && !req.converted_booking_id && (
                        <div className="flex flex-col items-end gap-1">
                          <button 
                            onClick={() => openConvertModal(req, 'guide')}
                            className="bg-brand-teal text-white px-4 py-2 rounded-lg font-bold hover:bg-brand-teal/90 transition-colors text-sm flex items-center gap-2"
                          >
                            <FilePlus size={16} /> Use in Booking
                          </button>
                          <span className="text-[10px] text-brand-teal font-medium">
                            Attach this guide to a booking to continue.
                          </span>
                        </div>
                      )}
                      {req.converted_booking_id && (
                        <span className="inline-flex items-center gap-1 text-gray-500 text-sm justify-end w-full">
                          <Check size={14} /> Linked to Booking
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Conversion Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-brand-charcoal">
                {modalMode === 'options' ? 'Use in Booking' : 
                 modalMode === 'create' ? 'Create New Draft Booking' : 
                 'Attach to Existing Booking'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <div className="p-6">
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-lg text-red-600 text-sm flex items-start gap-2">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {modalMode === 'options' && (
                <div className="space-y-4">
                  <p className="text-sm text-gray-600 mb-6">
                    This request for <strong>
                      {selectedRequestType === 'vehicle' 
                        ? `${(selectedRequest as VehicleAvailabilityRequest)?.vehicles?.make} ${(selectedRequest as VehicleAvailabilityRequest)?.vehicles?.model}`
                        : selectedRequestType === 'guide'
                        ? (selectedRequest as GuideAvailabilityRequest)?.guide?.full_name
                        : (selectedRequest as DriverAvailabilityRequest)?.driver?.full_name}
                    </strong> has been accepted. How would you like to use it?
                  </p>
                  <button
                    onClick={() => setModalMode('create')}
                    className="w-full p-4 border-2 border-gray-100 rounded-xl hover:border-brand-teal hover:bg-brand-teal/5 transition-all flex items-center gap-4 text-left group"
                  >
                    <div className="p-3 bg-brand-teal/10 rounded-lg text-brand-teal group-hover:bg-brand-teal group-hover:text-white transition-colors">
                      <PlusCircle size={24} />
                    </div>
                    <div>
                      <p className="font-bold text-brand-charcoal">Create New Draft Booking</p>
                      <p className="text-xs text-gray-500">Start a fresh booking with this {selectedRequestType}</p>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setModalMode('attach');
                      fetchDraftBookings();
                    }}
                    className="w-full p-4 border-2 border-gray-100 rounded-xl hover:border-brand-teal hover:bg-brand-teal/5 transition-all flex items-center gap-4 text-left group"
                  >
                    <div className="p-3 bg-blue-50 rounded-lg text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                      <LinkIcon size={24} />
                    </div>
                    <div>
                      <p className="font-bold text-brand-charcoal">Attach to Existing Booking</p>
                      <p className="text-xs text-gray-500">Assign this {selectedRequestType} to an existing booking</p>
                    </div>
                  </button>
                </div>
              )}

              {modalMode === 'create' && (
                <form onSubmit={handleConvert} className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-brand-charcoal mb-1">Select Tour</label>
                    <select
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-teal focus:border-transparent outline-none"
                      value={selectedTourId}
                      onChange={(e) => setSelectedTourId(e.target.value)}
                    >
                      <option value="">Choose a tour...</option>
                      {tours.map(t => (
                        <option key={t.id} value={t.id}>{t.title}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-brand-charcoal mb-1">Guest Name</label>
                    <input
                      type="text"
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-teal focus:border-transparent outline-none"
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      placeholder="e.g. John Doe"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-brand-charcoal mb-1">Guest Email</label>
                    <input
                      type="email"
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-teal focus:border-transparent outline-none"
                      value={guestEmail}
                      onChange={(e) => setGuestEmail(e.target.value)}
                      placeholder="e.g. john@example.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-brand-charcoal mb-1">Number of Guests</label>
                    <input
                      type="number"
                      required
                      min="1"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-teal focus:border-transparent outline-none"
                      value={numGuests}
                      onChange={(e) => setNumGuests(parseInt(e.target.value))}
                    />
                  </div>

                  <div className="pt-4 flex gap-3">
                    <button
                      type="button"
                      onClick={() => setModalMode('options')}
                      className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 font-bold rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={converting}
                      className="flex-1 px-4 py-2 bg-brand-teal text-white font-bold rounded-lg hover:bg-brand-teal/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {converting ? (
                        <>
                          <Loader2 size={18} className="animate-spin" />
                          Creating...
                        </>
                      ) : (
                        'Create Booking'
                      )}
                    </button>
                  </div>
                </form>
              )}

              {modalMode === 'attach' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-brand-charcoal mb-2">Select Booking</label>
                    {loadingDrafts ? (
                      <div className="py-8 flex justify-center">
                        <Loader2 className="animate-spin text-brand-teal" size={24} />
                      </div>
                    ) : draftBookings.length === 0 ? (
                      <div className="py-6 text-center text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                        No eligible bookings found.
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                        {draftBookings.map(b => (
                          <button
                            key={b.id}
                            onClick={() => setSelectedBookingId(b.id)}
                            className={`w-full p-3 text-left rounded-xl border-2 transition-all ${
                              selectedBookingId === b.id 
                                ? 'border-brand-teal bg-brand-teal/5' 
                                : 'border-gray-100 hover:border-gray-200'
                            }`}
                          >
                            <div className="flex justify-between items-start">
                              <p className="font-bold text-brand-charcoal text-sm">{b.booking_reference}</p>
                              <p className="text-[10px] font-bold text-gray-400 uppercase">{new Date(b.start_date).toLocaleDateString()}</p>
                            </div>
                            <p className="text-xs text-gray-500 truncate">{b.guest_name || 'No Guest Name'}</p>
                            <p className="text-[10px] text-gray-400 mt-1">{b.tours?.title}</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="pt-4 flex gap-3">
                    <button
                      type="button"
                      onClick={() => setModalMode('options')}
                      className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 font-bold rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleAttach}
                      disabled={converting || !selectedBookingId || loadingDrafts}
                      className="flex-1 px-4 py-2 bg-brand-teal text-white font-bold rounded-lg hover:bg-brand-teal/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {converting ? (
                        <>
                          <Loader2 size={18} className="animate-spin" />
                          Attaching...
                        </>
                      ) : (
                        `Attach ${selectedRequestType === 'vehicle' ? 'Vehicle' : selectedRequestType === 'driver' ? 'Driver' : 'Guide'}`
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
