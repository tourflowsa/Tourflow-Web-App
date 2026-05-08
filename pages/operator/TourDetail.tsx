
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Tour } from '../../types';
import { TourDuration } from '../../components/tours/TourDuration';
import { ArrowLeft, Edit2, Copy, Trash2, MapPin, Users, Calendar, AlertCircle, CheckCircle2, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { logAuditEvent } from '../../lib/auditService';

export const TourDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [tour, setTour] = useState<Tour | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetchTour();
  }, [id]);

  const fetchTour = async () => {
    if (!id) return;
    const { data } = await supabase.from('tours').select('*').eq('id', id).single();
    if (data) setTour(data as Tour);
    setLoading(false);
  };

  const handleDuplicate = async () => {
    if (!tour || !user) return;
    if (!confirm('Create a copy of this tour?')) return;

    const { id: _, created_at, updated_at, ...tourData } = tour;
    const payload = {
      ...tourData,
      title: `${tourData.title} (Copy)`,
      status: 'draft',
      operator_id: user.id
    };

    const { data, error } = await supabase.from('tours').insert(payload).select().single();
    if (data) {
      await logAuditEvent({
        action: 'tour.duplicated',
        entityType: 'tour',
        entityId: data.id,
        metadata: { originalId: tour.id, newTitle: data.title }
      });
      navigate(`/operator/tours/${data.id}/edit`);
    } else if (error) {
      setError('Failed to duplicate: ' + error.message);
    }
  };

  const handleArchive = async () => {
    if (!tour) return;
    if (!confirm('Are you sure you want to archive this tour? It will be hidden from the marketplace.')) return;
    
    await supabase.from('tours').update({ is_active: false, status: 'archived' }).eq('id', tour.id);
    
    await logAuditEvent({
      action: 'tour.archived',
      entityType: 'tour',
      entityId: tour.id,
      metadata: { title: tour.title }
    });

    navigate('/operator/tours');
  };

  if (loading) return <div className="p-12 text-center">Loading...</div>;
  if (!tour) return <div className="p-12 text-center">Tour not found</div>;

  const isOperator = profile?.role === 'operator';

  return (
    <div className="max-w-5xl mx-auto">
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-2 text-red-700 animate-in fade-in">
          <AlertCircle size={20} />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600"><X size={16} /></button>
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-2xl flex items-center gap-2 text-green-700 animate-in fade-in">
          <CheckCircle2 size={20} />
          <span>{success}</span>
          <button onClick={() => setSuccess(null)} className="ml-auto text-green-400 hover:text-green-600"><X size={16} /></button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <button 
          onClick={() => {
            if (window.history.length > 1) {
              navigate(-1);
            } else {
              navigate('/operator/tours');
            }
          }} 
          className="flex items-center gap-2 text-gray-500 hover:text-brand-charcoal self-start font-bold text-sm transition-colors"
        >
          <ArrowLeft size={16} /> Back
        </button>
        
        {isOperator && (
          <div className="flex flex-wrap items-center gap-3">
             <button onClick={handleDuplicate} className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors shadow-sm">
               <Copy size={16} /> Duplicate
             </button>
             <button onClick={handleArchive} className="px-4 py-2 bg-white border border-red-200 text-red-600 rounded-xl text-sm font-bold hover:bg-red-50 flex items-center gap-2 transition-colors shadow-sm">
               <Trash2 size={16} /> Archive
             </button>
             <Link to={`/operator/tours/${tour.id}/edit`} className="px-4 py-2 bg-brand-teal text-white rounded-xl text-sm font-bold hover:bg-brand-teal/90 flex items-center gap-2 transition-colors shadow-sm">
               <Edit2 size={16} /> Edit Tour
             </Link>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-8">
           <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
             {/* Cover Image */}
             <div className="h-72 bg-gray-100 w-full relative">
               {tour.gallery_urls && tour.gallery_urls.length > 0 ? (
                 <img src={tour.gallery_urls[0]} className="w-full h-full object-cover" alt={tour.title} />
               ) : (
                 <div className="w-full h-full flex items-center justify-center text-gray-400 font-medium">No Cover Image</div>
               )}
               <div className="absolute top-4 right-4">
                 <span className={`px-4 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider shadow-sm backdrop-blur-sm ${
                   tour.status === 'published' ? 'bg-green-100/90 text-green-800' : 'bg-gray-100/90 text-gray-800'
                 }`}>
                   {tour.status}
                 </span>
               </div>
             </div>

             <div className="p-8">
               <h1 className="text-4xl font-bold text-brand-charcoal mb-6">{tour.title}</h1>
               
               <div className="flex flex-wrap gap-6 mb-8 text-gray-600 bg-gray-50 p-4 rounded-xl border border-gray-100">
                 <div className="flex items-center gap-2">
                   <div className="p-2 bg-brand-teal/10 rounded-lg text-brand-teal">
                     <MapPin size={20} />
                   </div>
                   <span className="font-medium">{tour.region || 'No Region'}</span>
                 </div>
                 <div className="flex items-center gap-2">
                   <div className="p-2 bg-brand-charcoal/10 rounded-lg text-brand-charcoal">
                     <Calendar size={20} />
                   </div>
                   <TourDuration days={tour.duration_days} hours={tour.duration_hours} className="font-medium" />
                 </div>
                 <div className="flex items-center gap-2">
                   <div className="p-2 bg-brand-coral/10 rounded-lg text-brand-coral">
                     <Users size={20} />
                   </div>
                   <span className="font-medium">Max {tour.max_guests} Guests</span>
                 </div>
               </div>

               <div className="prose max-w-none text-gray-600">
                 <h3 className="text-lg font-bold text-brand-charcoal mb-3">Description</h3>
                 <p className="whitespace-pre-wrap leading-relaxed">{tour.description}</p>
               </div>

               {tour.tags && tour.tags.length > 0 && (
                 <div className="mt-8 pt-6 border-t border-gray-100">
                   <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Tags</h4>
                   <div className="flex flex-wrap gap-2">
                     {tour.tags.map(t => (
                       <span key={t} className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium">{t}</span>
                     ))}
                   </div>
                 </div>
               )}
             </div>
           </div>

           {/* Gallery Grid */}
           {tour.gallery_urls && tour.gallery_urls.length > 1 && (
             <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
               <h3 className="font-bold text-brand-charcoal text-lg mb-6">Gallery</h3>
               <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                 {tour.gallery_urls.slice(1).map((url, idx) => (
                   <img key={idx} src={url} className="w-full aspect-square object-cover rounded-xl border border-gray-100 hover:opacity-90 transition-opacity cursor-pointer" alt={`Gallery ${idx}`} />
                 ))}
               </div>
             </div>
           )}
        </div>

        {/* Sidebar Info */}
        <div className="space-y-6">
           <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
             <h3 className="font-bold text-gray-400 text-xs uppercase tracking-wider mb-4">Pricing Details</h3>
             <div className="text-4xl font-bold text-brand-teal mb-2">
               {tour.currency} {tour.price_amount.toLocaleString()}
             </div>
             <p className="text-sm text-gray-500 mb-6 font-medium">
               {tour.is_price_including_vat ? 'Includes VAT' : 'Excludes VAT'} ({tour.vat_rate}%)
             </p>
             <div className="pt-6 border-t border-gray-100 text-xs text-gray-400 flex flex-col gap-3">
               <span className="flex items-center gap-2"><Calendar size={14}/> Created: {new Date(tour.created_at).toLocaleDateString()}</span>
               <span className="flex items-center gap-2"><Edit2 size={14}/> Updated: {new Date(tour.updated_at).toLocaleDateString()}</span>
             </div>
           </div>
        </div>

      </div>
    </div>
  );
};
