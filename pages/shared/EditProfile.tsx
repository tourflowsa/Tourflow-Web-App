import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { fetchCountries, fetchProvinces } from '../../lib/fleetService';
import { Save, User, Building, Phone, Loader2, CheckCircle2, AlertCircle, Banknote, Globe, FileText, MapPin, Camera, Upload, X, Landmark } from 'lucide-react';
import { BankDetailsForm } from '../../components/BankDetailsForm';
import { OperatorBankDetailsForm } from '../../components/OperatorBankDetailsForm';

export const EditProfile: React.FC = () => {
  const { user, profile, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
  
  const [countries, setCountries] = useState<string[]>([]);
  const [provinces, setProvinces] = useState<string[]>([]);
  const [provincesLoading, setProvincesLoading] = useState(false);

  const [formData, setFormData] = useState({
    full_name: '',
    company_name: '',
    phone: '',
    bio: '',
    website: '',
    languages: '',
    specialties: '',
    years_experience: '',
    country: 'South Africa',
    province: '',
    city: '',
    default_day_rate: '',
    default_hour_rate: '',
    profile_image_url: '',
    vat_registered: false,
    vat_number: '',
    vat_rate: '15'
  });

  useEffect(() => {
    const loadLocations = async () => {
      try {
        const cList = await fetchCountries();
        setCountries(cList);
      } catch (e) {
        console.error('Failed to load countries', e);
      }
    };
    loadLocations();
  }, []);

  useEffect(() => {
    const loadProvinces = async () => {
      // Country is locked to "South Africa" for now as per instructions
      const targetCountry = "South Africa";
      setProvincesLoading(true);
      try {
        const pList = await fetchProvinces(targetCountry);
        setProvinces(pList);
      } catch (e) {
        console.error('Failed to load provinces', e);
      } finally {
        setProvincesLoading(false);
      }
    };
    loadProvinces();
  }, []);

  useEffect(() => {
    if (profile) {
      setFormData({
        full_name: profile.full_name || '',
        company_name: profile.company_name || '',
        phone: profile.phone || '',
        bio: profile.bio || profile.metadata?.bio || '',
        website: profile.metadata?.website || '',
        languages: (profile.metadata?.languages || []).join(', '),
        specialties: (profile.metadata?.services || profile.metadata?.specialties || []).join(', '),
        years_experience: profile.metadata?.years_experience?.toString() || profile.metadata?.experience_years?.toString() || '',
        country: 'South Africa', // Enforce lock
        province: profile.province || profile.metadata?.province || '',
        city: profile.city || profile.metadata?.city || '',
        default_day_rate: profile.default_day_rate?.toString() || '',
        default_hour_rate: profile.default_hour_rate?.toString() || '',
        profile_image_url: profile.profile_image_url || '',
        vat_registered: profile.vat_registered || false,
        vat_number: profile.vat_number || '',
        vat_rate: profile.vat_rate?.toString() || '15'
      });
    }
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!formData.province) {
      setMessage({ type: 'error', text: 'Province is required' });
      return;
    }

    if (formData.vat_registered && !formData.vat_number?.trim()) {
      setMessage({ type: 'error', text: 'VAT Number is required when VAT is registered' });
      return;
    }
    
    setLoading(true);
    setMessage(null);

    // Validation for rates: Empty allowed, but if filled must be > 0
    const dayRateNum = formData.default_day_rate ? parseFloat(formData.default_day_rate) : null;
    const hourRateNum = formData.default_hour_rate ? parseFloat(formData.default_hour_rate) : null;

    if (dayRateNum !== null && (isNaN(dayRateNum) || dayRateNum <= 0)) {
      setMessage({ type: 'error', text: 'Day rate must be a positive number' });
      setLoading(false);
      return;
    }
    if (hourRateNum !== null && (isNaN(hourRateNum) || hourRateNum <= 0)) {
      setMessage({ type: 'error', text: 'Hour rate must be a positive number' });
      setLoading(false);
      return;
    }

    // Client-side guardrail against private data in public fields
    const restrictedPatterns = [
      /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i, // email
      /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/, // loosely matches phone numbers
      /0\d{9}/, // simple 10 digit phone
      /whatsapp/i, // whatsapp
      /pay(?:ment)?\s*(?:me|directly|via|to|using)/i, // direct payment
      /eft|cash/i, // EFT/cash
      /https?:\/\//i, // URL
      /www\./i // URL prepended with www.
    ];

    const fieldsToCheck = [formData.bio, formData.languages, formData.specialties];
    for (const field of fieldsToCheck) {
      if (!field) continue;
      for (const pattern of restrictedPatterns) {
        if (pattern.test(field)) {
          setMessage({ type: 'error', text: 'Public profile fields cannot contain emails, phone numbers, links, WhatsApp references, or direct payment instructions.' });
          setLoading(false);
          return;
        }
      }
    }

    const vatRateNum = formData.vat_registered ? (formData.vat_rate ? parseFloat(formData.vat_rate) : 15) : null;
    
    try {
      // Build metadata object with normalized location and bio
      const updatedMetadata = {
        ...(profile?.metadata || {}),
        bio: formData.bio,
        website: formData.website,
        languages: formData.languages.split(',').map(s => s.trim()).filter(Boolean),
        services: formData.specialties.split(',').map(s => s.trim()).filter(Boolean),
        specialties: formData.specialties.split(',').map(s => s.trim()).filter(Boolean),
        years_experience: formData.years_experience ? parseInt(formData.years_experience, 10) : null,
        country: 'South Africa',
        province: formData.province,
        city: formData.city.trim().substring(0, 80)
      };

      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: formData.full_name,
          company_name: formData.company_name,
          phone: formData.phone,
          bio: formData.bio,
          city: formData.city.trim().substring(0, 80),
          province: formData.province,
          country: 'South Africa',
          metadata: updatedMetadata,
          default_day_rate: dayRateNum,
          default_hour_rate: hourRateNum,
          vat_registered: formData.vat_registered,
          vat_number: formData.vat_registered ? formData.vat_number : null,
          vat_rate: vatRateNum,
          profile_image_url: formData.profile_image_url,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (error) throw error;
      
      await refreshProfile();
      setMessage({ type: 'success', text: 'Profile updated successfully!' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to update profile' });
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validate type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setMessage({ type: 'error', text: 'Only JPG, PNG and WEBP images are allowed' });
      return;
    }

    // Validate size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'Image size must be less than 5MB' });
      return;
    }

    setLoading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `profile-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('profiles')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('profiles')
        .getPublicUrl(filePath);

      setFormData(prev => ({
        ...prev,
        profile_image_url: publicUrl
      }));
      
      setMessage({ type: 'success', text: 'Profile photo uploaded!' });
    } catch (err: any) {
      console.error('Upload error:', err);
      setMessage({ type: 'error', text: 'Failed to upload image' });
    } finally {
      setLoading(false);
    }
  };

  const removeImage = () => {
    setFormData(prev => ({
      ...prev,
      profile_image_url: ''
    }));
  };

  if (!profile) return <div className="p-8 text-center text-gray-500 font-bold">Initializing profile...</div>;

  const isProvider = ['driver', 'guide', 'vehicle_owner'].includes(profile.role);

  const checklistItems = [
    { label: 'Profile Photo', completed: !!(profile.avatar_url || formData.profile_image_url) },
    { label: 'Public Bio', completed: !!(formData.bio && formData.bio.trim().length > 0) },
    { label: 'Primary Location', completed: !!(formData.country && formData.province && formData.city && formData.city.trim().length > 0) },
    { label: 'Languages', completed: !!(formData.languages && formData.languages.trim().length > 0) },
    { label: 'Specialties', completed: !!(formData.specialties && formData.specialties.trim().length > 0) },
    { label: 'Years of Experience', completed: !!(formData.years_experience && formData.years_experience.toString().trim().length > 0) },
  ];

  if (profile.role === 'guide' || profile.role === 'driver') {
    checklistItems.push({ label: 'Default Rates', completed: !!((formData.default_day_rate && formData.default_day_rate.toString().trim().length > 0) || (formData.default_hour_rate && formData.default_hour_rate.toString().trim().length > 0)) });
  }

  const completedCount = checklistItems.filter(item => item.completed).length;
  const totalCount = checklistItems.length;
  const completenessPercentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-brand-charcoal">Edit Profile</h1>
        <p className="text-gray-500 mt-1">Manage your account and contact information.</p>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-2xl border flex items-center gap-3 animate-in fade-in slide-in-from-top-2 ${
          message.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'
        }`}>
          {message.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          <span className="font-bold">{message.text}</span>
        </div>
      )}

      {isProvider && (
        <div className="mb-8 bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-bold text-brand-charcoal flex items-center gap-2">
                  Marketplace Profile Completeness
                </h3>
                <p className="text-[11px] text-gray-500 mt-1 max-w-sm leading-relaxed">
                  Profile completeness helps operators understand your services. Compliance approval is handled separately through your required documents.
                </p>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-2xl font-black text-brand-teal">{completenessPercentage}%</span>
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">Complete</span>
              </div>
            </div>
            
            <div className="w-full bg-gray-100 rounded-full h-2.5 mb-6 overflow-hidden">
              <div 
                className="bg-brand-teal h-full transition-all duration-500 ease-out" 
                style={{ width: `${completenessPercentage}%` }}
              ></div>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-3 gap-x-4">
              {checklistItems.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  {item.completed ? (
                    <CheckCircle2 size={14} className="text-brand-teal shrink-0" />
                  ) : (
                    <div className="w-3.5 h-3.5 rounded-full border-2 border-gray-200 shrink-0 mx-0.5"></div>
                  )}
                  <span className={`text-[11px] ${item.completed ? 'text-gray-700 font-medium' : 'text-gray-400'}`}>
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="mb-8">
        {/* Profile Image Upload */}
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col items-center text-center max-w-sm mx-auto">
          <div className="relative mb-4 group">
            <div className="w-24 h-24 rounded-full bg-gray-100 border-2 border-brand-teal/20 flex items-center justify-center overflow-hidden">
              {profile.avatar_url || formData.profile_image_url ? (
                <img src={profile.avatar_url || formData.profile_image_url} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <User size={40} className="text-gray-300" />
              )}
            </div>
            <label className="absolute bottom-0 right-0 p-2 bg-brand-teal text-white rounded-full cursor-pointer shadow-lg hover:bg-brand-teal/90 transition-all">
              <Camera size={16} />
              <input type="file" className="hidden" accept="image/*" onChange={e => handleImageUpload(e)} />
            </label>
            {formData.profile_image_url && (
              <button 
                onClick={() => removeImage()}
                className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full shadow-md hover:bg-red-600 transition-all"
              >
                <X size={12} />
              </button>
            )}
          </div>
          <h3 className="font-bold text-brand-charcoal text-sm">Profile Photo</h3>
          <p className="text-[10px] text-gray-500 mt-1">Add a profile photo to help others recognize you.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-8 space-y-6">
          <div className="border-b border-gray-100 pb-6 mb-6">
             <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2 uppercase tracking-wider">
               <User size={16} className="text-brand-teal" /> Private Account Details
             </h3>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div>
                 <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                   <User size={16} className="text-brand-teal" /> Full Name
                 </label>
                 <input 
                   type="text" 
                   className="w-full border border-gray-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-brand-teal outline-none transition-all"
                   value={formData.full_name}
                   onChange={e => setFormData({...formData, full_name: e.target.value})}
                   placeholder="Your full legal name"
                 />
               </div>
               <div>
                 <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                   <Phone size={16} className="text-brand-teal" /> Phone Number
                 </label>
                 <input 
                   type="tel" 
                   className="w-full border border-gray-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-brand-teal outline-none transition-all"
                   value={formData.phone}
                   onChange={e => setFormData({...formData, phone: e.target.value})}
                   placeholder="+27..."
                 />
               </div>
               <div>
                 <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                   <Building size={16} className="text-brand-teal" /> Company Name
                 </label>
                 <input 
                   type="text" 
                   className="w-full border border-gray-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-brand-teal outline-none transition-all"
                   value={formData.company_name}
                   onChange={e => setFormData({...formData, company_name: e.target.value})}
                   placeholder="Your business name"
                 />
               </div>
               <div>
                 <div className="flex items-center justify-between text-sm text-gray-400 mb-2 font-bold uppercase tracking-wider h-6">
                   <span>Email Address</span>
                 </div>
                 <div className="flex items-center h-[46px] w-full border border-gray-100 rounded-xl px-4 bg-gray-50 text-gray-500 text-sm font-mono">
                   {profile.email}
                 </div>
                 <p className="text-[10px] text-gray-400 mt-1 italic">Email cannot be changed manually.</p>
               </div>
               <div>
                 <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5 flex items-center gap-1.5">
                   <Globe size={14} /> Website
                 </label>
                 <input 
                   type="text"
                   className="w-full border border-gray-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-brand-teal outline-none transition-all font-mono text-sm"
                   value={formData.website}
                   onChange={e => setFormData({...formData, website: e.target.value})}
                   placeholder="e.g. www.company.com"
                 />
               </div>
             </div>
          </div>

          <div className="border-b border-gray-100 pb-6 mb-6">
             <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2 uppercase tracking-wider">
               <Globe size={16} className="text-brand-teal" /> Public Marketplace Profile
             </h3>
             <p className="text-[10px] text-gray-500 mt-1 mb-4">
                These details may be visible to operators when they view your marketplace profile. Do not include phone numbers, email addresses, websites, bank details, personal addresses, or direct payment instructions.
             </p>
             <div className="space-y-4">
               <div>
                 <label className="block text-xs font-bold text-gray-400 uppercase mb-2">About / Bio</label>
                 <textarea 
                   className="w-full border border-gray-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-brand-teal outline-none transition-all h-24 resize-none"
                   value={formData.bio}
                   onChange={e => setFormData({...formData, bio: e.target.value})}
                   placeholder="Briefly describe your services and experience..."
                 />
               </div>
               <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                 <div>
                   <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Languages Spoken</label>
                   <input 
                     type="text"
                     className="w-full border border-gray-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-brand-teal outline-none transition-all text-sm"
                     value={formData.languages}
                     onChange={e => setFormData({...formData, languages: e.target.value})}
                     placeholder="e.g. English, Zulu, Afrikaans"
                   />
                 </div>
                 <div>
                   <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Specialties / Services</label>
                   <input 
                     type="text"
                     className="w-full border border-gray-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-brand-teal outline-none transition-all text-sm"
                     value={formData.specialties}
                     onChange={e => setFormData({...formData, specialties: e.target.value})}
                     placeholder="e.g. Wine Tours, Airport Transfers"
                   />
                 </div>
                 <div>
                   <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Years of Experience</label>
                   <input 
                     type="number"
                     className="w-full border border-gray-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-brand-teal outline-none transition-all text-sm"
                     value={formData.years_experience}
                     onChange={e => setFormData({...formData, years_experience: e.target.value})}
                     placeholder="e.g. 5"
                     min="0" max="60"
                   />
                 </div>
               </div>
             </div>

             <h3 className="text-sm font-bold text-gray-700 mt-6 mb-4 flex items-center gap-2 uppercase tracking-wider">
               <MapPin size={16} className="text-brand-teal" /> Primary Location
             </h3>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
               <div>
                 <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5">Country</label>
                 <select 
                   className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-teal outline-none transition-all bg-gray-100 cursor-not-allowed"
                   value={formData.country}
                   disabled={true}
                 >
                   <option value="South Africa">South Africa</option>
                 </select>
               </div>
               <div>
                 <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5 flex items-center gap-1">
                   Province/State {provincesLoading && <Loader2 size={10} className="animate-spin" />}
                 </label>
                 <select 
                   className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-teal outline-none transition-all bg-white disabled:bg-gray-50"
                   value={formData.province}
                   onChange={e => setFormData({...formData, province: e.target.value})}
                   disabled={provincesLoading}
                 >
                   <option value="">Select Province...</option>
                   {provinces.map(p => <option key={p} value={p}>{p}</option>)}
                   {provinces.length === 0 && !provincesLoading && <option value="Unknown">Unknown</option>}
                 </select>
               </div>
               <div>
                 <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5">City</label>
                 <input 
                   type="text"
                   className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-teal outline-none transition-all"
                   value={formData.city}
                   onChange={e => setFormData({...formData, city: e.target.value})}
                   placeholder="e.g. Cape Town"
                   maxLength={80}
                 />
               </div>
             </div>
          </div>

          {(isProvider || profile.role === 'operator') && (
            <div className="border-b border-gray-100 pb-6 mb-6">
               <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2 uppercase tracking-wider">
                 <Banknote size={16} className="text-brand-teal" /> Private Billing / Tax Details
               </h3>
               
               {isProvider && (
                 <div className="mb-6">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Default Day Rate (ZAR)</label>
                        <div className="relative">
                          <span className="absolute left-4 top-2.5 text-gray-400 text-sm">R</span>
                          <input 
                            type="number" 
                            step="0.01"
                            className="w-full border border-gray-300 rounded-xl pl-8 pr-4 py-2.5 focus:ring-2 focus:ring-brand-teal outline-none transition-all"
                            value={formData.default_day_rate}
                            onChange={e => setFormData({...formData, default_day_rate: e.target.value})}
                            placeholder="e.g. 1500"
                          />
                        </div>
                     </div>
                     <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Default Hour Rate (ZAR)</label>
                        <div className="relative">
                          <span className="absolute left-4 top-2.5 text-gray-400 text-sm">R</span>
                          <input 
                            type="number" 
                            step="0.01"
                            className="w-full border border-gray-300 rounded-xl pl-8 pr-4 py-2.5 focus:ring-2 focus:ring-brand-teal outline-none transition-all"
                            value={formData.default_hour_rate}
                            onChange={e => setFormData({...formData, default_hour_rate: e.target.value})}
                            placeholder="e.g. 250"
                          />
                        </div>
                     </div>
                   </div>
                   <p className="text-[10px] text-gray-400 mt-2 italic">Operators will see these rates when assigning you to bookings. You can leave these blank if you prefer to negotiate every trip.</p>
                 </div>
               )}

               <div className="space-y-4">
                 <div className="flex items-center gap-3">
                   <button
                     type="button"
                     role="switch"
                     aria-checked={formData.vat_registered}
                     onClick={() => setFormData({...formData, vat_registered: !formData.vat_registered})}
                     className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-teal focus:ring-offset-2 ${formData.vat_registered ? 'bg-brand-teal' : 'bg-gray-200'}`}
                   >
                     <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.vat_registered ? 'translate-x-6' : 'translate-x-1'}`} />
                   </button>
                   <label className="text-sm font-bold text-gray-700 cursor-pointer" onClick={() => setFormData({...formData, vat_registered: !formData.vat_registered})}>
                     VAT Registered
                   </label>
                 </div>

                 {formData.vat_registered && (
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-top-2">
                     <div>
                       <label className="block text-xs font-bold text-gray-400 uppercase mb-2">VAT Number *</label>
                       <input 
                         type="text" 
                         className="w-full border border-gray-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-brand-teal outline-none transition-all"
                         value={formData.vat_number || ''}
                         onChange={e => setFormData({...formData, vat_number: e.target.value})}
                         placeholder="e.g. 4123456789"
                         required={formData.vat_registered}
                       />
                     </div>
                     <div>
                       <label className="block text-xs font-bold text-gray-400 uppercase mb-2">VAT Rate (%)</label>
                       <input 
                         type="number" 
                         step="0.1"
                         className="w-full border border-gray-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-brand-teal outline-none transition-all"
                         value={formData.vat_rate || ''}
                         onChange={e => setFormData({...formData, vat_rate: e.target.value})}
                         placeholder="15"
                       />
                     </div>
                   </div>
                 )}
               </div>
            </div>
          )}
        </div>

        <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-end">
          <button 
            type="submit" 
            disabled={loading}
            className="bg-brand-charcoal text-white px-8 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-black transition-all shadow-lg shadow-brand-charcoal/20 disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
            Save Changes
          </button>
        </div>
      </form>

      {isProvider && user && (
        <div id="bank-details" className="mt-8 bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-8">
            <BankDetailsForm 
              providerId={user.id} 
              providerType={profile.role === 'vehicle_owner' ? 'fleet' : profile.role as any} 
            />
          </div>
        </div>
      )}

      {profile.role === 'operator' && user && (
        <div className="mt-8 bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-8">
            <OperatorBankDetailsForm 
              operatorId={user.id} 
            />
          </div>
        </div>
      )}
    </div>
  );
};
