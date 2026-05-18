
import { supabase } from './supabase';
import { BookingMessage } from '../types';
import { createNotification, NOTIFICATION_TYPES } from './notificationService';

export const listBookingMessages = async (bookingId: string) => {
  const { data, error } = await supabase
    .from('booking_messages')
    .select('*')
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching booking messages:', error);
    return [];
  }

  return data as BookingMessage[];
};

export const subscribeToBookingMessages = (bookingId: string, callback: (message: BookingMessage) => void) => {
  return supabase
    .channel(`booking-chat-${bookingId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'booking_messages',
        filter: `booking_id=eq.${bookingId}`
      },
      (payload) => {
        callback(payload.new as BookingMessage);
      }
    )
    .subscribe();
};

export const sendBookingMessage = async (bookingId: string, content: string) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  // Fetch current user details for snapshot
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('full_name, company_name, role')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    throw new Error('Failed to fetch user profile for message snapshot');
  }

  const senderName = profile.company_name || profile.full_name || 'System User';
  const senderRole = profile.role;

  const { data: message, error: messageError } = await supabase
    .from('booking_messages')
    .insert({
      booking_id: bookingId,
      sender_id: user.id,
      sender_role_snapshot: senderRole,
      sender_name_snapshot: senderName,
      content,
      metadata: {}
    })
    .select()
    .single();

  if (messageError) {
    console.error('Error sending message:', messageError);
    throw messageError;
  }

  // Notify other participants asynchronously
  notifyParticipants(bookingId, user.id, senderName).catch(err => {
    console.error('Failed to notify participants:', err);
  });

  return message as BookingMessage;
};

const notifyParticipants = async (bookingId: string, senderId: string, senderName: string) => {
  // Fetch booking details to find operator and vehicle owner
  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select('booking_reference, operator_id, vehicle_id, vehicles(owner_id)')
    .eq('id', bookingId)
    .single();

  if (bookingError || !booking) return;

  // Fetch assigned resources (Drivers/Guides) 
  const { data: assignments } = await supabase
    .from('booking_assignments')
    .select('id, resource_id, resource_type')
    .eq('booking_id', bookingId)
    .in('status', ['pending', 'accepted', 'completed', 'no_show']);

  // Fetch all admins
  const { data: admins } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'admin');

  // We need to know who is who to give them the right link
  const adminIds = new Set((admins || []).map(a => a.id));

  const participantIds = new Set<string>();

  // Add Operator
  if (booking.operator_id) participantIds.add(booking.operator_id);

  // Add Assigned Resources
  assignments?.forEach(a => {
    if (a.resource_id) participantIds.add(a.resource_id);
  });

  // Add Admins
  adminIds.forEach(id => participantIds.add(id));

  // Remove sender
  participantIds.delete(senderId);

  // Create notifications for each participant
  const notificationPromises = Array.from(participantIds).map(userId => {
    let link = `/operator/bookings/${bookingId}`; // Default to operator view if unknown

    if (adminIds.has(userId)) {
      link = `/admin/bookings/${bookingId}`;
    } else if (userId === booking.operator_id) {
      link = `/operator/bookings/${bookingId}`;
    } else {
      // Check if they are a driver or guide
      const asgn = assignments?.find(a => a.resource_id === userId);
      if (asgn) {
        link = `/${asgn.resource_type}/assignments/${asgn.id}`;
      }
    }
    
    return createNotification({
      user_id: userId,
      type: NOTIFICATION_TYPES.NEW_CHAT_MESSAGE,
      title: 'New Message',
      message: `${senderName} sent a message regarding booking ${booking.booking_reference}`,
      link,
      metadata: { booking_id: bookingId, sender_id: senderId }
    });
  });

  await Promise.all(notificationPromises);
};
