
import React, { useState } from 'react';
import { Star, X, Loader2, Send } from 'lucide-react';
import { createReview } from '../../lib/reviewService';

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookingId: string;
  operatorId: string;
  providerId: string;
  providerName: string;
  providerRole: 'driver' | 'guide' | 'vehicle_owner';
  onSuccess: () => void;
}

export const ReviewModal: React.FC<ReviewModalProps> = ({
  isOpen,
  onClose,
  bookingId,
  operatorId,
  providerId,
  providerName,
  providerRole,
  onSuccess
}) => {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) {
      setError('Please select a rating');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await createReview({
        booking_id: bookingId,
        operator_id: operatorId,
        provider_id: providerId,
        provider_type: providerRole,
        rating,
        review_text: comment.trim()
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h3 className="font-bold text-brand-charcoal">
            Review {providerRole === 'driver' ? 'Driver' : providerRole === 'guide' ? 'Guide' : 'Vehicle Owner'}: {providerName}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="text-center">
            <p className="text-sm text-gray-500 mb-4">How was your experience with this {providerRole === 'driver' ? 'driver' : providerRole === 'guide' ? 'guide' : 'vehicle owner'}?</p>
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHover(star)}
                  onMouseLeave={() => setHover(0)}
                  className="transition-transform hover:scale-110 active:scale-95"
                >
                  <Star
                    size={32}
                    className={`${
                      (hover || rating) >= star
                        ? 'fill-amber-400 text-amber-400'
                        : 'text-gray-200'
                    } transition-colors`}
                  />
                </button>
              ))}
            </div>
            {error && rating === 0 && <p className="text-red-500 text-xs mt-2 font-bold">{error}</p>}
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Your Review</label>
            <textarea
              className="w-full border border-gray-200 rounded-xl p-4 text-sm focus:ring-2 focus:ring-brand-teal focus:border-brand-teal outline-none transition-all h-32 resize-none"
              placeholder="Share your feedback about the provider's professionalism, punctuality, and service quality..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </div>

          {error && rating > 0 && (
            <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-xs font-bold text-center">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl font-bold text-sm bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || rating === 0}
              className="flex-1 py-3 rounded-xl font-bold text-sm bg-brand-teal text-white hover:bg-brand-teal/90 disabled:opacity-50 flex items-center justify-center gap-2 transition-all shadow-md shadow-brand-teal/20"
            >
              {submitting ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              Submit Review
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
