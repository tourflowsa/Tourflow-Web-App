
import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Star, MessageSquare, Calendar, ChevronLeft, AlertCircle } from 'lucide-react';
import { Review, RatingSummary, getProviderReviews, getProviderRatingSummary } from '../../lib/reviewService';
import { formatDate } from '../../lib/formatUtils';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

export const ProviderReviewsPage: React.FC = () => {
  const { id: providerId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [summary, setSummary] = useState<RatingSummary>({ average_rating: 0, total_reviews: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [publicProfiles, setPublicProfiles] = useState<Record<string, any>>({});

  useEffect(() => {
    const loadData = async () => {
      if (!providerId) return;
      
      try {
        setLoading(true);
        const [reviewsData, summaryData] = await Promise.all([
          getProviderReviews(providerId),
          getProviderRatingSummary(providerId)
        ]);
        
        setReviews(reviewsData);
        setSummary(summaryData);

        const operatorIds = Array.from(new Set(reviewsData.map(r => r.operator_id))).filter(Boolean) as string[];
        if (operatorIds.length > 0) {
          const { data, error: profileError } = await supabase.rpc('get_public_profiles', { p_ids: operatorIds });
          if (!profileError && data) {
            setPublicProfiles(data.reduce((acc: any, p: any) => ({ ...acc, [p.id]: p }), {}));
          }
        }
      } catch (err) {
        console.error('Error loading reviews:', err);
        setError('Failed to load review history. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [providerId]);

  const handleBack = () => {
    if (profile?.role === 'operator') {
      navigate(`/operator/providers/${providerId}`);
    } else if (profile?.role === 'admin') {
      navigate(`/admin/users/${providerId}`);
    } else {
      // Driver, Guide, Vehicle Owner go back to their dashboard
      navigate(`/${profile?.role || ''}`);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-teal"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="max-w-2xl mx-auto bg-red-50 border border-red-200 rounded-2xl p-8 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-red-800 mb-2">Error Loading Reviews</h2>
          <p className="text-red-600 mb-6">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <button 
          onClick={handleBack}
          className="inline-flex items-center gap-2 text-sm font-bold text-brand-teal hover:text-brand-teal/80 transition-colors mb-4"
        >
          <ChevronLeft size={16} />
          {profile?.role === 'operator' ? 'Back to Provider Profile' : 'Back to Dashboard'}
        </button>
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-brand-charcoal mb-2">Provider Reviews</h1>
            <p className="text-gray-500">Comprehensive review history from across the TourFlow platform.</p>
          </div>
          {summary.total_reviews > 0 && (
            <div className="bg-brand-teal/5 border border-brand-teal/10 rounded-2xl px-6 py-4 flex items-center gap-4">
              <div className="text-center">
                <div className="text-2xl font-black text-brand-teal">{summary.average_rating.toFixed(1)}</div>
                <div className="text-[10px] font-bold text-brand-teal/60 uppercase tracking-widest">Rating</div>
              </div>
              <div className="w-px h-8 bg-brand-teal/10" />
              <div className="text-center">
                <div className="text-2xl font-black text-brand-teal">{summary.total_reviews}</div>
                <div className="text-[10px] font-bold text-brand-teal/60 uppercase tracking-widest">Reviews</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Reviews List */}
      <div className="space-y-4">
        {reviews.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center shadow-sm">
            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <MessageSquare className="text-gray-300" size={32} />
            </div>
            <h3 className="text-lg font-bold text-brand-charcoal mb-2">No reviews yet</h3>
            <p className="text-gray-500">This provider has not received any reviews from operators yet.</p>
          </div>
        ) : (
          reviews.map((review) => (
            <div key={review.id} className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-4">
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star 
                        key={s} 
                        size={18} 
                        className={s <= review.rating ? "fill-amber-500 text-amber-500" : "text-gray-200"} 
                      />
                    ))}
                  </div>
                  <span className="px-3 py-1 bg-gray-100 rounded-full text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                    {review.provider_type.replace('_', ' ')}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs font-bold text-gray-400 uppercase tracking-wider">
                  <span className="flex items-center gap-1.5 font-mono bg-gray-50 px-2 py-1 rounded">
                    REF: {review.bookings?.booking_reference || 'N/A'}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Calendar size={14} />
                    {formatDate(review.created_at)}
                  </span>
                </div>
              </div>

              <div className="mb-6 relative">
                {review.review_text ? (
                  <p className="text-brand-charcoal text-base leading-relaxed italic border-l-4 border-amber-100 pl-6 py-2">
                    "{review.review_text}"
                  </p>
                ) : (
                  <p className="text-gray-400 text-sm italic py-2">No comment provided.</p>
                )}
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-brand-teal/10 flex items-center justify-center text-xs font-bold text-brand-teal border border-brand-teal/20">
                    {review.operator?.full_name?.substring(0, 1) || 'O'}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-brand-charcoal">
                      {publicProfiles[review.operator_id || '']?.company_name ||
                       review.operator?.company_name ||
                       publicProfiles[review.operator_id || '']?.full_name ||
                       review.operator?.full_name ||
                       'Tour Operator'}
                    </span>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">Verified Operator</span>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
