import React, { useEffect, useState } from 'react';
import { Vehicle, VehicleStatus, VehiclePhoto } from '../../types';
import { Loader2, Save, Truck, Info, Fuel, Users, CheckCircle2, ShieldCheck, Image as ImageIcon, Banknote, MapPin, AlertCircle, X } from 'lucide-react';
import { VehiclePhotos } from './VehiclePhotos';
import { fetchCountries, fetchProvinces, deleteVehiclePhoto } from '../../lib/fleetService';

interface Props {
  initialData?: Vehicle | null;
  onSubmit: (data: Partial<Vehicle>, pendingFiles: File[]) => Promise<void>;
  loading: boolean;
  mode: 'create' | 'edit';
}

interface VehicleFormValues {
  make: string;
  customMake: string; 
  model: string;
  year_model: number;
  body_type: string;
  license_plate: string;
  
  seat_count: number;
  transmission: 'Manual' | 'Automatic';
  fuel_type: 'Petrol' | 'Diesel' | 'Hybrid' | 'Electric';
  
  has_aircon: boolean;
  has_wifi: boolean;
  has_tow_bar: boolean;
  wheelchair_access: boolean;
  has_child_seat: boolean;
  
  seat_type: 'Leather' | 'Cloth' | 'Other';
  seat_type_other: string;
  luggage_capacity: string;
  
  default_day_rate: string;
  default_hour_rate: string;
  
  ownership_type: 'Owned' | 'Leased' | 'Partner';
  status: VehicleStatus;
  license_expiry: string;
  notes: string;
  
  country: string;
  province: string;
  city: string;

  photos: VehiclePhoto[];
}

const DEFAULT_FORM: VehicleFormValues = {
  make: '',
  customMake: '',
  model: '',
  year_model: new Date().getFullYear(),
  body_type: 'Minibus',
  license_plate: '',
  seat_count: 4,
  transmission: 'Manual',
  fuel_type: 'Petrol',
  has_aircon: false,
  has_wifi: false,
  has_tow_bar: false,
  wheelchair_access: false,
  has_child_seat: false,
  seat_type: 'Cloth',
  seat_type_other: '',
  luggage_capacity: '',
  default_day_rate: '',
  default_hour_rate: '',
  ownership_type: 'Owned',
  status: 'Active',
  license_expiry: '',
  notes: '',
  country: 'South Africa',
  province: '',
  city: '',
  photos: []
};

const COMMON_MAKES = [
  "Toyota", "Volkswagen", "Mercedes-Benz", "Ford", "Hyundai", 
  "Kia", "Nissan", "BMW", "Audi", "Isuzu"
];

const BODY_TYPES = [
  "Minibus", "Sedan", "SUV", "Double Cab", "Single Cab", "Coach", "Van", "Other"
];

const Section = ({ title, icon: Icon, children }: { title: string, icon: any, children?: React.ReactNode }) => (
  <div className="p-6 border-b border-gray-100 last:border-0">
    <div className="flex items-center gap-2 mb-6">
      <div className="p-1.5 bg-brand-teal/10 rounded-md text-brand-teal">
        <Icon size={18} />
      </div>
      <h3 className="font-bold text-gray-800 text-lg">{title}</h3>
    </div>
    {children}
  </div>
);

export const VehicleForm: React.FC<Props> = ({ initialData, onSubmit, loading, mode }) => {
  const [form, setForm] = useState<VehicleFormValues>(DEFAULT_FORM);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  
  const [countries, setCountries] = useState<string[]>([]);
  const [provinces, setProvinces] = useState<string[]>([]);
  const [provincesLoading, setProvincesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      // Force loading provinces for South Africa
      setProvincesLoading(true);
      try {
        const pList = await fetchProvinces("South Africa");
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
    if (initialData) {
      const isCustomMake = !COMMON_MAKES.includes(initialData.make);
      
      setForm({
        make: isCustomMake ? 'Other' : initialData.make,
        customMake: isCustomMake ? initialData.make : '',
        model: initialData.model,
        year_model: initialData.year_model,
        body_type: initialData.body_type,
        license_plate: initialData.license_plate,
        seat_count: initialData.seat_count,
        transmission: initialData.transmission as any,
        fuel_type: initialData.fuel_type as any,
        has_aircon: initialData.has_aircon,
        has_wifi: initialData.has_wifi,
        has_tow_bar: initialData.has_tow_bar,
        wheelchair_access: initialData.wheelchair_access,
        has_child_seat: initialData.has_child_seat,
        seat_type: initialData.seat_type as any,
        seat_type_other: initialData.seat_type_other || '',
        luggage_capacity: initialData.luggage_capacity || '',
        default_day_rate: initialData.default_day_rate?.toString() || '',
        default_hour_rate: initialData.default_hour_rate?.toString() || '',
        ownership_type: initialData.ownership_type as any,
        status: initialData.status,
        license_expiry: initialData.license_expiry || '',
        notes: initialData.notes || '',
        country: 'South Africa', // Locked to South Africa
        province: (initialData as any).province || '',
        city: (initialData as any).city || '',
        photos: initialData.photos || []
      });
    }
  }, [initialData]);

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value === '' ? '' : Number(value) }));
  };

  const handleCheckChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setForm(prev => ({ ...prev, [name]: checked }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const finalMake = form.make === 'Other' ? form.customMake : form.make;
    if (!finalMake.trim()) {
      setError("Please specify the Vehicle Make");
      return;
    }
    if (!form.model.trim()) {
      setError("Please specify the Model");
      return;
    }
    if (!form.province) {
      setError("Please select a Province");
      return;
    }

    // Rate Validation
    const dayRate = form.default_day_rate === '' ? null : Number(form.default_day_rate);
    const hourRate = form.default_hour_rate === '' ? null : Number(form.default_hour_rate);

    if (dayRate !== null && dayRate < 0) {
      setError("Day rate cannot be negative");
      return;
    }
    if (hourRate !== null && hourRate < 0) {
      setError("Hour rate cannot be negative");
      return;
    }

    // Marketplace Description (Notes) Validation
    const piiPatterns = [
      /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/, // Email
      /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4,}/, // Phone
      /https?:\/\/[^\s]+/, // URLs
      /www\.[^\s]+/, // URLs
      /whatsapp/i,
      /direct payment/i,
      /bank details/i,
      /wire transfer/i,
      /eft/i,
      /paypal/i
    ];

    if (form.notes) {
      const foundPII = piiPatterns.some(pattern => pattern.test(form.notes));
      if (foundPII) {
        setError("Description contains restricted contact or payment information. Please remove emails, phone numbers, websites, or direct payment mentions.");
        return;
      }
    }

    setError(null);

    const payload: Partial<Vehicle> = {
      make: finalMake,
      model: form.model,
      year_model: form.year_model,
      body_type: form.body_type,
      license_plate: form.license_plate,
      seat_count: form.seat_count,
      transmission: form.transmission,
      fuel_type: form.fuel_type,
      has_aircon: form.has_aircon,
      has_wifi: form.has_wifi,
      has_tow_bar: form.has_tow_bar,
      wheelchair_access: form.wheelchair_access,
      has_child_seat: form.has_child_seat,
      seat_type: form.seat_type,
      seat_type_other: form.seat_type === 'Other' ? form.seat_type_other : null,
      luggage_capacity: form.luggage_capacity,
      default_day_rate: dayRate,
      default_hour_rate: hourRate,
      rate_currency: 'ZAR',
      ownership_type: form.ownership_type,
      status: form.status,
      license_expiry: form.license_expiry || null,
      notes: form.notes,
      photos: form.photos,
      // Location payload
      country: 'South Africa',
      province: form.province,
      city: form.city.trim().substring(0, 80)
    };

    onSubmit(payload, pendingFiles);
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-6 bg-gray-50 border-b border-gray-200 flex items-center gap-3">
        <Truck className="text-brand-charcoal" size={24} />
        <div>
          <h2 className="text-xl font-bold text-brand-charcoal">
            {mode === 'create' ? 'Add New Vehicle' : `Editing ${initialData?.make} ${initialData?.model}`}
          </h2>
          <p className="text-xs text-gray-500">Complete all sections to register the vehicle.</p>
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-700 animate-in fade-in">
          <AlertCircle size={20} />
          <span className="text-sm font-bold">{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600"><X size={16}/></button>
        </div>
      )}

      <Section title="Basic Details" icon={Info}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
             <div>
               <label className="block text-sm font-bold text-gray-700 mb-1">Make <span className="text-red-500">*</span></label>
               <select name="make" className="w-full border border-gray-300 rounded-lg p-2.5 bg-white" value={form.make} onChange={handleTextChange} required>
                 <option value="">Select Make...</option>
                 {COMMON_MAKES.map(m => <option key={m} value={m}>{m}</option>)}
                 <option value="Other">Other</option>
               </select>
             </div>
             {form.make === 'Other' && (
               <div>
                 <label className="block text-sm font-bold text-gray-700 mb-1">Custom Make</label>
                 <input name="customMake" type="text" className="w-full border border-gray-300 rounded-lg p-2.5" placeholder="Enter make name" value={form.customMake} onChange={handleTextChange} required />
               </div>
             )}
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Model <span className="text-red-500">*</span></label>
            <input name="model" type="text" className="w-full border border-gray-300 rounded-lg p-2.5" placeholder="e.g. Sprinter 519" value={form.model} onChange={handleTextChange} required />
          </div>
          <div>
             <label className="block text-sm font-bold text-gray-700 mb-1">Year Model <span className="text-red-500">*</span></label>
             <input name="year_model" type="number" className="w-full border border-gray-300 rounded-lg p-2.5" min="1990" max={new Date().getFullYear() + 1} value={form.year_model} onChange={handleNumberChange} required />
          </div>
          <div>
             <label className="block text-sm font-bold text-gray-700 mb-1">Body Type <span className="text-red-500">*</span></label>
             <select name="body_type" className="w-full border border-gray-300 rounded-lg p-2.5 bg-white" value={form.body_type} onChange={handleTextChange}>
               {BODY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
             </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-bold text-gray-700 mb-1">License Plate <span className="text-red-500">*</span></label>
            <input name="license_plate" type="text" className="w-full border border-gray-300 rounded-lg p-2.5 uppercase font-mono tracking-wider max-w-md" placeholder="CA 123 456" value={form.license_plate} onChange={handleTextChange} required />
          </div>
        </div>
      </Section>

      <Section title="Location" icon={MapPin}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Country <span className="text-red-500">*</span></label>
            <select name="country" className="w-full border border-gray-300 rounded-lg p-2.5 bg-gray-100 cursor-not-allowed" value={form.country} disabled={true} required>
              <option value="South Africa">South Africa</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1 flex items-center gap-1">
              Province/State <span className="text-red-500">*</span> {provincesLoading && <Loader2 size={10} className="animate-spin" />}
            </label>
            <select 
              name="province" 
              className="w-full border border-gray-300 rounded-lg p-2.5 bg-white disabled:bg-gray-50" 
              value={form.province} 
              onChange={handleTextChange} 
              required
              disabled={provincesLoading}
            >
              <option value="">Select Province...</option>
              {provinces.map(p => <option key={p} value={p}>{p}</option>)}
              {form.province === 'Unknown' && <option value="Unknown">Unknown</option>}
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">City</label>
            <input name="city" type="text" className="w-full border border-gray-300 rounded-lg p-2.5" placeholder="e.g. Cape Town" value={form.city} onChange={handleTextChange} maxLength={80} />
          </div>
        </div>
      </Section>

      <Section title="Rental Rates" icon={Banknote}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Default Day Rate (ZAR)</label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-gray-400 text-sm">R</span>
              <input name="default_day_rate" type="number" step="0.01" min="0" className="w-full border border-gray-300 rounded-lg pl-8 pr-4 py-2.5" placeholder="0.00" value={form.default_day_rate} onChange={handleTextChange} />
            </div>
            <p className="text-[10px] text-gray-400 mt-1">Leave empty if not applicable.</p>
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Default Hour Rate (ZAR)</label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-gray-400 text-sm">R</span>
              <input name="default_hour_rate" type="number" step="0.01" min="0" className="w-full border border-gray-300 rounded-lg pl-8 pr-4 py-2.5" placeholder="0.00" value={form.default_hour_rate} onChange={handleTextChange} />
            </div>
            <p className="text-[10px] text-gray-400 mt-1">Recommended for airport transfers.</p>
          </div>
        </div>
      </Section>

      <Section title="Performance & Capacity" icon={Fuel}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           <div>
             <label className="block text-sm font-bold text-gray-700 mb-1">Seats <span className="text-red-500">*</span></label>
             <input name="seat_count" type="number" className="w-full border border-gray-300 rounded-lg p-2.5" min="1" max="80" value={form.seat_count} onChange={handleNumberChange} required />
           </div>
           <div>
             <label className="block text-sm font-bold text-gray-700 mb-1">Transmission</label>
             <select name="transmission" className="w-full border border-gray-300 rounded-lg p-2.5 bg-white" value={form.transmission} onChange={handleTextChange as any}>
               <option value="Manual">Manual</option>
               <option value="Automatic">Automatic</option>
             </select>
           </div>
           <div>
             <label className="block text-sm font-bold text-gray-700 mb-1">Fuel Type</label>
             <select name="fuel_type" className="w-full border border-gray-300 rounded-lg p-2.5 bg-white" value={form.fuel_type} onChange={handleTextChange as any}>
               <option value="Petrol">Petrol</option>
               <option value="Diesel">Diesel</option>
               <option value="Hybrid">Hybrid</option>
               <option value="Electric">Electric</option>
             </select>
           </div>
        </div>
      </Section>

      <Section title="Comfort & Features" icon={CheckCircle2}>
         <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 cursor-pointer bg-gray-50 px-4 py-3 rounded-lg border border-gray-200 hover:border-brand-teal transition-colors">
              <input name="has_aircon" type="checkbox" className="w-4 h-4 text-brand-teal rounded" checked={form.has_aircon} onChange={handleCheckChange} />
              <span className="text-sm font-bold text-gray-700">Air conditioning</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer bg-gray-50 px-4 py-3 rounded-lg border border-gray-200 hover:border-brand-teal transition-colors">
              <input name="has_wifi" type="checkbox" className="w-4 h-4 text-brand-teal rounded" checked={form.has_wifi} onChange={handleCheckChange} />
              <span className="text-sm font-bold text-gray-700">Wi-Fi</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer bg-gray-50 px-4 py-3 rounded-lg border border-gray-200 hover:border-brand-teal transition-colors">
              <input name="has_tow_bar" type="checkbox" className="w-4 h-4 text-brand-teal rounded" checked={form.has_tow_bar} onChange={handleCheckChange} />
              <span className="text-sm font-bold text-gray-700">Tow bar</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer bg-gray-50 px-4 py-3 rounded-lg border border-gray-200 hover:border-brand-teal transition-colors">
              <input name="wheelchair_access" type="checkbox" className="w-4 h-4 text-brand-teal rounded" checked={form.wheelchair_access} onChange={handleCheckChange} />
              <span className="text-sm font-bold text-gray-700">Wheelchair access</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer bg-gray-50 px-4 py-3 rounded-lg border border-gray-200 hover:border-brand-teal transition-colors">
              <input name="has_child_seat" type="checkbox" className="w-4 h-4 text-brand-teal rounded" checked={form.has_child_seat} onChange={handleCheckChange} />
              <span className="text-sm font-bold text-gray-700">Child or baby seat</span>
            </label>
         </div>
      </Section>

      <Section title="Vehicle Photos" icon={ImageIcon}>
         <VehiclePhotos 
           photos={form.photos} 
           pendingFiles={pendingFiles} 
           onPhotosChange={(updated) => setForm(prev => ({ ...prev, photos: updated }))}
           onMainPhotoUrlChange={(url) => setForm(prev => ({ ...prev, main_photo_url: url }))}
           onPendingFilesChange={setPendingFiles}
           onDeleteExistingPhoto={mode === 'edit' && initialData?.id ? async (photoId) => {
             return await deleteVehiclePhoto(initialData.id, photoId);
           } : undefined}
         />
      </Section>

      <Section title="Interior & Luggage" icon={Users}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Seat Type <span className="text-red-500">*</span></label>
            <div className="flex gap-4">
              {['Leather', 'Cloth', 'Other'].map(type => (
                <label key={type} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="seat_type" className="text-brand-teal" value={type} checked={form.seat_type === type} onChange={handleTextChange} />
                  <span className="text-sm">{type}</span>
                </label>
              ))}
            </div>
            {form.seat_type === 'Other' && (
              <input name="seat_type_other" type="text" className="mt-3 w-full border border-gray-300 rounded-lg p-2.5 text-sm" placeholder="Describe seat material" value={form.seat_type_other} onChange={handleTextChange} required />
            )}
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Luggage Capacity</label>
            <input name="luggage_capacity" type="text" className="w-full border border-gray-300 rounded-lg p-2.5" placeholder="e.g. 2 large, 4 small bags" value={form.luggage_capacity} onChange={handleTextChange} />
          </div>
        </div>
      </Section>

      <Section title="Ownership & Status" icon={ShieldCheck}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           <div>
             <label className="block text-sm font-bold text-gray-700 mb-1">Ownership</label>
             <select name="ownership_type" className="w-full border border-gray-300 rounded-lg p-2.5 bg-white" value={form.ownership_type} onChange={handleTextChange as any}>
               <option value="Owned">Owned</option>
               <option value="Leased">Leased</option>
               <option value="Partner">Partner</option>
             </select>
           </div>
           <div>
             <label className="block text-sm font-bold text-gray-700 mb-1">Status</label>
             <select name="status" className="w-full border border-gray-300 rounded-lg p-2.5 bg-white" value={form.status} onChange={handleTextChange as any}>
               <option value="Active">Active</option>
               <option value="Inactive">Inactive</option>
               <option value="Maintenance">Maintenance</option>
             </select>
           </div>
           <div>
             <label className="block text-sm font-bold text-gray-700 mb-1">License Expiry</label>
             <input name="license_expiry" type="date" className="w-full border border-gray-300 rounded-lg p-2.5" value={form.license_expiry} onChange={handleTextChange} />
           </div>
        </div>
      </Section>

      <Section title="Vehicle Profile" icon={Info}>
         <label className="block text-sm font-bold text-gray-700 mb-1">Vehicle Description</label>
         <p className="text-[11px] text-gray-500 mb-3 leading-relaxed">
           Describe the vehicle’s condition, comfort, features, and anything operators should know before booking it. Do not include phone numbers, email addresses, websites, bank details, or direct payment instructions.
         </p>
         <textarea name="notes" className="w-full border border-gray-300 rounded-lg p-3 h-32 resize-none focus:ring-2 focus:ring-brand-teal focus:border-transparent" placeholder="Example: Clean 13-seater Toyota Quantum with air conditioning, comfortable seats, luggage space, and suitable for airport transfers or day tours." value={form.notes} onChange={handleTextChange} maxLength={1000} />
         <div className="text-right text-xs text-gray-400 mt-1">{form.notes.length}/1000</div>
      </Section>

      <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
        <button type="submit" disabled={loading} className="bg-brand-teal text-white px-8 py-3 rounded-2xl font-bold hover:bg-brand-teal/90 transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50">
          {loading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
          {loading ? 'Saving...' : (mode === 'create' ? 'Add Vehicle' : 'Save Changes')}
        </button>
      </div>
    </form>
  );
};
