
import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Tour } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { Link } from 'react-router-dom';
import { Plus, Search, MapPin, Edit2, Eye, MoreHorizontal, AlertCircle } from 'lucide-react';
import { TourDuration } from '../../components/tours/TourDuration';

export const ToursList: React.FC = () => {
  const { user, profile } = useAuth();
  const [tours, setTours] = useState<Tour[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchTours();
  }, [user, profile]);

  const fetchTours = async () => {
    if (!user || !profile) return;
    setLoading(true);
    setError(null);
    
    let query = supabase
      .from('tours')
      .select('*')
      .eq('is_active', true);
      
    // Admins see all active tours, operators only see their own
    if (profile.role !== 'admin') {
      query = query.eq('operator_id', user.id);
    }

    const { data, error: fetchError } = await query.order('created_at', { ascending: false });
    
    if (fetchError) {
      console.error('Error fetching tours:', fetchError);
      setError('Failed to load tour inventory.');
    } else {
      setTours(data as Tour[]);
    }
    setLoading(false);
  };

  const filteredTours = tours.filter(t => filter === 'all' || t.status === filter);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'published': return <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-bold uppercase">Published</span>;
      case 'draft': return <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs font-bold uppercase">Draft</span>;
      case 'archived': return <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-bold uppercase">Archived</span>;
      default: return null;
    }
  };

  const isOperator = profile?.role === 'operator';

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-brand-charcoal">{profile?.role === 'admin' ? 'Global Tour Inventory' : 'Tour Inventory'}</h1>
          <p className="text-gray-500">{profile?.role === 'admin' ? 'Overview of all active platform packages' : 'Manage your packages and listings'}</p>
        </div>
        {isOperator && (
          <Link 
            to="/operator/tours/new"
            className="bg-brand-teal text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-brand-teal/90 transition-colors"
          >
            <Plus size={18} /> Create Tour
          </Link>
        )}
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Filters */}
        <div className="p-4 border-b border-gray-100 flex items-center gap-4 overflow-x-auto">
          {['all', 'published', 'draft'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm font-bold capitalize whitespace-nowrap transition-colors ${
                filter === f ? 'bg-brand-charcoal text-white' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <div className="p-12 text-center text-gray-400">Loading tours...</div>
        ) : filteredTours.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
              <MapPin size={32} />
            </div>
            <h3 className="text-lg font-bold text-gray-900">No tours found</h3>
            <p className="text-gray-500">
              {profile?.role === 'admin' ? 'No tours have been published on the platform yet.' : 'Get started by creating your first tour package.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredTours.map((tour) => (
              <div key={tour.id} className="p-6 hover:bg-gray-50 transition-colors flex flex-col md:flex-row gap-6">
                {/* Image Thumbnail */}
                <div className="w-full md:w-48 h-32 bg-gray-200 rounded-lg overflow-hidden shrink-0">
                  {tour.gallery_urls && tour.gallery_urls.length > 0 ? (
                    <img src={tour.gallery_urls[0]} alt={tour.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400 bg-gray-100">
                      <MapPin size={24} />
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-xl font-bold text-brand-charcoal">{tour.title}</h3>
                    {getStatusBadge(tour.status)}
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 mb-4">
                    {tour.region && (
                      <span className="flex items-center gap-1">
                        <MapPin size={14} /> {tour.region}
                      </span>
                    )}
                    <TourDuration days={tour.duration_days} hours={tour.duration_hours} />
                  </div>

                  <div className="flex items-center justify-between mt-auto pt-2">
                     <div className="font-mono font-bold text-brand-charcoal">
                       {tour.currency} {tour.price_amount.toLocaleString()}
                       <span className="text-xs font-normal text-gray-400 ml-1">
                         {tour.is_price_including_vat ? '(Inc. VAT)' : '(Ex. VAT)'}
                       </span>
                     </div>
                     
                     <div className="flex items-center gap-2">
                       <Link 
                         to={`/operator/tours/${tour.id}`}
                         className="p-2 text-gray-500 hover:text-brand-teal hover:bg-brand-teal/5 rounded transition-colors"
                         title="View Details"
                       >
                         <Eye size={18} />
                       </Link>
                       {isOperator && (
                         <Link 
                           to={`/operator/tours/${tour.id}/edit`}
                           className="p-2 text-gray-500 hover:text-brand-teal hover:bg-brand-teal/5 rounded transition-colors"
                           title="Edit Tour"
                         >
                           <Edit2 size={18} />
                         </Link>
                       )}
                     </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
