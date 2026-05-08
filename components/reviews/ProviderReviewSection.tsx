
import React, { useEffect, useState } from 'react';
import { Star, MessageSquare, Calendar, Tag, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Review, RatingSummary, getProviderReviews, getProviderRatingSummary } from '../../lib/reviewService';
import { formatDate } from '../../lib/formatUtils';
import { supabase } from '../../lib/supabase';

interface ProviderReviewSectionProps {
  providerId: string;
}

export const ProviderReviewSection: React.FC<ProviderReviewSectionProps> = ({ providerId }) => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [summary, setSummary] = useState<RatingSummary>({ average_rating: 0, total_reviews: 0 });
  const [loading, setLoading] = useState(true);
  const [publicProfiles, setPublicProfiles] = useState<Record<string, any>>({});

  useEffect(() => {
    const loadReviews = async () => {
      try {
        const [reviewsData, summaryData] = await Promise.all([
          getProviderReviews(providerId),
          getProviderRatingSummary(providerId)
        ]);
        setReviews(reviewsData);
        setSummary(summaryData);

        const operatorIds = Array.from(new Set(reviewsData.map(r => r.operator_id))).filter(Boolean) as string[];
        if (operatorIds.length > 0) {
          const { data, error } = await supabase.rpc('get_public_profiles', { p_ids: operatorIds });
          if (!error && data) {
            setPublicProfiles(data.reduce((acc: any, p: any) => ({ ...acc, [p.id]: p }), {}));
          }
        }
      } catch (error) {
        console.error('Error loading reviews:', error);
      } finally {
        setLoading(false);
      }
    };

    if (providerId) {
      loadReviews();
    }
  }, [providerId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-teal"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Reviews List */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
          <h2 className="font-bold text-lg text-brand-charcoal">Reviews from Operators</h2>
          {summary.total_reviews > 0 && (
            <div className="flex items-center gap-1.5 bg-brand-teal/10 px-3 py-1 rounded-full text-brand-teal text-sm font-bold">
              <Star size={14} className="fill-brand-teal" />
              {summary.average_rating.toFixed(1)} <span className="text-brand-teal/60 font-normal">({summary.total_reviews})</span>
            </div>
          )}
        </div>

        {reviews.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <MessageSquare className="text-gray-300" size={24} />
            </div>
            <p className="text-gray-500">No reviews yet.</p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-gray-100">
              {reviews.slice(0, 3).map((review) => (
                <div key={review.id} className="p-6 hover:bg-gray-50/50 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star 
                            key={s} 
                            size={14} 
                            className={s <= review.rating ? "fill-amber-500 text-amber-500" : "text-gray-200"} 
                          />
                        ))}
                      </div>
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-widest border-l border-gray-200 pl-3">
                        {review.provider_type.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                      <span className="flex items-center gap-1">
                        <Calendar size={12} />
                        {formatDate(review.created_at)}
                      </span>
                      {review.bookings?.booking_reference && (
                        <span className="flex items-center gap-1 bg-gray-100 px-2 py-0.5 rounded font-mono">
                          REF: {review.bookings.booking_reference}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {review.review_text && (
                    <p className="text-brand-charcoal text-sm leading-relaxed italic border-l-4 border-amber-100 pl-4 py-1">
                      "{review.review_text}"
                    </p>
                  )}
                  
                  <div className="mt-4 flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-brand-teal/10 flex items-center justify-center text-[10px] font-bold text-brand-teal">
                      {review.operator?.full_name?.substring(0, 1) || 'O'}
                    </div>
                    <span className="text-xs font-bold text-gray-500">
                      {publicProfiles[review.operator_id || '']?.company_name ||
                       publicProfiles[review.operator_id || '']?.full_name ||
                       review.operator?.company_name ||
                       review.operator?.full_name ||
                       'Tour Operator'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            {reviews.length > 3 && (
              <div className="px-6 py-4 bg-gray-50/50 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                <p className="text-xs text-gray-500 italic font-medium">
                  Showing latest 3 of {reviews.length} reviews.
                </p>
                {providerId ? (
                  <Link 
                    to={`/reviews/provider/${providerId}`}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-full text-[10px] font-bold text-brand-teal hover:text-brand-teal/80 hover:border-brand-teal/20 transition-all uppercase tracking-widest"
                  >
                    View all reviews
                    <ArrowRight size={12} />
                  </Link>
                ) : (
                  <div className="px-4 py-1.5 bg-white border border-gray-200 rounded-full text-[10px] font-bold text-gray-400 uppercase tracking-widest cursor-not-allowed">
                    Full review history unavailable
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
