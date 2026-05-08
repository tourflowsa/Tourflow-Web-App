
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  CheckCircle2, 
  MapPin, 
  Building2, 
  Eye, 
  Clock,
  User,
  Star
} from 'lucide-react';
import { ComplianceBadge } from '../common/ComplianceBadge';
import { UserProfile, UserRole, ComplianceSummary } from '../../types';
import { RatingSummary } from '../../lib/reviewService';

interface ProviderCardProps {
  provider: UserProfile & { metadata?: any };
  role: UserRole;
  onClickRequest?: (providerId: string, providerName: string) => void;
  ratingSummary?: RatingSummary;
}

export const ProviderCard: React.FC<ProviderCardProps> = ({ 
  provider, 
  role,
  onClickRequest,
  ratingSummary
}) => {
  const navigate = useNavigate();
  const [complianceLoaded, setComplianceLoaded] = useState(false);
  const [isCompliant, setIsCompliant] = useState(false);

  const metadata = provider.metadata || {};
  
  const displayName = provider.company_name || provider.full_name || 'Verified Provider';
  const secondaryName = provider.company_name && provider.full_name ? provider.full_name : null;
  
  const city = provider.city || metadata.city;
  const province = provider.province || metadata.province;
  const country = provider.country || metadata.country || 'South Africa';
  
  const bio = provider.bio || metadata.bio || metadata.service_summary;
  const experience = metadata.years_experience || metadata.experience_years;

  const normalizeArray = (val: any) => {
    if (Array.isArray(val)) return val.filter(Boolean);
    if (typeof val === 'string') return val.split(',').map(s => s.trim()).filter(Boolean);
    return [];
  };

  const getExperienceText = () => {
    const years = metadata.years_experience || metadata.experience_years;
    if (!years) return null;
    return `${years} yrs exp`;
  };

  const getRateText = () => {
    // Basic number check for currency formatting
    const dayRate = typeof provider.default_day_rate === 'number' ? provider.default_day_rate : Number(provider.default_day_rate);
    const hourRate = typeof provider.default_hour_rate === 'number' ? provider.default_hour_rate : Number(provider.default_hour_rate);

    if (!isNaN(dayRate) && dayRate > 0) return `R${dayRate.toLocaleString()}/day`;
    if (!isNaN(hourRate) && hourRate > 0) return `R${hourRate.toLocaleString()}/hr`;
    return null;
  };

  const getPrimaryMetadataChips = () => {
    const chips = [];
    const exp = getExperienceText();
    if (exp) chips.push({ text: exp, type: 'exp' });

    // Use primary service and language
    const primaryService = services[0];
    if (primaryService) chips.push({ text: primaryService, type: 'svc' });

    const primaryLanguage = languages[0];
    if (primaryLanguage && chips.length < 3) chips.push({ text: primaryLanguage, type: 'lang' });

    return chips;
  };

  const languages = normalizeArray(metadata.languages || metadata.language);
  const services = normalizeArray(metadata.services || metadata.specialties || metadata.transport_types);

  const getInitials = (name?: string) => {
    if (name) return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
    return 'PR';
  };

  const handleStatusLoad = (summary: ComplianceSummary | null) => {
    setComplianceLoaded(true);
    if (summary) {
      setIsCompliant(summary.isCompliant);
    } else {
      setIsCompliant(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden hover:border-brand-teal transition-all group flex flex-col h-full">
      <div className="p-6 flex-1 flex flex-col">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-brand-teal/5 rounded-2xl flex items-center justify-center text-brand-teal font-bold overflow-hidden border border-brand-teal/10 shadow-inner shrink-0">
              {provider.avatar_url || provider.profile_image_url ? (
                <img src={provider.avatar_url || provider.profile_image_url || ''} alt={displayName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <User size={28} className="text-gray-300" />
              )}
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-brand-charcoal truncate flex items-center gap-2">
                {displayName}
                {provider.verification_status === 'verified' && complianceLoaded && isCompliant && (
                  <CheckCircle2 size={14} className="text-blue-500 fill-blue-50 shrink-0" />
                )}
              </h3>
              <div className="flex items-center gap-2 mt-0.5">
                <ComplianceBadge userId={provider.id} role={role} showLabels={false} className="scale-90 origin-left" onStatusLoad={handleStatusLoad} />
                {experience && <span className="text-[10px] text-gray-400 font-bold uppercase">{experience}Y Exp</span>}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-2 mb-4 flex-1">
          {provider.company_name && provider.full_name && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Building2 size={14} className="text-gray-400" />
              <span className="truncate">{provider.full_name}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <MapPin size={14} className="text-brand-teal" />
            <span className="truncate">{[city, province, country].filter(Boolean).join(', ')}</span>
          </div>
          {(services.length > 0 || languages.length > 0 || getExperienceText()) && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {getPrimaryMetadataChips().map((chip, idx) => (
                <span key={`${chip.type}-${idx}`} className={`px-2 py-0.5 rounded-lg text-[10px] font-bold truncate max-w-[120px] ${
                  chip.type === 'exp' ? 'bg-amber-50 border border-amber-100 text-amber-700' :
                  chip.type === 'svc' ? 'bg-brand-teal/5 border border-brand-teal/10 text-brand-teal' :
                  'bg-gray-50 border border-gray-100 text-gray-500'
                }`}>
                  {chip.text}
                </span>
              ))}
            </div>
          )}
          {bio && (
            <p className="text-[11px] text-gray-500 line-clamp-2 mt-2 leading-relaxed italic">
              "{bio}"
            </p>
          )}
        </div>
        
        <div className="flex items-center justify-between gap-1 mb-4">
          <div className="flex items-center gap-1">
            {ratingSummary && ratingSummary.total_reviews > 0 ? (
              <>
                <Star size={12} className="text-amber-400 fill-amber-400" />
                <span className="text-xs font-bold text-brand-charcoal ml-0.5">{ratingSummary.average_rating.toFixed(1)}</span>
                <span className="text-[10px] text-gray-400 ml-1">({ratingSummary.total_reviews})</span>
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
          {getRateText() && (
            <span className="text-xs font-bold text-brand-charcoal">
              {getRateText()}
            </span>
          )}
        </div>

        <div className="mt-auto pt-4 border-t border-gray-50 grid grid-cols-2 gap-2">
          <button 
            onClick={() => navigate(`/operator/directory/provider/${provider.id}`)}
            className="flex items-center justify-center gap-2 py-2.5 bg-gray-50 text-brand-charcoal font-bold rounded-xl hover:bg-gray-100 transition-all text-xs"
          >
            <Eye size={14} /> Profile
          </button>
          <button 
            onClick={() => onClickRequest?.(provider.id, provider.full_name || displayName)}
            className="flex items-center justify-center gap-2 py-2.5 bg-brand-charcoal text-white font-bold rounded-xl hover:bg-black transition-all text-xs"
          >
            <Clock size={14} /> Request
          </button>
        </div>
      </div>
    </div>
  );
};
