import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  searchVehiclesForDirectory, 
  listVehicleLinksForOperator,
  fetchCountries,
  fetchProvinces
} from '../../lib/fleetService';
import { 
  searchDrivers, 
  searchGuides, 
  searchDriversWithFilters, 
  searchGuidesWithFilters 
} from '../../lib/assignmentService';
import { 
  createReview, 
  getProviderReviews, 
  getProviderRatingSummary,
  getProviderRatingSummaries,
  hasReview, 
  RatingSummary 
} from '../../lib/reviewService';
import { 
  createDriverAvailabilityRequest, 
  createGuideAvailabilityRequest 
} from '../../lib/bookingService';
import { 
  Search, 
  Truck, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  Users,
  Clock,
  Eye,
  MapPin,
  Filter,
  XCircle,
  Info,
  Edit2,
  Building2,
  Shield,
  Star
} from 'lucide-react';
import { ProviderCard } from '../../components/providers/ProviderCard';

const BODY_TYPES = [
  "Minibus", "Sedan", "SUV", "Double Cab", "Single Cab", "Coach", "Van", "Other"
];

export const ProviderDirectory: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<'search' | 'hired' | 'drivers' | 'guides'>('search');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [operatorLinks, setOperatorLinks] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState({ 
    make: '', 
    model: '', 
    seats: '',
    country: 'South Africa',
    province: '',
    city: '',
    body_type: ''
  });
  const [provinces, setProvinces] = useState<string[]>([]);
  const [provincesLoading, setProvincesLoading] = useState(false);

  const [driverResults, setDriverResults] = useState<(any & { ratingSummary?: RatingSummary })[]>([]);
  const [driverSearchQuery, setDriverSearchQuery] = useState({
    query: '',
    city: '',
    province: '',
    country: 'South Africa'
  });
  const [driverLoading, setDriverLoading] = useState(false);

  const [guideResults, setGuideResults] = useState<(any & { ratingSummary?: RatingSummary })[]>([]);
  const [guideSearchQuery, setGuideSearchQuery] = useState({
    query: '',
    city: '',
    province: '',
    country: 'South Africa'
  });
  const [guideLoading, setGuideLoading] = useState(false);

  const [requestModal, setRequestModal] = useState<{ 
    open: boolean; 
    providerId: string; 
    providerName: string;
    providerType: 'driver' | 'guide';
    bookingId?: string;
  }>({
    open: false,
    providerId: '',
    providerName: '',
    providerType: 'driver'
  });
  const [requestForm, setRequestForm] = useState({
    startDate: '',
    endDate: '',
    notes: ''
  });
  const [submittingRequest, setSubmittingRequest] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [guideLanguage, setGuideLanguage] = useState('');
  const [guideSpecialty, setGuideSpecialty] = useState('');
  const [driverService, setDriverService] = useState('');
  const [driverServiceType, setDriverServiceType] = useState('');
  const [isVehiclesVerifiedOnly, setIsVehiclesVerifiedOnly] = useState(false);
  const [isDriversVerifiedOnly, setIsDriversVerifiedOnly] = useState(false);
  const [isGuidesVerifiedOnly, setIsGuidesVerifiedOnly] = useState(false);
  const [vehicleSort, setVehicleSort] = useState('recommended');
  const [driverSort, setDriverSort] = useState('recommended');
  const [guideSort, setGuideSort] = useState('recommended');

  const normalizeMetaList = (value: any): string[] => {
    if (!value) return [];
    if (Array.isArray(value)) value = value.join(',');
    return String(value).toLowerCase().split(',').map(item => item.trim()).filter(Boolean);
  };

  const getProfileFromVehicle = (v: any) => Array.isArray(v.profiles) ? v.profiles : [v.profiles].filter(Boolean);
  const isVerifiedStatus = (status: any) => String(status || "").toLowerCase() === "verified";

  const clearVehicleFilters = () => {
    setSearchQuery({ make: '', model: '', seats: '', country: 'South Africa', province: '', city: '', body_type: '' });
    setIsVehiclesVerifiedOnly(false);
    setVehicleSort('recommended');
  };

  const clearDriverFilters = () => {
    setDriverSearchQuery({ query: '', city: '', province: '', country: 'South Africa' });
    setDriverService('');
    setDriverServiceType('');
    setIsDriversVerifiedOnly(false);
    setDriverSort('recommended');
  };

  const clearGuideFilters = () => {
    setGuideSearchQuery({ query: '', city: '', province: '', country: 'South Africa' });
    setGuideLanguage('');
    setGuideSpecialty('');
    setIsGuidesVerifiedOnly(false);
    setGuideSort('recommended');
  };

  const isVehicleFilterActive = () => 
    !!(searchQuery.make || searchQuery.model || searchQuery.seats || 
    searchQuery.province || searchQuery.city || searchQuery.body_type || 
    isVehiclesVerifiedOnly || vehicleSort !== 'recommended');

  const isDriverFilterActive = () =>
    !!(driverSearchQuery.query || driverSearchQuery.city || driverSearchQuery.province ||
    driverService || driverServiceType || 
    isDriversVerifiedOnly || driverSort !== 'recommended');

  const isGuideFilterActive = () =>
    !!(guideSearchQuery.query || guideSearchQuery.city || guideSearchQuery.province ||
    guideLanguage || guideSpecialty || 
    isGuidesVerifiedOnly || guideSort !== 'recommended');

  const FilterChips = ({ onClear, isActive }: { onClear: () => void, isActive: () => boolean }) => (
    isActive() ? (
      <div className="flex items-center gap-2 mt-2">
        <span className="text-sm text-gray-500">Active filters:</span>
        <button onClick={onClear} className="text-xs font-bold text-brand-teal bg-brand-teal/10 px-3 py-1 rounded-full hover:bg-brand-teal/20">
          Clear all filters
        </button>
      </div>
    ) : null
  );

  const NoResults = ({ isActive, type }: { isActive: () => boolean, type: string }) => (
    <div className="text-center p-12 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
      <h3 className="font-bold text-gray-400">
        {isActive() ? `No results match your current ${type} filters.` : `No ${type} found.`}
      </h3>
      {isActive() && <p className="text-gray-400 text-sm mt-1">Try clearing filters or broadening your search.</p>}
    </div>
  );

  const sortData = (data: any[], sortType: string, type: 'vehicle' | 'driver' | 'guide') => {
    if (sortType === 'recommended') return data;
    return [...data].sort((a, b) => {
      let va: number | null = null;
      let vb: number | null = null;
      switch (sortType) {
        case 'newest':
          va = new Date(a.created_at || 0).getTime();
          vb = new Date(b.created_at || 0).getTime();
          return vb - va;
        case 'highest_capacity':
          va = Number(a.seat_count || 0);
          vb = Number(b.seat_count || 0);
          return vb - va;
        case 'most_experienced':
          va = Number(a.metadata?.years_experience || a.metadata?.experience_years || 0);
          vb = Number(b.metadata?.years_experience || b.metadata?.experience_years || 0);
          return vb - va;
        case 'lowest_day_rate':
          va = Number(a.default_day_rate || a.rate || Infinity);
          vb = Number(b.default_day_rate || b.rate || Infinity);
          return va - vb;
        default:
          return 0;
      }
    });
  };

  const vehicleRatingSummaries = useMemo(() => {
    const ids = Array.from(new Set(results.map(v => v.owner_id).filter(Boolean)));
    return ids;
  }, [results]);

  const [vehicleRatings, setVehicleRatings] = useState<Record<string, RatingSummary>>({});

  useEffect(() => {
    const fetchVehicleRatings = async () => {
      if (vehicleRatingSummaries.length > 0) {
        const summaries = await getProviderRatingSummaries(vehicleRatingSummaries);
        setVehicleRatings(summaries);
      }
    };
    fetchVehicleRatings();
  }, [vehicleRatingSummaries]);

  const filteredVehicleResults = results.filter(v => {
    if (!isVehiclesVerifiedOnly) return true;
    return getProfileFromVehicle(v).some((p: any) => isVerifiedStatus(p.verification_status));
  });
  const sortedVehicleResults = sortData(filteredVehicleResults, vehicleSort, 'vehicle');

  const filteredDriverResults = driverResults.filter(driver => {
    if (isDriversVerifiedOnly && !isVerifiedStatus(driver.verification_status || driver.metadata?.verification_status)) return false;
    const meta = driver.metadata || {};
    const services = [...normalizeMetaList(meta.specialties), ...normalizeMetaList(meta.services), ...normalizeMetaList(meta.service_summary)];
    const transportTypes = [...normalizeMetaList(meta.transport_types), ...normalizeMetaList(meta.services)];
    if (driverService && !services.some(s => s.toLowerCase().includes(driverService.toLowerCase()))) return false;
    if (driverServiceType && !transportTypes.some(t => t.toLowerCase().includes(driverServiceType.toLowerCase()))) return false;
    return true;
  });
  const sortedDriverResults = sortData(filteredDriverResults, driverSort, 'driver');

  const filteredGuideResults = guideResults.filter(guide => {
    if (isGuidesVerifiedOnly && !isVerifiedStatus(guide.verification_status || guide.metadata?.verification_status)) return false;
    const meta = guide.metadata || {};
    const langs = normalizeMetaList(meta.languages);
    const specs = [...normalizeMetaList(meta.specialties), ...normalizeMetaList(meta.services)];
    if (guideLanguage && !langs.some(l => l.toLowerCase().includes(guideLanguage.toLowerCase()))) return false;
    if (guideSpecialty && !specs.some(s => s.toLowerCase().includes(guideSpecialty.toLowerCase()))) return false;
    return true;
  });
  const sortedGuideResults = sortData(filteredGuideResults, guideSort, 'guide');

  useEffect(() => {
    if (location.state) {
      const s = location.state as any;
      
      // Handle both direct state (from back button) and nested state (from other sources)
      const tab = s.tab;
      const savedTab = s.activeTab;
      const savedSearchQuery = s.searchQuery;
      const savedDriverSearchQuery = s.driverSearchQuery;
      const savedGuideSearchQuery = s.guideSearchQuery;
      const autoSearch = s.autoSearch;

      if (savedTab) setActiveTab(savedTab);
      else if (tab === 'driver') setActiveTab('drivers');
      else if (tab === 'guide') setActiveTab('guides');
      else if (tab === 'vehicle') setActiveTab('search');

      if (savedSearchQuery) setSearchQuery(savedSearchQuery);
      if (savedDriverSearchQuery) setDriverSearchQuery(savedDriverSearchQuery);
      if (savedGuideSearchQuery) setGuideSearchQuery(savedGuideSearchQuery);

      if (autoSearch) {
        const currentTab = savedTab || (tab === 'driver' ? 'drivers' : tab === 'guide' ? 'guides' : tab === 'vehicle' ? 'search' : 'search');
        if (currentTab === 'search') handleSearch(undefined, savedSearchQuery);
        if (currentTab === 'drivers') handleDriverSearch(undefined, savedDriverSearchQuery);
        if (currentTab === 'guides') handleGuideSearch(undefined, savedGuideSearchQuery);
      }

      if (s.startDate || s.endDate) {
        setRequestForm(prev => ({
          ...prev,
          startDate: s.startDate ? new Date(s.startDate).toISOString().split('T')[0] : prev.startDate,
          endDate: s.endDate ? new Date(s.endDate).toISOString().split('T')[0] : prev.endDate,
        }));
      }
    }
  }, [location.state]);

  useEffect(() => {
    if (user) {
      loadOperatorLinks();
      loadInitialLocations();
    }
  }, [user]);

  const loadInitialLocations = async () => {
    try {
      const defaultCountry = "South Africa";
      setSearchQuery(prev => ({ ...prev, country: defaultCountry }));
      
      setProvincesLoading(true);
      const pList = await fetchProvinces(defaultCountry);
      setProvinces(pList);
    } catch (e) {
      console.error('Failed to load initial locations', e);
    } finally {
      setProvincesLoading(false);
    }
  };

  const loadOperatorLinks = async () => {
    if (!user) return;
    try {
      const data = await listVehicleLinksForOperator(user.id);
      setOperatorLinks(data || []);
    } catch (e) {
      console.error('Failed to load links', e);
    }
  };

  const handleSearch = async (e?: React.FormEvent, overrideQuery?: any) => {
    e?.preventDefault();
    if (!user) return;
    setLoading(true);
    
    const query = overrideQuery || searchQuery;
    const cityTrimmed = query.city.trim();
    const finalCity = cityTrimmed.length > 0 ? cityTrimmed : undefined;
    
    const finalProvince = (query.province === '' || query.province === 'Any') 
      ? undefined 
      : query.province;

    const payload = {
      make: query.make.trim() || undefined,
      model: query.model.trim() || undefined,
      seats: query.seats ? Number(query.seats) : undefined,
      country: query.country || "South Africa",
      province: finalProvince,
      city: finalCity,
      body_type: query.body_type || undefined
    };

    try {
      const data = await searchVehiclesForDirectory(user.id, payload);
      setResults(data);
    } catch (e) {
      console.error('[ProviderDirectory] Search execution error:', e);
      showToast("Your search could not be completed. Please check your filters and try again.", 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDriverSearch = async (e?: React.FormEvent, overrideQuery?: any) => {
    e?.preventDefault();
    if (!user) return;
    setDriverLoading(true);
    try {
      const data = await searchDriversWithFilters(overrideQuery || driverSearchQuery);
      const providerIds = (data || []).map((d: any) => d.id);
      const ratingSummaries = await getProviderRatingSummaries(providerIds);
      
      const withRatings = (data || []).map((d: any) => ({
        ...d,
        ratingSummary: ratingSummaries[d.id] || { average_rating: 0, total_reviews: 0 }
      }));
      setDriverResults(withRatings);
    } catch (e) {
      console.error('Driver search failed', e);
      showToast('Failed to search drivers', 'error');
    } finally {
      setDriverLoading(false);
    }
  };

  const handleGuideSearch = async (e?: React.FormEvent, overrideQuery?: any) => {
    e?.preventDefault();
    if (!user) return;
    setGuideLoading(true);
    try {
      const data = await searchGuidesWithFilters(overrideQuery || guideSearchQuery);
      const providerIds = (data || []).map((g: any) => g.id);
      const ratingSummaries = await getProviderRatingSummaries(providerIds);
      
      const withRatings = (data || []).map((g: any) => ({
        ...g,
        ratingSummary: ratingSummaries[g.id] || { average_rating: 0, total_reviews: 0 }
      }));
      setGuideResults(withRatings);
    } catch (e) {
      console.error('Guide search failed', e);
      showToast('Failed to search guides', 'error');
    } finally {
      setGuideLoading(false);
    }
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !requestModal.providerId) return;
    if (!requestForm.startDate || !requestForm.endDate) {
      showToast('Start and end dates are required', 'error');
      return;
    }

    setSubmittingRequest(true);
    try {
      if (requestModal.providerType === 'driver') {
        await createDriverAvailabilityRequest({
          operator_id: user.id,
          driver_id: requestModal.providerId,
          start_date: requestForm.startDate,
          end_date: requestForm.endDate,
          notes: requestForm.notes
        });
      } else {
        await createGuideAvailabilityRequest({
          operator_id: user.id,
          guide_id: requestModal.providerId,
          start_date: requestForm.startDate,
          end_date: requestForm.endDate,
          notes: requestForm.notes
        });
      }
      
      window.dispatchEvent(new CustomEvent('PENDING_REQUESTS_UPDATED'));
      showToast('Request sent successfully', 'success');
      setRequestModal({ open: false, providerId: '', providerName: '', providerType: 'driver' });
      setRequestForm({ startDate: '', endDate: '', notes: '' });
      
      const targetTab = requestModal.providerType === 'driver' ? 'drivers' : 'guides';
      setTimeout(() => navigate('/operator/vehicle-requests', { 
        state: { 
          tab: targetTab, 
          message: 'Request sent successfully' 
        } 
      }), 1500);
    } catch (e) {
      console.error('Failed to create request', e);
      showToast('Failed to send request', 'error');
    } finally {
      setSubmittingRequest(false);
    }
  };

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const getInitials = (name?: string, email?: string) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
    }
    if (email) {
      return email.substring(0, 2).toUpperCase();
    }
    return '??';
  };

  const getVehicleLinkStatus = (vehicleId: string) => {
    const link = operatorLinks.find(l => l.vehicle_id === vehicleId);
    return link ? String(link.status).toLowerCase() : 'none';
  };

  const hiredDisplayList = operatorLinks.filter(l => 
    l.status === 'approved' || l.status === 'pending'
  );

  return (
    <div className="max-w-6xl mx-auto pb-12">
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[60] px-6 py-3 rounded-2xl shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-4 duration-300 ${
          toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          <span className="font-bold">{toast.message}</span>
        </div>
      )}

      <div className="mb-8 flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-brand-charcoal">Provider Directory</h1>
          <p className="text-gray-500 mt-1">Find and link with trusted vehicle owners and service providers.</p>
        </div>
        {location.state?.bookingId && (
          <button
            onClick={() => navigate(`/operator/bookings/${location.state.bookingId}`)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors text-sm"
          >
            ← Back to Booking
          </button>
        )}
      </div>

      <div className="flex gap-4 border-b border-gray-200 mb-8">
        <button 
          onClick={() => setActiveTab('search')}
          className={`px-4 py-2 font-bold text-sm border-b-2 transition-colors cursor-pointer ${activeTab === 'search' ? 'border-brand-teal text-brand-teal' : 'border-transparent text-gray-500 hover:text-brand-charcoal'}`}
        >
          Find Vehicles
        </button>
        <button 
          onClick={() => setActiveTab('hired')}
          className={`px-4 py-2 font-bold text-sm border-b-2 transition-colors cursor-pointer ${activeTab === 'hired' ? 'border-brand-teal text-brand-teal' : 'border-transparent text-gray-500 hover:text-brand-charcoal'}`}
        >
          My Hired Fleet ({hiredDisplayList.filter(l => l.status === 'approved').length})
        </button>
        <button 
          onClick={() => setActiveTab('drivers')}
          className={`px-4 py-2 font-bold text-sm border-b-2 transition-colors cursor-pointer ${activeTab === 'drivers' ? 'border-brand-teal text-brand-teal' : 'border-transparent text-gray-500 hover:text-brand-charcoal'}`}
        >
          Find Drivers
        </button>
        <button 
          onClick={() => setActiveTab('guides')}
          className={`px-4 py-2 font-bold text-sm border-b-2 transition-colors cursor-pointer ${activeTab === 'guides' ? 'border-brand-teal text-brand-teal' : 'border-transparent text-gray-500 hover:text-brand-charcoal'}`}
        >
          Find Guides
        </button>
      </div>

      {activeTab === 'search' ? (
        <div className="space-y-8">
          <div className="mb-2">
            <h2 className="text-xl font-bold text-brand-charcoal">Find Vehicles</h2>
            <p className="text-gray-500 text-sm">Search vehicles by type, size, and location.</p>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-6">
            <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Make</label>
                <input 
                  type="text" 
                  className="w-full border border-gray-300 rounded-2xl p-2.5 text-sm" 
                  placeholder="Toyota, VW..."
                  value={searchQuery.make}
                  onChange={e => setSearchQuery({...searchQuery, make: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Model</label>
                <input 
                  type="text" 
                  className="w-full border border-gray-300 rounded-2xl p-2.5 text-sm" 
                  placeholder="Quantum, Sprinter..."
                  value={searchQuery.model}
                  onChange={e => setSearchQuery({...searchQuery, model: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Body Type</label>
                <select 
                  className="w-full border border-gray-300 rounded-2xl p-2.5 text-sm bg-white cursor-pointer"
                  value={searchQuery.body_type}
                  onChange={e => setSearchQuery({...searchQuery, body_type: e.target.value})}
                >
                  <option value="">Any Body Type</option>
                  {BODY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <button 
                type="submit" 
                disabled={loading}
                className="bg-brand-charcoal text-white font-bold py-2.5 rounded-2xl hover:bg-black transition-colors flex items-center justify-center gap-2 text-sm cursor-pointer"
              >
                {loading ? <Loader2 className="animate-spin" size={18} /> : <Search size={18} />}
                Search Vehicles
              </button>
              <div className="flex flex-col ml-4">
                <div className="flex items-center gap-2">
                  <input 
                    type="checkbox" 
                    id="vehiclesVerifiedOnly"
                    className="w-4 h-4 rounded border-gray-300 text-brand-teal focus:ring-brand-teal"
                    checked={isVehiclesVerifiedOnly}
                    onChange={e => setIsVehiclesVerifiedOnly(e.target.checked)}
                  />
                  <label htmlFor="vehiclesVerifiedOnly" className="text-sm font-bold text-gray-700">Verified profiles only</label>
                </div>
                <p className="text-xs text-gray-500 mt-1">Profile verification confirms the provider account has been approved. Document compliance is checked separately before assignment.</p>
              </div>
              <div className="flex flex-col ml-4">
                <label className="text-xs font-bold text-gray-400 uppercase mb-2">Sort by</label>
                <select 
                  className="w-full border border-gray-300 rounded-2xl p-2 text-sm bg-white cursor-pointer"
                  value={vehicleSort}
                  onChange={e => setVehicleSort(e.target.value)}
                >
                  <option value="recommended">Recommended</option>
                  <option value="newest">Newest</option>
                  <option value="highest_capacity">Highest capacity</option>
                  <option value="lowest_day_rate">Lowest day rate</option>
                </select>
              </div>
            </form>

            <div className="pt-4 border-t border-gray-100 grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-2 flex items-center gap-1.5">
                  <MapPin size={12} /> Country
                </label>
                <select 
                  className="w-full border border-gray-300 rounded-2xl p-2 text-sm bg-white cursor-pointer"
                  value={searchQuery.country}
                  onChange={e => setSearchQuery({...searchQuery, country: e.target.value})}
                >
                  <option value="South Africa">South Africa</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-2 flex items-center gap-1.5">
                  <MapPin size={12} /> Province {provincesLoading && <Loader2 size={10} className="animate-spin" />}
                </label>
                <select 
                  className="w-full border border-gray-300 rounded-2xl p-2 text-sm bg-white disabled:bg-gray-50"
                  value={searchQuery.province}
                  onChange={e => setSearchQuery({...searchQuery, province: e.target.value})}
                  disabled={provincesLoading}
                >
                  <option value="">Any Province</option>
                  {provinces.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-2 flex items-center gap-1.5">
                   <Filter size={12} /> City
                </label>
                <input 
                  type="text"
                  className="w-full border border-gray-300 rounded-2xl p-2 text-sm"
                  placeholder="Filter by city..."
                  value={searchQuery.city}
                  onChange={e => setSearchQuery({...searchQuery, city: e.target.value})}
                  maxLength={80}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-2 flex items-center gap-1.5">
                  <Users size={12} /> Min Seats
                </label>
                <input 
                  type="number" 
                  className="w-full border border-gray-300 rounded-2xl p-2 text-sm" 
                  placeholder="Any"
                  value={searchQuery.seats}
                  onChange={e => setSearchQuery({...searchQuery, seats: e.target.value})}
                  min="1"
                />
              </div>
            </div>
          </div>

          <div className="mb-4">
            <h2 className="text-xl font-bold text-brand-charcoal">{sortedVehicleResults.length} vehicles found</h2>
            <FilterChips onClear={clearVehicleFilters} isActive={isVehicleFilterActive} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedVehicleResults.map((v) => {
              const linkStatus = getVehicleLinkStatus(v.id);
              const isPending = linkStatus === 'pending';
              const isApproved = linkStatus === 'approved';
              
              const profileList = Array.isArray(v.profiles) ? v.profiles : [v.profiles].filter(Boolean);
              const profile = profileList[0];
              const companyName = profile?.company_name;
              const fullName = profile?.full_name;
              const verificationStatus = profile?.verification_status;
              const metadata = profile?.metadata || {};
              
              const displayName = companyName || fullName || 'Vehicle Provider';
              const secondaryName = companyName && fullName ? fullName : null;
              
              // Location fallback
              const pCity = profile?.city || metadata.city || v.city;
              const pProvince = profile?.province || metadata.province || v.province;
              const pCountry = profile?.country || metadata.country || v.country || 'South Africa';
              
              const bio = profile?.bio || metadata.bio || metadata.service_summary;

              return (
                <div key={v.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden hover:border-brand-teal transition-all group flex flex-col">
                  <div className="aspect-video bg-gray-100 relative">
                    {v.photos && v.photos.length > 0 ? (
                      <img src={v.photos[0].url} className="w-full h-full object-cover" alt={v.model} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300">
                        <Truck size={48} />
                      </div>
                    )}
                    <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-2xl text-[10px] font-bold text-brand-charcoal uppercase">
                      {v.seat_count} Seats
                    </div>
                    <div className="absolute bottom-3 left-3 bg-brand-charcoal/80 backdrop-blur-sm px-2 py-1 rounded-2xl text-[10px] font-bold text-white flex items-center gap-1">
                      <MapPin size={10} /> {[pCity, pProvince, pCountry].filter(Boolean).join(', ') || 'Location not set'}
                    </div>
                  </div>
                  <div className="p-5 flex-1 flex flex-col">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold text-lg text-brand-charcoal truncate">{v.make} {v.model}</h3>
                          {isApproved ? (
                            <span className="px-2 py-0.5 bg-green-50 text-green-700 border border-green-100 rounded-2xl text-[10px] font-bold uppercase whitespace-nowrap">
                              Linked
                            </span>
                          ) : isPending ? (
                            <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-100 rounded-2xl text-[10px] font-bold uppercase whitespace-nowrap">
                              Pending
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-gray-50 text-gray-500 border border-gray-200 rounded-2xl text-[10px] font-bold uppercase whitespace-nowrap">
                              Not Linked
                            </span>
                          )}
                          {profile?.vat_registered && (
                            <span className="px-2 py-0.5 bg-brand-teal/10 text-brand-teal border border-brand-teal/20 rounded-2xl text-[10px] font-bold uppercase whitespace-nowrap">
                              VAT Reg
                            </span>
                          )}
                        </div>
                        <div className="flex flex-col">
                          <p className="text-xs text-gray-600 font-bold flex items-center gap-1 truncate">
                            {displayName}
                            {verificationStatus === 'verified' && (
                              <CheckCircle2 size={12} className="text-blue-500 fill-blue-50" />
                            )}
                          </p>
                          {verificationStatus === 'verified' ? (
                            <p className="mt-0.5 text-[10px] text-green-700 font-bold uppercase">
                              Verified owner
                            </p>
                          ) : verificationStatus?.toLowerCase() === 'pending' ? (
                            <p className="mt-0.5 text-[10px] text-amber-700 font-bold uppercase">
                              Verification pending
                            </p>
                          ) : (
                            <p className="mt-0.5 text-[10px] text-gray-400 font-bold uppercase">
                              Vehicle provider
                            </p>
                          )}
                          {secondaryName && (
                            <p className="text-[10px] text-gray-400 truncate">{secondaryName}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <button 
                          onClick={() => navigate(`/operator/vehicles/${v.id}`, { 
                            state: { 
                              activeTab, 
                              searchQuery, 
                              driverSearchQuery, 
                              guideSearchQuery, 
                              autoSearch: true,
                              fromDirectory: true
                            } 
                          })}
                          className="p-1.5 text-gray-400 hover:text-brand-teal transition-colors"
                          title="View Details"
                        >
                          <Eye size={18} />
                        </button>
                      </div>
                    </div>
                    
                    {bio && (
                      <p className="text-[11px] text-gray-500 line-clamp-2 mt-2 italic">
                        "{bio}"
                      </p>
                    )}

                      <div className="mt-auto pt-4">
                      <div className="flex items-center gap-1">
                        {vehicleRatings[v.owner_id] && vehicleRatings[v.owner_id].total_reviews > 0 ? (
                          <>
                            <Star size={12} className="text-amber-400 fill-amber-400" />
                            <span className="text-xs font-bold text-brand-charcoal ml-0.5">{vehicleRatings[v.owner_id].average_rating.toFixed(1)}</span>
                            <span className="text-[10px] text-gray-400 ml-1">({vehicleRatings[v.owner_id].total_reviews})</span>
                          </>
                        ) : (
                          <>
                            <div className="flex items-center gap-0.5">
                              {[1,2,3,4,5].map(i => <Star key={i} size={10} className="text-gray-200 fill-gray-100" />)}
                            </div>
                            <span className="text-[10px] text-gray-400 font-bold ml-1">No reviews yet</span>
                          </>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2 mb-4">
                          <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-2xl font-bold uppercase">{v.fuel_type}</span>
                          <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-2xl font-bold uppercase">{v.body_type}</span>
                          <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-2xl font-bold uppercase">{v.transmission}</span>
                        </div>

                        {isApproved ? (
                          <button 
                            type="button"
                            onClick={() => navigate(`/operator/vehicles/${v.id}`, { 
                              state: { 
                                activeTab, 
                                searchQuery, 
                                driverSearchQuery, 
                                guideSearchQuery, 
                                autoSearch: true,
                                fromDirectory: true 
                              } 
                            })}
                            className="w-full flex items-center justify-center gap-2 py-2.5 bg-brand-teal text-white font-bold rounded-2xl hover:bg-brand-teal/90 transition-all text-sm cursor-pointer"
                          >
                            View details
                          </button>
                        ) : isPending ? (
                          <div className="flex flex-col gap-2">
                             <button 
                                type="button"
                                onClick={() => navigate(`/operator/vehicles/${v.id}`, { 
                                   state: { 
                                     activeTab, 
                                     searchQuery, 
                                     driverSearchQuery, 
                                     guideSearchQuery, 
                                     autoSearch: true,
                                     fromDirectory: true 
                                   } 
                                 })}
                                className="w-full py-2.5 bg-brand-teal text-white font-bold rounded-2xl hover:bg-brand-teal/90 transition-all text-sm cursor-pointer"
                             >
                               View details
                             </button>
                             <button 
                                type="button"
                                disabled
                                className="w-full flex items-center justify-center gap-2 py-2.5 bg-gray-50 text-gray-400 font-bold rounded-2xl text-sm cursor-not-allowed"
                             >
                               <Clock size={16} /> Link request pending
                             </button>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-2">
                             <button 
                                type="button"
                                onClick={() => navigate(`/operator/vehicles/${v.id}`, { 
                                   state: { 
                                     activeTab, 
                                     searchQuery, 
                                     driverSearchQuery, 
                                     guideSearchQuery, 
                                     autoSearch: true,
                                     fromDirectory: true 
                                   } 
                                 })}
                                className="w-full py-2.5 bg-brand-teal text-white font-bold rounded-2xl hover:bg-brand-teal/90 transition-all text-sm cursor-pointer"
                             >
                               View details
                             </button>
                             <button 
                                type="button"
                                onClick={() => navigate(`/operator/vehicles/${v.id}`, { 
                                  state: { 
                                    ...location.state,
                                    activeTab, 
                                    searchQuery, 
                                    driverSearchQuery, 
                                    guideSearchQuery, 
                                    autoSearch: true 
                                  } 
                                })}
                                className="w-full flex items-center justify-center gap-2 py-2.5 bg-brand-charcoal text-white font-bold rounded-2xl hover:bg-black transition-all text-sm cursor-pointer"
                             >
                               Request link
                             </button>
                          </div>
                        )}
                      </div>
                  </div>
                </div>
              );
            })}
          </div>

          {!loading && sortedVehicleResults.length === 0 && (
            <NoResults isActive={isVehicleFilterActive} type="vehicles" />
          )}
        </div>
      ) : activeTab === 'drivers' ? (
        <div className="space-y-8">
          <div className="mb-2">
            <h2 className="text-xl font-bold text-brand-charcoal">Find Drivers</h2>
            <p className="text-gray-500 text-sm">Search drivers by name and location.</p>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-6">
            <form onSubmit={handleDriverSearch} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-4 items-end">
                <div className="md:col-span-2 lg:col-span-3">
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Search Drivers</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input 
                      type="text" 
                      className="w-full border border-gray-300 rounded-2xl pl-10 pr-4 py-2.5 text-sm" 
                      placeholder="Search by name or email..."
                      value={driverSearchQuery.query}
                      onChange={e => setDriverSearchQuery({...driverSearchQuery, query: e.target.value})}
                    />
                  </div>
                </div>
                <div>
                  <button 
                    type="submit" 
                    disabled={driverLoading}
                    className="w-full bg-brand-charcoal text-white font-bold px-4 py-2.5 rounded-2xl hover:bg-black transition-colors flex items-center justify-center gap-2 text-sm cursor-pointer"
                  >
                    {driverLoading ? <Loader2 className="animate-spin" size={18} /> : <Search size={18} />}
                    Search
                  </button>
                </div>
                <div className="flex flex-col gap-1 pb-1">
                   <div className="flex items-center gap-2">
                     <input 
                       type="checkbox" 
                       id="driversVerifiedOnly"
                       className="w-4 h-4 rounded border-gray-300 text-brand-teal focus:ring-brand-teal"
                       checked={isDriversVerifiedOnly}
                       onChange={e => setIsDriversVerifiedOnly(e.target.checked)}
                     />
                     <label htmlFor="driversVerifiedOnly" className="text-sm font-bold text-gray-700 whitespace-nowrap">Verified profiles only</label>
                   </div>
                   <p className="text-xs text-gray-500 leading-tight">Profile verification confirms the provider account has been approved. Document compliance is checked separately before assignment.</p>
                 </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">Sort by</label>
                  <select 
                    className="w-full border border-gray-300 rounded-2xl p-2 text-sm bg-white cursor-pointer"
                    value={driverSort}
                    onChange={e => setDriverSort(e.target.value)}
                  >
                    <option value="recommended">Recommended</option>
                    <option value="newest">Newest</option>
                    <option value="most_experienced">Experienced</option>
                    <option value="lowest_day_rate">Price (Low)</option>
                  </select>
                </div>
              </div>
              <div className="pt-4 border-t border-gray-100 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-2 flex items-center gap-1.5">
                    <MapPin size={12} /> Country
                  </label>
                  <select 
                    className="w-full border border-gray-300 rounded-2xl p-2 text-sm bg-white cursor-pointer"
                    value={driverSearchQuery.country}
                    onChange={e => setDriverSearchQuery({...driverSearchQuery, country: e.target.value})}
                  >
                    <option value="South Africa">South Africa</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-2 flex items-center gap-1.5">
                    <MapPin size={12} /> Province {provincesLoading && <Loader2 size={10} className="animate-spin" />}
                  </label>
                  <select 
                    className="w-full border border-gray-300 rounded-2xl p-2 text-sm bg-white disabled:bg-gray-50"
                    value={driverSearchQuery.province}
                    onChange={e => setDriverSearchQuery({...driverSearchQuery, province: e.target.value})}
                    disabled={provincesLoading}
                  >
                    <option value="">Any Province</option>
                    {provinces.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-2 flex items-center gap-1.5">
                    <MapPin size={12} /> City
                  </label>
                  <input 
                    type="text" 
                    className="w-full border border-gray-300 rounded-2xl p-2 text-sm" 
                    placeholder="e.g. Cape Town"
                    value={driverSearchQuery.city}
                    onChange={e => setDriverSearchQuery({...driverSearchQuery, city: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Service / Specialty</label>
                  <input 
                    type="text" 
                    className="w-full border border-gray-300 rounded-2xl p-2 text-sm" 
                    placeholder="e.g. Airport Transfers"
                    value={driverService}
                    onChange={e => setDriverService(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Service Type</label>
                  <input 
                    type="text" 
                    className="w-full border border-gray-300 rounded-2xl p-2 text-sm" 
                    placeholder="e.g. Airport transfers, chauffeur, shuttle"
                    value={driverServiceType}
                    onChange={e => setDriverServiceType(e.target.value)}
                  />
                </div>
              </div>
            </form>
          </div>          <div className="mb-4">
            <h2 className="text-xl font-bold text-brand-charcoal">{sortedDriverResults.length} drivers found</h2>
            <FilterChips onClear={clearDriverFilters} isActive={isDriverFilterActive} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedDriverResults.map(driver => (
              <ProviderCard 
                key={driver.id} 
                provider={driver} 
                role="driver"
                ratingSummary={driver.ratingSummary}
                onClickRequest={(id, name) => setRequestModal({ 
                  open: true, 
                  providerId: id, 
                  providerName: name,
                  providerType: 'driver'
                })}
              />
            ))}
          </div>

          {!driverLoading && sortedDriverResults.length === 0 && (
            <NoResults isActive={isDriverFilterActive} type="drivers" />
          )}
        </div>
      ) : activeTab === 'guides' ? (
        <div className="space-y-8">
          <div className="mb-2">
            <h2 className="text-xl font-bold text-brand-charcoal">Find Guides</h2>
            <p className="text-gray-500 text-sm">Search guides by name and location.</p>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-6">
            <form onSubmit={handleGuideSearch} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-4 items-end">
                <div className="md:col-span-2 lg:col-span-3">
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Search Guides</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input 
                      type="text" 
                      className="w-full border border-gray-300 rounded-2xl pl-10 pr-4 py-2.5 text-sm" 
                      placeholder="Search by name or email..."
                      value={guideSearchQuery.query}
                      onChange={e => setGuideSearchQuery({...guideSearchQuery, query: e.target.value})}
                    />
                  </div>
                </div>
                <div>
                  <button 
                    type="submit" 
                    disabled={guideLoading}
                    className="w-full bg-brand-charcoal text-white font-bold px-4 py-2.5 rounded-2xl hover:bg-black transition-colors flex items-center justify-center gap-2 text-sm cursor-pointer"
                  >
                    {guideLoading ? <Loader2 className="animate-spin" size={18} /> : <Search size={18} />}
                    Search
                  </button>
                </div>
                <div className="flex flex-col gap-1 pb-1">
                   <div className="flex items-center gap-2">
                     <input 
                       type="checkbox" 
                       id="guidesVerifiedOnly"
                       className="w-4 h-4 rounded border-gray-300 text-brand-teal focus:ring-brand-teal"
                       checked={isGuidesVerifiedOnly}
                       onChange={e => setIsGuidesVerifiedOnly(e.target.checked)}
                     />
                     <label htmlFor="guidesVerifiedOnly" className="text-sm font-bold text-gray-700 whitespace-nowrap">Verified profiles only</label>
                   </div>
                   <p className="text-xs text-gray-500 leading-tight">Profile verification confirms the provider account has been approved. Document compliance is checked separately before assignment.</p>
                 </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">Sort by</label>
                  <select 
                    className="w-full border border-gray-300 rounded-2xl p-2 text-sm bg-white cursor-pointer"
                    value={guideSort}
                    onChange={e => setGuideSort(e.target.value)}
                  >
                    <option value="recommended">Recommended</option>
                    <option value="newest">Newest</option>
                    <option value="most_experienced">Experienced</option>
                    <option value="lowest_day_rate">Price (Low)</option>
                  </select>
                </div>
              </div>
              <div className="pt-4 border-t border-gray-100 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-2 flex items-center gap-1.5">
                    <MapPin size={12} /> Country
                  </label>
                  <select 
                    className="w-full border border-gray-300 rounded-2xl p-2 text-sm bg-white cursor-pointer"
                    value={guideSearchQuery.country}
                    onChange={e => setGuideSearchQuery({...guideSearchQuery, country: e.target.value})}
                  >
                    <option value="South Africa">South Africa</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-2 flex items-center gap-1.5">
                    <MapPin size={12} /> Province {provincesLoading && <Loader2 size={10} className="animate-spin" />}
                  </label>
                  <select 
                    className="w-full border border-gray-300 rounded-2xl p-2 text-sm bg-white disabled:bg-gray-50"
                    value={guideSearchQuery.province}
                    onChange={e => setGuideSearchQuery({...guideSearchQuery, province: e.target.value})}
                    disabled={provincesLoading}
                  >
                    <option value="">Any Province</option>
                    {provinces.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-2 flex items-center gap-1.5">
                    <MapPin size={12} /> City
                  </label>
                  <input 
                    type="text" 
                    className="w-full border border-gray-300 rounded-2xl p-2 text-sm" 
                    placeholder="e.g. Cape Town"
                    value={guideSearchQuery.city}
                    onChange={e => setGuideSearchQuery({...guideSearchQuery, city: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Language</label>
                  <input 
                    type="text" 
                    className="w-full border border-gray-300 rounded-2xl p-2 text-sm" 
                    placeholder="e.g. English"
                    value={guideLanguage}
                    onChange={e => setGuideLanguage(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Specialty / Service</label>
                  <input 
                    type="text" 
                    className="w-full border border-gray-300 rounded-2xl p-2 text-sm" 
                    placeholder="e.g. Historical tours"
                    value={guideSpecialty}
                    onChange={e => setGuideSpecialty(e.target.value)}
                  />
                </div>
              </div>
            </form>
          </div>

          <div className="mb-4">
            <h2 className="text-xl font-bold text-brand-charcoal">{sortedGuideResults.length} guides found</h2>
            <FilterChips onClear={clearGuideFilters} isActive={isGuideFilterActive} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedGuideResults.map(guide => (
              <ProviderCard 
                key={guide.id} 
                provider={guide} 
                role="guide"
                ratingSummary={guide.ratingSummary}
                onClickRequest={(id, name) => setRequestModal({ 
                  open: true, 
                  providerId: id, 
                  providerName: name,
                  providerType: 'guide'
                })}
              />
            ))}
          </div>

          {!guideLoading && sortedGuideResults.length === 0 && (
            <NoResults isActive={isGuideFilterActive} type="guides" />
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="mb-2">
            <h2 className="text-xl font-bold text-brand-charcoal">My Hired Fleet</h2>
            <p className="text-gray-500 text-sm">Manage your linked vehicles and pending requests.</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Truck size={18} className="text-brand-charcoal" />
                <h2 className="font-bold text-brand-charcoal">Hired Fleet Management</h2>
              </div>
              <span className="text-xs font-bold text-gray-400 uppercase">{hiredDisplayList.length} Connections</span>
            </div>
            
            {hiredDisplayList.length === 0 ? (
              <div className="p-12 text-center text-gray-400">
                No hired vehicles linked or requested. Start by requesting links in the Discover tab.
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {hiredDisplayList.map((item) => {
                  const v = item.vehicle;
                  const isPending = item.status === 'pending';
                  
                  return (
                    <div key={item.id} className={`p-4 transition-colors flex items-center justify-between ${isPending ? 'bg-gray-50/50' : 'hover:bg-gray-50'}`}>
                      <div className="flex items-center gap-4">
                        <div className={`w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center border border-gray-200 overflow-hidden ${isPending ? 'opacity-60' : ''}`}>
                          {v?.photos && v.photos.length > 0 ? (
                            <img src={v.photos[0].url} className="w-full h-full object-cover" alt="" />
                          ) : (
                            <Truck size={24} className="text-gray-400" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className={`font-bold ${isPending ? 'text-gray-500' : 'text-brand-charcoal'}`}>
                              {v?.make} {v?.model}
                            </p>
                            <span className={`px-2 py-0.5 rounded-2xl font-bold uppercase border ${
                              item.status === 'approved' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-amber-50 text-amber-700 border-amber-100'
                            }`}>
                              {item.status}
                            </span>
                          </div>
                          <p className="text-xs text-gray-400 font-mono uppercase mt-0.5">
                            {v?.license_plate || 'No Plate'} • {v?.seat_count || 0} Seats
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                         {isPending && (
                            <span className="text-[10px] text-gray-400 flex items-center gap-1 font-medium">
                               <Clock size={12} /> Requested {new Date(item.created_at).toLocaleDateString()}
                            </span>
                         )}
                         <button
                            onClick={() => navigate(`/operator/vehicles/${v.id}`, { 
                               state: { 
                                 activeTab, 
                                 searchQuery, 
                                 driverSearchQuery, 
                                 guideSearchQuery, 
                                 autoSearch: true 
                               } 
                             })}
                            className="p-2 text-gray-400 hover:text-brand-teal transition-colors"
                            title="View Details"
                          >
                            <Eye size={18} />
                          </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="p-4 bg-brand-teal/5 border border-brand-teal/10 rounded-2xl flex items-start gap-3">
             <Info size={18} className="text-brand-teal shrink-0 mt-0.5" />
             <p className="text-xs text-brand-teal/80 leading-relaxed">
               Approved vehicles in this list will be available for selection when managing your bookings. 
               Pending requests must be approved by the vehicle owner before they appear in your active fleet picker.
             </p>
          </div>
        </div>
      )}

      {/* Provider Request Modal */}
      {requestModal.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <h3 className="font-bold text-brand-charcoal">Request Availability: {requestModal.providerName}</h3>
              <button onClick={() => setRequestModal({ ...requestModal, open: false })} className="text-gray-400 hover:text-gray-600">
                <XCircle size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmitRequest} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Start Date</label>
                  <input 
                    type="date" 
                    required
                    className="w-full border border-gray-300 rounded-2xl p-2.5 text-sm"
                    value={requestForm.startDate}
                    onChange={e => setRequestForm({ ...requestForm, startDate: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-2">End Date</label>
                  <input 
                    type="date" 
                    required
                    className="w-full border border-gray-300 rounded-2xl p-2.5 text-sm"
                    value={requestForm.endDate}
                    onChange={e => setRequestForm({ ...requestForm, endDate: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Notes (Optional)</label>
                <textarea 
                  className="w-full border border-gray-300 rounded-2xl p-2.5 text-sm h-24 resize-none"
                  placeholder="Tell the driver about the trip..."
                  value={requestForm.notes}
                  onChange={e => setRequestForm({ ...requestForm, notes: e.target.value })}
                />
              </div>
              <div className="pt-4 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setRequestModal({ ...requestModal, open: false })}
                  className="flex-1 py-2.5 border border-gray-300 text-gray-600 font-bold rounded-2xl hover:bg-gray-50 transition-colors text-sm cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={submittingRequest}
                  className="flex-1 py-2.5 bg-brand-teal text-white font-bold rounded-2xl hover:bg-brand-teal/90 transition-colors flex items-center justify-center gap-2 text-sm cursor-pointer"
                >
                  {submittingRequest ? <Loader2 className="animate-spin" size={18} /> : 'Send Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && (
        <div className={`fixed bottom-4 right-4 px-6 py-3 rounded-2xl shadow-lg flex items-center gap-3 z-50 animate-in fade-in slide-in-from-bottom-4 ${
          toast.type === 'success' ? 'bg-brand-teal text-white' : 'bg-red-500 text-white'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          <span className="font-bold text-sm">{toast.message}</span>
        </div>
      )}
    </div>
  );
};