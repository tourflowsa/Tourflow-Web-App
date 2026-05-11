
import { supabase } from './supabase';

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  link?: string;
  is_read: boolean;
  metadata?: Record<string, any> | null;
  created_at: string;
}

export const NOTIFICATION_TYPES = {
  // Booking & Assignments
  ASSIGNED_TO_BOOKING: 'ASSIGNED_TO_BOOKING',
  REMOVED_FROM_BOOKING: 'REMOVED_FROM_BOOKING',
  ASSIGNMENT_ACCEPTED: 'ASSIGNMENT_ACCEPTED',
  ASSIGNMENT_REJECTED: 'ASSIGNMENT_REJECTED',
  BOOKING_CANCELLED: 'BOOKING_CANCELLED',
  BOOKING_NO_SHOW: 'BOOKING_NO_SHOW',
  
  // Documents
  NEW_DOCUMENT_UPLOADED: 'NEW_DOCUMENT_UPLOADED',
  DOCUMENT_APPROVED: 'DOCUMENT_APPROVED',
  DOCUMENT_REJECTED: 'DOCUMENT_REJECTED',
  DOCUMENT_EXPIRY_REMINDER: 'DOCUMENT_EXPIRY_REMINDER',
  DOCUMENT_EXPIRED: 'DOCUMENT_EXPIRED',
  
  // Reviews
  NEW_REVIEW: 'NEW_REVIEW',
  
  // Payouts & Finance
  PAYOUT_APPROVED: 'PAYOUT_APPROVED',
  PAYOUT_PAID: 'PAYOUT_PAID',
  PAYOUT_HOLD: 'PAYOUT_HOLD',
  NEW_DISPUTE: 'NEW_DISPUTE',
  DISPUTE_RESOLVED: 'DISPUTE_RESOLVED',
  WITHDRAWAL_REQUESTED: 'WITHDRAWAL_REQUESTED',
  WITHDRAWAL_APPROVED: 'WITHDRAWAL_APPROVED',
  WITHDRAWAL_REJECTED: 'WITHDRAWAL_REJECTED'
};

export const createNotification = async (payload: {
  user_id: string;
  type: string;
  title: string;
  message: string;
  link?: string;
  metadata?: Record<string, any> | null;
}) => {
  if (!payload.user_id) return null;

  const { error } = await supabase
    .from('notifications')
    .insert({
      ...payload,
      metadata: payload.metadata || {},
      is_read: false,
      created_at: new Date().toISOString()
    });

  if (error) {
    console.error('Error creating notification:', error.message);
    return false;
  }

  // Dispatch a custom event for real-time updates in the UI
  window.dispatchEvent(new CustomEvent('NOTIFICATIONS_UPDATED'));
  
  return true;
};

export const listNotifications = async (userId: string, limit = 50) => {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error listing notifications:', error);
    return [];
  }

  return data as Notification[];
};

export const getUnreadCount = async (userId: string) => {
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false);

  if (error) {
    console.error('Error getting unread count:', error);
    return 0;
  }

  return count || 0;
};

export const markAsRead = async (notificationId: string) => {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId);

  if (error) {
    console.error('Error marking notification as read:', error);
    return false;
  }

  window.dispatchEvent(new CustomEvent('NOTIFICATIONS_UPDATED'));
  return true;
};

export const markAllAsRead = async (userId: string) => {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false);

  if (error) {
    console.error('Error marking all notifications as read:', error);
    return false;
  }

  window.dispatchEvent(new CustomEvent('NOTIFICATIONS_UPDATED'));
  return true;
};
