
import { supabase } from './supabase';
import { createNotification } from './notificationService';

export interface Review {
  id: string;
  booking_id: string;
  operator_id: string;
  provider_id: string;
  provider_type: 'driver' | 'guide' | 'vehicle_owner';
  rating: number;
  review_text: string;
  is_hidden: boolean;
  hidden_reason: string | null;
  hidden_at: string | null;
  hidden_by: string | null;
  created_at: string;
  updated_at: string;
  operator?: {
    full_name: string;
    company_name: string;
    avatar_url: string;
  };
  bookings?: {
    booking_reference: string;
  };
}

export interface RatingSummary {
  average_rating: number;
  total_reviews: number;
}

export const createReview = async (review: Omit<Review, 'id' | 'created_at' | 'updated_at' | 'operator' | 'bookings' | 'is_hidden' | 'hidden_reason' | 'hidden_at' | 'hidden_by'>) => {
  const { data, error } = await supabase
    .from('reviews')
    .insert([review])
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new Error('You have already reviewed this provider for this booking.');
    }
    console.error('Error creating review:', error);
    throw error;
  }

  // Notify Provider
  try {
    const { data: booking } = await supabase
      .from('bookings')
      .select('booking_reference')
      .eq('id', review.booking_id)
      .single();

    await createNotification({
      user_id: review.provider_id,
      type: 'NEW_REVIEW',
      title: 'New Review Received',
      message: `An operator has left a review for booking ${booking?.booking_reference || 'N/A'}. Rating: ${review.rating}/5`,
      link: '/dashboard' // or provider profile
    });
  } catch (notifyErr) {
    console.error('Failed to notify provider about new review:', notifyErr);
  }

  return data as Review;
};

export const getProviderReviews = async (providerId: string): Promise<Review[]> => {
  const { data, error } = await supabase
    .from('reviews')
    .select(`
      *,
      operator:profiles!operator_id(full_name, company_name, avatar_url),
      bookings!booking_id(booking_reference)
    `)
    .eq('provider_id', providerId)
    .eq('is_hidden', false)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching provider reviews:', error);
    throw error;
  }
  return data as unknown as Review[];
};

export const getProviderRatingSummary = async (providerId: string): Promise<RatingSummary> => {
  const { data, error } = await supabase
    .from('reviews')
    .select('rating')
    .eq('provider_id', providerId)
    .eq('is_hidden', false);

  if (error) {
    console.error('Error fetching rating summary:', error);
    return { average_rating: 0, total_reviews: 0 };
  }

  if (!data || data.length === 0) return { average_rating: 0, total_reviews: 0 };

  const sum = data.reduce((acc, curr) => acc + curr.rating, 0);
  return {
    average_rating: parseFloat((sum / data.length).toFixed(1)),
    total_reviews: data.length
  };
};

export const getProviderRatingSummaries = async (providerIds: string[]): Promise<Record<string, RatingSummary>> => {
  if (!providerIds || providerIds.length === 0) return {};

  const { data, error } = await supabase
    .from('reviews')
    .select('provider_id, rating')
    .in('provider_id', providerIds)
    .eq('is_hidden', false);

  if (error) {
    console.error('Error fetching bulk rating summaries:', error);
    return {};
  }

  const summaries: Record<string, { ratingSum: number; count: number }> = {};
  
  data.forEach(review => {
    if (!summaries[review.provider_id]) {
      summaries[review.provider_id] = { ratingSum: 0, count: 0 };
    }
    summaries[review.provider_id].ratingSum += review.rating;
    summaries[review.provider_id].count += 1;
  });

  const result: Record<string, RatingSummary> = {};
  Object.keys(summaries).forEach(providerId => {
    result[providerId] = {
      average_rating: parseFloat((summaries[providerId].ratingSum / summaries[providerId].count).toFixed(1)),
      total_reviews: summaries[providerId].count
    };
  });
  
  return result;
};

export const hasReview = async (bookingId: string, providerId: string) => {
  const { data, error } = await supabase
    .from('reviews')
    .select('id')
    .eq('booking_id', bookingId)
    .eq('provider_id', providerId)
    .maybeSingle();

  if (error) {
    console.error('Error checking for existing review:', error);
    return false;
  }
  return !!data;
};

export const moderateReview = async (
  reviewId: string,
  isHidden: boolean,
  reason: string | null,
  adminId: string
) => {
  if (isHidden && (!reason || reason.trim() === '')) {
    throw new Error('A reason is required when hiding a review.');
  }

  const updates = isHidden 
    ? {
        is_hidden: true,
        hidden_reason: reason,
        hidden_at: new Date().toISOString(),
        hidden_by: adminId
      }
    : {
        is_hidden: false,
        hidden_reason: null,
        hidden_at: null,
        hidden_by: null
      };

  const { data, error } = await supabase
    .from('reviews')
    .update(updates)
    .eq('id', reviewId)
    .select()
    .single();

  if (error) {
    console.error('Error moderating review:', error);
    throw error;
  }

  return data as Review;
};

export interface ReviewFilters {
  provider_type?: string;
  rating?: number;
  startDate?: string;
  endDate?: string;
  search?: string;
}

export const getAllReviews = async (filters?: ReviewFilters): Promise<(Review & { provider?: { full_name: string; company_name: string } })[]> => {
  let query = supabase
    .from('reviews')
    .select(`
      *,
      operator:profiles!operator_id(full_name, company_name, avatar_url),
      provider:profiles!provider_id(full_name, company_name),
      bookings!booking_id(booking_reference)
    `);

  if (filters?.provider_type && filters.provider_type !== 'all') {
    query = query.eq('provider_type', filters.provider_type);
  }

  if (filters?.rating) {
    query = query.gte('rating', filters.rating);
  }

  if (filters?.startDate) {
    query = query.gte('created_at', filters.startDate);
  }

  if (filters?.endDate) {
    query = query.lte('created_at', filters.endDate);
  }

  // Search is more complex with Supabase without text search, so we might do limited search or just fetch and filter in UI
  // But we can try basic ilike if we know the field. 
  // Let's do a basic fetch and handle complex search or specific fields in UI if needed, 
  // or use or() for multiple fields.
  if (filters?.search) {
    query = query.or(`review_text.ilike.%${filters.search}%`);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching all reviews:', error);
    throw error;
  }

  return data as unknown as (Review & { provider?: { full_name: string; company_name: string } })[];
};
