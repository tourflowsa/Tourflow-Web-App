
import React, { useEffect, useState } from 'react';
import { 
  Star, 
  Search, 
  Filter, 
  Calendar, 
  ArrowRight, 
  MessageSquare,
  User,
  Users,
  Clock,
  ExternalLink,
  EyeOff,
  Eye,
  ShieldAlert,
  AlertCircle
} from 'lucide-react';
import { Review, getAllReviews, ReviewFilters, moderateReview } from '../../lib/reviewService';
import { formatDate } from '../../lib/formatUtils';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export const AdminReviewsPage: React.FC = () => {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<(Review & { provider?: { full_name: string; company_name: string } })[]>([]);
  const [loading, setLoading] = useState(true);
  const [modifyingId, setModifyingId] = useState<string | null>(null);
  const [hiddenReason, setHiddenReason] = useState('');
  const [isModifying, setIsModifying] = useState(false);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [filters, setFilters] = useState<ReviewFilters>({
    provider_type: 'all',
    rating: undefined,
    search: ''
  });

  const fetchReviews = async () => {
    setLoading(true);
    try {
      const data = await getAllReviews(filters);
      setReviews(data);
    } catch (error) {
      console.error('Error fetching admin reviews:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, [filters.provider_type, filters.rating, filters.startDate, filters.endDate]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchReviews();
  };

  const handleModerate = async (reviewId: string, isHidden: boolean) => {
    if (!user) return;
    setErrorNotice(null);

    if (isHidden && !hiddenReason.trim()) {
      return;
    }

    setIsModifying(true);
    try {
      await moderateReview(reviewId, isHidden, hiddenReason, user.id);
      setModifyingId(null);
      setHiddenReason('');
      await fetchReviews();
    } catch (error: any) {
      console.error('Moderation error:', error);
      setErrorNotice(error.message || 'Error moderating review');
      // Auto-clear error after 5 seconds
      setTimeout(() => setErrorNotice(null), 5000);
    } finally {
      setIsModifying(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-brand-charcoal">Provider Reviews</h1>
          <p className="text-gray-500">Monitor platform quality and provider performance.</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
        {errorNotice && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-700 text-sm animate-in fade-in slide-in-from-top-2 duration-300">
            <AlertCircle size={18} />
            <p className="font-medium">{errorNotice}</p>
          </div>
        )}
        <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                type="text"
                placeholder="Reference or text..."
                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-teal focus:border-brand-teal outline-none transition-all"
                value={filters.search}
                onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Provider Type</label>
            <select 
              className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-teal outline-none appearance-none"
              value={filters.provider_type}
              onChange={(e) => setFilters(f => ({ ...f, provider_type: e.target.value }))}
            >
              <option value="all">All Types</option>
              <option value="driver">Drivers</option>
              <option value="guide">Guides</option>
              <option value="vehicle_owner">Vehicle Owners</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Min Rating</label>
            <select 
              className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-teal outline-none appearance-none"
              value={filters.rating || ''}
              onChange={(e) => setFilters(f => ({ ...f, rating: e.target.value ? Number(e.target.value) : undefined }))}
            >
              <option value="">Any Rating</option>
              <option value="5">5 Stars</option>
              <option value="4">4+ Stars</option>
              <option value="3">3+ Stars</option>
              <option value="2">2+ Stars</option>
              <option value="1">1+ Stars</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Date From</label>
            <input 
              type="date"
              className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-teal outline-none"
              value={filters.startDate || ''}
              onChange={(e) => setFilters(f => ({ ...f, startDate: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Date To</label>
            <input 
              type="date"
              className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-teal outline-none"
              value={filters.endDate || ''}
              onChange={(e) => setFilters(f => ({ ...f, endDate: e.target.value }))}
            />
          </div>

          <div className="flex items-end">
            <button 
              type="submit"
              className="w-full bg-brand-charcoal text-white font-bold py-2 rounded-xl hover:bg-opacity-90 transition-all flex items-center justify-center gap-2"
            >
              <Search size={18} /> Apply Filters
            </button>
          </div>
        </form>
      </div>

      {/* Reviews Table/Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-teal"></div>
        </div>
      ) : reviews.length === 0 ? (
        <div className="bg-white py-16 rounded-2xl border border-gray-200 shadow-sm text-center">
          <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-300">
            <MessageSquare size={32} />
          </div>
          <p className="text-gray-500 font-medium">No reviews found matching your criteria.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100">
                  <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Submitted</th>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Provider</th>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Operator</th>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Rating</th>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Review</th>
                  <th className="px-6 py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {reviews.map((review) => (
                  <React.Fragment key={review.id}>
                    <tr className={`hover:bg-gray-50/50 transition-colors ${review.is_hidden ? 'bg-red-50/30' : ''}`}>
                      <td className="px-6 py-6 whitespace-nowrap">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-brand-charcoal">{formatDate(review.created_at)}</span>
                            {review.is_hidden && (
                              <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 text-[10px] font-black uppercase px-2 py-0.5 rounded tracking-widest">
                                <EyeOff size={10} /> Hidden
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">
                            REF: {review.bookings?.booking_reference || 'N/A'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-6">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-brand-teal/10 flex items-center justify-center text-[10px] font-bold text-brand-teal">
                            <Users size={14} />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-brand-charcoal">
                              {review.provider?.company_name || review.provider?.full_name || 'Unknown'}
                            </span>
                            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                              {review.provider_type.replace('_', ' ')}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-6">
                        <div className="flex items-center gap-2">
                          <User size={14} className="text-gray-400" />
                          <span className="text-sm font-medium text-gray-600">
                            {review.operator?.company_name || review.operator?.full_name || 'Tour Operator'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-6">
                        <div className="flex gap-0.5">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star 
                              key={s} 
                              size={14} 
                              className={s <= review.rating ? "fill-amber-500 text-amber-500" : "text-gray-200"} 
                            />
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-6 max-w-md">
                        <p className="text-sm text-gray-600 line-clamp-2 italic">
                          "{review.review_text || 'No comment provided.'}"
                        </p>
                      </td>
                      <td className="px-6 py-6 text-right">
                        <div className="flex flex-col items-end gap-2">
                          <Link 
                            to={`/admin/bookings/${review.booking_id}`}
                            className="inline-flex items-center gap-1.5 text-[10px] font-bold text-brand-teal hover:text-brand-charcoal transition-colors uppercase tracking-widest border border-brand-teal/20 px-3 py-1.5 rounded-lg whitespace-nowrap"
                          >
                            View Booking <ArrowRight size={12} />
                          </Link>
                          
                          {review.is_hidden ? (
                            <button
                              onClick={() => handleModerate(review.id, false)}
                              disabled={isModifying}
                              className="inline-flex items-center gap-1.5 text-[10px] font-bold text-green-600 hover:text-green-700 transition-colors uppercase tracking-widest border border-green-200 bg-green-50 px-3 py-1.5 rounded-lg whitespace-nowrap"
                            >
                              <Eye size={12} /> Unhide Review
                            </button>
                          ) : (
                            <button
                              onClick={() => setModifyingId(review.id)}
                              disabled={isModifying}
                              className="inline-flex items-center gap-1.5 text-[10px] font-bold text-red-600 hover:text-red-700 transition-colors uppercase tracking-widest border border-red-200 bg-red-50 px-3 py-1.5 rounded-lg whitespace-nowrap"
                            >
                              <EyeOff size={12} /> Hide Review
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    
                    {modifyingId === review.id && (
                      <tr className="bg-red-50/50">
                        <td colSpan={6} className="px-6 py-4">
                          <div className="flex flex-col sm:flex-row items-center gap-4">
                            <div className="flex-1 w-full">
                              <label className="block text-[10px] font-bold text-red-600 uppercase tracking-widest mb-1 ml-1">Reason for hiding</label>
                              <input 
                                type="text" 
                                placeholder="e.g. Inappropriate language, false information..."
                                className="w-full px-4 py-2 bg-white border border-red-200 rounded-xl text-sm focus:ring-2 focus:ring-red-500 outline-none"
                                value={hiddenReason}
                                onChange={(e) => setHiddenReason(e.target.value)}
                                autoFocus
                              />
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleModerate(review.id, true)}
                                disabled={isModifying || !hiddenReason.trim()}
                                className="px-6 py-2 bg-red-600 text-white text-xs font-black uppercase tracking-widest rounded-xl hover:bg-red-700 disabled:opacity-50 transition-all"
                              >
                                Confirm Hide
                              </button>
                              <button
                                onClick={() => {
                                  setModifyingId(null);
                                  setHiddenReason('');
                                }}
                                disabled={isModifying}
                                className="px-6 py-2 bg-white border border-gray-200 text-gray-500 text-xs font-black uppercase tracking-widest rounded-xl hover:bg-gray-50 transition-all"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                    
                    {review.is_hidden && review.hidden_reason && (
                      <tr className="bg-red-50/20">
                        <td colSpan={6} className="px-6 py-2">
                          <div className="flex items-center gap-2 text-[10px] font-bold text-red-500 uppercase tracking-widest ml-6">
                            <ShieldAlert size={12} />
                            Reason: <span className="text-gray-600 normal-case font-medium italic">{review.hidden_reason}</span>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
