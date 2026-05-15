import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getPublicProfile, getOwnerVehicles } from '../../lib/fleetService';
import { createDriverAvailabilityRequest, createGuideAvailabilityRequest } from '../../lib/bookingService';
import { 
  ArrowLeft, 
  MapPin, 
  CheckCircle2, 
  Clock, 
  Loader2, 
  User, 
  Building2, 
  Info,
  CalendarPlus,
  Send,
  X,
  AlertCircle,
  Briefcase,
  Globe,
  Star,
  ShieldCheck,
  Languages,
  Truck,
  Users as UsersIcon
} from 'lucide-react';
import { ComplianceBadge } from '../../components/common/ComplianceBadge';
import { ProviderComplianceSummary } from '../../components/providers/ProviderComplianceSummary';
import { getProviderComplianceForOperator, ComplianceResult } from '../../lib/compliance';
import { UserRole } from '../../types';
import { getProviderReviews, getProviderRatingSummary, Review, RatingSummary } from '../../lib/reviewService';
import { format } from 'date-fns';

export const ProviderProfilePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const [profile, setProfile] = useState<any>(null);
  const [compliance, setCompliance] = useState<ComplianceResult | null>(null);
  const [fleet, setFleet] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingCompliance, setLoadingCompliance] = useState(false);
  const [loadingFleet, setLoadingFleet] = useState(false);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [ratingSummary, setRatingSummary] = useState<RatingSummary>({ average_rating: 0, total_reviews: 0 });
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestForm, setRequestForm] = useState({
    startDate: '',
    endDate: '',
    notes: ''
  });
  const [submittingRequest, setSubmittingRequest] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (id) {
      loadProfile();
    }
  }, [id]);

  useEffect(() => {
    if (location.state) {
      const { startDate, endDate } = location.state as any;
      if (startDate || endDate) {
        setRequestForm(prev => ({
          ...prev,
          startDate: startDate ? new Date(startDate).toISOString().split('T')[0] : prev.startDate,
          endDate: endDate ? new Date(endDate).toISOString().split('T')[0] : prev.endDate,
        }));
      }
    }
  }, [location.state]);

  const loadProfile = async () => {
    if (!id) return;
    try {
      const data = await getPublicProfile(id);
      setProfile(data);
      if (data && data.id && data.role) {
        loadCompliance(data.id, data.role as UserRole);
        loadReviews(data.id);
        if (data.role === 'vehicle_owner') {
          loadFleet(data.id);
        }
      }
    } catch (error) {
      console.error('Failed to load profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCompliance = async (userId: string, role: UserRole) => {
    setLoadingCompliance(true);
    try {
      const result = await getProviderComplianceForOperator(userId, role);
      setCompliance(result);
    } catch (error) {
      console.error('Failed to load compliance:', error);
    } finally {
      setLoadingCompliance(false);
    }
  };

  const loadFleet = async (userId: string) => {
    setLoadingFleet(true);
    try {
      const vehicles = await getOwnerVehicles(userId);
      setFleet(vehicles || []);
    } catch (error) {
      console.error('Failed to load fleet:', error);
    } finally {
      setLoadingFleet(false);
    }
  };

  const loadReviews = async (userId: string) => {
    setLoadingReviews(true);
    try {
      const [reviewsData, summaryData] = await Promise.all([
        getProviderReviews(userId),
        getProviderRatingSummary(userId)
      ]);
      setReviews(reviewsData);
      setRatingSummary(summaryData);
    } catch (error) {
      console.error('Failed to load reviews:', error);
    } finally {
      setLoadingReviews(false);
    }
  };

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;
    if (!requestForm.startDate || !requestForm.endDate) {
      showToast('Start and end dates are required', 'error');
      return;
    }

    setSubmittingRequest(true);
    try {
      if (profile.role === 'driver') {
        await createDriverAvailabilityRequest({
          operator_id: user.id,
          driver_id: profile.id,
          start_date: requestForm.startDate,
          end_date: requestForm.endDate,
          notes: requestForm.notes
        });
      } else {
        await createGuideAvailabilityRequest({
          operator_id: user.id,
          guide_id: profile.id,
          start_date: requestForm.startDate,
          end_date: requestForm.endDate,
          notes: requestForm.notes
        });
      }
      
      window.dispatchEvent(new CustomEvent('PENDING_REQUESTS_UPDATED'));
      showToast('Request sent successfully', 'success');
      setShowRequestModal(false);
      
      setTimeout(() => navigate('/operator/vehicle-requests', { 
        state: { 
          tab: profile.role === 'driver' ? 'drivers' : 'guides', 
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

  const getInitials = (name?: string) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
    }
    return 'PR';
  };

  const formatLocation = (p: any) => {
    const city = p.city || p.metadata?.city;
    const province = p.province || p.metadata?.province;
    const country = p.country || p.metadata?.country;
    const parts = [city, province, country].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : 'Location not set';
  };

  if (loading) return <div className="p-12 text-center text-gray-400">Loading profile...</div>;
  if (!profile) return <div className="p-12 text-center text-gray-400">Profile not found.</div>;

  const isProviderOwner = user?.id === id;

  const metadata = profile.metadata || {};
  const bio = profile.bio || metadata.bio || metadata.service_summary;
  
  const normalizeArray = (val: any) => {
    if (Array.isArray(val)) return val.filter(Boolean);
    if (typeof val === 'string') return val.split(',').map(s => s.trim()).filter(Boolean);
    return [];
  };

  const languages = normalizeArray(metadata.languages);
  const services = normalizeArray(metadata.services || metadata.specialties);
  const experience = metadata.years_experience || metadata.experience_years;

  const isLoadingComplianceStatus = loadingCompliance;
  const hasPendingOnly = compliance?.issues?.length ? compliance.issues.every(i => i.problem === 'pending') : false;
  const isPendingCompliance = compliance?.status === 'non_compliant' && hasPendingOnly;
  const isNonCompliant = compliance?.status === 'non_compliant' && !hasPendingOnly;
  
  let headerBadgeOverrides = '';
  if (isNonCompliant) {
    headerBadgeOverrides = '!bg-red-50 !text-red-700 !border-red-200';
  } else if (isPendingCompliance) {
    headerBadgeOverrides = '!bg-amber-50 !text-amber-700 !border-amber-200';
  } else if (isLoadingComplianceStatus) {
    headerBadgeOverrides = '!bg-gray-100 !text-gray-500 !border-gray-200';
  }

  let verifBg = 'bg-blue-50';
  let verifBorder = 'border-blue-100';
  let verifTitle = 'text-blue-700';
  let verifContent = 'text-blue-800';
  let verifIconColor = 'text-blue-600';

  if (profile.verification_status === 'verified') {
    if (isNonCompliant) {
      verifBg = 'bg-red-50';
      verifBorder = 'border-red-200';
      verifTitle = 'text-red-700';
      verifContent = 'text-red-800';
      verifIconColor = 'text-red-600';
    } else if (isPendingCompliance) {
      verifBg = 'bg-amber-50';
      verifBorder = 'border-amber-200';
      verifTitle = 'text-amber-700';
      verifContent = 'text-amber-800';
      verifIconColor = 'text-amber-600';
    } else if (isLoadingComplianceStatus || !compliance) {
      verifBg = 'bg-gray-50';
      verifBorder = 'border-gray-200';
      verifTitle = 'text-gray-500';
      verifContent = 'text-gray-600';
      verifIconColor = 'text-gray-400';
    }
  } else {
    // Verification pending itself
    verifBg = 'bg-amber-50';
    verifBorder = 'border-amber-200';
    verifTitle = 'text-amber-700';
    verifContent = 'text-amber-800';
    verifIconColor = 'text-amber-600';
  }

  return (
    <div className="max-w-5xl mx-auto pb-12">
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[60] px-6 py-3 rounded-2xl shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-4 duration-300 ${
          toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          <span className="font-bold">{toast.message}</span>
        </div>
      )}

      <div className="mb-6 flex items-center justify-between">
        <button 
          onClick={() => navigate('/operator/directory', { state: location.state })} 
          className="flex items-center gap-2 text-gray-500 hover:text-brand-charcoal transition-colors font-bold text-sm"
        >
          <ArrowLeft size={18} /> Back to Directory
        </button>
        {isProviderOwner && (
          <button 
            onClick={() => navigate('/shared/documents')}
            className="flex items-center gap-2 px-4 py-2 bg-brand-teal text-white font-bold rounded-xl hover:bg-brand-teal/90 transition-colors text-sm shadow-sm"
          >
            <ShieldCheck size={18} /> Manage My Documents
          </button>
        )}
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Header/Cover Area */}
        <div className="h-32 bg-gradient-to-r from-brand-teal/20 to-brand-charcoal/10" />
        
        <div className="px-8 pb-8">
          <div className="relative -mt-16 mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-6">
            <div className="flex flex-col sm:flex-row items-center sm:items-end gap-6">
              <div className="w-32 h-32 bg-white rounded-3xl p-1 shadow-md">
                <div className="w-full h-full bg-brand-teal/10 rounded-[22px] flex items-center justify-center text-brand-teal font-bold text-3xl overflow-hidden border border-brand-teal/20">
                  {profile.avatar_url || profile.profile_image_url ? (
                    <img src={(profile.avatar_url || profile.profile_image_url) ?? undefined} alt={profile.full_name || ''} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <span>{getInitials(profile.full_name || profile.company_name)}</span>
                  )}
                </div>
              </div>
              <div className="text-center sm:text-left pb-2">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mb-1">
                  <h1 className="text-2xl font-bold text-brand-charcoal">{profile.full_name}</h1>
                  <ComplianceBadge userId={profile.id} role={profile.role} className={`scale-110 origin-left ${headerBadgeOverrides}`} />
                </div>
                <div className="flex flex-wrap justify-center sm:justify-start items-center gap-x-4 gap-y-1 text-sm text-gray-500">
                  <span className="flex items-center gap-1.5 capitalize font-medium text-brand-charcoal">
                    <User size={14} className="text-brand-teal" /> {profile.role}
                  </span>
                  {ratingSummary.total_reviews > 0 && (
                    <span className="flex items-center gap-1 text-amber-500 font-bold">
                      <Star size={14} className="fill-amber-500" /> 
                      {ratingSummary.average_rating.toFixed(1)} 
                      <span className="text-gray-400 font-normal ml-0.5">({ratingSummary.total_reviews})</span>
                    </span>
                  )}
                  {profile.company_name && (
                    <span className="flex items-center gap-1.5 px-2 py-0.5 bg-gray-100 rounded-lg">
                      <Building2 size={14} className="text-gray-400" /> {profile.company_name}
                    </span>
                  )}
                  <span className="flex items-center gap-1.5">
                    <MapPin size={14} className="text-brand-teal" /> {formatLocation(profile)}
                  </span>
                  {profile.is_active !== false ? (
                    <span className="flex items-center gap-1 text-green-600 font-bold text-[10px] uppercase">
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                      Available
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-gray-400 font-bold text-[10px] uppercase">
                      <div className="w-1.5 h-1.5 bg-gray-300 rounded-full" />
                      Unavailable
                    </span>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowRequestModal(true)}
              className="px-6 py-3 bg-brand-charcoal text-white rounded-2xl font-bold hover:bg-black transition-all flex items-center justify-center gap-2 shadow-sm"
            >
              <CalendarPlus size={18} />
              Request Availability
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-6 border-t border-gray-100">
            <div className="md:col-span-2 space-y-10">
              <section>
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Info size={16} className="text-brand-teal" />
                  About
                </h3>
                {bio ? (
                  <p className="text-gray-600 leading-relaxed whitespace-pre-wrap text-lg italic">
                    "{bio}"
                  </p>
                ) : (
                  <div className="p-8 border-2 border-dashed border-gray-100 rounded-3xl text-center">
                    <p className="text-gray-400 text-sm">No bio added yet.</p>
                  </div>
                )}
              </section>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <section>
                  <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Star size={16} className="text-brand-teal" />
                    Specialties
                  </h3>
                  {services && services.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {services.map((svc: string) => (
                        <span key={svc} className="px-3 py-1 bg-brand-teal/5 border border-brand-teal/20 rounded-xl text-sm font-medium text-brand-teal">
                          {svc}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-400 text-sm italic">Not specified</p>
                  )}
                </section>

                <section>
                  <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Languages size={16} className="text-brand-teal" />
                    Languages
                  </h3>
                  {languages && languages.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {languages.map((lang: string) => (
                        <span key={lang} className="px-3 py-1 bg-white border border-gray-200 rounded-xl text-sm font-medium text-brand-charcoal">
                          {lang}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-400 text-sm italic">Not specified</p>
                  )}
                </section>

                <section>
                  <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Briefcase size={16} className="text-brand-teal" />
                    Experience
                  </h3>
                  {experience ? (
                    <div className="text-brand-charcoal font-bold text-lg">
                      {experience} Years <span className="text-gray-400 font-normal text-sm block">Professional Experience</span>
                    </div>
                  ) : (
                    <p className="text-gray-400 text-sm italic">Not specified</p>
                  )}
                </section>
              </div>

              <section>
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <ShieldCheck size={16} className="text-brand-teal" />
                  Compliance & Safety
                </h3>
                {compliance ? (
                  <ProviderComplianceSummary compliance={compliance} title="" />
                ) : loadingCompliance ? (
                  <div className="flex items-center gap-2 text-gray-400 italic text-sm">
                    <Loader2 size={14} className="animate-spin" /> Loading compliance...
                  </div>
                ) : (
                  <div className="p-8 border-2 border-dashed border-gray-100 rounded-3xl text-center">
                    <p className="text-gray-400 text-sm italic">Compliance status pending verification.</p>
                  </div>
                )}
              </section>

              <section>
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Star size={16} className="text-brand-teal" />
                  Reviews & Ratings
                </h3>
                
                {loadingReviews ? (
                  <div className="flex items-center gap-2 text-gray-400 italic text-sm p-4">
                    <Loader2 size={14} className="animate-spin" /> Loading reviews...
                  </div>
                ) : reviews.length > 0 ? (
                  <div className="space-y-6">
                    <div className="flex items-center gap-8 p-6 bg-amber-50/50 rounded-3xl border border-amber-100">
                      <div className="text-center">
                        <div className="text-4xl font-black text-brand-charcoal leading-none mb-1">
                          {ratingSummary.average_rating.toFixed(1)}
                        </div>
                        <div className="flex gap-0.5 justify-center mb-1">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star 
                              key={s} 
                              size={12} 
                              className={s <= Math.round(ratingSummary.average_rating) ? "fill-amber-500 text-amber-500" : "text-gray-300"} 
                            />
                          ))}
                        </div>
                        <div className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">
                          {ratingSummary.total_reviews} Reviews
                        </div>
                      </div>
                      
                      <div className="flex-1 space-y-1.5 border-l border-amber-200 pl-8 hidden sm:block">
                        {[5, 4, 3, 2, 1].map((rating) => {
                          const count = reviews.filter(r => Math.round(r.rating) === rating).length;
                          const percentage = (count / reviews.length) * 100;
                          return (
                            <div key={rating} className="flex items-center gap-3">
                              <span className="text-[10px] font-bold text-gray-500 w-2">{rating}</span>
                              <div className="flex-1 h-1.5 bg-white rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-amber-400 rounded-full" 
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                              <span className="text-[10px] text-gray-400 w-4">{count}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="divide-y divide-gray-100">
                      {reviews.map((review) => (
                        <div key={review.id} className="py-6 first:pt-0 last:pb-0">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className="flex gap-0.5">
                                {[1, 2, 3, 4, 5].map((s) => (
                                  <Star 
                                    key={s} 
                                    size={10} 
                                    className={s <= review.rating ? "fill-amber-500 text-amber-500" : "text-gray-200"} 
                                  />
                                ))}
                              </div>
                              <span className="text-xs font-bold text-brand-charcoal">
                                {review.operator?.company_name || review.operator?.full_name || 'Tour Operator'}
                              </span>
                            </div>
                            <span className="text-[10px] text-gray-400 font-medium">
                              {format(new Date(review.created_at), 'MMM d, yyyy')}
                            </span>
                          </div>
                          {review.review_text && (
                            <p className="text-sm text-gray-600 leading-relaxed italic">
                              "{review.review_text}"
                            </p>
                          ) }
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="p-12 bg-gray-50 border border-gray-100 rounded-3xl text-center">
                    <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-gray-300 mx-auto mb-4 shadow-sm">
                      <Star size={32} />
                    </div>
                    <h4 className="font-bold text-brand-charcoal">No reviews yet</h4>
                    <p className="text-sm text-gray-500 max-w-xs mx-auto mt-2">
                      Ratings and feedback from other operators will appear here once this provider completes their first bookings.
                    </p>
                  </div>
                )}
              </section>

              {profile.role === 'vehicle_owner' && (
                <section>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                      <Truck size={16} className="text-brand-teal" />
                      Fleet
                    </h3>
                    <span className="text-xs font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-lg uppercase">
                      {fleet.length} Vehicles
                    </span>
                  </div>
                  
                  {loadingFleet ? (
                    <div className="flex items-center gap-2 text-gray-400 italic text-sm p-4">
                      <Loader2 size={14} className="animate-spin" /> Loading fleet...
                    </div>
                  ) : fleet.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {fleet.map((v) => {
                        const s = v.status?.toLowerCase() || '';
                        const labels: Record<string, string> = {
                          active: 'Active',
                          inactive: 'Inactive',
                          maintenance: 'Maintenance',
                          unavailable: 'Unavailable'
                        };
                        const styles: Record<string, string> = {
                          active: 'bg-teal-50 text-teal-700 border-teal-200',
                          inactive: 'bg-gray-100 text-gray-700 border-gray-200',
                          maintenance: 'bg-amber-50 text-amber-700 border-amber-200',
                          unavailable: 'bg-gray-100 text-gray-700 border-gray-200'
                        };
                        return (
                          <div
                            key={v.id}
                            onClick={() => navigate(`/operator/vehicles/${v.id}`)}
                            className="relative group bg-white p-4 rounded-2xl border border-gray-200 shadow-sm hover:border-brand-teal transition-all cursor-pointer flex gap-4"
                          >
                            <div className="absolute top-3 right-3">
                              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${styles[s] || 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                                {labels[s] || 'Status Unknown'}
                              </span>
                            </div>
                            <div className="w-20 h-20 bg-gray-100 rounded-xl overflow-hidden border border-gray-100 shrink-0">
                               {v.photos && v.photos.length > 0 ? (
                                 <img src={v.photos[0].url} className="w-full h-full object-cover group-hover:scale-110 transition-transform" alt="" />
                               ) : (
                                 <div className="w-full h-full flex items-center justify-center text-gray-300">
                                   <Truck size={24} />
                                 </div>
                               )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-bold text-brand-charcoal truncate flex items-center justify-between gap-2">
                                {v.make} {v.model}
                                <span className="text-[10px] text-gray-400 uppercase shrink-0">{v.year_model}</span>
                              </h4>
                              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                                 <span className="text-[10px] text-gray-500 flex items-center gap-1">
                                   <UsersIcon size={10} /> {v.seat_count} Seats
                                 </span>
                                 <span className="text-[10px] text-gray-500 uppercase">{v.body_type}</span>
                              </div>
                              <div className="mt-2 flex items-center justify-between">
                                 <div className="font-bold text-brand-teal text-xs">
                                   R {v.default_day_rate?.toLocaleString()}/day
                                 </div>
                                 <button className="text-[10px] text-brand-teal font-bold uppercase group-hover:underline">View Details</button>
                             </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-8 border-2 border-dashed border-gray-100 rounded-3xl text-center">
                      <p className="text-gray-400 text-sm italic">No vehicles listed in this fleet yet.</p>
                    </div>
                  )}
                </section>
              )}
            </div>

            <div className="space-y-6">
              <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 border-b border-gray-200 pb-2">
                  Standard Rates
                </h3>
                <div className="space-y-4">
                  <div>
                    <span className="text-[10px] text-gray-400 uppercase font-bold block mb-1">Daily Rate</span>
                    <div className="text-xl font-bold text-brand-charcoal">
                      {profile.default_day_rate ? `R ${profile.default_day_rate}` : 'Not set'}
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 uppercase font-bold block mb-1">Hourly Rate</span>
                    <div className="text-xl font-bold text-brand-charcoal">
                      {profile.default_hour_rate ? `R ${profile.default_hour_rate}` : 'Not set'}
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-400 leading-tight italic">
                    * Rates are indicative and may be negotiated during the booking process.
                  </p>
                </div>
              </div>

              {profile.vat_registered && (
                <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 border-b border-gray-200 pb-2">
                    Tax Information
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <span className="text-[10px] text-gray-400 uppercase font-bold block mb-1">VAT Status</span>
                      <div className="text-sm font-bold text-green-600 flex items-center gap-1.5">
                        <CheckCircle2 size={14} /> Registered
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className={`${verifBg} rounded-2xl p-6 border ${verifBorder}`}>
                <h3 className={`text-xs font-bold ${verifTitle} uppercase tracking-wider mb-2`}>
                  Verification
                </h3>
                <div className={`flex items-center gap-2 text-sm ${verifContent} font-medium`}>
                  {profile.verification_status === 'verified' && compliance?.status === 'compliant' ? (
                    <>
                      <CheckCircle2 size={16} className={verifIconColor} />
                      Verified Provider
                    </>
                  ) : profile.verification_status === 'verified' ? (
                    <>
                      <Clock size={16} className={verifIconColor} />
                      Compliance Incomplete
                    </>
                  ) : (
                    <>
                      <Clock size={16} className={verifIconColor} />
                      Verification Pending
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
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
                This sends a request to <strong>{profile.full_name}</strong> for availability.
              </p>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">
                    Start Date
                  </label>
                  <input 
                    type="date"
                    required
                    className="w-full border border-gray-300 rounded-2xl px-3 py-2 text-sm focus:ring-2 focus:ring-brand-teal outline-none"
                    value={requestForm.startDate}
                    onChange={e => setRequestForm({...requestForm, startDate: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">
                    End Date
                  </label>
                  <input 
                    type="date"
                    required
                    className="w-full border border-gray-300 rounded-2xl px-3 py-2 text-sm focus:ring-2 focus:ring-brand-teal outline-none"
                    value={requestForm.endDate}
                    onChange={e => setRequestForm({...requestForm, endDate: e.target.value})}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Notes (Optional)</label>
                <textarea 
                  rows={3}
                  className="w-full border border-gray-300 rounded-2xl px-3 py-2 text-sm focus:ring-2 focus:ring-brand-teal outline-none resize-none"
                  value={requestForm.notes}
                  onChange={e => setRequestForm({...requestForm, notes: e.target.value})}
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
                  disabled={submittingRequest}
                  className="flex-1 py-2 bg-brand-teal text-white rounded-2xl font-bold hover:bg-brand-teal/90 transition-colors flex items-center justify-center gap-2 text-sm shadow-sm"
                >
                  {submittingRequest ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  Send Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
