
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { ImageGalleryUploader } from '../../components/tours/ImageGalleryUploader';
import { TourStatus } from '../../types';
import { Save, ArrowLeft, Loader2, Info, AlertCircle } from 'lucide-react';
import { logAuditEvent } from '../../lib/auditService';

export const TourForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isEditMode = !!id;
  
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(isEditMode);
  const [error, setError] = useState<string | null>(null);
  
  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [region, setRegion] = useState('');
  const [tags, setTags] = useState<string>(''); // Managed as comma-separated string for input
  const [durationDays, setDurationDays] = useState(0);
  const [durationHours, setDurationHours] = useState(0);
  const [maxGuests, setMaxGuests] = useState(1);
  const [priceAmount, setPriceAmount] = useState(0);
  const [currency, setCurrency] = useState('ZAR');
  const [vatRate, setVatRate] = useState(15);
  const [incVat, setIncVat] = useState(false);
  const [status, setStatus] = useState<TourStatus>('draft');
  const [galleryUrls, setGalleryUrls] = useState<string[]>([]);
  const [tempId] = useState(crypto.randomUUID()); // For new tours storage path

  useEffect(() => {
    if (isEditMode && id) {
      fetchTour(id);
    }
  }, [id]);

  const fetchTour = async (tourId: string) => {
    const { data, error } = await supabase.from('tours').select('*').eq('id', tourId).single();
    if (error) {
      console.error(error);
      setError("Failed to fetch tour details.");
      setFetching(false);
      return;
    }
    
    if (data) {
      setTitle(data.title);
      setDescription(data.description || '');
      setRegion(data.region || '');
      setTags(data.tags ? data.tags.join(', ') : '');
      setDurationDays(data.duration_days || 0);
      setDurationHours(data.duration_hours || 0);
      setMaxGuests(data.max_guests);
      setPriceAmount(data.price_amount);
      setCurrency(data.currency);
      setVatRate(data.vat_rate);
      setIncVat(data.is_price_including_vat);
      setStatus(data.status);
      setGalleryUrls(data.gallery_urls || []);
    }
    setFetching(false);
  };

  const handleSubmit = async (e: React.FormEvent, targetStatus?: TourStatus) => {
    e.preventDefault();
    if (!user) return;

    // Validation
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    if (!description.trim()) {
      setError("Description is required");
      return;
    }
    if (priceAmount <= 0) {
      setError("Price must be greater than 0");
      return;
    }
    if (durationDays === 0 && durationHours === 0) {
      setError("Please specify a duration (Days or Hours)");
      return;
    }

    setLoading(true);
    setError(null);

    const finalStatus = targetStatus || status;

    const payload = {
      operator_id: user.id,
      title,
      description,
      region: region || null,
      tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      duration_days: durationDays || 0,
      duration_hours: durationHours || 0,
      max_guests: maxGuests,
      price_amount: priceAmount,
      currency,
      vat_rate: vatRate,
      is_price_including_vat: incVat,
      status: finalStatus,
      gallery_urls: galleryUrls || [],
      is_active: true
    };

    try {
      const query = isEditMode && id
        ? supabase.from('tours').update(payload).eq('id', id)
        : supabase.from('tours').insert(payload);
        
      const { data, error: apiError } = await query.select().single();

      if (apiError) throw apiError;

      // Logic to determine Audit Action
      let auditAction = '';
      if (finalStatus === 'published') {
        auditAction = 'TOUR_PUBLISHED';
      } else {
        auditAction = 'TOUR_DRAFT_SAVED';
      }

      await logAuditEvent({
        action: auditAction,
        entityType: 'Tour',
        entityId: data.id,
        metadata: { 
          status: finalStatus,
          title: data.title,
          region: data.region,
          price: data.price_amount
        }
      });

      navigate('/operator/tours');
    } catch (err: any) {
      console.error("Tour Save Error:", err);
      setError('There was an issue saving the tour. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (fetching) return <div className="p-12 text-center text-gray-500">Loading tour data...</div>;

  return (
    <div className="max-w-4xl mx-auto pb-12">
      <div className="flex items-center justify-between mb-8">
        <button onClick={() => navigate('/operator/tours')} className="flex items-center gap-2 text-gray-500 hover:text-brand-charcoal">
          <ArrowLeft size={16} /> Back to Tours
        </button>
        <div className="flex items-center gap-3">
           <button 
             type="button"
             onClick={(e) => handleSubmit(e, 'draft')}
             disabled={loading}
             className="px-4 py-2 border border-gray-300 rounded-2xl font-bold text-gray-600 hover:bg-gray-50"
           >
             Save as Draft
           </button>
           <button 
             type="button"
             onClick={(e) => handleSubmit(e, 'published')}
             disabled={loading}
             className="px-4 py-2 bg-brand-teal text-white rounded-2xl font-bold hover:bg-brand-teal/90 flex items-center gap-2"
           >
             {loading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
             {isEditMode ? 'Update Tour' : 'Publish Tour'}
           </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-2 text-red-700">
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-100 bg-gray-50">
          <h1 className="text-xl font-bold text-brand-charcoal">{isEditMode ? 'Edit Tour Package' : 'Create New Tour'}</h1>
        </div>
        
        <form className="p-6 space-y-8">
          {/* General Section */}
          <section className="space-y-4">
            <h3 className="font-bold text-gray-900 border-b pb-2">General Information</h3>
            
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Tour Title <span className="text-red-500">*</span></label>
              <input type="text" className="w-full border rounded-lg p-2" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g., Cape Peninsula Full Day Tour" />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Description <span className="text-red-500">*</span></label>
              <textarea className="w-full border rounded-lg p-2 h-32" value={description} onChange={e => setDescription(e.target.value)} placeholder="Detailed itinerary and highlights..." />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Region</label>
                <input type="text" className="w-full border rounded-lg p-2" value={region} onChange={e => setRegion(e.target.value)} placeholder="e.g., Western Cape" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Tags (comma separated)</label>
                <input type="text" className="w-full border rounded-lg p-2" value={tags} onChange={e => setTags(e.target.value)} placeholder="e.g., Wine, History, Outdoor" />
              </div>
            </div>
          </section>

          {/* Logistics Section */}
          <section className="space-y-4">
            <h3 className="font-bold text-gray-900 border-b pb-2">Logistics</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
               <div>
                 <label className="block text-sm font-bold text-gray-700 mb-1">Duration Days</label>
                 <input type="number" min="0" className="w-full border rounded-lg p-2" value={durationDays} onChange={e => setDurationDays(Number(e.target.value))} />
               </div>
               <div>
                 <label className="block text-sm font-bold text-gray-700 mb-1">Duration Hours</label>
                 <input type="number" min="0" step="0.5" className="w-full border rounded-lg p-2" value={durationHours} onChange={e => setDurationHours(Number(e.target.value))} />
               </div>
               <div>
                 <label className="block text-sm font-bold text-gray-700 mb-1">Max Guests</label>
                 <input type="number" min="1" className="w-full border rounded-lg p-2" value={maxGuests} onChange={e => setMaxGuests(Number(e.target.value))} />
               </div>
            </div>
            <div className="text-sm text-gray-500 bg-gray-50 p-2 rounded flex items-center gap-2">
              <Info size={14} /> Total Duration Preview: 
              <span className="font-bold text-brand-charcoal">
                {durationDays > 0 ? `${durationDays} Days ` : ''}
                {durationHours > 0 ? `${durationHours} Hours` : ''}
                {(durationDays === 0 && durationHours === 0) ? '0 Hours' : ''}
              </span>
            </div>
          </section>

          {/* Pricing Section */}
          <section className="space-y-4">
            <h3 className="font-bold text-gray-900 border-b pb-2">Pricing</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
               <div>
                 <label className="block text-sm font-bold text-gray-700 mb-1">Amount <span className="text-red-500">*</span></label>
                 <div className="relative">
                   <span className="absolute left-3 top-2 text-gray-500">{currency}</span>
                   <input type="number" min="0" className="w-full border rounded-lg p-2 pl-12" value={priceAmount} onChange={e => setPriceAmount(Number(e.target.value))} />
                 </div>
               </div>
               <div>
                 <label className="block text-sm font-bold text-gray-700 mb-1">VAT Rate (%)</label>
                 <input type="number" min="0" className="w-full border rounded-lg p-2" value={vatRate} onChange={e => setVatRate(Number(e.target.value))} />
               </div>
               <div className="flex items-center h-full pt-6">
                 <label className="flex items-center gap-2 cursor-pointer">
                   <input type="checkbox" className="w-5 h-5 text-brand-teal rounded" checked={incVat} onChange={e => setIncVat(e.target.checked)} />
                   <span className="font-bold text-sm text-gray-700">Price includes VAT?</span>
                 </label>
               </div>
            </div>
          </section>

          {/* Media Section */}
          <section className="space-y-4">
            <h3 className="font-bold text-gray-900 border-b pb-2">Gallery</h3>
            <ImageGalleryUploader 
              images={galleryUrls} 
              onImagesChange={setGalleryUrls} 
              folderPath={`tours/${isEditMode ? id : `new_${tempId}`}`} 
            />
          </section>

        </form>
      </div>
    </div>
  );
};
