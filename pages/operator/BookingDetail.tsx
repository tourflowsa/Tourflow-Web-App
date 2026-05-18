import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import type { Booking, BookingStatus, Vehicle } from '../../types';
import { supabase } from '../../lib/supabase';
import { 
  getOperatorOwnedVehicles, 
  getLinkedVehiclesForOperator, 
  getVehicleById, 
  getVehicleAvailabilityBlocks,
} from '../../lib/fleetService';
import {
  getBookingById,
  updateBookingStatus,
  completeBooking,
  cancelBooking,
  markBookingNoShow,
  markAssignmentNoShow,
  archiveBookingRpc,
  unarchiveBookingRpc,
  getEffectiveVehicleRateForBookingAssignment,
  updateBookingVehicleSnapshots,
  getVehicleBookingConflicts,
  checkVehicleConflicts,
  getBookingStatusHistory,
  updateBookingTripInfo,
  updateBookingInternalNotes,
  updateBookingInternalCosts,
  listVehicleAvailabilityRequestsForOperator,
  listDriverAvailabilityRequestsForOperator,
  listGuideAvailabilityRequestsForOperator,
  markDriverRequestConverted,
  markGuideRequestConverted,
  markVehicleRequestConverted,
  createRecurringBookings,
  createDuplicateBooking,
  checkProviderConflicts
} from '../../lib/bookingService';
import {
  searchDrivers,
  searchGuides,
  assignDriver,
  assignGuide,
  getBookingAssignments,
  getCurrentAssignment,
  cancelAssignmentByOperator,
  ProviderProfile,
  BookingAssignmentRow
} from '../../lib/assignmentService';
import { updatePayoutStatus, getPayoutLedgersForBooking, createPayoutLedgerForBooking, raisePayoutDispute } from '../../lib/payoutService';
import { getProviderComplianceForOperator, canAssignProvider, canAssignVehicle } from '../../lib/compliance';
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Users,
  User,
  Mail,
  Phone,
  Search,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Plus,
  Info,
  Car,
  Compass,
  Check,
  X,
  Archive,
  RotateCcw,
  Banknote,
  Lock,
  Edit2,
  Truck,
  ExternalLink,
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  Save,
  CreditCard,
  AlertTriangle,
  Repeat,
  Copy,
  Star
} from 'lucide-react';
import { 
  BookingStatusBadge 
} from '../../components/bookings/BookingStatusBadge';
import { ComplianceBadge } from '../../components/common/ComplianceBadge';
import { ConfirmationModal } from '../../components/common/ConfirmationModal';
import { BookingFinancialBreakdownView } from '../../components/bookings/BookingFinancialBreakdown';
import { formatCurrency, formatDate, toLocalDatetimeString, toLocalDateString } from '../../lib/formatUtils';
import { getBookingFinancialBreakdown, BookingFinancialBreakdown } from '../../lib/financialService';
import { getPayableAmount, getOriginalAmount } from '../../lib/payoutUtils';
import { fetchAuditLogsByBookingId, AuditLogEntry, logAuditEvent } from '../../lib/auditService';
import { ReviewModal } from '../../components/reviews/ReviewModal';
import { hasReview, getProviderRatingSummary, RatingSummary } from '../../lib/reviewService';
import { BookingChat } from '../../components/bookings/BookingChat';


function getAllowedActions(status: string, isArchived: boolean) {
  if (isArchived) return ['unarchive'];

  switch (status) {
    case 'draft':
    case 'pending':
      return ['confirm', 'cancel'];
    case 'confirmed':
      return ['complete', 'cancel'];
    case 'completed':
    case 'cancelled':
      return ['archive'];
    default:
      return ['cancel'];
  }
}

const getStatusDisplay = (status: string | null | undefined) => {
  if (!status) return '';
  switch (status.toLowerCase()) {
    case 'pending': return 'Pending Acceptance';
    case 'accepted': return 'Accepted';
    case 'completed': return 'Completed';
    case 'rejected': return 'Declined';
    case 'cancelled': return 'Cancelled';
    case 'replaced': return 'Replaced';
    case 'no_show': return 'No-Show Reported';
    default: return status;
  }
};

const isVehiclePaid = (payoutLedgers: any[], vehicle: Vehicle | null) => {
  if (!vehicle) return false;
  return payoutLedgers.some(p => p.provider_id === vehicle.owner_id && p.status === 'paid');
};

const isVehicleApproved = (payoutLedgers: any[], vehicle: Vehicle | null) => {
  if (!vehicle) return false;
  return payoutLedgers.some(p => p.provider_id === vehicle.owner_id && p.status === 'approved');
};

const isAssignmentPaid = (payoutLedgers: any[], resourceId: string | null) => {
  if (!resourceId) return false;
  return payoutLedgers.some(p => p.provider_id === resourceId && p.status === 'paid');
};

const isAssignmentApproved = (payoutLedgers: any[], resourceId: string | null) => {
  if (!resourceId) return false;
  return payoutLedgers.some(p => p.provider_id === resourceId && p.status === 'approved');
};

const getStatusBadgeClass = (status: string | null | undefined) => {
  if (!status) return '';
  switch (status.toLowerCase()) {
    case 'accepted': return 'bg-green-100 text-green-700';
    case 'completed': return 'bg-brand-teal/10 text-brand-teal';
    case 'rejected': return 'bg-red-100 text-red-700';
    case 'no_show': return 'bg-red-100 text-red-700';
    case 'pending': return 'bg-amber-100 text-amber-700';
    case 'cancelled': return 'bg-orange-100 text-orange-700';
    case 'replaced': return 'bg-slate-100 text-slate-700';
    default: return 'bg-gray-100 text-gray-700';
  }
};

export const BookingDetail: React.FC = () => {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile } = useAuth();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [assignments, setAssignments] = useState<BookingAssignmentRow[]>([]);
  const [payoutLedgers, setPayoutLedgers] = useState<any[]>([]);
  const [financials, setFinancials] = useState<BookingFinancialBreakdown | null>(null);
  const [disputes, setDisputes] = useState<any[]>([]);
  const [statusHistory, setStatusHistory] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [statusHistoryLoading, setStatusHistoryLoading] = useState(false);
  const [statusHistoryError, setStatusHistoryError] = useState(false);

  const prevDriverStatusRef = useRef<string | null>(null);
  const prevGuideStatusRef = useRef<string | null>(null);
  const reviewSectionRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);


  // Assignment states for Driver
  const [showDriverSearch, setShowDriverSearch] = useState(false);
  const [driverSearchQuery, setDriverSearchQuery] = useState('');
  const [foundDrivers, setFoundDrivers] = useState<(ProviderProfile & { compliance?: any; hasConflict?: boolean; assignmentCheck?: any; ratingSummary?: RatingSummary })[]>([]);
  const [hasSearchedDrivers, setHasSearchedDrivers] = useState(false);
  const [loadingDrivers, setLoadingDrivers] = useState(false);
  const [assigningDriverId, setAssigningDriverId] = useState<string | null>(null);

  // Assignment states for Guide
  const [showGuideSearch, setShowGuideSearch] = useState(false);
  const [guideSearchQuery, setGuideSearchQuery] = useState('');
  const [foundGuides, setFoundGuides] = useState<(ProviderProfile & { compliance?: any; hasConflict?: boolean; assignmentCheck?: any; ratingSummary?: RatingSummary })[]>([]);
  const [hasSearchedGuides, setHasSearchedGuides] = useState(false);
  const [loadingGuides, setLoadingGuides] = useState(false);
  const [assigningGuideId, setAssigningGuideId] = useState<string | null>(null);

  // Vehicle selection states
  const [showVehicleModal, setShowVehicleModal] = useState(false);
  const [ownedVehicles, setOwnedVehicles] = useState<(Vehicle & { ownerCompliance?: any })[]>([]);
  const [hiredVehicles, setHiredVehicles] = useState<(Vehicle & { ownerCompliance?: any })[]>([]);
  const [availabilityBlocks, setAvailabilityBlocks] = useState<any[]>([]);
  const [bookingConflicts, setBookingConflicts] = useState<string[]>([]); // vehicle IDs
  const [vehicleTab, setVehicleTab] = useState<'owned' | 'hired'>('owned');
  const [vehicleSearch, setVehicleSearch] = useState('');
  const [loadingVehicles, setLoadingVehicles] = useState(false);

  const [vehicleRateType, setVehicleRateType] = useState<'day' | 'hour'>('day');
  const [vehicleRateAmount, setVehicleRateAmount] = useState<string>('');
  const [vehicleRateOverridden, setVehicleRateOverridden] = useState(false);
  const [vehicleRateAutoSource, setVehicleRateAutoSource] = useState<'negotiated' | 'default' | null>(null);
  const [savingVehicle, setSavingVehicle] = useState(false);
  const [updatingPayout, setUpdatingPayout] = useState<'driver' | 'guide' | 'vehicle' | null>(null);

  // Loaded details for booking.vehicle_id
  const [selectedVehicleDetails, setSelectedVehicleDetails] = useState<Vehicle | null>(null);

  // Edit Trip Info states
  const [showEditTripModal, setShowEditTripModal] = useState(false);
  const [editTripForm, setEditTripForm] = useState({
    startDate: '',
    endDate: '',
    guestName: '',
    guestEmail: '',
    guestPhone: '',
    numGuests: 1,
    pickupLocation: '',
    dropoffLocation: '',
    specialRequests: '',
    internalNotes: ''
  });
  const [savingTripInfo, setSavingTripInfo] = useState(false);
  const [savingCosts, setSavingCosts] = useState(false);
  const [creatingRecurring, setCreatingRecurring] = useState(false);

  // Recurring Booking states
  const [showRepeatModal, setShowRepeatModal] = useState(false);
  const [repeatConfig, setRepeatConfig] = useState({
    frequency: 'daily' as 'daily' | 'weekly',
    startDate: '',
    endCondition: 'count' as 'count' | 'endDate',
    repeatCount: 1,
    endDate: '',
    includeResources: true
  });

  // Duplicate Booking states
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [duplicateConfig, setDuplicateConfig] = useState({
    startDate: '',
    endDate: '',
    includeResources: false
  });

  // Internal Cost states
  const [driverCostOverride, setDriverCostOverride] = useState<number | null>(null);
  const [guideCostOverride, setGuideCostOverride] = useState<number | null>(null);
  const [vehicleCostOverride, setVehicleCostOverride] = useState<number | null>(null);

  // Rate Config State (shared between driver/guide search step)
  const [configuringProvider, setConfiguringProvider] = useState<{ profile: ProviderProfile; type: 'driver' | 'guide' } | null>(null);
  const [rateType, setRateType] = useState<'day' | 'hour'>('day');
  const [rateAmount, setRateAmount] = useState<string>('');
  const [isRateOverridden, setIsRateOverridden] = useState(false);

  // Resource Modal States
  const [resourceModal, setResourceModal] = useState<{
    isOpen: boolean;
    type: 'driver' | 'guide' | 'vehicle';
    action: 'add' | 'replace';
  } | null>(null);

  // Review states
  const [reviewedProviders, setReviewedProviders] = useState<Set<string>>(new Set());
  const [reviewModalData, setReviewModalData] = useState<{ providerId: string; providerName: string; role: 'driver' | 'guide' | 'vehicle_owner' } | null>(null);

  // Dispute states
  const [disputeModal, setDisputeModal] = useState<{
    isOpen: boolean;
    payoutId: string;
    resource: 'driver' | 'guide' | 'vehicle';
  } | null>(null);
  const [disputeReason, setDisputeReason] = useState('');
  const [raisingDispute, setRaisingDispute] = useState(false);

  const [acceptedRequestsModal, setAcceptedRequestsModal] = useState<{
    isOpen: boolean;
    type: 'driver' | 'guide' | 'vehicle';
    requests: any[];
    loading: boolean;
  } | null>(null);

  const [assignmentConfirmModal, setAssignmentConfirmModal] = useState<{
    isOpen: boolean;
    type: 'remove' | 'replace';
    role: 'driver' | 'guide' | 'vehicle';
    assignmentId?: string;
  } | null>(null);

  const [showArchiveConfirmModal, setShowArchiveConfirmModal] = useState(false);
  const [showUnarchiveConfirmModal, setShowUnarchiveConfirmModal] = useState(false);
  const [isArchiveProcessing, setIsArchiveProcessing] = useState(false);

  const [isProcessingAssignmentAction, setIsProcessingAssignmentAction] = useState(false);

  useEffect(() => {
    if (user && id) {
      loadAll();
    } else if (!id) {
      setLoading(false);
    }
  }, [user, id]);

  useEffect(() => {
    if (booking) {
      if (booking.internal_cost_driver !== null && booking.internal_cost_driver !== undefined) {
        setDriverCostOverride(booking.internal_cost_driver);
      }
      if (booking.internal_cost_guide !== null && booking.internal_cost_guide !== undefined) {
        setGuideCostOverride(booking.internal_cost_guide);
      }
      if (booking.internal_cost_vehicle !== null && booking.internal_cost_vehicle !== undefined) {
        setVehicleCostOverride(booking.internal_cost_vehicle);
      }
    }
  }, [booking?.id]);

  useEffect(() => {
    if (!booking) return;

    const rt = (booking.vehicle_rate_type || 'day') as 'day' | 'hour';
    setVehicleRateType(rt);
    setVehicleRateOverridden(Boolean(booking.vehicle_rate_overridden));

    if (booking.vehicle_rate_amount !== null && booking.vehicle_rate_amount !== undefined) {
      setVehicleRateAmount(String(booking.vehicle_rate_amount));
    } else {
      setVehicleRateAmount('');
    }
  }, [booking]);

  useEffect(() => {
    if (!booking?.vehicle_id) {
      setSelectedVehicleDetails(null);
      return;
    }
    if (selectedVehicleDetails?.id === booking.vehicle_id) return;

    void loadSelectedVehicleDetails(booking.vehicle_id);
  }, [booking?.vehicle_id]);

  useEffect(() => {
    if (configuringProvider && !isRateOverridden) {
      const defaultRate =
        rateType === 'day' ? configuringProvider.profile.default_day_rate : configuringProvider.profile.default_hour_rate;

      setRateAmount(defaultRate !== null && defaultRate !== undefined ? defaultRate.toString() : '');
    }
  }, [configuringProvider, rateType, isRateOverridden]);

  const assignedDriver = useMemo(() => {
    return getCurrentAssignment(assignments, 'driver');
  }, [assignments]);

  const assignedGuide = useMemo(() => {
    return getCurrentAssignment(assignments, 'guide');
  }, [assignments]);

  const driverPayout = useMemo(() => 
    payoutLedgers.find(p => p.provider_id === assignedDriver?.resource_id),
    [payoutLedgers, assignedDriver]
  );
  const guidePayout = useMemo(() => 
    payoutLedgers.find(p => p.provider_id === assignedGuide?.resource_id),
    [payoutLedgers, assignedGuide]
  );
  const vehiclePayout = useMemo(() => 
    payoutLedgers.find(p => p.provider_id === selectedVehicleDetails?.owner_id),
    [payoutLedgers, selectedVehicleDetails]
  );

  const isFinanciallyLocked = useMemo(() => {
    return payoutLedgers.some(p => p.status === 'paid');
  }, [payoutLedgers]);

  const isDriverLocked = (driverPayout && driverPayout.status !== 'pending') || isFinanciallyLocked;
  const isGuideLocked = (guidePayout && guidePayout.status !== 'pending') || isFinanciallyLocked;
  const isVehicleLocked = (vehiclePayout && vehiclePayout.status !== 'pending') || isFinanciallyLocked;
  const isTripInfoLocked = booking?.status === 'completed' || booking?.status === 'cancelled' || !!booking?.archived_at || isFinanciallyLocked;

  const { durationHours, durationDays } = useMemo(() => {
    if (!booking?.start_date || !booking?.end_date) return { durationHours: 0, durationDays: 0 };

    const start = new Date(booking.start_date);
    const end = new Date(booking.end_date);

    const ms = end.getTime() - start.getTime();
    const hours = Math.max(0, Math.ceil(ms / (1000 * 60 * 60)));
    const days = Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));

    return { durationHours: hours, durationDays: days };
  }, [booking?.start_date, booking?.end_date]);

  const calcCost = (rateAmount?: number | null, rateType?: string | null) => {
    const amt = Number(rateAmount ?? 0);
    if (!amt) return 0;

    const type = String(rateType ?? '').toLowerCase();
    const isHourly = type.includes('hour');

    if (isHourly) return amt * Math.max(1, durationHours);
    return amt * Math.max(1, durationDays);
  };

  const internalCostVehicle = useMemo(() => {
    if (!booking?.vehicle_id) return 0;
    if (vehicleCostOverride !== null) return vehicleCostOverride;
    if (!booking) return 0;
    return calcCost(booking.vehicle_rate_amount, booking.vehicle_rate_type);
  }, [booking, durationHours, durationDays, vehicleCostOverride]);

  const internalCostDriver = useMemo(() => {
    if (!assignedDriver || assignedDriver.status === 'rejected') return 0;
    if (driverCostOverride !== null) return driverCostOverride;
    
    // Fallback to profile rates if assignment rates are missing
    const rateType = assignedDriver.rate_type || 'day';
    const rateAmount = assignedDriver.rate_amount ?? (
      rateType === 'hour' 
        ? assignedDriver.profile?.default_hour_rate 
        : assignedDriver.profile?.default_day_rate
    );
    
    return calcCost(rateAmount, rateType);
  }, [assignedDriver, durationHours, durationDays, driverCostOverride]);

  const internalCostGuide = useMemo(() => {
    if (!assignedGuide || assignedGuide.status === 'rejected') return 0;
    if (guideCostOverride !== null) return guideCostOverride;
    
    // Fallback to profile rates if assignment rates are missing
    const rateType = assignedGuide.rate_type || 'day';
    const rateAmount = assignedGuide.rate_amount ?? (
      rateType === 'hour' 
        ? assignedGuide.profile?.default_hour_rate 
        : assignedGuide.profile?.default_day_rate
    );
    
    return calcCost(rateAmount, rateType);
  }, [assignedGuide, durationHours, durationDays, guideCostOverride]);

  const internalCostTotal = useMemo(() => 
    internalCostDriver + internalCostGuide + internalCostVehicle,
    [internalCostDriver, internalCostGuide, internalCostVehicle]
  );

  const internalMargin = useMemo(() => {
    if (!booking) return 0;
    return (booking.total_amount || 0) - internalCostTotal;
  }, [booking, internalCostTotal]);

  const internalMarginPercent = useMemo(() => {
    if (!booking || !booking.total_amount) return 0;
    return (internalMargin / booking.total_amount) * 100;
  }, [booking, internalMargin]);

  const marginColorClass = useMemo(() => {
    if (internalMarginPercent > 30) return 'text-green-600';
    if (internalMarginPercent >= 10) return 'text-amber-600';
    return 'text-red-600';
  }, [internalMarginPercent]);

  // Reset overrides when resources change to ensure "auto-population" on new assignment
  useEffect(() => {
    setDriverCostOverride(null);
  }, [assignedDriver?.id]);

  useEffect(() => {
    setGuideCostOverride(null);
  }, [assignedGuide?.id]);

  useEffect(() => {
    setVehicleCostOverride(null);
  }, [booking?.vehicle_id]);

  const isOperatorOrAdmin = profile?.role === 'operator' || profile?.role === 'admin';
  const isAdmin = profile?.role === 'admin';

  const handleSaveCosts = async () => {
    if (!booking || !user) return;

    if (isDriverLocked || isGuideLocked || isVehicleLocked) {
      // We still allow saving if at least one is NOT locked, but the service might need to handle partial updates
      // For simplicity, let's just proceed, but the UI should have disabled the inputs for locked ones.
    }

    setSavingCosts(true);
    try {
      await updateBookingInternalCosts(booking.id, user.id, {
        vehicle: internalCostVehicle,
        driver: internalCostDriver,
        guide: internalCostGuide,
        total: internalCostTotal,
        margin: internalMargin
      });
      showNotice('success', 'Internal costs and margins saved successfully.');
      // Refresh booking to get updated values
      const updated = await getBookingById(booking.id, user.id);
      setBooking(updated);
    } catch (err: any) {
      console.error(err);
      showNotice('error', getFriendlyErrorMessage(err, 'Failed to save internal costs.'));
    } finally {
      setSavingCosts(false);
    }
  };

  const handleCreateRecurring = async () => {
    if (!id || !repeatConfig.startDate) return;
    if (repeatConfig.endCondition === 'endDate' && !repeatConfig.endDate) return;

    setCreatingRecurring(true);
    try {
      const result = await createRecurringBookings(id, {
        frequency: repeatConfig.frequency,
        startDate: repeatConfig.startDate,
        endCondition: repeatConfig.endCondition,
        repeatCount: repeatConfig.repeatCount,
        endDate: repeatConfig.endDate,
        includeResources: repeatConfig.includeResources
      });

      if (result.warnings && result.warnings.length > 0) {
        showNotice('error', "Recurring bookings were created, but some providers were not carried forward.");
      } else {
        showNotice('success', `Successfully created ${result.count} recurring bookings.`);
      }
      setShowRepeatModal(false);
      // Navigate to bookings list so they see the new draft bookings
      setTimeout(() => navigate('/operator/bookings'), 1500);
    } catch (e: any) {
      console.error(e);
      showNotice('error', e.message || 'Failed to create recurring bookings.');
    } finally {
      setCreatingRecurring(false);
    }
  };

  const handleDuplicateBooking = async () => {
    if (!id || !duplicateConfig.startDate || !duplicateConfig.endDate) {
      showNotice('error', 'Please select both start and end dates.');
      return;
    }

    setDuplicating(true);
    try {
      const { bookingId, warnings } = await createDuplicateBooking(id, {
        startDate: new Date(duplicateConfig.startDate).toISOString(),
        endDate: new Date(duplicateConfig.endDate).toISOString(),
        includeResources: duplicateConfig.includeResources
      });

      if (warnings && warnings.length > 0) {
        showNotice('error', warnings.join(' '));
      } else {
        showNotice('success', 'Draft booking created successfully.');
      }
      setShowDuplicateModal(false);
      // Navigate to the new booking
      navigate(`/operator/bookings/${bookingId}`);
    } catch (error: any) {
      console.error('Error duplicating booking:', error, error.message);
      showNotice('error', error.message || 'Failed to duplicate booking.');
    } finally {
      setDuplicating(false);
    }
  };

  const isVehicleAssigned = !!booking?.vehicle_id;
  const isDriverAccepted = assignedDriver?.status === 'accepted' || assignedDriver?.status === 'completed';
  const isGuideAccepted = assignedGuide?.status === 'accepted' || assignedGuide?.status === 'completed';
  const isReady = !!booking?.tour_id && !!booking?.start_date && !!booking?.end_date && (booking?.num_guests || 0) > 0 && !!booking?.guest_name && !!booking?.guest_email;
  
  const canReportNoShow = useMemo(() => {
    if (!booking) return false;
    const startTime = new Date(booking.start_date).getTime();
    const now = Date.now();
    // Allow reporting 5 mins before theoretical start to be safe for setup issues
    return now >= (startTime - 5 * 60 * 1000);
  }, [booking?.start_date]);

  const actualReleased = useMemo(() => {
    const sum = payoutLedgers
      .filter(l => l.status === 'paid')
      .reduce((sum, l) => sum + (l.adjusted_amount !== null && l.adjusted_amount !== undefined ? Number(l.adjusted_amount) : Number(l.amount_net || 0)), 0);
    return sum || booking?.funds_released_amount || 0;
  }, [payoutLedgers, booking?.funds_released_amount]);

  const fundsReceived = booking?.funds_received_amount || booking?.total_amount || 0;
  const remainingBalance = Math.max(0, fundsReceived - actualReleased);

  const pendingProviders = useMemo(() => {
    const pending = [];
    if (assignedDriver && assignedDriver.resource_id !== user?.id && ['pending', 'invited', 'requested'].includes((assignedDriver.status || '').toLowerCase())) {
      pending.push({ type: 'Driver', status: assignedDriver.status || 'pending' });
    }
    if (assignedGuide && assignedGuide.resource_id !== user?.id && ['pending', 'invited', 'requested'].includes((assignedGuide.status || '').toLowerCase())) {
      pending.push({ type: 'Guide', status: assignedGuide.status || 'pending' });
    }
    // Check vehicle assignment if it exists in assignments
    const vehicleAssignment = assignments.find(a => a.resource_type === 'vehicle');
    if (vehicleAssignment && vehicleAssignment.resource_id !== user?.id && ['pending', 'invited', 'requested'].includes((vehicleAssignment.status || '').toLowerCase())) {
      pending.push({ type: 'Vehicle', status: vehicleAssignment.status || 'pending' });
    }
    return pending;
  }, [assignedDriver, assignedGuide, assignments, user?.id]);

  const hasPendingProviders = pendingProviders.length > 0;
  const [showAcceptanceWarningModal, setShowAcceptanceWarningModal] = useState(false);
  const [showNoShowModal, setShowNoShowModal] = useState(false);
  const [noShowReason, setNoShowReason] = useState('');
  const [reportingNoShow, setReportingNoShow] = useState(false);

  const [showAssignmentNoShowModal, setShowAssignmentNoShowModal] = useState<{ id: string, type: string, name: string } | null>(null);
  const [assignmentNoShowReason, setAssignmentNoShowReason] = useState('');
  const [reportingAssignmentNoShow, setReportingAssignmentNoShow] = useState(false);

  const handleConfirmBooking = () => {
    if (hasPendingProviders) {
      setShowAcceptanceWarningModal(true);
    } else {
      handleStatusUpdate('confirmed');
    }
  };

  const showNotice = (type: 'success' | 'error', message: string) => {
    setNotice({ type, message });
    setTimeout(() => setNotice(null), 4000);
  };

  const getFriendlyErrorMessage = (error: any, fallback: string) => {
    const msg = error?.message || '';
    if (msg.includes('BOOKING_FINANCIALLY_LOCKED')) {
      return "This trip is locked because a payout has already been initiated or completed.";
    }
    if (msg.includes('PAYOUT_APPROVED')) {
      return "You cannot change this assignment because payout has already been approved.";
    }
    if (msg.includes('PAYOUT_PAID')) {
      return "You cannot change this assignment because payout has already been paid.";
    }
    if (msg.includes('completed') || msg.includes('stage')) {
      return "This assignment cannot be changed at this stage of the booking.";
    }
    if (msg.includes('CANNOT_ASSIGN_PROVIDER')) {
      if (fallback.toLowerCase().includes('driver')) {
        return "This driver cannot be assigned because required compliance checks are incomplete. Select another verified and compliant driver.";
      }
      if (fallback.toLowerCase().includes('guide')) {
        return "This guide cannot be assigned because required compliance checks are incomplete. Select another verified and compliant guide.";
      }
      return "This provider cannot be assigned because required compliance checks are incomplete. Select another verified and compliant provider.";
    }
    if (msg.includes('CANNOT_ASSIGN_VEHICLE') || msg.includes('VEHICLE_COMPLIANCE_ERROR')) {
      return "This vehicle cannot be assigned because the fleet owner’s required compliance checks are incomplete. Select another verified and compliant vehicle.";
    }
    if (msg.includes('already has an accepted or completed')) {
      const role = msg.includes('guide') ? 'guide' : msg.includes('driver') ? 'driver' : 'provider';
      return `This booking already has a ${role} assigned. Remove the current ${role} before assigning another one.`;
    }
    if (msg.includes('PROVIDER_CONFLICT')) {
      return "Provider cannot be assigned because they are already booked for this date range.";
    }
    if (msg.includes('VEHICLE_CONFLICT')) {
      return "Vehicle cannot be assigned because it is already booked for this date range.";
    }
    return fallback;
  };

  useEffect(() => {
    if (location.state?.successMessage) {
      showNotice('success', location.state.successMessage);
      // Clear state to prevent re-showing on refresh
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  useEffect(() => {
    const handleRefresh = (e?: any) => {
      loadAll();
    };

    window.addEventListener('ASSIGNMENTS_UPDATED', handleRefresh);
    return () => window.removeEventListener('ASSIGNMENTS_UPDATED', handleRefresh);
  }, [id, user]);


  const loadPayoutLedgers = async () => {
    if (!id) return;
    try {
      const [ledgers, disputesData] = await Promise.all([
        getPayoutLedgersForBooking(id),
        supabase.from('payout_disputes').select('*').eq('booking_id', id).eq('status', 'open')
      ]);
      setPayoutLedgers(ledgers);
      setDisputes(disputesData.data || []);
    } catch (e) {
      console.error("Failed to load payout ledgers", e);
    }
  };

  const [providersCompliant, setProvidersCompliant] = useState<boolean | null>(null);

  useEffect(() => {
    if (!booking) return;
    let isMounted = true;
    const checkCompliance = async () => {
      try {
        let isCompliant = true;
        if (assignedDriver) {
          const comp = await getProviderComplianceForOperator(assignedDriver.resource_id, 'driver');
          if (comp.status === 'non_compliant') isCompliant = false;
        }
        if (isCompliant && assignedGuide) {
          const comp = await getProviderComplianceForOperator(assignedGuide.resource_id, 'guide');
          if (comp.status === 'non_compliant') isCompliant = false;
        }
        if (isMounted) setProvidersCompliant(isCompliant);
      } catch (e) {
        if (isMounted) setProvidersCompliant(false);
      }
    };
    checkCompliance();
    return () => { isMounted = false; };
  }, [booking, assignedDriver, assignedGuide, selectedVehicleDetails]);

  const loadAll = async () => {
    if (!id || !user) return;
    setLoading(true);
    try {
      await Promise.all([
        loadBooking(), 
        loadAssignments(), 
        loadAuditLogs(), 
        loadPayoutLedgers(),
        loadFinancials(),
        loadReviews()
      ]);
    } catch (e: any) {
      console.error(e);
      showNotice('error', 'Failed to load booking details.');
    } finally {
      setLoading(false);
    }
  };

  const loadReviews = async () => {
    if (!id) return;
    try {
      // Need to find which providers are already reviewed
      const assignments_list = await getBookingAssignments(id);
      const reviewed = new Set<string>();
      
      for (const a of assignments_list) {
        const reviewed_exists = await hasReview(id, a.resource_id);
        if (reviewed_exists) reviewed.add(a.resource_id);
      }

      // Also check vehicle owner
      const { data: bData } = await supabase.from('bookings').select('vehicle_id').eq('id', id).single();
      if (bData?.vehicle_id) {
        const { data: vData } = await supabase.from('vehicles').select('owner_id').eq('id', bData.vehicle_id).single();
        if (vData?.owner_id) {
          const reviewed_exists = await hasReview(id, vData.owner_id);
          if (reviewed_exists) reviewed.add(vData.owner_id);
        }
      }

      setReviewedProviders(reviewed);
    } catch (e) {
      console.error("Failed to load reviews check", e);
    }
  };

  const loadFinancials = async () => {
    if (!id) return;
    try {
      const breakdown = await getBookingFinancialBreakdown(id as string);
      setFinancials(breakdown);
    } catch (e) {
      console.error('Failed to load financials:', e);
    }
  };

  useEffect(() => {
    const updateAutoRate = async () => {
      if (!vehicleRateOverridden && booking?.vehicle_id && user?.id) {
        try {
          const { effectiveRate, source } = await getEffectiveVehicleRateForBookingAssignment(
            user.id,
            booking.vehicle_id,
            vehicleRateType
          );
          setVehicleRateAmount(String(effectiveRate));
          setVehicleRateAutoSource(source);
        } catch (e) {
          console.error('Failed to update auto rate', e);
        }
      }
    };
    updateAutoRate();
  }, [vehicleRateOverridden, vehicleRateType, booking?.vehicle_id, user?.id]);

  const loadVehiclesForPicker = async () => {
    if (!user?.id || !booking) return;

    setLoadingVehicles(true);
    try {
      let list: Vehicle[] = [];
      if (vehicleTab === 'owned') {
        list = await getOperatorOwnedVehicles(user.id);
      } else {
        list = await getLinkedVehiclesForOperator(user.id);
      }

      if (list.length > 0) {
        const [blocks, conflicts, withCompliance] = await Promise.all([
          getVehicleAvailabilityBlocks(list.map(v => v.id), booking.start_date, booking.end_date),
          getVehicleBookingConflicts(list.map(v => v.id), booking.start_date, booking.end_date, booking.id),
          Promise.all(list.map(async (v) => {
  try {
    const { data, error } = await supabase.rpc('rpc_check_vehicle_assignment_compliance', {
      p_vehicle_id: v.id
    });

    if (error) throw error;

    const row = Array.isArray(data) ? data[0] : data;
    const blockers = row?.blockers || [];
    const warnings = row?.warnings || [];

    return {
      ...v,
      ownerCompliance: {
        status: row?.can_assign ? 'compliant' : 'non_compliant',
        issues: [
          ...blockers.map((message: string) => ({
            problem: 'missing',
            message,
            isRequired: true
          })),
          ...warnings.map((message: string) => ({
            problem: 'expiring_soon',
            message,
            isRequired: true
          }))
        ]
      }
    };
  } catch (e) {
    console.error("Failed to fetch vehicle compliance", e);
    return { ...v, ownerCompliance: null };
  }
}))
        ]);

        setAvailabilityBlocks(blocks || []);
        setBookingConflicts(conflicts || []);
        
        if (vehicleTab === 'owned') setOwnedVehicles(withCompliance);
        else setHiredVehicles(withCompliance);
      } else {
        setAvailabilityBlocks([]);
        setBookingConflicts([]);
        if (vehicleTab === 'owned') setOwnedVehicles([]);
        else setHiredVehicles([]);
      }
    } catch (err) {
      console.error("Failed to load vehicles for picker", err);
    } finally {
      setLoadingVehicles(false);
    }
  };

  useEffect(() => {
    if (showVehicleModal) {
      loadVehiclesForPicker();
    }
  }, [vehicleTab, showVehicleModal]);

  const loadSelectedVehicleDetails = async (vehicleId: string) => {
    if (!user?.id) return;
    try {
      const v = await getVehicleById(vehicleId);
      if (v) {
        const hired = Boolean(v.owner_id) && v.owner_id !== user.id;
        if (hired) {
          const negotiatedRes = await getEffectiveVehicleRateForBookingAssignment(user.id, v.id, vehicleRateType);
          v.effective_day_rate = negotiatedRes.source === 'negotiated' && vehicleRateType === 'day' ? negotiatedRes.effectiveRate : v.default_day_rate;
          v.effective_hour_rate = negotiatedRes.source === 'negotiated' && vehicleRateType === 'hour' ? negotiatedRes.effectiveRate : v.default_hour_rate;
          
          if (!vehicleRateOverridden) {
             setVehicleRateAutoSource(negotiatedRes.source);
          }
        } else {
          v.effective_day_rate = v.default_day_rate;
          v.effective_hour_rate = v.default_hour_rate;
          if (!vehicleRateOverridden) {
            setVehicleRateAutoSource('default');
          }
        }
      }
      setSelectedVehicleDetails(v);
    } catch (e) {
      console.error(e);
      setSelectedVehicleDetails(null);
    }
  };

  const allVehicles = useMemo(() => [...ownedVehicles, ...hiredVehicles], [ownedVehicles, hiredVehicles]);
  
  const listForTab = useMemo(() => {
    return vehicleTab === 'owned' ? ownedVehicles : hiredVehicles;
  }, [vehicleTab, ownedVehicles, hiredVehicles]);

  const visibleVehicles = useMemo(() => {
    const q = vehicleSearch.trim().toLowerCase();
    if (!q) return listForTab;
    return listForTab.filter(v => {
      const label = `${v.make} ${v.model} ${v.license_plate}`.toLowerCase();
      return label.includes(q);
    });
  }, [listForTab, vehicleSearch]);

  const getVehicleDefaultRate = (v: Vehicle, rt: 'day' | 'hour') => {
    if (rt === 'hour') {
      return v.effective_hour_rate ?? v.default_hour_rate;
    }
    return v.effective_day_rate ?? v.default_day_rate;
  };

  const pickVehicle = async (v: Vehicle) => {
    const isBlocked = availabilityBlocks.some(b => b.vehicle_id === v.id) || bookingConflicts.includes(v.id);
    if (isBlocked) return;

    if (!user) return;
    setSavingVehicle(true);

    try {
      const { effectiveRate, negotiated, source } = await getEffectiveVehicleRateForBookingAssignment(
        user.id,
        v.id,
        vehicleRateType
      );

      const enrichedVehicle = {
        ...v,
        effective_day_rate: vehicleRateType === 'day' ? effectiveRate : v.default_day_rate,
        effective_hour_rate: vehicleRateType === 'hour' ? effectiveRate : v.default_hour_rate,
      };

      setSelectedVehicleDetails(enrichedVehicle);
      setBooking(prev => (prev ? { ...prev, vehicle_id: v.id } : prev));
      
      if (!vehicleRateOverridden) {
        setVehicleRateAmount(String(effectiveRate));
        setVehicleRateAutoSource(source);
      }

      await saveVehicleToBooking(v.id, effectiveRate, negotiated);
      
      showNotice('success', `Vehicle assigned. Rate applied: R${effectiveRate} (${source === 'negotiated' ? 'Negotiated' : 'Default'})`);
      setShowVehicleModal(false);
    } catch (err: any) {
      console.error(err);
      showNotice('error', getFriendlyErrorMessage(err, 'Could not assign this vehicle to the selected booking. This booking may already have a vehicle assigned, or the vehicle may no longer be available.'));
    } finally {
      setSavingVehicle(false);
    }
  };

  const saveVehicleToBooking = async (vehicleId: string, resolvedAmount?: number, isNegotiated?: boolean) => {
    if (!booking || !user) return;

    if (booking.status === 'completed' || booking.status === 'cancelled') {
      throw new Error('Booking locked.');
    }

    // Final conflict check
    setSavingVehicle(true);
    try {
      const hasConflict = await checkVehicleConflicts(vehicleId, booking.start_date, booking.end_date, booking.id);
      if (hasConflict) {
        throw new Error('VEHICLE_CONFLICT: This vehicle is no longer available for the selected dates.');
      }

      const complianceCheck = await canAssignVehicle(vehicleId);
      if (!complianceCheck.canAssign) {
        throw new Error(`CANNOT_ASSIGN_VEHICLE: ${complianceCheck.blockers.join(', ')}`);
      }

      const selected = selectedVehicleDetails?.id === vehicleId ? selectedVehicleDetails : (allVehicles.find((v) => v.id === vehicleId) || null);

      if (!selected && resolvedAmount === undefined) {
        throw new Error('Selected vehicle data not found.');
      }

      let finalAmount: number | null = null;
      let finalOverridden = vehicleRateOverridden;

      if (resolvedAmount !== undefined) {
        finalAmount = resolvedAmount;
        // If it was resolved automatically (negotiated or default), it's NOT a manual override
        finalOverridden = false; 
      } else if (!vehicleRateOverridden) {
        if (!selected) return;
        finalAmount = getVehicleDefaultRate(selected, vehicleRateType);
        if (finalAmount === null || finalAmount <= 0) {
          throw new Error('Vehicle rate missing.');
        }
        // Reverting to auto
        finalOverridden = false;
      } else {
        const parsed = Number(vehicleRateAmount);
        if (!Number.isFinite(parsed) || parsed <= 0) {
          throw new Error('Invalid override rate amount.');
        }
        finalAmount = parsed;
        finalOverridden = true;
      }

      await updateBookingVehicleSnapshots(booking.id, user.id, {
        vehicleId,
        vehicleName: selected ? `${selected.make} ${selected.model} (${selected.license_plate})` : null,
        vehicleRateType,
        vehicleRateAmount: finalAmount,
        vehicleRateOverridden: finalOverridden
      });

      await loadAll();
    } catch (err: any) {
      console.error(err);
      throw err;
    } finally {
      setSavingVehicle(false);
    }
  };

  const handleUpdateTripInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!booking || !user) return;

    if (isTripInfoLocked) {
      setSavingTripInfo(true);
      try {
        await updateBookingInternalNotes(booking.id, editTripForm.internalNotes || null);
        await loadAll();
        setShowEditTripModal(false);
        showNotice('success', 'Internal notes updated successfully.');
      } catch (err: any) {
        showNotice('error', getFriendlyErrorMessage(err, 'Failed to update internal notes.'));
      } finally {
        setSavingTripInfo(false);
      }
      return;
    }

    // Validation
    if (!editTripForm.guestName || !editTripForm.guestEmail || !editTripForm.startDate || !editTripForm.endDate || editTripForm.numGuests < 1) {
      showNotice('error', 'All fields are required.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(editTripForm.guestEmail)) {
      showNotice('error', 'Invalid email format.');
      return;
    }

    const start = new Date(editTripForm.startDate);
    const end = new Date(editTripForm.endDate);
    if (end <= start) {
      showNotice('error', 'End date must be after start date.');
      return;
    }

    setSavingTripInfo(true);
    try {
      // Vehicle conflict check if dates changed and vehicle assigned
      const datesChanged = 
        new Date(booking.start_date).getTime() !== start.getTime() || 
        new Date(booking.end_date).getTime() !== end.getTime();

      if (datesChanged && booking.vehicle_id) {
        const hasConflict = await checkVehicleConflicts(
          booking.vehicle_id, 
          start.toISOString(), 
          end.toISOString(), 
          booking.id
        );
        if (hasConflict) {
          showNotice('error', 'The assigned vehicle has a conflict during the new dates.');
          setSavingTripInfo(false);
          return;
        }
      }

      const updateResult = await updateBookingTripInfo(booking.id, user.id, {
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        guestName: editTripForm.guestName,
        guestEmail: editTripForm.guestEmail,
        guestPhone: editTripForm.guestPhone ? editTripForm.guestPhone.trim() : null,
        numGuests: Number(editTripForm.numGuests),
        pickupLocation: editTripForm.pickupLocation || null,
        dropoffLocation: editTripForm.dropoffLocation || null,
        specialRequests: editTripForm.specialRequests || null,
        internalNotes: editTripForm.internalNotes || null
      });

      await loadAll();
      setShowEditTripModal(false);
      showNotice('success', 'Trip information updated successfully. Financials have been recalculated.');

      if (updateResult.escrowSyncResult?.wasFunded && updateResult.escrowSyncResult?.hasPaidPayouts && !updateResult.escrowSyncResult?.synced) {
        setTimeout(() => {
          showNotice('error', 'Booking total changed after payouts were released. Please review escrow reconciliation.');
        }, 1500);
      }

      // Warning if assignments exist and dates changed
      if (datesChanged && assignments.length > 0) {
        setTimeout(() => {
          showNotice('error', 'Dates changed. Please review existing driver/guide assignments manually.');
        }, 3000);
      }
    } catch (err: any) {
      console.error(err);
      showNotice('error', getFriendlyErrorMessage(err, 'Failed to update trip information.'));
    } finally {
      setSavingTripInfo(false);
    }
  };

  const handleRemoveVehicle = async () => {
    if (!booking || !user) return;
    
    if (isVehiclePaid(payoutLedgers, selectedVehicleDetails)) {
      showNotice('error', 'You cannot change this assignment because payout has already been paid.');
      return;
    }
    const isApproved = payoutLedgers.some(p => p.provider_id === selectedVehicleDetails?.owner_id && p.status === 'approved');
    if (isApproved) {
      showNotice('error', 'You cannot change this assignment because payout has already been approved.');
      return;
    }

    setSavingVehicle(true);
    try {
      await updateBookingVehicleSnapshots(booking.id, user.id, {
        vehicleId: null,
        vehicleRateType: null,
        vehicleRateAmount: null,
        vehicleRateOverridden: false
      });

      await loadAll();
      showNotice('success', 'Vehicle removed successfully.');
    } catch (err: any) {
      console.error(err);
      showNotice('error', getFriendlyErrorMessage(err, 'Failed to remove vehicle.'));
    } finally {
      setSavingVehicle(false);
    }
  };

  const openResourceModal = (type: 'driver' | 'guide' | 'vehicle', action: 'add' | 'replace') => {
    if (action === 'replace') {
      const ownerId = type === 'vehicle' ? selectedVehicleDetails?.owner_id : (type === 'driver' ? assignedDriver?.resource_id : assignedGuide?.resource_id);
      const payout = payoutLedgers.find(p => p.provider_id === ownerId);
      
      if (payout?.status === 'paid') {
        showNotice('error', 'You cannot change this assignment because payout has already been paid.');
        return;
      }
      if (payout?.status === 'approved') {
        showNotice('error', 'You cannot change this assignment because payout has already been approved.');
        return;
      }
    }
    setResourceModal({ isOpen: true, type, action });
  };

  const handleUseAcceptedRequest = async (type: 'driver' | 'guide' | 'vehicle') => {
    if (!user || !booking) return;
    setResourceModal(null);
    setAcceptedRequestsModal({ isOpen: true, type, requests: [], loading: true });
    try {
      let reqs: any[] = [];
      if (type === 'driver') {
        reqs = await listDriverAvailabilityRequestsForOperator(user.id);
      } else if (type === 'guide') {
        reqs = await listGuideAvailabilityRequestsForOperator(user.id);
      } else if (type === 'vehicle') {
        reqs = await listVehicleAvailabilityRequestsForOperator(user.id);
      }
      
      const filtered = reqs.filter(r => {
        if (r.status !== 'accepted') return false;
        
        // The only exclusion rule: exclude the resource that is currently assigned on the live booking state
        if (type === 'driver') return r.driver_id !== assignedDriver?.resource_id;
        if (type === 'guide') return r.guide_id !== assignedGuide?.resource_id;
        if (type === 'vehicle') return r.vehicle_id !== booking.vehicle_id;
        
        return true;
      });
      
      setAcceptedRequestsModal({ isOpen: true, type, requests: filtered, loading: false });
    } catch (e) {
      console.error(e);
      showNotice('error', 'Failed to load requests');
      setAcceptedRequestsModal(null);
    }
  };

  const handleAssignFromRequest = async (req: any) => {
    if (!booking || !user || !acceptedRequestsModal) return;
    const type = acceptedRequestsModal.type;
    
    try {
      if (type === 'driver') {
        await assignDriver(booking.id, req.driver_id, { rateType: 'day', rateAmount: null, rateOverridden: false });
        await markDriverRequestConverted(req.id, booking.id);
      } else if (type === 'guide') {
        await assignGuide(booking.id, req.guide_id, { rateType: 'day', rateAmount: null, rateOverridden: false });
        await markGuideRequestConverted(req.id, booking.id);
      } else if (type === 'vehicle') {
        const { effectiveRate, negotiated } = await getEffectiveVehicleRateForBookingAssignment(
          user.id,
          req.vehicle_id,
          'day'
        );
        await saveVehicleToBooking(req.vehicle_id, effectiveRate, negotiated);
        await markVehicleRequestConverted(req.id, booking.id);
      }
      
      // Verification step as requested
      if (type === 'vehicle') {
        const fresh = await loadBooking();
        if (!fresh?.vehicle_id || fresh.vehicle_id !== req.vehicle_id) {
          throw new Error(`Verification failed: Vehicle was not correctly assigned.`);
        }
      } else {
        await loadAssignments();
        // For drivers/guides, we'd need to check the list, but loadAssignments updates state
        // We'll trust the throw from assigning functions for now, but following the refetch pattern
      }

      showNotice('success', `${type} assigned successfully from request.`);
      setAcceptedRequestsModal(null);
    } catch (e: any) {
      console.error(e);
      showNotice('error', getFriendlyErrorMessage(e, `Could not assign this ${type} to the selected booking. This booking may already have a ${type} assigned for this role, or the ${type} may no longer be available.`));
    }
  };

  const timelineEvents = useMemo(() => {
    const events: { type: string; label: string; timestamp: string; note?: string; source?: string; avatar?: string; initials?: string; colorClass?: string }[] = [];

    const getProviderName = (metadata: any, log?: any) => {
      let name = metadata?.provider_name || 
             metadata?.providerName || 
             metadata?.name || 
             metadata?.full_name || 
             metadata?.provider?.company_name || 
             metadata?.provider?.full_name || 
             '';
      
      // Try matching against current assignments if name not in metadata
      if (!name && log) {
        const resourceId = log.metadata?.provider_id || log.metadata?.resource_id || log.entity_id;
        if (resourceId) {
          const match = assignments.find(a => a.resource_id === resourceId || a.id === resourceId);
          if (match && match.profile) {
             name = (match.profile as any)?.company_name || match.profile?.full_name || '';
          }
        }
      }
      return name;
    };

    const getProviderRoleLabel = (metadata: any, log?: any) => {
      let rawRole = metadata?.provider_type || 
                      metadata?.providerType || 
                      metadata?.role || 
                      metadata?.assignment_type || 
                      '';
      
      // Try matching against current assignments if role not in metadata
      if (!rawRole && log) {
        const resourceId = log.metadata?.provider_id || log.metadata?.resource_id || log.entity_id;
        if (resourceId) {
          const match = assignments.find(a => a.resource_id === resourceId || a.id === resourceId);
          if (match) {
            rawRole = match.resource_type;
          }
        }
      }

      const map: Record<string, string> = {
        'driver': 'Driver',
        'guide': 'Guide',
        'vehicle_owner': 'Vehicle Owner',
        'vehicle': 'Vehicle'
      };
      
      return map[String(rawRole).toLowerCase()] || 'Provider';
    };

    const getSourceLabel = (actorRole: string) => {
      const role = String(actorRole || '').toLowerCase();
      if (['provider', 'driver', 'guide', 'vehicle_owner'].includes(role)) return 'PROVIDER';
      if (role === 'operator') return 'OPERATOR';
      if (role === 'admin') return 'ADMIN';
      return 'SYSTEM';
    };

    // Status History
    statusHistory.forEach(h => {
      events.push({
        type: 'status',
        label: `Booking status: ${h.old_status} → ${h.new_status}`,
        timestamp: h.created_at,
        note: h.note,
        source: getSourceLabel(h.source || 'operator')
      });
    });

    // Tracking which resource_id + type + action has audit logs to avoid duplicate entries with fallback
    const handledResourceActions = new Set<string>();

    // Audit Logs (Primary source for history)
    auditLogs.forEach(log => {
      if (log.action === 'BOOKING_VEHICLE_SNAPSHOT_UPDATED') {
        const vehicleName = log.metadata?.vehicle_name;
        events.push({
          type: 'vehicle',
          label: log.metadata?.vehicle_id ? (vehicleName ? `Vehicle assigned: ${vehicleName}` : 'Vehicle assigned/updated') : 'Vehicle removed',
          timestamp: log.created_at,
          source: getSourceLabel(log.actor_role)
        });
      } else if (log.action === 'BOOKING_TRIP_INFO_UPDATED') {
        events.push({
          type: 'info',
          label: 'Trip info updated',
          timestamp: log.created_at,
          source: getSourceLabel(log.actor_role)
        });
      } else if (log.action.startsWith('ASSIGNMENT_')) {
        const roleLabel = getProviderRoleLabel(log.metadata, log);
        const name = getProviderName(log.metadata, log);
        const nameSuffix = name ? `: ${name}` : '';
        const resourceId = log.metadata?.provider_id || log.metadata?.resource_id || log.entity_id;
        const rawRole = log.metadata?.provider_type || log.metadata?.role || 'provider';
        
        if (resourceId) {
          const actionKey = log.action.replace('ASSIGNMENT_', '').toLowerCase();
          handledResourceActions.add(`${resourceId}_${rawRole}_${actionKey}`);
          // Support older audit log mappings
          if (actionKey === 'declined') handledResourceActions.add(`${resourceId}_${rawRole}_rejected`);
          if (actionKey === 'rejected') handledResourceActions.add(`${resourceId}_${rawRole}_declined`);
          // Mark as "sent" if we have any assignment activity to avoid duplicate "assigned" fallbacks
          handledResourceActions.add(`${resourceId}_${rawRole}_sent`);
        }

        let label = '';
        let colorClass = '';

        switch (log.action) {
          case 'ASSIGNMENT_SENT':
            label = `${roleLabel} assignment sent${nameSuffix}`;
            break;
          case 'ASSIGNMENT_ACCEPTED':
            label = `${roleLabel} accepted assignment${nameSuffix}`;
            colorClass = 'text-green-600';
            break;
          case 'ASSIGNMENT_REJECTED':
          case 'ASSIGNMENT_DECLINED':
            label = `${roleLabel} declined assignment${nameSuffix}`;
            colorClass = 'text-red-600';
            break;
          case 'ASSIGNMENT_REMOVED':
            label = `${roleLabel} removed from booking${nameSuffix}`;
            colorClass = 'text-amber-600';
            break;
          case 'ASSIGNMENT_REPLACED':
            label = `${roleLabel} replaced${nameSuffix}`;
            colorClass = 'text-amber-600';
            break;
          case 'ASSIGNMENT_COMPLETED':
            label = `${roleLabel} assignment completed${nameSuffix}`;
            colorClass = 'text-green-600';
            break;
        case 'ASSIGNMENT_NO_SHOW':
            label = `${roleLabel} reported no-show${nameSuffix}`;
            colorClass = 'text-red-700';
            break;
          default:
            // Fallback for any other assignment action
            label = `${roleLabel} ${log.action.toLowerCase().replace('_', ' ')}${nameSuffix}`;
        }

        if (label) {
          events.push({
            type: 'assignment',
            label,
            timestamp: log.created_at,
            source: getSourceLabel(log.actor_role),
            colorClass
          });
        }
      }
    });

    // Fallback Assignments (Reliability layer for missing audit logs)
    assignments.forEach(a => {
      const role = a.resource_type;
      const resourceId = a.resource_id;
      
      const roleLabel = role.charAt(0).toUpperCase() + role.slice(1).replace('_', ' ');
      const name = (a.profile as any)?.company_name || a.profile?.full_name || '';
      const nameSuffix = name ? `: ${name}` : '';
      
      // 1. "Assigned" event fallback
      if (a.updated_at && !handledResourceActions.has(`${resourceId}_${role}_sent`)) {
        events.push({
          type: 'assignment',
          label: `${roleLabel} assigned${nameSuffix}`,
          timestamp: a.updated_at,
          source: 'OPERATOR',
          avatar: a.profile?.avatar_url || a.profile?.profile_image_url || undefined,
          initials: a.profile?.full_name?.charAt(0)
        });
      }

      // 2. Status event fallback (Accepted/Declined/Completed)
      if (a.updated_at && a.status && a.status !== 'pending') {
        const actionKey = a.status === 'rejected' ? 'declined' : a.status;
        const alternateKey = a.status === 'rejected' ? 'rejected' : a.status;

        if (!handledResourceActions.has(`${resourceId}_${role}_${actionKey}`) && 
            !handledResourceActions.has(`${resourceId}_${role}_${alternateKey}`)) {
          
          let label = '';
          let colorClass = '';
          if (a.status === 'accepted') {
            label = `${roleLabel} accepted assignment${nameSuffix}`;
            colorClass = 'text-green-600';
          } else if (a.status === 'rejected') {
            label = `${roleLabel} declined assignment${nameSuffix}`;
            colorClass = 'text-red-600';
          } else if (a.status === 'completed') {
            label = `${roleLabel} assignment completed${nameSuffix}`;
            colorClass = 'text-green-600';
          }

          if (label) {
            events.push({
              type: 'assignment',
              label,
              timestamp: a.updated_at,
              source: a.status === 'rejected' ? 'PROVIDER' : (a.status === 'accepted' ? 'PROVIDER' : 'SYSTEM'),
              avatar: a.profile?.avatar_url || a.profile?.profile_image_url || undefined,
              initials: a.profile?.full_name?.charAt(0),
              colorClass
            });
          }
        }
      }
    });

    return events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [statusHistory, assignments, auditLogs]);


  const fetchAuditLogsForBooking = async (bookingId: string) => {
    try {
      const rows = await fetchAuditLogsByBookingId(bookingId);
      return rows;
    } catch (error) {
      console.error(`Error fetching audit logs for booking:${bookingId}:`, error);
      throw error;
    }
  };

  const loadStatusHistory = async (bookingId: string) => {
    setStatusHistoryLoading(true);
    setStatusHistoryError(false);
    try {
      const [history, logs] = await Promise.all([
        getBookingStatusHistory(bookingId),
        fetchAuditLogsForBooking(bookingId)
      ]);
      setStatusHistory(history);
      setAuditLogs(logs);
    } catch (e) {
      console.error("Failed to load timeline data", e);
      setStatusHistoryError(true);
    } finally {
      setStatusHistoryLoading(false);
    }
  };

  const loadAuditLogs = async () => {
    if (!id) return;
    try {
      const logs = await fetchAuditLogsForBooking(id);
      setAuditLogs(logs);
    } catch (e) {
      console.error("Failed to load audit logs", e);
    }
  };

  const loadBooking = async () => {
    if (!id || !user) return;
    try {
      const data = await getBookingById(id, user.id);
      setBooking(data);
      void loadStatusHistory(id);
      return data;
    } catch (e: any) {
      console.error(e);
      showNotice('error', 'Could not load booking.');
      return null;
    }
  };

  const loadAssignments = async () => {
    if (!id) return;
    try {
      const data = await getBookingAssignments(id);
      setAssignments(data);

      const currentDriver = getCurrentAssignment(data, 'driver');
      const currentGuide = getCurrentAssignment(data, 'guide');

      const cDStatus = currentDriver?.status || null;
      const cGStatus = currentGuide?.status || null;

      // Notification check
      // NotificationBell handles these events via custom events now

      prevDriverStatusRef.current = cDStatus;
      prevGuideStatusRef.current = cGStatus;
    } catch (e: any) {
      console.error(e);
    }
  };

  const handleDriverSearch = async () => {
    if (!driverSearchQuery.trim() || !booking) return;
    setLoadingDrivers(true);
    try {
      const results = await searchDrivers(driverSearchQuery);
      
      const withInfo = await Promise.all(results.map(async (p) => {
        try {
          const [compliance, hasConflict, assignmentCheck, ratingSummary] = await Promise.all([
            getProviderComplianceForOperator(p.id, 'driver'),
            checkProviderConflicts(p.id, booking.start_date, booking.end_date, booking.id),
            canAssignProvider(p.id, 'driver'),
            getProviderRatingSummary(p.id)
          ]);
          return { ...p, compliance, hasConflict, assignmentCheck, ratingSummary };
        } catch (e: any) {
          console.error("Provider info fetch failed", e);
          return { 
            ...p, 
            compliance: null, 
            hasConflict: false, 
            assignmentCheck: { 
              canAssign: false, 
              blockers: [e.message.includes('verify') ? e.message : "Error verifying compliance"] 
            } 
          };
        }
      }));

      setFoundDrivers(withInfo);
      setHasSearchedDrivers(true);
    } catch (e) {
      showNotice('error', 'Your search could not be completed. Please check your filters and try again.');
    } finally {
      setLoadingDrivers(false);
    }
  };

  const handleGuideSearch = async () => {
    if (!guideSearchQuery.trim() || !booking) return;
    setLoadingGuides(true);
    try {
      const results = await searchGuides(guideSearchQuery);

      const withInfo = await Promise.all(results.map(async (p) => {
        try {
          const [compliance, hasConflict, assignmentCheck, ratingSummary] = await Promise.all([
            getProviderComplianceForOperator(p.id, 'guide'),
            checkProviderConflicts(p.id, booking.start_date, booking.end_date, booking.id),
            canAssignProvider(p.id, 'guide'),
            getProviderRatingSummary(p.id)
          ]);
          return { ...p, compliance, hasConflict, assignmentCheck, ratingSummary };
        } catch (e: any) {
          console.error("Provider info fetch failed", e);
          return { 
            ...p, 
            compliance: null, 
            hasConflict: false, 
            assignmentCheck: { 
              canAssign: false, 
              blockers: [e.message.includes('verify') ? e.message : "Error verifying compliance"] 
            } 
          };
        }
      }));

      setFoundGuides(withInfo);
      setHasSearchedGuides(true);
    } catch (e) {
      showNotice('error', 'Your search could not be completed. Please check your filters and try again.');
    } finally {
      setLoadingGuides(false);
    }
  };

  const handleFinalAssign = async () => {
    if (!id || !configuringProvider || !user) return;

    const amount = parseFloat(rateAmount);
    if (isNaN(amount) || amount <= 0) {
      showNotice('error', 'Invalid rate amount.');
      return;
    }

    const opts = { rateType, rateAmount: amount, rateOverridden: isRateOverridden };
    const assignFunc = configuringProvider.type === 'driver' ? assignDriver : assignGuide;

    if (configuringProvider.type === 'driver') setAssigningDriverId(configuringProvider.profile.id);
    else setAssigningGuideId(configuringProvider.profile.id);

    try {
      await assignFunc(id, configuringProvider.profile.id, opts);
      setConfiguringProvider(null);
      await loadAll();
      showNotice('success', 'Assignment successful');
    } catch (e: any) {
      console.error(e);
      showNotice('error', getFriendlyErrorMessage(e, `Could not assign this ${configuringProvider.type} to the selected booking. This booking may already have a ${configuringProvider.type} assigned for this role, or the ${configuringProvider.type} may no longer be available.`));
    } finally {
      setAssigningDriverId(null);
      setAssigningGuideId(null);
    }
  };

  const handleRemoveAssignment = async (assignmentId: string, role: 'driver' | 'guide') => {
    try {
      await cancelAssignmentByOperator(assignmentId);
      await loadAll();
      showNotice('success', `${role.charAt(0).toUpperCase() + role.slice(1)} assignment removed`);
    } catch (e: any) {
      console.error(e);
      showNotice('error', getFriendlyErrorMessage(e, `Failed to remove ${role} assignment`));
    }
  };

  const handleReplaceAssignment = async (assignmentId: string, role: 'driver' | 'guide') => {
    try {
      await cancelAssignmentByOperator(assignmentId, true);
      await loadAll();
      openResourceModal(role, 'replace');
    } catch (e: any) {
      console.error(e);
      showNotice('error', getFriendlyErrorMessage(e, `Failed to replace ${role} assignment`));
    }
  };

  const handleReportNoShow = async () => {
    if (!booking || reportingNoShow) return;
    setReportingNoShow(true);
    try {
      await markBookingNoShow(booking.id, noShowReason);
      setShowNoShowModal(false);
      setNoShowReason('');
      showNotice('success', 'Booking marked as no-show successfully.');
      await loadAll();
    } catch (e: any) {
      showNotice('error', getFriendlyErrorMessage(e, 'Failed to report no-show.'));
    } finally {
      setReportingNoShow(false);
    }
  };

  const handleReportAssignmentNoShow = async () => {
    if (!showAssignmentNoShowModal || reportingAssignmentNoShow) return;
    setReportingAssignmentNoShow(true);
    
    try {
      await markAssignmentNoShow(showAssignmentNoShowModal.id, assignmentNoShowReason);
      setShowAssignmentNoShowModal(null);
      setAssignmentNoShowReason('');
      showNotice('success', `${showAssignmentNoShowModal.type.charAt(0).toUpperCase() + showAssignmentNoShowModal.type.slice(1)} marked as no-show.`);
      await loadAll();
    } catch (e: any) {
      showNotice('error', getFriendlyErrorMessage(e, 'Failed to report no-show.'));
    } finally {
      setReportingAssignmentNoShow(false);
    }
  };

  const handleStatusUpdate = async (newStatus: BookingStatus) => {
    if (!booking || !user) return;
    try {
      if (newStatus === 'completed') {
        // Block completion if required providers haven't accepted or have declined
        const missingAcceptance = [];
        const declined = [];
        
        if (assignedDriver) {
          if (assignedDriver.status === 'rejected') declined.push('Driver');
          else if (!['accepted', 'completed'].includes(assignedDriver.status || '')) missingAcceptance.push('Driver');
        }
        if (assignedGuide) {
          if (assignedGuide.status === 'rejected') declined.push('Guide');
          else if (!['accepted', 'completed'].includes(assignedGuide.status || '')) missingAcceptance.push('Guide');
        }

        if (declined.length > 0) {
          showNotice('error', `Booking cannot be completed because the assigned ${declined.join('/')} declined the assignment. Please replace or remove the provider.`);
          return;
        }

        if (missingAcceptance.length > 0) {
          showNotice('error', `Booking cannot be completed yet. The following assigned providers have not accepted their assignment: ${missingAcceptance.join(', ')}. Please wait for acceptance or replace the provider.`);
          return;
        }

        // Safety check: Ensure all assigned providers have a resolvable payout amount
        const unresolvable = [];
        
        // Check Driver
        if (assignedDriver && assignedDriver.status === 'accepted') {
          const rate = assignedDriver.rate_amount || (assignedDriver.profile as any)?.default_day_rate || (assignedDriver.profile as any)?.default_hour_rate;
          if (!rate && !assignedDriver.cost_total) unresolvable.push('Driver');
        }
        
        // Check Guide
        if (assignedGuide && assignedGuide.status === 'accepted') {
          const rate = assignedGuide.rate_amount || (assignedGuide.profile as any)?.default_day_rate || (assignedGuide.profile as any)?.default_hour_rate;
          if (!rate && !assignedGuide.cost_total) unresolvable.push('Guide');
        }
        
        // Check Vehicle
        if (booking.vehicle_id) {
          if (!booking.vehicle_rate_amount) unresolvable.push('Vehicle');
        }

        if (unresolvable.length > 0) {
          showNotice('error', `Cannot complete booking. Missing payout rates for: ${unresolvable.join(', ')}. Please set internal costs first.`);
          return;
        }

        // 1. Save final internal costs before completing
        await updateBookingInternalCosts(booking.id, booking.operator_id || user.id, {
          vehicle: internalCostVehicle,
          driver: internalCostDriver,
          guide: internalCostGuide,
          total: internalCostTotal,
          margin: internalMargin
        });
        // 2. Complete booking (which triggers payout creation)
        await completeBooking(booking.id);
      } else if (newStatus === 'cancelled') {
        const reason = window.prompt("Reason for cancellation (optional):") || "";
        await cancelBooking(booking.id, reason);
      } else if (newStatus === 'no_show') {
        setShowNoShowModal(true);
        return;
      } else {
        await updateBookingStatus(booking.id, newStatus, user.id, 'operator_dashboard');
      }

      await loadAll();
      showNotice('success', `Booking marked as ${newStatus}`);
    } catch (e: any) {
      console.error(e);
      showNotice('error', e?.message || 'Update failed.');
    }
  };

  const handleArchiveToggle = () => {
    if (!booking) return;
    if (booking.archived_at) {
      setShowUnarchiveConfirmModal(true);
    } else {
      setShowArchiveConfirmModal(true);
    }
  };

  const confirmArchive = async () => {
    if (!booking || !user) return;
    setIsArchiveProcessing(true);
    try {
      await archiveBookingRpc(booking.id);
      await loadAll();
      showNotice('success', 'Booking archived successfully.');
      setShowArchiveConfirmModal(false);
    } catch (e: any) {
      console.error(e);
      showNotice('error', e?.message || 'Archive operation failed.');
    } finally {
      setIsArchiveProcessing(false);
    }
  };

  const confirmUnarchive = async () => {
    if (!booking || !user) return;
    setIsArchiveProcessing(true);
    try {
      await unarchiveBookingRpc(booking.id);
      await loadAll();
      showNotice('success', 'Booking restored successfully.');
      setShowUnarchiveConfirmModal(false);
    } catch (e: any) {
      console.error(e);
      showNotice('error', e?.message || 'Restore operation failed.');
    } finally {
      setIsArchiveProcessing(false);
    }
  };

  const hasPayoutHolds = useMemo(() => {
    return payoutLedgers.some(p => p.is_on_hold) || disputes.length > 0;
  }, [payoutLedgers, disputes]);

  const onHoldPayouts = useMemo(() => {
    const holds: string[] = [];
    const dp = payoutLedgers.find(p => p.payout_reference?.includes('-DRIVER'));
    const gp = payoutLedgers.find(p => p.payout_reference?.includes('-GUIDE'));
    const vp = payoutLedgers.find(p => p.payout_reference?.includes('-VEHICLE'));

    const drvName = assignedDriver?.profile?.full_name || 'Driver';
    const guiName = assignedGuide?.profile?.full_name || 'Guide';
    const vehName = selectedVehicleDetails?.make ? `${selectedVehicleDetails.make} ${selectedVehicleDetails.model}` : 'Vehicle';

    const getReasonText = (payout: any) => {
      const dispute = disputes.find(d => d.payout_id === payout.id && d.status === 'open');
      if (dispute) return dispute.reason;
      if (payout.hold_reason && payout.hold_reason !== 'dispute') return payout.hold_reason;
      return 'Under review';
    };

    if (dp?.is_on_hold) {
      holds.push(`${drvName} ${dp.hold_reason === 'dispute' ? 'payout dispute' : 'payout on hold'}: ${getReasonText(dp)}`);
    }
    if (gp?.is_on_hold) {
      holds.push(`${guiName} ${gp.hold_reason === 'dispute' ? 'payout dispute' : 'payout on hold'}: ${getReasonText(gp)}`);
    }
    if (vp?.is_on_hold) {
      holds.push(`${vehName} ${vp.hold_reason === 'dispute' ? 'payout dispute' : 'payout on hold'}: ${getReasonText(vp)}`);
    }
    
    // Check disputes for any we missed
    disputes.forEach(d => {
      const isDrv = d.payout_id === dp?.id;
      const isGui = d.payout_id === gp?.id;
      const isVeh = d.payout_id === vp?.id;
      
      const typeName = isDrv ? drvName : isGui ? guiName : isVeh ? vehName : 'Other';
      if (!holds.some(h => h.includes(typeName))) {
        holds.push(`${typeName} payout dispute: ${d.reason || 'Under review'}`);
      }
    });

    return holds;
  }, [payoutLedgers, disputes, assignedDriver, assignedGuide, selectedVehicleDetails]);

  const pendingReviewsList = useMemo(() => {
    const list = [];
    if (booking?.status === 'completed') {
      if (assignedDriver && (driverPayout?.status === 'paid' || isFinanciallyLocked) && !reviewedProviders.has(assignedDriver.resource_id)) {
        list.push({
          roleDisplay: 'Driver',
          role: 'driver' as const,
          id: assignedDriver.resource_id,
          name: assignedDriver.profile?.full_name || 'Driver'
        });
      }
      if (assignedGuide && (guidePayout?.status === 'paid' || isFinanciallyLocked) && !reviewedProviders.has(assignedGuide.resource_id)) {
        list.push({
          roleDisplay: 'Guide',
          role: 'guide' as const,
          id: assignedGuide.resource_id,
          name: assignedGuide.profile?.full_name || 'Guide'
        });
      }
      if (selectedVehicleDetails?.owner_id && selectedVehicleDetails.owner_id !== user?.id && booking?.status === 'completed' && !reviewedProviders.has(selectedVehicleDetails.owner_id)) {
        list.push({
          roleDisplay: 'Vehicle Owner',
          role: 'vehicle_owner' as const,
          id: selectedVehicleDetails.owner_id,
          name: selectedVehicleDetails.profiles?.company_name || selectedVehicleDetails.profiles?.full_name || 'Vehicle Owner'
        });
      }
    }
    return list;
  }, [booking?.status, assignedDriver, driverPayout?.status, isFinanciallyLocked, reviewedProviders, assignedGuide, guidePayout?.status, selectedVehicleDetails, vehiclePayout?.status, user?.id]);

  if (loading) return <div className="p-12 text-center flex flex-col items-center gap-4"><Loader2 className="animate-spin text-brand-teal" size={32} /> Loading booking...</div>;
  if (!booking) return <div className="p-12 text-center text-gray-500">Booking not found.</div>;

  const handleUpdatePayoutStatus = async (payoutLedgerId: string, status: 'approved' | 'paid', resource: 'driver' | 'guide' | 'vehicle') => {
    if (!booking) return;
    if (!isAdmin) {
      showNotice('error', 'Only administrators can update payout statuses.');
      return;
    }
    
    setUpdatingPayout(resource);
    try {
      const updated = await updatePayoutStatus(payoutLedgerId, status, booking.operator_id);
      if (!updated) {
        throw new Error("Payout status update failed. No data returned.");
      }
      await Promise.all([loadPayoutLedgers(), loadBooking(), loadFinancials()]);
      showNotice('success', `Payout ${status} successfully.`);
    } catch (err: any) {
      if (err.message === 'PAYOUT_PAID') {
        await Promise.all([loadPayoutLedgers(), loadBooking(), loadFinancials()]);
        showNotice('success', 'Payout already marked as paid.');
        return;
      }
      console.error(err);
      showNotice('error', err.message || `Failed to ${status} payout.`);
    } finally {
      setUpdatingPayout(null);
    }
  };

  const handleRegeneratePayouts = async () => {
    if (!id) return;
    setUpdatingPayout('driver'); // Use 'driver' as a generic loading state for the whole card
    try {
      await createPayoutLedgerForBooking(id);
      await loadPayoutLedgers();
      showNotice('success', 'Payout records regenerated successfully.');
    } catch (err: any) {
      console.error(err);
      showNotice('error', err.message || 'Failed to regenerate payouts');
    } finally {
      setUpdatingPayout(null);
    }
  };

  const handleRaiseDispute = async () => {
    if (!disputeModal || !disputeReason.trim() || !booking || !user) return;

    setRaisingDispute(true);
    try {
      const payout = payoutLedgers.find(p => p.id === disputeModal.payoutId);
      if (!payout) throw new Error("Payout not found");

      await raisePayoutDispute({
        payout_id: disputeModal.payoutId,
        booking_id: booking.id,
        provider_id: payout.provider_id,
        operator_id: booking.operator_id || user.id,
        reason: disputeReason,
        created_by: user.id
      });

      showNotice('success', 'Dispute raised and payout placed on hold.');
      setDisputeModal(null);
      setDisputeReason('');
      await loadPayoutLedgers();
    } catch (err: any) {
      console.error(err);
      showNotice('error', err.message || 'Failed to raise dispute.');
    } finally {
      setRaisingDispute(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto pb-12">
      {hasPayoutHolds && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-6 py-4 mb-6 flex items-start gap-4 text-red-800 shadow-sm">
          <div className="p-2 bg-red-100 rounded-full shrink-0">
            <AlertTriangle size={20} className="text-red-600" />
          </div>
          <div className="flex-1">
            <p className="font-bold text-sm">Payout dispute in progress</p>
            <p className="text-xs opacity-90 mb-2">
              One or more payouts for this booking are currently on hold and under review.
            </p>
            <ul className="text-[10px] font-bold uppercase tracking-wider space-y-1">
              {onHoldPayouts.map((hold, idx) => (
                <li key={idx} className="flex items-center gap-1.5">
                  <span className="w-1 h-1 bg-red-400 rounded-full"></span>
                  {hold}
                </li>
              ))}
            </ul>
          </div>
          <Link 
            to={`/contact?topic=booking&ref=${booking?.booking_reference}`} 
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg transition-colors whitespace-nowrap self-center"
          >
            Contact Support
          </Link>
        </div>
      )}
      {isFinanciallyLocked && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-6 py-4 mb-6 flex items-center gap-4 text-amber-800 shadow-sm">
          <div className="p-2 bg-amber-100 rounded-full">
            <Lock size={20} className="text-amber-600" />
          </div>
          <div>
            <p className="font-bold text-sm">Financial Lock Active</p>
            <p className="text-xs opacity-90">
              At least one payout for this booking has been marked as <span className="font-bold uppercase">Paid</span>. 
              Costs, rates, and assignments are now read-only to maintain financial integrity.
            </p>
          </div>
        </div>
      )}
      {notice && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[60] px-6 py-3 rounded-lg shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-4 duration-300 ${notice.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
          {notice.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          <span className="font-bold">{notice.message}</span>
        </div>
      )}

      {resourceModal?.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-brand-charcoal capitalize">
                {resourceModal.action} {resourceModal.type}
              </h3>
              <button onClick={() => setResourceModal(null)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <button
                onClick={() => handleUseAcceptedRequest(resourceModal.type)}
                className="w-full p-4 border-2 border-gray-100 rounded-xl hover:border-brand-teal hover:bg-brand-teal/5 transition-all flex items-center gap-4 text-left group"
              >
                <div className="p-3 bg-brand-teal/10 rounded-lg text-brand-teal group-hover:bg-brand-teal group-hover:text-white transition-colors">
                  <CheckCircle2 size={24} />
                </div>
                <div>
                  <p className="font-bold text-brand-charcoal">Convert Request to Assignment</p>
                  <p className="text-xs text-gray-500">Accepted requests confirm provider interest or availability. Converting one sends a formal assignment for the provider to accept.</p>
                </div>
              </button>

              <button
                onClick={() => {
                  setResourceModal(null);
                  navigate('/operator/directory', {
                    state: {
                      tab: resourceModal.type,
                      bookingId: booking?.id,
                      startDate: booking?.start_date,
                      endDate: booking?.end_date
                    }
                  });
                }}
                className="w-full p-4 border-2 border-gray-100 rounded-xl hover:border-brand-teal hover:bg-brand-teal/5 transition-all flex items-center gap-4 text-left group"
              >
                <div className="p-3 bg-blue-50 rounded-lg text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  <Search size={24} />
                </div>
                <div>
                  <p className="font-bold text-brand-charcoal">Find in Directory</p>
                  <p className="text-xs text-gray-500">Search and assign directly</p>
                </div>
              </button>

              <button
                onClick={() => {
                  setResourceModal(null);
                  navigate('/operator/directory', {
                    state: {
                      tab: resourceModal.type,
                      bookingId: booking?.id,
                      startDate: booking?.start_date,
                      endDate: booking?.end_date
                    }
                  });
                }}
                className="w-full p-4 border-2 border-gray-100 rounded-xl hover:border-brand-teal hover:bg-brand-teal/5 transition-all flex items-center gap-4 text-left group"
              >
                <div className="p-3 bg-purple-50 rounded-lg text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                  <Mail size={24} />
                </div>
                <div>
                  <p className="font-bold text-brand-charcoal">Send New Request</p>
                  <p className="text-xs text-gray-500">Go to directory to send a new request</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {disputeModal?.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-brand-charcoal">Raise Payout Dispute</h3>
              <button onClick={() => setDisputeModal(null)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs">
                <p className="font-bold flex items-center gap-1 mb-1">
                  <AlertTriangle size={14} /> Important
                </p>
                <p>Raising a dispute will place this payout on hold. Admins will be notified to review and resolve the issue.</p>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Reason for Dispute</label>
                <textarea
                  className="w-full border border-gray-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-brand-teal focus:border-brand-teal outline-none transition-all h-32"
                  placeholder="Explain why you are disputing this payout..."
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setDisputeModal(null)}
                  className="flex-1 py-2 rounded-lg font-bold text-sm bg-gray-100 hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRaiseDispute}
                  disabled={raisingDispute || !disputeReason.trim()}
                  className="flex-1 py-2 rounded-lg font-bold text-sm bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {raisingDispute ? <Loader2 size={16} className="animate-spin" /> : <AlertCircle size={16} />}
                  Raise Dispute
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {acceptedRequestsModal?.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden flex flex-col max-h-[80vh]">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 shrink-0">
              <h3 className="font-bold text-brand-charcoal capitalize">
                Select Accepted {acceptedRequestsModal.type} Request
              </h3>
              <button onClick={() => setAcceptedRequestsModal(null)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              <p className="text-xs text-gray-600 mb-4 bg-gray-50 p-3 rounded-lg border border-gray-100">
                Accepted requests confirm provider interest or availability. Converting one sends a formal assignment for the provider to accept.
              </p>
              {acceptedRequestsModal.loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="animate-spin text-brand-teal" size={24} />
                </div>
              ) : acceptedRequestsModal.requests.length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-sm">
                  No accepted requests available for this resource.
                </div>
              ) : (
                <div className="space-y-3">
                  {acceptedRequestsModal.requests.map((req) => (
                    <div key={req.id} className="border border-gray-200 rounded-xl p-4 hover:border-brand-teal transition-colors">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-3">
                          {(acceptedRequestsModal.type === 'driver' || acceptedRequestsModal.type === 'guide') && (
                            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden shrink-0">
                              {acceptedRequestsModal.type === 'driver' && (req.driver?.avatar_url || req.driver?.profile_image_url) ? (
                                <img 
                                  src={req.driver?.avatar_url || req.driver?.profile_image_url || undefined} 
                                  alt={req.driver?.full_name || ''} 
                                  className="w-full h-full object-cover"
                                  referrerPolicy="no-referrer"
                                />
                              ) : acceptedRequestsModal.type === 'guide' && (req.guide?.avatar_url || req.guide?.profile_image_url) ? (
                                <img 
                                  src={req.guide?.avatar_url || req.guide?.profile_image_url || undefined} 
                                  alt={req.guide?.full_name || ''} 
                                  className="w-full h-full object-cover"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <span className="font-bold text-gray-400">
                                  {acceptedRequestsModal.type === 'driver' && req.driver?.full_name?.charAt(0)}
                                  {acceptedRequestsModal.type === 'guide' && req.guide?.full_name?.charAt(0)}
                                </span>
                              )}
                            </div>
                          )}
                          <div>
                            <p className="font-bold text-sm text-brand-charcoal">
                              {acceptedRequestsModal.type === 'driver' && req.driver?.full_name}
                              {acceptedRequestsModal.type === 'guide' && req.guide?.full_name}
                              {acceptedRequestsModal.type === 'vehicle' && (req.profiles?.company_name || req.profiles?.full_name || 'Unknown Provider')}
                            </p>
                            {acceptedRequestsModal.type === 'vehicle' && req.vehicles && (
                              <p className="text-xs text-gray-600 mb-1">
                                {Array.isArray(req.vehicles) ? req.vehicles[0]?.make : req.vehicles.make} {Array.isArray(req.vehicles) ? req.vehicles[0]?.model : req.vehicles.model} ({Array.isArray(req.vehicles) ? req.vehicles[0]?.license_plate : req.vehicles.license_plate})
                              </p>
                            )}
                            <p className="text-xs text-gray-500">
                              {new Date(req.start_date).toLocaleDateString()} - {new Date(req.end_date).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-green-100 text-green-700">
                          Accepted
                        </span>
                      </div>
                      <button
                        onClick={() => handleAssignFromRequest(req)}
                        className="w-full mt-3 py-2 bg-brand-charcoal text-white rounded-lg text-xs font-bold hover:bg-black transition-colors"
                      >
                        Assign to Booking
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {configuringProvider && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full overflow-hidden">
            <div className="p-6 border-b border-gray-100 bg-gray-50 flex items-center gap-3">
              <Banknote size={20} className="text-brand-teal" />
              <h3 className="font-bold">Assignment Rates</h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden shrink-0">
                  {configuringProvider.profile.avatar_url || configuringProvider.profile.profile_image_url ? (
                    <img 
                      src={configuringProvider.profile.avatar_url || configuringProvider.profile.profile_image_url || undefined} 
                      alt={configuringProvider.profile.full_name || ''} 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <span className="font-bold text-gray-400">{configuringProvider.profile.full_name?.charAt(0)}</span>
                  )}
                </div>
                <div>
                  <p className="font-bold text-sm truncate">{configuringProvider.profile.full_name}</p>
                  <p className="text-[10px] text-gray-500 uppercase font-bold">{configuringProvider.type}</p>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Rate Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setRateType('day')} className={`py-2 text-sm font-bold rounded-lg border-2 ${rateType === 'day' ? 'border-brand-teal bg-brand-teal/5 text-brand-teal' : 'border-gray-100'}`}>Per Day</button>
                  <button onClick={() => setRateType('hour')} className={`py-2 text-sm font-bold rounded-lg border-2 ${rateType === 'hour' ? 'border-brand-teal bg-brand-teal/5 text-brand-teal' : 'border-gray-100'}`}>Per Hour</button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Amount (ZAR)</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-gray-400">R</span>
                  <input type="number" className="w-full border rounded-lg pl-7 pr-4 py-2.5" value={rateAmount} onChange={e => setRateAmount(e.target.value)} disabled={!isRateOverridden} />
                </div>
              </div>
              <label className="flex items-center gap-3 cursor-pointer p-3 bg-gray-50 rounded-lg">
                <input type="checkbox" className="w-4 h-4 text-brand-teal" checked={isRateOverridden} onChange={e => setIsRateOverridden(e.target.checked)} />
                <span className="text-sm font-bold">Override default</span>
              </label>
            </div>
            <div className="p-4 bg-gray-50 border-t flex gap-3">
              <button onClick={() => setConfiguringProvider(null)} className="flex-1 py-2 text-sm font-bold text-gray-500">Cancel</button>
              <button onClick={handleFinalAssign} className="flex-1 py-2 bg-brand-teal text-white rounded-lg font-bold">Assign Now</button>
            </div>
          </div>
        </div>
      )}

      {showVehicleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full overflow-hidden">
            <div className="p-6 border-b bg-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Truck size={20} className="text-brand-teal" />
                <h3 className="font-bold">Select Vehicle</h3>
              </div>
              <button onClick={() => setShowVehicleModal(false)} className="text-gray-500 hover:text-red-600 font-bold">Close</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  <button onClick={() => setVehicleTab('owned')} className={`px-3 py-2 rounded-lg text-xs font-bold ${vehicleTab === 'owned' ? 'bg-brand-teal text-white' : 'bg-gray-100'}`}>Owned</button>
                  <button onClick={() => setVehicleTab('hired')} className={`px-3 py-2 rounded-lg text-xs font-bold ${vehicleTab === 'hired' ? 'bg-brand-teal text-white' : 'bg-gray-100'}`}>Hired</button>
                </div>
                <button onClick={loadVehiclesForPicker} className="px-3 py-2 bg-brand-charcoal text-white rounded-lg font-bold text-sm">Refresh</button>
              </div>
              <input type="text" className="w-full text-sm border rounded-lg p-2" placeholder="Search..." value={vehicleSearch} onChange={e => setVehicleSearch(e.target.value)} />
              <div className="max-h-[500px] overflow-y-auto space-y-3 p-1">
                {visibleVehicles.length === 0 && !loadingVehicles && (
                  <div className="text-center py-10 text-gray-400 text-sm italic">
                    No vehicles found matching your search.
                  </div>
                )}
                {loadingVehicles && (
                  <div className="text-center py-10 text-gray-400 text-sm flex items-center justify-center gap-2">
                    <Loader2 size={16} className="animate-spin" /> Fetching vehicles...
                  </div>
                )}
                {visibleVehicles.map(v => {
                  const isBlocked = availabilityBlocks.some(b => b.vehicle_id === v.id) || bookingConflicts.includes(v.id);
                  const isNonCompliant = v.ownerCompliance?.status === 'non_compliant';
                  const isDisabled = isBlocked || isNonCompliant;
                  
                  const appliedRate = getVehicleDefaultRate(v, vehicleRateType);
                  
                  let reason = "";
                  if (isBlocked) reason = "Vehicle unavailable (overlapping booking or block)";
                  else if (isNonCompliant) reason = "Owner compliance issues detected";

                  return (
                    <div 
                      key={v.id} 
                      className={`p-4 border rounded-xl flex items-center justify-between transition-all ${isDisabled ? 'bg-gray-50 opacity-60' : 'hover:bg-brand-teal/5 border-gray-100 hover:border-brand-teal/20'}`}
                      title={reason}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold text-sm text-brand-charcoal">{v.make} {v.model}</p>
                          {v.owner_id && (
                            <ComplianceBadge 
                              userId={v.owner_id} 
                              role="vehicle_owner" 
                              initialSummary={v.ownerCompliance ? {
                                isCompliant: v.ownerCompliance.status !== 'non_compliant',
                                missingCount: v.ownerCompliance.issues.filter((i: any) => i.problem === 'missing').length,
                                expiredCount: v.ownerCompliance.issues.filter((i: any) => i.problem === 'expired').length,
                                expiringSoonCount: v.ownerCompliance.issues.filter((i: any) => i.problem === 'expiring_soon').length,
                                pendingReviewCount: v.ownerCompliance.issues.filter((i: any) => i.problem === 'pending').length,
                                rejectedCount: v.ownerCompliance.issues.filter((i: any) => i.problem === 'rejected').length,
                                validCount: 0
                              } as any : null}
                              showLabels={false}
                              className="scale-90"
                            />
                          )}
                          {isBlocked && (
                            <span className="text-red-500 text-[10px] font-bold uppercase tracking-wider bg-red-50 px-1.5 py-0.5 rounded border border-red-100 flex items-center gap-1">
                              <AlertCircle size={10} /> Unavailable
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-xs text-gray-500 font-mono bg-gray-50 px-1.5 py-0.5 rounded">{v.license_plate}</p>
                          <p className="text-xs text-brand-teal font-bold bg-brand-teal/5 px-1.5 py-0.5 rounded">R{appliedRate || 0}/{vehicleRateType}</p>
                        </div>
                        {isNonCompliant && (
                          <div className="text-[10px] text-red-500 font-medium mt-1 flex items-center gap-1">
                            <AlertTriangle size={10} /> Owner documentation issues: Selection disabled
                          </div>
                        )}
                      </div>
                      <div className="ml-4">
                        {!isDisabled ? (
                          <button 
                            onClick={() => pickVehicle(v)} 
                            disabled={savingVehicle} 
                            className="bg-brand-teal hover:bg-brand-teal-dark text-white px-5 py-2 rounded-lg text-xs font-bold shadow-sm transition-all active:scale-95"
                          >
                            Select
                          </button>
                        ) : (
                          <div className="p-2 bg-gray-100 rounded-lg text-gray-400">
                            <Lock size={16} />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {showEditTripModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full overflow-hidden">
            <div className="p-6 border-b bg-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Edit2 size={20} className="text-brand-teal" />
                <h3 className="font-bold">Edit Trip Information</h3>
              </div>
              <button onClick={() => setShowEditTripModal(false)} className="text-gray-500 hover:text-red-600 font-bold">Close</button>
            </div>
            <form onSubmit={handleUpdateTripInfo} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Start Date & Time</label>
                  <input 
                    type="datetime-local" 
                    required
                    disabled={isTripInfoLocked}
                    className="w-full text-sm border rounded-lg p-2 disabled:bg-gray-100 disabled:text-gray-500"
                    value={editTripForm.startDate}
                    onChange={e => setEditTripForm(prev => ({ ...prev, startDate: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">End Date & Time</label>
                  <input 
                    type="datetime-local" 
                    required
                    disabled={isTripInfoLocked}
                    className="w-full text-sm border rounded-lg p-2 disabled:bg-gray-100 disabled:text-gray-500"
                    value={editTripForm.endDate}
                    onChange={e => setEditTripForm(prev => ({ ...prev, endDate: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Guest Name</label>
                <input 
                  type="text" 
                  required
                  disabled={isTripInfoLocked}
                  className="w-full text-sm border rounded-lg p-2 disabled:bg-gray-100 disabled:text-gray-500"
                  value={editTripForm.guestName}
                  onChange={e => setEditTripForm(prev => ({ ...prev, guestName: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Guest Email</label>
                  <input 
                    type="email" 
                    required
                    disabled={isTripInfoLocked}
                    className="w-full text-sm border rounded-lg p-2 disabled:bg-gray-100 disabled:text-gray-500"
                    value={editTripForm.guestEmail}
                    onChange={e => setEditTripForm(prev => ({ ...prev, guestEmail: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Client Telephone</label>
                  <input 
                    type="tel" 
                    disabled={isTripInfoLocked}
                    className="w-full text-sm border rounded-lg p-2 disabled:bg-gray-100 disabled:text-gray-500"
                    value={editTripForm.guestPhone}
                    onChange={e => setEditTripForm(prev => ({ ...prev, guestPhone: e.target.value }))}
                    placeholder="Optional"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Number of Guests</label>
                <input 
                  type="number" 
                  required
                  min="1"
                  disabled={isTripInfoLocked}
                  className="w-full text-sm border rounded-lg p-2 disabled:bg-gray-100 disabled:text-gray-500"
                  value={editTripForm.numGuests}
                  onChange={e => setEditTripForm(prev => ({ ...prev, numGuests: parseInt(e.target.value) }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Pickup Location</label>
                  <input 
                    type="text" 
                    disabled={isTripInfoLocked}
                    className="w-full text-sm border rounded-lg p-2 disabled:bg-gray-100 disabled:text-gray-500"
                    value={editTripForm.pickupLocation}
                    onChange={e => setEditTripForm(prev => ({ ...prev, pickupLocation: e.target.value }))}
                    placeholder="e.g. Airport"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Dropoff Location</label>
                  <input 
                    type="text" 
                    disabled={isTripInfoLocked}
                    className="w-full text-sm border rounded-lg p-2 disabled:bg-gray-100 disabled:text-gray-500"
                    value={editTripForm.dropoffLocation}
                    onChange={e => setEditTripForm(prev => ({ ...prev, dropoffLocation: e.target.value }))}
                    placeholder="e.g. Hotel"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Special Requests</label>
                <textarea 
                  disabled={isTripInfoLocked}
                  className="w-full text-sm border rounded-lg p-2 h-16 disabled:bg-gray-100 disabled:text-gray-500"
                  value={editTripForm.specialRequests}
                  onChange={e => setEditTripForm(prev => ({ ...prev, specialRequests: e.target.value }))}
                  placeholder="e.g. Baby seat"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Internal Notes</label>
                <textarea 
                  className="w-full text-sm border rounded-lg p-2 h-24"
                  value={editTripForm.internalNotes}
                  onChange={e => setEditTripForm(prev => ({ ...prev, internalNotes: e.target.value }))}
                />
              </div>
              {isTripInfoLocked && (
                <div className="bg-amber-50 text-amber-800 p-2 text-xs rounded-lg flex items-center justify-center gap-2 font-medium">
                  <AlertCircle size={14} /> Only Internal Notes can be edited for this booking.
                </div>
              )}
              <div className="pt-4 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setShowEditTripModal(false)}
                  className="flex-1 py-2 border border-gray-300 rounded-lg text-sm font-bold text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={savingTripInfo}
                  className="flex-1 py-2 bg-brand-teal text-white rounded-lg text-sm font-bold hover:bg-brand-teal/90 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {savingTripInfo ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="mb-8">
        <button onClick={() => navigate('/operator/bookings')} className="flex items-center gap-2 text-gray-500 hover:text-brand-charcoal mb-4 font-bold text-sm transition-colors">
          <ArrowLeft size={16} /> Back to Bookings
        </button>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-mono font-bold text-brand-charcoal">{booking.booking_reference}</h1>
              <div className="flex items-center gap-2">
                <BookingStatusBadge status={booking.status} />
                {(booking.status === 'pending' || booking.status === 'draft') && (
                  isReady ? (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-green-100 text-green-700 border border-green-200">Ready</span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-100 text-amber-700 border border-amber-200">Incomplete</span>
                  )
                )}
              </div>
              {booking.archived_at && (
                <span className="px-2.5 py-1 rounded-lg text-xs font-bold uppercase bg-gray-100 text-gray-600 flex items-center gap-1">
                  <Archive size={12} /> Archived
                </span>
              )}
            </div>
            {booking.tours?.title && <p className="text-gray-500 font-medium">{booking.tours.title}</p>}
            {(booking.start_date || booking.end_date) && (
              <p className="text-sm text-gray-500 flex items-center gap-1.5 mt-1 font-medium">
                <Calendar size={14} className="opacity-70" />
                {booking.start_date ? formatDate(booking.start_date) : ''}
                {booking.end_date ? ` — ${formatDate(booking.end_date)}` : ''}
              </p>
            )}
          </div>
          <div className="text-left md:text-right">
            <p className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-1">Total Amount</p>
            <p className="text-3xl font-bold text-brand-teal">{formatCurrency(booking.total_amount, booking.currency)}</p>
          </div>
        </div>

        {/* Draft Booking Awareness Banner */}
        {booking.status === 'draft' && (
          <div className="mt-6 bg-brand-charcoal text-white rounded-2xl p-6 shadow-lg border border-brand-charcoal">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="flex items-start gap-4">
                <div className="bg-brand-teal/20 p-3 rounded-xl text-brand-teal">
                  <ShieldAlert size={28} />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-lg font-bold text-white tracking-tight">Draft Booking</h3>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-brand-teal text-white">Action Required</span>
                  </div>
                  <p className="text-sm text-gray-300 max-w-2xl leading-relaxed">
                    This booking is still a draft. You can plan details and request/assign resources, but escrow, payouts, and final dispatch only activate once the booking is confirmed.
                  </p>
                </div>
              </div>
              <button 
                onClick={handleConfirmBooking}
                disabled={!isReady}
                title={!isReady ? "Please complete all core booking details before confirming" : ""}
                className={`w-full md:w-auto font-bold px-8 py-3 rounded-xl transition shadow-md flex items-center justify-center gap-2 ${
                  isReady 
                    ? 'bg-brand-teal hover:bg-brand-teal/90 text-white' 
                    : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                }`}
              >
                <CheckCircle2 size={18} />
                Confirm Booking
              </button>
            </div>
          </div>
        )}

        {/* Review Providers Banner */}
        {pendingReviewsList.length > 0 && (
          <div ref={reviewSectionRef} className="mt-6 bg-amber-50 border border-amber-200 rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
            <div>
              <h3 className="text-sm font-bold text-amber-900 flex items-center gap-2">
                <Star size={16} className="text-amber-500 fill-amber-500" />
                Booking completed
              </h3>
              <p className="text-[11px] text-amber-700 mt-1 font-medium">
                Please review your assigned providers.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button 
                onClick={() => reviewSectionRef.current?.scrollIntoView({ behavior: 'smooth' })}
                className="bg-amber-100 hover:bg-amber-200 text-amber-800 font-bold px-3 py-1.5 rounded-lg text-xs transition"
              >
                Review Providers
              </button>
              {pendingReviewsList.map(pr => (
                <button
                  key={pr.id}
                  onClick={() => setReviewModalData({
                    providerId: pr.id,
                    providerName: pr.name,
                    role: pr.role
                  })}
                  className="text-xs bg-white border border-amber-200 text-amber-900 px-3 py-1.5 rounded-lg font-bold hover:border-amber-400 transition-colors flex items-center gap-1.5"
                >
                  <Star size={12} className="text-amber-500 fill-amber-500" />
                  Review {pr.roleDisplay}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Escrow / Payment Status Section */}
        <div className="mt-6 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                <ShieldCheck size={16} className="text-brand-teal" />
                Payment & Escrow Status
              </h3>
              <button 
                onClick={loadAll}
                disabled={loading}
                className="p-1 hover:bg-gray-100 rounded text-gray-400 transition-colors"
                title="Refresh Status"
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
            <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-lg flex items-center gap-1 ${
              booking.payment_status === 'payout_completed' ? 'bg-green-100 text-green-700' :
              booking.payment_status === 'payout_ready' ? 'bg-blue-100 text-blue-700' :
              (booking.payment_status === 'funds_held' || booking.payment_status === 'funds_received' || Number(booking.funds_received_amount) > 0 || Number(booking.funds_held_amount) > 0 || Number(booking.escrow_held) > 0 || booking.escrow_status === 'funds_received') ? 'bg-blue-100 text-blue-700' :
              'bg-gray-100 text-gray-500'
            }`}>
              {booking.payment_status === 'payout_completed' && <CheckCircle2 size={12} />}
              {((!booking.payment_status || booking.payment_status === 'payment_pending') && (Number(booking.funds_received_amount) > 0 || Number(booking.funds_held_amount) > 0 || Number(booking.escrow_held) > 0 || booking.escrow_status === 'funds_received')) ? 'FUNDS HELD' : booking.payment_status?.replace('_', ' ')}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-3 rounded-xl bg-gray-50 border border-gray-100">
              <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Funds Held</p>
              <p className="text-lg font-mono font-bold text-brand-charcoal">
                {formatCurrency(remainingBalance, booking.currency)}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-gray-50 border border-gray-100">
              <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Funds Released</p>
              <p className="text-lg font-mono font-bold text-green-600">
                {formatCurrency(actualReleased, booking.currency)}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-brand-charcoal text-white border border-brand-charcoal">
              <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Remaining Balance</p>
              <p className="text-lg font-mono font-bold text-brand-teal">
                {formatCurrency(remainingBalance, booking.currency)}
              </p>
            </div>
          </div>
          
          {booking.payment_received_at && (
            <p className="mt-4 text-[10px] text-gray-400">
              Customer payment confirmed on {new Date(booking.payment_received_at).toLocaleDateString()}
            </p>
          )}
        </div>

        {/* Booking Readiness Section */}
        <div className="mt-6 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                <ShieldAlert size={16} className={isReady ? 'text-green-500' : 'text-amber-500'} />
                Booking Readiness
              </h3>
              <p className="text-[11px] text-gray-500 mt-1">
                Resources are optional. Assign drivers, guides, or vehicles only if needed for this booking.
              </p>
            </div>
            {isReady ? (
              <span className="text-[10px] font-bold uppercase bg-green-100 text-green-700 px-2 py-1 rounded-lg flex items-center gap-1">
                <CheckCircle2 size={12} /> Ready for confirmation
              </span>
            ) : (
              <span className="text-[10px] font-bold uppercase bg-red-100 text-red-700 px-2 py-1 rounded-lg flex items-center gap-1">
                <AlertCircle size={12} /> Incomplete
              </span>
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Vehicle Status */}
            <div className="flex items-center p-3 rounded-xl bg-gray-50 border border-gray-100">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${isVehicleAssigned ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                  <Car size={18} />
                </div>
                <div>
                  <p className="text-xs font-bold text-brand-charcoal">Vehicle</p>
                  <p className={`text-[10px] font-medium ${isVehicleAssigned ? 'text-green-600' : 'text-gray-500'}`}>
                    {isVehicleAssigned ? 'Assigned' : 'Unassigned'}
                  </p>
                </div>
              </div>
            </div>

            {/* Driver Status */}
            <div className="flex items-center p-3 rounded-xl bg-gray-50 border border-gray-100">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${
                  isDriverAccepted ? 'bg-green-100 text-green-600' : 
                  assignedDriver ? 'bg-amber-100 text-amber-600' : 
                  'bg-gray-100 text-gray-500'
                }`}>
                  <User size={18} />
                </div>
                <div>
                  <p className="text-xs font-bold text-brand-charcoal">Driver</p>
                  <p className={`text-[10px] font-medium ${
                    isDriverAccepted ? 'text-green-600' : 
                    assignedDriver ? 'text-amber-600' : 
                    'text-gray-500'
                  }`}>
                    {!assignedDriver ? 'Unassigned' : assignedDriver.status === 'pending' ? 'Pending' : 'Accepted'}
                  </p>
                </div>
              </div>
            </div>

            {/* Guide Status */}
            <div className="flex items-center p-3 rounded-xl bg-gray-50 border border-gray-100">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${
                  isGuideAccepted ? 'bg-green-100 text-green-600' : 
                  assignedGuide ? 'bg-amber-100 text-amber-600' : 
                  'bg-gray-100 text-gray-500'
                }`}>
                  <Compass size={18} />
                </div>
                <div>
                  <p className="text-xs font-bold text-brand-charcoal">Guide</p>
                  <p className={`text-[10px] font-medium ${
                    isGuideAccepted ? 'text-green-600' : 
                    assignedGuide ? 'text-amber-600' : 
                    'text-gray-500'
                  }`}>
                    {!assignedGuide ? 'Unassigned' : assignedGuide.status === 'pending' ? 'Pending' : 'Accepted'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {isVehicleAssigned && selectedVehicleDetails && (booking.num_guests || 1) > (selectedVehicleDetails.seat_count || 0) && (
            <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-700">
              <AlertTriangle size={18} />
              <p className="text-xs font-medium">
                Guest count exceeds vehicle capacity. Assign a larger vehicle or reduce guest count.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {financials && (
            <BookingFinancialBreakdownView 
              data={financials} 
            />
          )}

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
              <h2 className="font-bold text-brand-charcoal flex items-center gap-2">
                <Info size={18} className="text-brand-teal" /> Trip Information
              </h2>
              {isOperatorOrAdmin && (() => {
                const isFullyLocked = booking.status === 'completed' || booking.status === 'cancelled' || !!booking.archived_at;
                return (
                  <div className="flex flex-col items-end gap-1">
                    <button 
                      onClick={() => {
                        setEditTripForm({
                          startDate: toLocalDatetimeString(booking.start_date),
                          endDate: toLocalDatetimeString(booking.end_date),
                          guestName: booking.guest_name || '',
                          guestEmail: booking.guest_email || '',
                          guestPhone: booking.guest_phone || '',
                          numGuests: booking.num_guests || 1,
                          pickupLocation: (booking as any).pickup_location || '',
                          dropoffLocation: (booking as any).dropoff_location || '',
                          specialRequests: (booking as any).special_requests || '',
                          internalNotes: (booking as any).internal_notes || booking.notes || ''
                        });
                        setShowEditTripModal(true);
                      }}
                      disabled={isFullyLocked}
                      title={isFullyLocked ? "Completed bookings are locked from trip edits." : ""}
                      className={`text-xs flex items-center gap-1 font-bold ${isFullyLocked ? 'text-gray-400 cursor-not-allowed' : 'text-brand-teal hover:underline'}`}
                    >
                      <Edit2 size={12} /> Edit Trip Info
                    </button>
                    {isFullyLocked && (
                      <span className="text-[10px] text-red-500 font-medium">Completed bookings are locked from trip edits.</span>
                    )}
                  </div>
                );
              })()}
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div>
                  <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider block mb-1">Start Date & Time</span>
                  <div className="font-medium text-brand-charcoal flex items-center gap-2">
                    <Calendar size={16} className="text-gray-400" />
                    {new Date(booking.start_date).toLocaleString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider block mb-1">End Date & Time</span>
                  <div className="font-medium text-brand-charcoal flex items-center gap-2">
                    <Calendar size={16} className="text-gray-400" />
                    {new Date(booking.end_date).toLocaleString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider block mb-1">Number of Guests</span>
                  <div className="font-medium text-brand-charcoal flex items-center gap-2">
                    <Users size={16} className="text-gray-400" />
                    {booking.num_guests || 'Not provided'}
                  </div>
                </div>
              </div>
              <div className="space-y-6">
                <div>
                  <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider block mb-1">Primary Guest</span>
                  <div className="font-medium text-brand-charcoal flex items-center gap-2">
                    <User size={16} className="text-gray-400" />
                    {booking.guest_name}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider block mb-1">Contact Email</span>
                  <div className="font-medium text-brand-teal flex items-center gap-2">
                    <Mail size={16} className="text-gray-400" />
                    <a href={`mailto:${booking.guest_email}`} className="hover:underline">{booking.guest_email}</a>
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider block mb-1">Pickup Location</span>
                  <div className="font-medium text-brand-charcoal flex items-center gap-2">
                    <MapPin size={16} className="text-gray-400" />
                    {booking.pickup_location || <span className="text-gray-400 italic">Not provided</span>}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-100 bg-gray-50/30">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div>
                    <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider block mb-1">Dropoff Location</span>
                    <div className="font-medium text-brand-charcoal flex items-center gap-2">
                      <MapPin size={16} className="text-gray-400" />
                      {booking.dropoff_location || <span className="text-gray-400 italic">Not provided</span>}
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider block mb-1">Client Telephone</span>
                    <div className="font-medium text-brand-charcoal flex items-center gap-2">
                      <Phone size={16} className="text-gray-400" />
                      {booking.guest_phone ? (
                        <a href={`tel:${booking.guest_phone}`} className="hover:underline text-brand-teal">{booking.guest_phone}</a>
                      ) : (
                        <span className="text-gray-400 italic">Not provided</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="space-y-6">
                  <div>
                    <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider block mb-1">Special Requests</span>
                    <div className="bg-white border border-gray-100 rounded-lg p-3">
                      {(booking as any).special_requests ? (
                        <p className="text-sm text-brand-charcoal">{(booking as any).special_requests}</p>
                      ) : (
                        <p className="text-sm text-gray-400 italic">Not provided</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {((booking as any).internal_notes || booking.notes) && (
                <div className="mt-6 pt-6 border-t border-gray-100">
                  <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider block mb-1">Internal Notes</span>
                  <div className="text-sm text-gray-600 bg-amber-50/50 border border-amber-100 rounded-lg p-3 italic">
                    {(booking as any).internal_notes || booking.notes}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mt-6">
            <div className="p-6 border-b border-gray-100 bg-gray-50/50">
              <h2 className="font-bold text-brand-charcoal flex items-center gap-2">
                <Users size={18} className="text-brand-teal" /> Resources
              </h2>
              {['confirmed', 'in_progress', 'assigned', 'pending'].includes(booking.status) && (
                <div className="mt-4 p-4 bg-amber-50 border border-amber-100 rounded-2xl flex items-start gap-4">
                  <div className="bg-amber-100 p-2 rounded-xl text-amber-600">
                    <Info size={20} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-amber-900">Having trouble with a provider?</p>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mt-1">
                      <p className="text-xs text-amber-700">
                        If a specific provider does not arrive or there is an issue during the tour, contact support so Admin can review the case.
                      </p>
                      <Link 
                        to={`/contact?topic=booking&ref=${booking?.booking_reference}`} 
                        className="text-amber-900 hover:text-brand-charcoal text-xs font-bold underline whitespace-nowrap"
                      >
                        Contact Support
                      </Link>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Driver Block */}
              <div className="border border-gray-100 rounded-xl p-4">
                <h3 className="font-bold text-sm text-gray-500 mb-4 flex items-center gap-2"><Car size={16}/> Assigned Driver</h3>
                {assignedDriver ? (
                  <div>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden shrink-0">
                        {assignedDriver.profile?.avatar_url || assignedDriver.profile?.profile_image_url ? (
                          <img 
                            src={assignedDriver.profile?.avatar_url || assignedDriver.profile?.profile_image_url || undefined} 
                            alt={assignedDriver.profile?.full_name || ''} 
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <span className="font-bold text-gray-400">{assignedDriver.profile?.full_name?.charAt(0)}</span>
                        )}
                      </div>
                      <div>
                        <p className="font-bold text-brand-charcoal text-sm">{assignedDriver.profile?.full_name}</p>
                        {(() => {
                           const isReported = assignedDriver.status === 'no_show' || !!assignedDriver.incident_reported_at;
                           return (
                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${getStatusBadgeClass(isReported ? 'no_show' : assignedDriver.status || 'accepted')}`}>
                              {isReported ? 'REPORTED NO-SHOW' : getStatusDisplay(assignedDriver.status)}
                            </span>
                           );
                        })()}
                      </div>
                    </div>
                    {(() => {
                       const isReported = assignedDriver.status === 'no_show' || !!assignedDriver.incident_reported_at;
                       return isReported && (
                        <div className="mb-3 p-2 bg-amber-50 border border-amber-100 rounded-lg">
                          <p className="text-[10px] font-bold text-amber-700 uppercase mb-1">Incident reported</p>
                          { (assignedDriver.incident_reason || assignedDriver.no_show_reason) && (
                            <p className="text-xs text-amber-600">{assignedDriver.incident_reason || assignedDriver.no_show_reason}</p>
                          )}
                        </div>
                      );
                    })()}
                    <div className="flex flex-wrap gap-2">
                       <button 
                        onClick={() => setAssignmentConfirmModal({ isOpen: true, type: 'replace', role: 'driver', assignmentId: assignedDriver.id })} 
                        disabled={booking.status === 'completed' || booking.status === 'cancelled' || isAssignmentApproved(payoutLedgers, assignedDriver.resource_id) || isAssignmentPaid(payoutLedgers, assignedDriver.resource_id) || isFinanciallyLocked}
                        className="text-xs bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg font-bold hover:bg-gray-200 disabled:opacity-50"
                      >
                        Replace
                      </button>
                      <button 
                        onClick={() => setAssignmentConfirmModal({ isOpen: true, type: 'remove', role: 'driver', assignmentId: assignedDriver.id })} 
                        disabled={booking.status === 'completed' || booking.status === 'cancelled' || isAssignmentApproved(payoutLedgers, assignedDriver.resource_id) || isAssignmentPaid(payoutLedgers, assignedDriver.resource_id) || isFinanciallyLocked}
                        className="text-xs bg-red-50 text-red-600 px-3 py-1.5 rounded-lg font-bold hover:bg-red-100 disabled:opacity-50"
                      >
                        Remove
                      </button>
                      {booking.status === 'completed' && (driverPayout?.status === 'paid' || isFinanciallyLocked) && (
                        reviewedProviders.has(assignedDriver.resource_id) ? (
                          <span className="text-xs bg-gray-50 text-gray-400 px-3 py-1.5 rounded-lg font-bold flex items-center gap-1">
                            <Check size={12} /> Reviewed
                          </span>
                        ) : (
                          <button 
                            onClick={() => setReviewModalData({
                              providerId: assignedDriver.resource_id,
                              providerName: assignedDriver.profile?.full_name || 'Driver',
                              role: 'driver'
                            })}
                            className="text-xs bg-amber-50 text-amber-600 px-3 py-1.5 rounded-lg font-bold hover:bg-amber-100 flex items-center gap-1"
                          >
                            <Star size={12} /> Review
                          </button>
                        )
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="pt-2">
                    <div className="p-4 bg-gray-50 border border-gray-100 rounded-xl">
                      <p className="text-sm font-bold text-brand-charcoal">No driver assigned yet</p>
                      <p className="text-xs text-gray-500 mt-1">Assign a verified and compliant driver before final confirmation.</p>
                    </div>
                    <button onClick={() => openResourceModal('driver', 'add')} disabled={isFinanciallyLocked} className="w-full py-2 mt-4 border-2 border-dashed border-gray-200 text-gray-500 rounded-xl text-sm font-bold hover:border-brand-teal hover:text-brand-teal transition-colors disabled:opacity-50">Add Driver</button>
                  </div>
                )}
              </div>

              {/* Guide Block */}
              <div className="border border-gray-100 rounded-xl p-4">
                <h3 className="font-bold text-sm text-gray-500 mb-4 flex items-center gap-2"><Compass size={16}/> Assigned Guide</h3>
                {assignedGuide ? (
                  <div>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden shrink-0">
                        {assignedGuide.profile?.avatar_url || assignedGuide.profile?.profile_image_url ? (
                          <img 
                            src={assignedGuide.profile?.avatar_url || assignedGuide.profile?.profile_image_url || undefined} 
                            alt={assignedGuide.profile?.full_name || ''} 
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <span className="font-bold text-gray-400">{assignedGuide.profile?.full_name?.charAt(0)}</span>
                        )}
                      </div>
                      <div>
                        <p className="font-bold text-brand-charcoal text-sm">{assignedGuide.profile?.full_name}</p>
                        {(() => {
                           const isReported = assignedGuide.status === 'no_show' || !!assignedGuide.incident_reported_at;
                           return (
                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${getStatusBadgeClass(isReported ? 'no_show' : assignedGuide.status || 'accepted')}`}>
                              {isReported ? 'REPORTED NO-SHOW' : getStatusDisplay(assignedGuide.status)}
                            </span>
                           );
                        })()}
                      </div>
                    </div>
                    {(() => {
                       const isReported = assignedGuide.status === 'no_show' || !!assignedGuide.incident_reported_at;
                       return isReported && (
                        <div className="mb-3 p-2 bg-amber-50 border border-amber-100 rounded-lg">
                          <p className="text-[10px] font-bold text-amber-700 uppercase mb-1">Incident reported</p>
                          { (assignedGuide.incident_reason || assignedGuide.no_show_reason) && (
                            <p className="text-xs text-amber-600">{assignedGuide.incident_reason || assignedGuide.no_show_reason}</p>
                          )}
                        </div>
                      );
                    })()}
                    <div className="flex flex-wrap gap-2">
                       <button 
                        onClick={() => setAssignmentConfirmModal({ isOpen: true, type: 'replace', role: 'guide', assignmentId: assignedGuide.id })} 
                        disabled={booking.status === 'completed' || booking.status === 'cancelled' || isAssignmentApproved(payoutLedgers, assignedGuide.resource_id) || isAssignmentPaid(payoutLedgers, assignedGuide.resource_id) || isFinanciallyLocked}
                        className="text-xs bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg font-bold hover:bg-gray-200 disabled:opacity-50"
                      >
                        Replace
                      </button>
                      <button 
                        onClick={() => setAssignmentConfirmModal({ isOpen: true, type: 'remove', role: 'guide', assignmentId: assignedGuide.id })} 
                        disabled={booking.status === 'completed' || booking.status === 'cancelled' || isAssignmentApproved(payoutLedgers, assignedGuide.resource_id) || isAssignmentPaid(payoutLedgers, assignedGuide.resource_id) || isFinanciallyLocked}
                        className="text-xs bg-red-50 text-red-600 px-3 py-1.5 rounded-lg font-bold hover:bg-red-100 disabled:opacity-50"
                      >
                        Remove
                      </button>
                      {booking.status === 'completed' && (guidePayout?.status === 'paid' || isFinanciallyLocked) && (
                        reviewedProviders.has(assignedGuide.resource_id) ? (
                          <span className="text-xs bg-gray-50 text-gray-400 px-3 py-1.5 rounded-lg font-bold flex items-center gap-1">
                            <Check size={12} /> Reviewed
                          </span>
                        ) : (
                          <button 
                            onClick={() => setReviewModalData({
                              providerId: assignedGuide.resource_id,
                              providerName: assignedGuide.profile?.full_name || 'Guide',
                              role: 'guide'
                            })}
                            className="text-xs bg-amber-50 text-amber-600 px-3 py-1.5 rounded-lg font-bold hover:bg-amber-100 flex items-center gap-1"
                          >
                            <Star size={12} /> Review
                          </button>
                        )
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="pt-2">
                    <div className="p-4 bg-gray-50 border border-gray-100 rounded-xl">
                      <p className="text-sm font-bold text-brand-charcoal">No guide assigned yet</p>
                      <p className="text-xs text-gray-500 mt-1">Assign a verified and compliant guide before final confirmation.</p>
                    </div>
                    <button onClick={() => openResourceModal('guide', 'add')} disabled={isFinanciallyLocked} className="w-full py-2 mt-4 border-2 border-dashed border-gray-200 text-gray-500 rounded-xl text-sm font-bold hover:border-brand-teal hover:text-brand-teal transition-colors disabled:opacity-50">Add Guide</button>
                  </div>
                )}
              </div>

              {/* Vehicle Block */}
              <div className="border border-gray-100 rounded-xl p-4">
                <h3 className="font-bold text-sm text-gray-500 mb-4 flex items-center gap-2"><Truck size={16}/> Assigned Vehicle</h3>
                {selectedVehicleDetails ? (
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-brand-charcoal">{selectedVehicleDetails.make} {selectedVehicleDetails.model}</p>
                    </div>
                    {(() => {
                        const vAsgn = assignments.find(a => a.resource_type === 'vehicle' && a.resource_id === booking.vehicle_id);
                        const isReported = vAsgn?.status === 'no_show' || !!vAsgn?.incident_reported_at;
                        return (
                          <>
                            <span className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase ${getStatusBadgeClass(isReported ? 'no_show' : vAsgn?.status || 'accepted')}`}>
                              {isReported ? 'REPORTED NO-SHOW' : getStatusDisplay(vAsgn?.status || 'accepted')}
                            </span>
                            {isReported && (
                              <div className="mt-3 p-2 bg-amber-50 border border-amber-100 rounded-lg">
                                <p className="text-[10px] font-bold text-amber-700 uppercase mb-1">Incident reported</p>
                                {(vAsgn?.incident_reason || vAsgn?.no_show_reason) && (
                                    <p className="text-xs text-amber-600">{vAsgn.incident_reason || vAsgn.no_show_reason}</p>
                                )}
                              </div>
                            )}
                          </>
                        );
                    })()}
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button 
                        onClick={() => setAssignmentConfirmModal({ isOpen: true, type: 'replace', role: 'vehicle' })} 
                        disabled={booking.status === 'completed' || booking.status === 'cancelled' || isVehicleApproved(payoutLedgers, selectedVehicleDetails) || isVehiclePaid(payoutLedgers, selectedVehicleDetails) || isFinanciallyLocked}
                        className="text-xs bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg font-bold hover:bg-gray-200 disabled:opacity-50"
                      >
                        Replace
                      </button>
                      <button 
                        onClick={() => setAssignmentConfirmModal({ isOpen: true, type: 'remove', role: 'vehicle' })} 
                        disabled={booking.status === 'completed' || booking.status === 'cancelled' || isVehicleApproved(payoutLedgers, selectedVehicleDetails) || isVehiclePaid(payoutLedgers, selectedVehicleDetails) || isFinanciallyLocked}
                        className="text-xs bg-red-50 text-red-600 px-3 py-1.5 rounded-lg font-bold hover:bg-red-100 disabled:opacity-50"
                      >
                        Remove
                      </button>
                      {booking.status === 'completed' && selectedVehicleDetails.owner_id && selectedVehicleDetails.owner_id !== user?.id && (
                        reviewedProviders.has(selectedVehicleDetails.owner_id) ? (
                            <span className="text-xs bg-gray-50 text-gray-400 px-3 py-1.5 rounded-lg font-bold flex items-center gap-1">
                              <Check size={12} /> Reviewed
                            </span>
                        ) : (
                          <button 
                            onClick={() => setReviewModalData({
                              providerId: selectedVehicleDetails.owner_id!,
                              providerName: selectedVehicleDetails.profiles?.company_name || selectedVehicleDetails.profiles?.full_name || 'Vehicle Owner',
                              role: 'vehicle_owner'
                            })}
                            className="text-xs bg-amber-50 text-amber-600 px-3 py-1.5 rounded-lg font-bold hover:bg-amber-100 flex items-center gap-1"
                          >
                            <Star size={12} /> Review Vehicle Owner
                          </button>
                        )
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="pt-2">
                    <div className="p-4 bg-gray-50 border border-gray-100 rounded-xl">
                      <p className="text-sm font-bold text-brand-charcoal">No vehicle assigned yet</p>
                      <p className="text-xs text-gray-500 mt-1">Assign a verified and compliant vehicle before final confirmation.</p>
                    </div>
                    <button onClick={() => openResourceModal('vehicle', 'add')} disabled={isFinanciallyLocked} className="w-full py-2 mt-4 border-2 border-dashed border-gray-200 text-gray-500 rounded-xl text-sm font-bold hover:border-brand-teal hover:text-brand-teal transition-colors disabled:opacity-50">Add Vehicle</button>
                  </div>
                )}
              </div>
            </div>

            {/* Render search bars if active */}
            {(showDriverSearch || showGuideSearch) && (
              <div className="p-6 border-t border-gray-100 bg-gray-50">
                {showDriverSearch && (
                  <div className="mb-4">
                    <h4 className="font-bold text-sm mb-2">Find Driver in Directory</h4>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        className="flex-1 text-xs border rounded p-2" 
                        value={driverSearchQuery} 
                        onChange={e => {
                          setDriverSearchQuery(e.target.value);
                          setHasSearchedDrivers(false);
                        }} 
                      />
                      <button onClick={handleDriverSearch} className="bg-brand-charcoal text-white p-2 rounded"><Search size={14} /></button>
                      <button onClick={() => setShowDriverSearch(false)} className="text-gray-500 p-2 hover:bg-gray-200 rounded"><X size={14} /></button>
                    </div>
                    {hasSearchedDrivers && foundDrivers.length === 0 && !loadingDrivers && (
                      <div className="mt-2 text-xs text-gray-500 italic">No drivers found</div>
                    )}
                    {loadingDrivers && (
                      <div className="mt-2 text-xs text-gray-400 flex items-center gap-2">
                        <Loader2 size={12} className="animate-spin" /> Searching providers...
                      </div>
                    )}
                    {foundDrivers.length > 0 && !loadingDrivers && (
                      <div className="mt-2 space-y-2 max-h-60 overflow-y-auto border rounded p-2 bg-white">
                        {foundDrivers.map(d => {
                          const canAssign = d.assignmentCheck?.canAssign ?? true;
                          const hasConflict = d.hasConflict;
                          const isDisabled = !canAssign || hasConflict || !d.is_active;
                          
                          let reason = "";
                          if (!d.is_active) reason = "Provider inactive";
                          else if (hasConflict) reason = "Provider unavailable (overlapping booking)";
                          else if (!canAssign) {
                            reason = d.assignmentCheck?.blockers?.[0] || "Compliance issues detected";
                          }

                          return (
                            <div 
                              key={d.id} 
                              className={`flex justify-between items-center text-sm p-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 rounded transition-colors ${isDisabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                              onClick={() => {
                                if (isDisabled) return;
                                setConfiguringProvider({ type: 'driver', profile: d });
                                setFoundDrivers([]);
                                setShowDriverSearch(false);
                              }}
                              title={reason}
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <div className="font-bold text-brand-charcoal">{d.full_name}</div>
                                  {d.ratingSummary && d.ratingSummary.total_reviews > 0 && (
                                    <div className="flex items-center gap-0.5 text-[10px] text-amber-500 font-bold bg-amber-50 px-1.5 py-0.5 rounded">
                                      <Star size={10} className="fill-amber-500" />
                                      {d.ratingSummary.average_rating.toFixed(1)}
                                    </div>
                                  )}
                                  <ComplianceBadge 
                                    userId={d.id} 
                                    role="driver" 
                                    initialSummary={{
                                      isCompliant: d.compliance.status !== 'non_compliant',
                                      missingCount: d.compliance.issues.filter((i: any) => i.problem === 'missing').length,
                                      expiredCount: d.compliance.issues.filter((i: any) => i.problem === 'expired').length,
                                      expiringSoonCount: d.compliance.issues.filter((i: any) => i.problem === 'expiring_soon').length,
                                      pendingReviewCount: d.compliance.issues.filter((i: any) => i.problem === 'pending').length,
                                      rejectedCount: d.compliance.issues.filter((i: any) => i.problem === 'rejected').length,
                                      validCount: 0
                                    } as any}
                                    showLabels={true}
                                  />
                                </div>
                                <div className="text-[10px] text-gray-500 flex items-center gap-2 mt-0.5">
                                  <span>{d.email}</span>
                                  {d.city && <span className="flex items-center gap-0.5 before:content-['•'] before:mr-1">{d.city}{d.province ? `, ${d.province}` : ''}</span>}
                                </div>
                                {isDisabled && (
                                  <div className="text-[10px] text-red-500 font-medium mt-1 flex items-center gap-1">
                                    <AlertTriangle size={10} /> {reason}
                                  </div>
                                )}
                              </div>
                              <div className="text-right">
                                {!isDisabled ? (
                                  <span className="bg-brand-teal/10 text-brand-teal px-3 py-1 rounded text-[10px] font-bold uppercase">Select</span>
                                ) : (
                                  <Lock size={14} className="text-gray-300 ml-auto" />
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
                
                {showGuideSearch && (
                  <div className="mb-4">
                    <h4 className="font-bold text-sm mb-2">Find Guide in Directory</h4>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        className="flex-1 text-xs border rounded p-2" 
                        value={guideSearchQuery} 
                        onChange={e => {
                          setGuideSearchQuery(e.target.value);
                          setHasSearchedGuides(false);
                        }} 
                      />
                      <button onClick={handleGuideSearch} className="bg-brand-charcoal text-white p-2 rounded"><Search size={14} /></button>
                      <button onClick={() => setShowGuideSearch(false)} className="text-gray-500 p-2 hover:bg-gray-200 rounded"><X size={14} /></button>
                    </div>
                    {hasSearchedGuides && foundGuides.length === 0 && !loadingGuides && (
                      <div className="mt-2 text-xs text-gray-500 italic">No guides found</div>
                    )}
                    {loadingGuides && (
                      <div className="mt-2 text-xs text-gray-400 flex items-center gap-2">
                        <Loader2 size={12} className="animate-spin" /> Searching providers...
                      </div>
                    )}
                    {foundGuides.length > 0 && !loadingGuides && (
                      <div className="mt-2 space-y-2 max-h-60 overflow-y-auto border rounded p-2 bg-white">
                        {foundGuides.map(g => {
                          const canAssign = g.assignmentCheck?.canAssign ?? true;
                          const hasConflict = g.hasConflict;
                          const isDisabled = !canAssign || hasConflict || !g.is_active;

                          let reason = "";
                          if (!g.is_active) reason = "Provider inactive";
                          else if (hasConflict) reason = "Provider unavailable (overlapping booking)";
                          else if (!canAssign) {
                            reason = g.assignmentCheck?.blockers?.[0] || "Compliance issues detected";
                          }

                          return (
                            <div 
                              key={g.id} 
                              className={`flex justify-between items-center text-sm p-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 rounded transition-colors ${isDisabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                              onClick={() => {
                                if (isDisabled) return;
                                setConfiguringProvider({ type: 'guide', profile: g });
                                setFoundGuides([]);
                                setShowGuideSearch(false);
                              }}
                              title={reason}
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <div className="font-bold text-brand-charcoal">{g.full_name}</div>
                                  {g.ratingSummary && g.ratingSummary.total_reviews > 0 && (
                                    <div className="flex items-center gap-0.5 text-[10px] text-amber-500 font-bold bg-amber-50 px-1.5 py-0.5 rounded">
                                      <Star size={10} className="fill-amber-500" />
                                      {g.ratingSummary.average_rating.toFixed(1)}
                                    </div>
                                  )}
                                  <ComplianceBadge 
                                    userId={g.id} 
                                    role="guide" 
                                    initialSummary={{
                                      isCompliant: g.compliance.status !== 'non_compliant',
                                      missingCount: g.compliance.issues.filter((i: any) => i.problem === 'missing').length,
                                      expiredCount: g.compliance.issues.filter((i: any) => i.problem === 'expired').length,
                                      expiringSoonCount: g.compliance.issues.filter((i: any) => i.problem === 'expiring_soon').length,
                                      pendingReviewCount: g.compliance.issues.filter((i: any) => i.problem === 'pending').length,
                                      rejectedCount: g.compliance.issues.filter((i: any) => i.problem === 'rejected').length,
                                      validCount: 0
                                    } as any}
                                    showLabels={true}
                                  />
                                </div>
                                <div className="text-[10px] text-gray-500 flex items-center gap-2 mt-0.5">
                                  <span>{g.email}</span>
                                  {g.city && <span className="flex items-center gap-0.5 before:content-['•'] before:mr-1">{g.city}{g.province ? `, ${g.province}` : ''}</span>}
                                </div>
                                {isDisabled && (
                                  <div className="text-[10px] text-red-500 font-medium mt-1 flex items-center gap-1">
                                    <AlertTriangle size={10} /> {reason}
                                  </div>
                                )}
                              </div>
                              <div className="text-right">
                                {!isDisabled ? (
                                  <span className="bg-brand-teal/10 text-brand-teal px-3 py-1 rounded text-[10px] font-bold uppercase">Select</span>
                                ) : (
                                  <Lock size={14} className="text-gray-300 ml-auto" />
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mt-6">
            <div className="p-6 border-b border-gray-100 bg-gray-50/50">
              <h2 className="font-bold text-brand-charcoal flex items-center gap-2">
                <RotateCcw size={18} className="text-brand-teal" /> Assignment Timeline
              </h2>
            </div>
            <div className="p-6">
              {statusHistoryLoading ? (
                <div className="text-sm text-gray-500 flex items-center gap-2">
                  <Loader2 className="animate-spin" size={16} /> Loading timeline...
                </div>
              ) : statusHistoryError ? (
                <div className="text-sm text-red-500">Failed to load timeline data.</div>
              ) : timelineEvents.length === 0 ? (
                <div className="text-sm text-gray-500">No events logged yet.</div>
              ) : (
                <div className="space-y-6 relative before:absolute before:left-[7px] before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-100">
                  {timelineEvents.map((event, idx) => (
                    <div key={idx} className="flex items-start gap-4 relative">
                      <div className={`mt-1.5 w-4 h-4 rounded-full border-2 border-white shadow-sm shrink-0 z-10 ${
                        event.type === 'status' ? 'bg-brand-teal' : 
                        event.type === 'vehicle' ? 'bg-purple-500' :
                        event.type === 'info' ? 'bg-orange-500' :
                        event.label.includes('declined') || event.label.includes('removed') || event.label.includes('replaced') ? 'bg-red-500' : 
                        event.label.includes('accepted') ? 'bg-green-500' : 
                        'bg-blue-500'
                      }`}>
                        {(event.avatar || event.initials) && (
                          <div className="absolute -left-1 -top-1 w-6 h-6 rounded-full bg-white border border-gray-100 overflow-hidden shadow-sm hidden md:flex items-center justify-center">
                            {event.avatar ? (
                              <img src={event.avatar} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <span className="text-[8px] font-bold text-gray-400">{event.initials}</span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className={`text-sm font-bold ${event.colorClass || 'text-brand-charcoal'}`}>
                            {event.label}
                          </p>
                          <span className="text-[10px] text-gray-400 font-mono bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100">
                            {new Date(event.timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        {event.note && (
                          <p className="text-xs text-gray-600 mt-1.5 bg-gray-50 p-2 rounded border border-gray-100 italic">
                            "{event.note}"
                          </p>
                        )}
                        <div className="text-[10px] text-gray-400 mt-1 uppercase font-bold tracking-wider">
                          Source: {event.source || 'System'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {booking?.status && (
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Actions</h3>
              <div className="space-y-3">
                {(() => {
                  const allowed = getAllowedActions(booking.status, !!booking.archived_at);
                  return (
                    <>
                      {allowed.includes('confirm') && (
                        <div className="space-y-4">
                          {hasPendingProviders && (
                            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs">
                              <h4 className="font-bold flex items-center gap-1 mb-1">
                                <AlertTriangle size={14} /> Provider acceptance pending
                              </h4>
                              <p className="mb-2">One or more assigned providers have not accepted this booking yet. You can still confirm the booking now or wait for provider acceptance.</p>
                              <ul className="space-y-0.5">
                                {pendingProviders.map((p, i) => (
                                  <li key={i} className="font-medium">{p.type}: {p.status.charAt(0).toUpperCase() + p.status.slice(1)}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          <button 
                            onClick={handleConfirmBooking} 
                            disabled={!isReady}
                            title={!isReady ? "Please complete all core booking details before confirming" : ""}
                            className={`w-full py-2.5 rounded-xl font-bold text-sm transition-colors shadow-sm ${
                              isReady 
                                ? 'bg-brand-teal text-white hover:bg-brand-teal/90' 
                                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                            }`}
                          >
                            Confirm Booking
                          </button>
                          {!isReady && (
                            <p className="text-[10px] text-amber-600 flex items-center gap-1 justify-center text-center">
                              <AlertCircle size={12} />
                              Please complete all core booking details before confirming. Resource assignments are optional.
                            </p>
                          )}
                        </div>
                      )}

                      {showNoShowModal && (
                        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
                          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
                            <div className="flex items-center gap-3 text-purple-600 mb-4">
                              <AlertTriangle size={24} />
                              <h3 className="font-bold text-xl">Report No-Show</h3>
                            </div>
                            <p className="text-sm text-gray-600 mb-6">
                              Are you sure you want to mark this booking as a no-show? This status is for operational tracking only and does not automatically process payouts or penalties.
                            </p>
                            
                            <div className="mb-6">
                              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                                Reason for no-show
                              </label>
                              <textarea
                                value={noShowReason}
                                onChange={(e) => setNoShowReason(e.target.value)}
                                placeholder="Briefly explain what happened. Example: guest did not arrive, provider did not arrive, wrong pickup details, or other issue."
                                className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none min-h-[100px] resize-none transition-all"
                              />
                            </div>
                            
                            <div className="flex gap-3">
                              <button 
                                onClick={() => { setShowNoShowModal(false); setNoShowReason(''); }} 
                                className="flex-1 py-3 rounded-xl font-bold text-sm bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                              >
                                Cancel
                              </button>
                              <button 
                                onClick={handleReportNoShow} 
                                disabled={reportingNoShow}
                                className="flex-1 py-3 rounded-xl font-bold text-sm bg-purple-600 text-white hover:bg-purple-700 transition-colors shadow-lg shadow-purple-200 disabled:opacity-50 flex items-center justify-center gap-2"
                              >
                                {reportingNoShow ? (
                                  <>
                                    <Loader2 size={16} className="animate-spin" />
                                    Reporting...
                                  </>
                                ) : (
                                  'Confirm No-Show'
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {showAcceptanceWarningModal && (
                        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
                            <h3 className="font-bold text-lg mb-2">Confirm booking with pending provider acceptance?</h3>
                            <p className="text-sm text-gray-600 mb-4">One or more assigned providers have not accepted this booking yet. You can confirm now and manage provider acceptance afterward.</p>
                            <ul className="text-sm font-medium mb-6 space-y-1">
                              {pendingProviders.map((p, i) => (
                                <li key={i}>{p.type}: {p.status.charAt(0).toUpperCase() + p.status.slice(1)}</li>
                              ))}
                            </ul>
                            <div className="flex gap-3">
                              <button onClick={() => setShowAcceptanceWarningModal(false)} className="flex-1 py-2 rounded-lg font-bold text-sm bg-gray-100 hover:bg-gray-200">Go Back</button>
                              <button onClick={() => { setShowAcceptanceWarningModal(false); handleStatusUpdate('confirmed'); }} className="flex-1 py-2 rounded-lg font-bold text-sm bg-brand-teal text-white hover:bg-brand-teal/90">Confirm Anyway</button>
                            </div>
                          </div>
                        </div>
                      )}

                      {showAssignmentNoShowModal && (
                        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
                          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
                            <div className="flex items-center gap-3 text-orange-600 mb-4">
                              <AlertTriangle size={24} />
                              <h3 className="font-bold text-xl">Report {showAssignmentNoShowModal.type.charAt(0).toUpperCase() + showAssignmentNoShowModal.type.slice(1)} No-Show</h3>
                            </div>
                            <p className="text-sm text-gray-600 mb-2">
                              Report no-show for <strong>{showAssignmentNoShowModal.name}</strong>.
                            </p>
                            <p className="text-xs text-gray-500 mb-6 italic">
                              This marks only this specific assignment as no-show. The overall booking status remains unchanged unless manually updated.
                            </p>
                            
                            <div className="mb-6">
                              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                                Reason for no-show
                              </label>
                              <textarea
                                value={assignmentNoShowReason}
                                onChange={(e) => setAssignmentNoShowReason(e.target.value)}
                                placeholder="Example: provider was late, wrong vehicle arrived, or did not show up at all."
                                className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none min-h-[80px] resize-none transition-all"
                              />
                            </div>
                            
                            <div className="flex gap-3">
                              <button 
                                onClick={() => { setShowAssignmentNoShowModal(null); setAssignmentNoShowReason(''); }} 
                                className="flex-1 py-3 rounded-xl font-bold text-sm bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                              >
                                Cancel
                              </button>
                              <button 
                                onClick={handleReportAssignmentNoShow} 
                                disabled={reportingAssignmentNoShow}
                                className="flex-1 py-3 rounded-xl font-bold text-sm bg-orange-600 text-white hover:bg-orange-700 transition-colors shadow-lg shadow-orange-200 disabled:opacity-50 flex items-center justify-center gap-2"
                              >
                                {reportingAssignmentNoShow ? (
                                  <>
                                    <Loader2 size={16} className="animate-spin" />
                                    Reporting...
                                  </>
                                ) : (
                                  'Confirm No-Show'
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                      {allowed.includes('complete') && (() => {
                        const missingAcceptance = [];
                        const declined = [];
                        
                        if (assignedDriver) {
                          if (assignedDriver.status === 'rejected') declined.push('Driver');
                          else if (!['accepted', 'completed'].includes(assignedDriver.status || '')) missingAcceptance.push('Driver');
                        }
                        if (assignedGuide) {
                          if (assignedGuide.status === 'rejected') declined.push('Guide');
                          else if (!['accepted', 'completed'].includes(assignedGuide.status || '')) missingAcceptance.push('Guide');
                        }

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

                        let isBlocked = false;
                        let blockedReason = "";
                        
                        if (booking.status === 'completed' || booking.status === 'cancelled') {
                          isBlocked = true;
                          blockedReason = `Booking is already ${booking.status}.`;
                        } else if (booking.archived_at) {
                          isBlocked = true;
                          blockedReason = "Booking is archived.";
                        } else if (declined.length > 0) {
                          isBlocked = true;
                          blockedReason = `Assigned ${declined.join('/')} declined.`;
                        } else if (missingAcceptance.length > 0) {
                          isBlocked = true;
                          blockedReason = `Assigned providers have not accepted: ${missingAcceptance.join(', ')}.`;
                        } else if (providersCompliant === false) {
                          isBlocked = true;
                          blockedReason = "Required provider compliance is invalid.";
                        } else if (!hasEscrowFundsReceived(booking)) {
                          isBlocked = true;
                          blockedReason = "Escrow funds have not been received.";
                        } 

                        return (
                          <div className="flex flex-col gap-1">
                            <button 
                              onClick={() => handleStatusUpdate('completed')} 
                              disabled={isBlocked}
                              title={blockedReason}
                              className={`w-full text-white py-2.5 rounded-xl font-bold text-sm transition-colors shadow-sm ${
                                isBlocked ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'
                              }`}
                            >
                              Mark Completed
                            </button>
                            {isBlocked && (
                              <p className="text-[10px] text-red-500 font-medium text-center">
                                {blockedReason}
                              </p>
                            )}
                          </div>
                        );
                      })()}
                      {allowed.includes('cancel') && (
                        <div className="flex flex-col gap-1">
                          <button 
                            onClick={() => handleStatusUpdate('cancelled')} 
                            disabled={isFinanciallyLocked}
                            title={isFinanciallyLocked ? "This booking cannot be cancelled because provider payouts have already been released." : ""}
                            className={`w-full bg-white text-red-600 border-2 border-red-100 py-2.5 rounded-xl font-bold text-sm transition-colors ${
                              isFinanciallyLocked ? 'opacity-50 cursor-not-allowed' : 'hover:bg-red-50'
                            }`}
                          >
                            Cancel Booking
                          </button>
                        </div>
                      )}
                      {booking.status !== 'completed' && booking.status !== 'cancelled' && booking.status !== 'no_show' && !booking.archived_at && (
                        <div className="flex flex-col gap-1">
                          <button 
                            onClick={() => handleStatusUpdate('no_show')} 
                            disabled={isFinanciallyLocked || !canReportNoShow}
                            title={isFinanciallyLocked ? "Financial lock active." : !canReportNoShow ? "No-show can only be reported once the booking starts." : ""}
                            className={`w-full bg-white text-purple-600 border-2 border-purple-100 py-2.5 rounded-xl font-bold text-sm transition-colors ${
                              (isFinanciallyLocked || !canReportNoShow) ? 'opacity-50 cursor-not-allowed' : 'hover:bg-purple-50'
                            }`}
                          >
                            Report No-Show
                          </button>
                          {!canReportNoShow && (
                            <p className="text-[10px] text-amber-600 font-medium text-center">
                              Available after {new Date(new Date(booking.start_date).getTime() - 5 * 60 * 1000).toLocaleString()}
                            </p>
                          )}
                        </div>
                      )}
                      {allowed.includes('archive') && (
                        <button 
                          onClick={handleArchiveToggle} 
                          title="Archive hides this completed or cancelled trip from active lists. Records are preserved."
                          className="w-full bg-gray-100 py-2.5 rounded-xl font-bold text-sm text-gray-700 hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
                        >
                          <Archive size={16} /> Archive
                        </button>
                      )}
                      {allowed.includes('unarchive') && (
                        <button onClick={handleArchiveToggle} className="w-full bg-gray-100 py-2.5 rounded-xl font-bold text-sm text-gray-700 hover:bg-gray-200 transition-colors flex items-center justify-center gap-2">
                          <Archive size={16} /> Unarchive
                        </button>
                      )}
                      {!booking.archived_at && (
                        <>
                          <button 
                            onClick={() => {
                              setDuplicateConfig({
                                startDate: toLocalDatetimeString(booking.start_date),
                                endDate: toLocalDatetimeString(booking.end_date),
                                includeResources: false
                              });
                              setShowDuplicateModal(true);
                            }}
                            className="w-full bg-white border-2 border-brand-charcoal text-brand-charcoal py-2.5 rounded-xl font-bold text-sm hover:bg-brand-charcoal/5 transition-colors flex items-center justify-center gap-2"
                          >
                            <Copy size={16} /> Duplicate Booking
                          </button>
                          <button 
                            onClick={() => {
                              setRepeatConfig({
                                ...repeatConfig,
                                startDate: toLocalDateString(booking.start_date),
                                endDate: toLocalDateString(booking.end_date)
                              });
                              setShowRepeatModal(true);
                            }}
                            className="w-full bg-brand-charcoal text-white py-2.5 rounded-xl font-bold text-sm hover:bg-black transition-colors shadow-sm flex items-center justify-center gap-2"
                          >
                            <Repeat size={16} /> Repeat Booking
                          </button>
                        </>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          )}

          {isOperatorOrAdmin && selectedVehicleDetails && (
            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-brand-charcoal flex items-center gap-2">
                  <div className="p-2 bg-brand-charcoal/10 rounded-lg text-brand-charcoal">
                    <Truck size={20} />
                  </div>
                  Vehicle Pricing
                </h3>
              </div>
              <div className="space-y-4 pt-2 border-t border-gray-100">
                <div className="flex justify-between items-center mb-2">
                  <div className="flex flex-col">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Pricing Mode</label>
                    {vehicleRateOverridden ? (
                      <span className="text-[10px] text-brand-coral font-medium">
                        Manual Booking Override
                      </span>
                    ) : (
                      <span className="text-[10px] text-brand-teal font-medium">
                        {vehicleRateAutoSource === 'negotiated' ? 'Negotiated Linked Rate' : 'Default Vehicle Rate'}
                      </span>
                    )}
                  </div>
                  <button 
                    onClick={() => setVehicleRateOverridden(!vehicleRateOverridden)}
                    disabled={booking?.status === 'completed'}
                    className={`text-[10px] font-bold px-2 py-1 rounded transition-colors disabled:opacity-50 ${vehicleRateOverridden ? 'bg-brand-coral text-white' : 'bg-gray-100 text-gray-500'}`}
                  >
                    {vehicleRateOverridden ? 'Manual Mode' : 'Auto Mode'}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => setVehicleRateType('day')} 
                    disabled={booking?.status === 'completed'}
                    className={`py-2 text-xs font-bold rounded-xl border-2 transition-colors disabled:opacity-50 ${vehicleRateType === 'day' ? 'border-brand-teal bg-brand-teal/5 text-brand-teal' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
                  >
                    Per Day
                  </button>
                  <button 
                    onClick={() => setVehicleRateType('hour')} 
                    disabled={booking?.status === 'completed'}
                    className={`py-2 text-xs font-bold rounded-xl border-2 transition-colors disabled:opacity-50 ${vehicleRateType === 'hour' ? 'border-brand-teal bg-brand-teal/5 text-brand-teal' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
                  >
                    Per Hour
                  </button>
                </div>
                <div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">R</span>
                    <input 
                      type="number" 
                      className="w-full border border-gray-300 rounded-xl py-2.5 pl-8 pr-3 text-sm focus:ring-2 focus:ring-brand-teal focus:border-brand-teal outline-none transition-all disabled:opacity-50" 
                      value={vehicleRateAmount} 
                      onChange={e => setVehicleRateAmount(e.target.value)} 
                      disabled={!vehicleRateOverridden || booking?.status === 'completed'} 
                      placeholder="0.00" 
                    />
                  </div>
                </div>
                <button 
                  onClick={async () => {
                    if (!booking.vehicle_id) return;
                    try {
                      await saveVehicleToBooking(booking.vehicle_id);
                      showNotice('success', 'Pricing saved successfully.');
                    } catch (err: any) {
                      showNotice('error', getFriendlyErrorMessage(err, 'Failed to save pricing.'));
                    }
                  }} 
                  disabled={savingVehicle || !booking.vehicle_id || booking?.status === 'completed'} 
                  className="w-full py-2.5 bg-brand-charcoal text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                  {savingVehicle ? <Loader2 className="animate-spin" size={16}/> : <Save size={16}/>} Save Pricing
                </button>
              </div>
            </div>
          )}

          {/* Payouts / Settlement Section */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <div className="mb-4">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                  <CreditCard size={16} /> Payouts & Settlement
                </h3>
                {isOperatorOrAdmin && booking?.status === 'completed' && !isFinanciallyLocked && (!driverPayout || !guidePayout || (booking.vehicle_id && !vehiclePayout)) && (
                  <button
                    onClick={handleRegeneratePayouts}
                    disabled={!!updatingPayout}
                    className="text-[10px] text-brand-teal hover:underline font-bold uppercase flex items-center gap-1 disabled:opacity-50 disabled:no-underline"
                  >
                    {updatingPayout ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
                    Regenerate Missing Payouts
                  </button>
                )}
              </div>
              {(booking?.status === 'completed' || payoutLedgers.length > 0) && (
                <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-xl flex items-start gap-3">
                  <Info size={16} className="text-blue-600 mt-0.5 shrink-0" />
                  <p className="text-[11px] text-blue-800 leading-relaxed">
                    If a provider failed to arrive or delivered the wrong service, use <span className="font-bold uppercase tracking-tight">Raise Dispute</span> on that provider’s payout. This will place the payout on hold until Admin reviews it.
                  </p>
                </div>
              )}
              <p className="text-[10px] text-gray-500 mt-2">
                Net provider payouts after TourFlow fee.
              </p>
            </div>
            
            <div className="flex flex-col divide-y divide-gray-100 border-t border-gray-100 mt-4">
              {/* Driver Payout */}
              <div className="py-4 flex flex-col gap-3">
                <div className="flex justify-between items-start">
                  <div className="flex flex-col">
                    <span className="font-bold text-gray-700 text-sm">Driver</span>
                    <span className="text-xs text-gray-500 mt-0.5">{assignedDriver?.profile?.full_name || 'No driver assigned'}</span>
                  </div>
                  <span className={`text-[10px] font-bold uppercase ${
                    driverPayout?.status === 'cancelled' ? 'text-gray-500' :
                    driverPayout?.is_on_hold ? 'text-red-600' :
                    driverPayout?.status === 'paid' ? 'text-green-600' :
                    driverPayout?.status === 'approved' ? 'text-blue-600' :
                    driverPayout?.status === 'pending' ? 'text-brand-teal' : 'text-amber-500'
                  }`}>
                    {driverPayout ? (
                      driverPayout.is_on_hold ? (driverPayout.hold_reason === 'dispute' ? 'DISPUTED' : 'ON HOLD') :
                      driverPayout.status === 'cancelled' ? 'Cancelled' :
                      driverPayout.status === 'paid' ? (driverPayout.adjusted_amount !== null && driverPayout.adjusted_amount !== undefined && driverPayout.adjusted_amount < getOriginalAmount(driverPayout) ? 'Paid, Reduced' : 'Paid') :
                      driverPayout.status === 'approved' ? (
                        (driverPayout.adjusted_amount ?? 0) > 0 && (driverPayout.adjusted_amount ?? 0) < getOriginalAmount(driverPayout) ? 'Resolved, Reduced' :
                        (driverPayout.adjusted_amount ?? 0) > 0 ? 'Resolved, Approved' :
                        'Approved'
                      ) :
                      driverPayout.status === 'pending' ? 'Ready for Payout' : 'Ready'
                    ) : (booking?.status === 'completed' ? '' : 'Pending')}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 bg-gray-50 rounded-lg p-3">
                  <div className="flex flex-col">
                    <span className="text-[9px] text-gray-400 uppercase font-bold tracking-wider">Agreed Rate</span>
                    <span className="font-mono text-xs text-gray-600 mt-0.5">{driverPayout ? `R ${driverPayout.amount_gross.toLocaleString()}` : '-'}</span>
                  </div>
                  <div className="flex flex-col border-l border-gray-200 pl-3">
                    <span className="text-[9px] text-gray-400 uppercase font-bold tracking-wider">Platform Fee</span>
                    <span className="font-mono text-xs text-gray-600 mt-0.5">{driverPayout ? `R ${driverPayout.platform_fee.toLocaleString()}` : '-'}</span>
                  </div>
                  <div className="flex flex-col text-right border-l border-gray-200 pl-3">
                    <span className="text-[9px] text-gray-400 uppercase font-bold tracking-wider">Net Payout</span>
                    <span className="font-mono font-bold text-brand-charcoal text-sm mt-0.5">
                      R {(driverPayout ? getPayableAmount(driverPayout) : 0).toLocaleString()}
                      {!driverPayout && <span className="text-[10px] text-gray-400 ml-1 font-normal">(Est)</span>}
                    </span>
                  </div>
                </div>

                {isOperatorOrAdmin && booking?.status === 'completed' && (
                  <div className="flex items-center justify-end gap-2 mt-1">
                    {!driverPayout ? (
                      <span className="text-[10px] text-amber-600 font-bold italic">Payout record missing</span>
                    ) : driverPayout.status === 'pending' ? (
                      <>
                        {isAdmin && (
                          <button
                            onClick={() => handleUpdatePayoutStatus(driverPayout.id, 'approved', 'driver')}
                            disabled={updatingPayout === 'driver' || driverPayout.is_on_hold}
                            title={driverPayout.is_on_hold ? "Payout is on hold. Resolve dispute to continue." : ""}
                            className="px-3 py-1 bg-brand-teal text-white text-[10px] font-bold uppercase rounded hover:bg-brand-teal/90 disabled:opacity-50"
                          >
                            {updatingPayout === 'driver' ? <Loader2 size={12} className="animate-spin inline" /> : 'Approve'}
                          </button>
                        )}
                        {!driverPayout.is_on_hold && (
                          <button
                            onClick={() => setDisputeModal({ isOpen: true, payoutId: driverPayout.id, resource: 'driver' })}
                            className="px-3 py-1 bg-white text-red-600 border border-red-100 text-[10px] font-bold uppercase rounded hover:bg-red-50"
                          >
                            Raise Dispute
                          </button>
                        )}
                      </>
                    ) : driverPayout.status === 'approved' ? (
                      <>
                        {isAdmin && (
                          <button
                            onClick={() => handleUpdatePayoutStatus(driverPayout.id, 'paid', 'driver')}
                            disabled={updatingPayout === 'driver' || driverPayout.is_on_hold}
                            title={driverPayout.is_on_hold ? "Payout is on hold. Resolve dispute to continue." : ""}
                            className="px-3 py-1 bg-green-600 text-white text-[10px] font-bold uppercase rounded hover:bg-green-700 disabled:opacity-50"
                          >
                            {updatingPayout === 'driver' ? <Loader2 size={12} className="animate-spin inline" /> : 'Mark as Paid'}
                          </button>
                        )}
                        {!driverPayout.is_on_hold && (
                          <button
                            onClick={() => setDisputeModal({ isOpen: true, payoutId: driverPayout.id, resource: 'driver' })}
                            className="px-3 py-1 bg-white text-red-600 border border-red-100 text-[10px] font-bold uppercase rounded hover:bg-red-50"
                          >
                            Raise Dispute
                          </button>
                        )}
                      </>
                    ) : null}
                  </div>
                )}
                
                {driverPayout?.is_on_hold && (
                  <div className="bg-red-50/50 rounded-md p-2 text-[10px] text-red-600 font-bold flex flex-col gap-1 mt-1">
                    <div className="flex items-center gap-1">
                      <ShieldAlert size={12} /> This payout is currently on hold and cannot be approved or paid. Resolve dispute to continue.
                    </div>
                    {(() => {
                      const d = disputes.find(dis => dis.payout_id === driverPayout.id && dis.status === 'open');
                      const r = d?.reason || (driverPayout.hold_reason !== 'dispute' ? driverPayout.hold_reason : null);
                      return r ? <p className="ml-4 font-medium opacity-90 italic">Reason: {r}</p> : null;
                    })()}
                  </div>
                )}
              </div>

              {/* Guide Payout */}
              <div className="py-4 flex flex-col gap-3">
                <div className="flex justify-between items-start">
                  <div className="flex flex-col">
                    <span className="font-bold text-gray-700 text-sm">Guide</span>
                    <span className="text-xs text-gray-500 mt-0.5">{assignedGuide?.profile?.full_name || 'No guide assigned'}</span>
                  </div>
                  <span className={`text-[10px] font-bold uppercase ${
                    guidePayout?.status === 'cancelled' ? 'text-gray-500' :
                    guidePayout?.is_on_hold ? 'text-red-600' :
                    guidePayout?.status === 'paid' ? 'text-green-600' :
                    guidePayout?.status === 'approved' ? 'text-blue-600' :
                    guidePayout?.status === 'pending' ? 'text-brand-teal' : 'text-amber-500'
                  }`}>
                    {guidePayout ? (
                      guidePayout.is_on_hold ? (guidePayout.hold_reason === 'dispute' ? 'DISPUTED' : 'ON HOLD') :
                      guidePayout.status === 'cancelled' ? 'Cancelled' :
                      guidePayout.status === 'paid' ? (guidePayout.adjusted_amount !== null && guidePayout.adjusted_amount !== undefined && guidePayout.adjusted_amount < getOriginalAmount(guidePayout) ? 'Paid, Reduced' : 'Paid') :
                      guidePayout.status === 'approved' ? (
                        (guidePayout.adjusted_amount ?? 0) > 0 && (guidePayout.adjusted_amount ?? 0) < getOriginalAmount(guidePayout) ? 'Resolved, Reduced' :
                        (guidePayout.adjusted_amount ?? 0) > 0 ? 'Resolved, Approved' :
                        'Approved'
                      ) :
                      guidePayout.status === 'pending' ? 'Ready for Payout' : 'Ready'
                    ) : (booking?.status === 'completed' ? '' : 'Pending')}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 bg-gray-50 rounded-lg p-3">
                  <div className="flex flex-col">
                    <span className="text-[9px] text-gray-400 uppercase font-bold tracking-wider">Agreed Rate</span>
                    <span className="font-mono text-xs text-gray-600 mt-0.5">{guidePayout ? `R ${guidePayout.amount_gross.toLocaleString()}` : '-'}</span>
                  </div>
                  <div className="flex flex-col border-l border-gray-200 pl-3">
                    <span className="text-[9px] text-gray-400 uppercase font-bold tracking-wider">Platform Fee</span>
                    <span className="font-mono text-xs text-gray-600 mt-0.5">{guidePayout ? `R ${guidePayout.platform_fee.toLocaleString()}` : '-'}</span>
                  </div>
                  <div className="flex flex-col text-right border-l border-gray-200 pl-3">
                    <span className="text-[9px] text-gray-400 uppercase font-bold tracking-wider">Net Payout</span>
                    <span className="font-mono font-bold text-brand-charcoal text-sm mt-0.5">
                      R {(guidePayout ? getPayableAmount(guidePayout) : 0).toLocaleString()}
                      {!guidePayout && <span className="text-[10px] text-gray-400 ml-1 font-normal">(Est)</span>}
                    </span>
                  </div>
                </div>

                {isOperatorOrAdmin && booking?.status === 'completed' && (
                  <div className="flex items-center justify-end gap-2 mt-1">
                    {!guidePayout ? (
                      <span className="text-[10px] text-amber-600 font-bold italic">Payout record missing</span>
                    ) : guidePayout.status === 'pending' ? (
                      <>
                        {isAdmin && (
                          <button
                            onClick={() => handleUpdatePayoutStatus(guidePayout.id, 'approved', 'guide')}
                            disabled={updatingPayout === 'guide' || guidePayout.is_on_hold}
                            title={guidePayout.is_on_hold ? "Payout is on hold. Resolve dispute to continue." : ""}
                            className="px-3 py-1 bg-brand-teal text-white text-[10px] font-bold uppercase rounded hover:bg-brand-teal/90 disabled:opacity-50"
                          >
                            {updatingPayout === 'guide' ? <Loader2 size={12} className="animate-spin inline" /> : 'Approve'}
                          </button>
                        )}
                        {!guidePayout.is_on_hold && (
                          <button
                            onClick={() => setDisputeModal({ isOpen: true, payoutId: guidePayout.id, resource: 'guide' })}
                            className="px-3 py-1 bg-white text-red-600 border border-red-100 text-[10px] font-bold uppercase rounded hover:bg-red-50"
                          >
                            Raise Dispute
                          </button>
                        )}
                      </>
                    ) : guidePayout.status === 'approved' ? (
                      <>
                        {isAdmin && (
                          <button
                            onClick={() => handleUpdatePayoutStatus(guidePayout.id, 'paid', 'guide')}
                            disabled={updatingPayout === 'guide' || guidePayout.is_on_hold}
                            title={guidePayout.is_on_hold ? "Payout is on hold. Resolve dispute to continue." : ""}
                            className="px-3 py-1 bg-green-600 text-white text-[10px] font-bold uppercase rounded hover:bg-green-700 disabled:opacity-50"
                          >
                            {updatingPayout === 'guide' ? <Loader2 size={12} className="animate-spin inline" /> : 'Mark as Paid'}
                          </button>
                        )}
                        {!guidePayout.is_on_hold && (
                          <button
                            onClick={() => setDisputeModal({ isOpen: true, payoutId: guidePayout.id, resource: 'guide' })}
                            className="px-3 py-1 bg-white text-red-600 border border-red-100 text-[10px] font-bold uppercase rounded hover:bg-red-50"
                          >
                            Raise Dispute
                          </button>
                        )}
                      </>
                    ) : null}
                  </div>
                )}

                {guidePayout?.is_on_hold && (
                  <div className="bg-red-50/50 rounded-md p-2 text-[10px] text-red-600 font-bold flex flex-col gap-1 mt-1">
                    <div className="flex items-center gap-1">
                      <ShieldAlert size={12} /> This payout is currently on hold and cannot be approved or paid. Resolve dispute to continue.
                    </div>
                    {(() => {
                      const d = disputes.find(dis => dis.payout_id === guidePayout.id && dis.status === 'open');
                      const r = d?.reason || (guidePayout.hold_reason !== 'dispute' ? guidePayout.hold_reason : null);
                      return r ? <p className="ml-4 font-medium opacity-90 italic">Reason: {r}</p> : null;
                    })()}
                  </div>
                )}
              </div>

              {/* Vehicle Payout */}
              <div className="py-4 flex flex-col gap-3">
                <div className="flex justify-between items-start">
                  <div className="flex flex-col">
                    <span className="font-bold text-gray-700 text-sm">Vehicle</span>
                    <span className="text-xs text-gray-500 mt-0.5">{selectedVehicleDetails ? `${selectedVehicleDetails.make} ${selectedVehicleDetails.model}` : 'No vehicle assigned'}</span>
                  </div>
                  <span className={`text-[10px] font-bold uppercase ${
                    vehiclePayout?.status === 'cancelled' ? 'text-gray-500' :
                    vehiclePayout?.is_on_hold ? 'text-red-600' :
                    vehiclePayout?.status === 'paid' ? 'text-green-600' :
                    vehiclePayout?.status === 'approved' ? 'text-blue-600' :
                    vehiclePayout?.status === 'pending' ? 'text-brand-teal' : 'text-amber-500'
                  }`}>
                    {vehiclePayout ? (
                      vehiclePayout.is_on_hold ? (vehiclePayout.hold_reason === 'dispute' ? 'DISPUTED' : 'ON HOLD') :
                      vehiclePayout.status === 'cancelled' ? 'Cancelled' :
                      vehiclePayout.status === 'paid' ? (vehiclePayout.adjusted_amount !== null && vehiclePayout.adjusted_amount !== undefined && vehiclePayout.adjusted_amount < getOriginalAmount(vehiclePayout) ? 'Paid, Reduced' : 'Paid') :
                      vehiclePayout.status === 'approved' ? (
                        (vehiclePayout.adjusted_amount ?? 0) > 0 && (vehiclePayout.adjusted_amount ?? 0) < getOriginalAmount(vehiclePayout) ? 'Resolved, Reduced' :
                        (vehiclePayout.adjusted_amount ?? 0) > 0 ? 'Resolved, Approved' :
                        'Approved'
                      ) :
                      vehiclePayout.status === 'pending' ? 'Ready for Payout' : 'Ready'
                    ) : (booking?.status === 'completed' ? '' : 'Pending')}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 bg-gray-50 rounded-lg p-3">
                  <div className="flex flex-col">
                    <span className="text-[9px] text-gray-400 uppercase font-bold tracking-wider">Agreed Rate</span>
                    <span className="font-mono text-xs text-gray-600 mt-0.5">{vehiclePayout ? `R ${vehiclePayout.amount_gross.toLocaleString()}` : '-'}</span>
                  </div>
                  <div className="flex flex-col border-l border-gray-200 pl-3">
                    <span className="text-[9px] text-gray-400 uppercase font-bold tracking-wider">Platform Fee</span>
                    <span className="font-mono text-xs text-gray-600 mt-0.5">{vehiclePayout ? `R ${vehiclePayout.platform_fee.toLocaleString()}` : '-'}</span>
                  </div>
                  <div className="flex flex-col text-right border-l border-gray-200 pl-3">
                    <span className="text-[9px] text-gray-400 uppercase font-bold tracking-wider">Net Payout</span>
                    <span className="font-mono font-bold text-brand-charcoal text-sm mt-0.5">
                      R {(vehiclePayout ? getPayableAmount(vehiclePayout) : 0).toLocaleString()}
                      {!vehiclePayout && <span className="text-[10px] text-gray-400 ml-1 font-normal">(Est)</span>}
                    </span>
                  </div>
                </div>

                {isOperatorOrAdmin && booking?.status === 'completed' && (
                  <div className="flex items-center justify-end gap-2 mt-1">
                    {!vehiclePayout ? (
                      <span className="text-[10px] text-amber-600 font-bold italic">Payout record missing</span>
                    ) : vehiclePayout.status === 'pending' ? (
                      <>
                        {isAdmin && (
                          <button
                            onClick={() => handleUpdatePayoutStatus(vehiclePayout.id, 'approved', 'vehicle')}
                            disabled={updatingPayout === 'vehicle' || vehiclePayout.is_on_hold}
                            title={vehiclePayout.is_on_hold ? "Payout is on hold. Resolve dispute to continue." : ""}
                            className="px-3 py-1 bg-brand-teal text-white text-[10px] font-bold uppercase rounded hover:bg-brand-teal/90 disabled:opacity-50"
                          >
                            {updatingPayout === 'vehicle' ? <Loader2 size={12} className="animate-spin inline" /> : 'Approve'}
                          </button>
                        )}
                        {!vehiclePayout.is_on_hold && (
                          <button
                            onClick={() => setDisputeModal({ isOpen: true, payoutId: vehiclePayout.id, resource: 'vehicle' })}
                            className="px-3 py-1 bg-white text-red-600 border border-red-100 text-[10px] font-bold uppercase rounded hover:bg-red-50"
                          >
                            Raise Dispute
                          </button>
                        )}
                      </>
                    ) : vehiclePayout.status === 'approved' ? (
                      <>
                        {isAdmin && (
                          <button
                            onClick={() => handleUpdatePayoutStatus(vehiclePayout.id, 'paid', 'vehicle')}
                            disabled={updatingPayout === 'vehicle' || vehiclePayout.is_on_hold}
                            title={vehiclePayout.is_on_hold ? "Payout is on hold. Resolve dispute to continue." : ""}
                            className="px-3 py-1 bg-green-600 text-white text-[10px] font-bold uppercase rounded hover:bg-green-700 disabled:opacity-50"
                          >
                            {updatingPayout === 'vehicle' ? <Loader2 size={12} className="animate-spin inline" /> : 'Mark as Paid'}
                          </button>
                        )}
                        {!vehiclePayout.is_on_hold && (
                          <button
                            onClick={() => setDisputeModal({ isOpen: true, payoutId: vehiclePayout.id, resource: 'vehicle' })}
                            className="px-3 py-1 bg-white text-red-600 border border-red-100 text-[10px] font-bold uppercase rounded hover:bg-red-50"
                          >
                            Raise Dispute
                          </button>
                        )}
                      </>
                    ) : null}
                  </div>
                )}

                {vehiclePayout?.is_on_hold && (
                  <div className="bg-red-50/50 rounded-md p-2 text-[10px] text-red-600 font-bold flex flex-col gap-1 mt-1">
                    <div className="flex items-center gap-1">
                      <ShieldAlert size={12} /> This payout is currently on hold and cannot be approved or paid. Resolve dispute to continue.
                    </div>
                    {(() => {
                      const d = disputes.find(dis => dis.payout_id === vehiclePayout.id && dis.status === 'open');
                      const r = d?.reason || (vehiclePayout.hold_reason !== 'dispute' ? vehiclePayout.hold_reason : null);
                      return r ? <p className="ml-4 font-medium opacity-90 italic">Reason: {r}</p> : null;
                    })()}
                  </div>
                )}
              </div>
            </div>
          </div>

          <BookingChat 
            bookingId={booking.id} 
            bookingReference={booking.booking_reference} 
          />
        </div>
      </div>
      {/* Duplicate Booking Modal */}
      {showDuplicateModal && (
        <div className="fixed inset-0 bg-brand-charcoal/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden border border-gray-100">
            <div className="bg-brand-charcoal p-6 text-white flex justify-between items-center">
              <div className="flex items-center gap-3">
                <Copy size={20} />
                <h3 className="text-xl font-bold">Duplicate booking</h3>
              </div>
              <button 
                onClick={() => setShowDuplicateModal(false)}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
                disabled={duplicating}
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <p className="text-sm text-gray-500">
                This creates a new draft booking. Payments, payouts, disputes, reviews, chat messages, and audit history will not be copied.
              </p>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">New Start Date & Time</label>
                  <input
                    type="datetime-local"
                    value={duplicateConfig.startDate}
                    onChange={e => setDuplicateConfig(prev => ({ ...prev, startDate: e.target.value }))}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-brand-charcoal focus:ring-2 focus:ring-brand-charcoal/20 outline-none transition-all"
                    disabled={duplicating}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">New End Date & Time</label>
                  <input
                    type="datetime-local"
                    value={duplicateConfig.endDate}
                    onChange={e => setDuplicateConfig(prev => ({ ...prev, endDate: e.target.value }))}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-brand-charcoal focus:ring-2 focus:ring-brand-charcoal/20 outline-none transition-all"
                    disabled={duplicating}
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 bg-brand-charcoal/5 rounded-2xl border border-brand-charcoal/10">
                <input
                  type="checkbox"
                  id="reuseResources"
                  checked={duplicateConfig.includeResources}
                  onChange={e => setDuplicateConfig(prev => ({ ...prev, includeResources: e.target.checked }))}
                  className="w-5 h-5 rounded border-gray-300 text-brand-charcoal focus:ring-brand-charcoal"
                  disabled={duplicating}
                />
                <label htmlFor="reuseResources" className="text-sm font-medium text-brand-charcoal cursor-pointer select-none">
                  Try to reuse the same Driver, Guide, and Vehicle
                </label>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowDuplicateModal(false)}
                  className="flex-1 px-6 py-3.5 rounded-xl border-2 border-gray-100 font-bold text-gray-600 hover:bg-gray-50 transition-colors"
                  disabled={duplicating}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDuplicateBooking}
                  className="flex-1 px-6 py-3.5 rounded-xl bg-brand-charcoal text-white font-bold hover:bg-black transition-all shadow-md disabled:bg-gray-300 flex items-center justify-center gap-2"
                  disabled={duplicating || !duplicateConfig.startDate || !duplicateConfig.endDate}
                >
                  {duplicating ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Duplicating...
                    </>
                  ) : (
                    'Confirm Duplication'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Repeat Booking Modal */}
      {showRepeatModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-brand-charcoal text-white">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Repeat size={20} /> Repeat Booking
              </h3>
              <button onClick={() => setShowRepeatModal(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Frequency</label>
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => setRepeatConfig(prev => ({ ...prev, frequency: 'daily' }))}
                    className={`py-2 text-sm font-bold rounded-xl border-2 transition-all ${repeatConfig.frequency === 'daily' ? 'border-brand-teal bg-brand-teal/5 text-brand-teal' : 'border-gray-100 text-gray-500 hover:border-gray-200'}`}
                  >
                    Daily
                  </button>
                  <button 
                    onClick={() => setRepeatConfig(prev => ({ ...prev, frequency: 'weekly' }))}
                    className={`py-2 text-sm font-bold rounded-xl border-2 transition-all ${repeatConfig.frequency === 'weekly' ? 'border-brand-teal bg-brand-teal/5 text-brand-teal' : 'border-gray-100 text-gray-500 hover:border-gray-200'}`}
                  >
                    Weekly
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Start Date for First Repeat</label>
                <input 
                  type="date" 
                  className="w-full border border-gray-200 rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-brand-teal outline-none transition-all"
                  value={repeatConfig.startDate}
                  onChange={e => setRepeatConfig(prev => ({ ...prev, startDate: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">End Condition</label>
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => setRepeatConfig(prev => ({ ...prev, endCondition: 'count' }))}
                    className={`py-2 text-sm font-bold rounded-xl border-2 transition-all ${repeatConfig.endCondition === 'count' ? 'border-brand-teal bg-brand-teal/5 text-brand-teal' : 'border-gray-100 text-gray-500 hover:border-gray-200'}`}
                  >
                    Number of Times
                  </button>
                  <button 
                    onClick={() => setRepeatConfig(prev => ({ ...prev, endCondition: 'endDate' }))}
                    className={`py-2 text-sm font-bold rounded-xl border-2 transition-all ${repeatConfig.endCondition === 'endDate' ? 'border-brand-teal bg-brand-teal/5 text-brand-teal' : 'border-gray-100 text-gray-500 hover:border-gray-200'}`}
                  >
                    End Date
                  </button>
                </div>
              </div>

              {repeatConfig.endCondition === 'count' ? (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Repeat Count</label>
                  <input 
                    type="number" 
                    min="1"
                    max="50"
                    className="w-full border border-gray-200 rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-brand-teal outline-none transition-all"
                    value={repeatConfig.repeatCount}
                    onChange={e => setRepeatConfig(prev => ({ ...prev, repeatCount: parseInt(e.target.value) || 1 }))}
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">End Date</label>
                  <input 
                    type="date" 
                    className="w-full border border-gray-200 rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-brand-teal outline-none transition-all"
                    value={repeatConfig.endDate}
                    onChange={e => setRepeatConfig(prev => ({ ...prev, endDate: e.target.value }))}
                  />
                </div>
              )}

              <label className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl cursor-pointer hover:bg-gray-100 transition-colors group">
                <input 
                  type="checkbox" 
                  className="w-5 h-5 rounded border-gray-300 text-brand-teal focus:ring-brand-teal transition-all"
                  checked={repeatConfig.includeResources}
                  onChange={e => setRepeatConfig(prev => ({ ...prev, includeResources: e.target.checked }))}
                />
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-brand-charcoal group-hover:text-black transition-colors">Include Assigned Resources</span>
                  <span className="text-[10px] text-gray-500">Carry forward driver, guide, and vehicle selections</span>
                </div>
              </label>
            </div>
            <div className="p-6 bg-gray-50 flex gap-3">
              <button 
                onClick={() => setShowRepeatModal(false)}
                className="flex-1 py-3 border border-gray-200 rounded-xl font-bold text-sm text-gray-600 hover:bg-white transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={handleCreateRecurring}
                disabled={creatingRecurring || !repeatConfig.startDate}
                className="flex-1 py-3 bg-brand-teal text-white rounded-xl font-bold text-sm hover:bg-brand-teal/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-brand-teal/20"
              >
                {creatingRecurring ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
                Create Bookings
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Review Modal */}
      {reviewModalData && user && (
        <ReviewModal
          isOpen={!!reviewModalData}
          onClose={() => setReviewModalData(null)}
          bookingId={booking.id}
          operatorId={user.id}
          providerId={reviewModalData.providerId}
          providerName={reviewModalData.providerName}
          providerRole={reviewModalData.role}
          onSuccess={() => {
            showNotice('success', 'Thank you! Your review has been submitted.');
            loadReviews();
          }}
        />
      )}

      {/* Assignment Confirmation Modal */}
      <ConfirmationModal
        isOpen={!!assignmentConfirmModal?.isOpen}
        title={assignmentConfirmModal?.type === 'remove' ? `Remove assigned ${assignmentConfirmModal?.role}?` : `Replace assigned ${assignmentConfirmModal?.role}?`}
        body={
          assignmentConfirmModal?.type === 'remove' 
            ? `This will remove the assigned ${assignmentConfirmModal?.role} from this booking. The provider may be notified and the booking will need a replacement if this role is still required.`
            : `This will remove the current ${assignmentConfirmModal?.role} and open the assignment search so you can choose a replacement.`
        }
        confirmLabel={
          assignmentConfirmModal?.type === 'remove' 
            ? `Remove ${assignmentConfirmModal?.role === 'vehicle' ? 'Vehicle' : 'Provider'}`
            : `Continue to Replace`
        }
        isDestructive={assignmentConfirmModal?.type === 'remove'}
        isProcessing={isProcessingAssignmentAction}
        onCancel={() => setAssignmentConfirmModal(null)}
        onConfirm={async () => {
          if (!assignmentConfirmModal) return;
          setIsProcessingAssignmentAction(true);
          try {
            if (assignmentConfirmModal.role === 'vehicle') {
              if (assignmentConfirmModal.type === 'remove') {
                await handleRemoveVehicle();
              } else {
                openResourceModal('vehicle', 'replace');
              }
            } else {
              if (assignmentConfirmModal.type === 'remove') {
                await handleRemoveAssignment(assignmentConfirmModal.assignmentId!, assignmentConfirmModal.role as 'driver' | 'guide');
              } else {
                await handleReplaceAssignment(assignmentConfirmModal.assignmentId!, assignmentConfirmModal.role as 'driver' | 'guide');
              }
            }
            setAssignmentConfirmModal(null);
          } catch (e) {
            // Handled in sub-handlers
          } finally {
            setIsProcessingAssignmentAction(false);
          }
        }}
      />

      {/* Archive Confirmation Modal */}
      <ConfirmationModal
        isOpen={showArchiveConfirmModal}
        title="Archive booking?"
        body="This hides the trip from active lists. All payment history, assignments, disputes, and audit logs are safely preserved for reporting."
        confirmLabel="Archive Booking"
        isDestructive={false}
        isProcessing={isArchiveProcessing}
        onCancel={() => setShowArchiveConfirmModal(false)}
        onConfirm={confirmArchive}
      />

      {/* Unarchive Confirmation Modal */}
      <ConfirmationModal
        isOpen={showUnarchiveConfirmModal}
        title="Restore booking?"
        body="This will return the booking to your active booking lists."
        confirmLabel="Restore Booking"
        isDestructive={false}
        isProcessing={isArchiveProcessing}
        onCancel={() => setShowUnarchiveConfirmModal(false)}
        onConfirm={confirmUnarchive}
      />
    </div>
  );
};
