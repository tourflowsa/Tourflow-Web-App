import { supabase } from './supabase';
import { Booking, Payout } from '../types';
import { getPayoutLedgersForBooking } from './payoutService';
import { logAuditEvent } from './auditService';

/**
 * Mark a booking as having received funds from the customer.
 * This is a simulation function for the escrow layer.
 */
export const markBookingFundsReceived = async (bookingId: string, amount: number, userId: string) => {
  const now = new Date().toISOString();
  
  const { data: booking, error: fetchError } = await supabase
    .from('bookings')
    .select('booking_reference, funds_released_amount, escrow_status, total_amount')
    .eq('id', bookingId)
    .single();

  if (fetchError) throw fetchError;

  // Guard: if already marked as received, do nothing
  if (booking?.escrow_status === 'funds_received') {
    return;
  }

  const total = booking?.total_amount || amount;
  const released = booking?.funds_released_amount || 0;

  const payload = {
    payment_status: 'funds_held',
    escrow_status: 'funds_received',
    escrow_total: total,
    escrow_held: total,
    funds_received_amount: total,
    funds_held_amount: total,
    funds_remaining_amount: total - released,
    payment_received_at: now,
    updated_at: now
  } as any;

  const { error } = await supabase
    .from('bookings')
    .update(payload)
    .eq('id', bookingId);

  if (error) throw error;

  await logAuditEvent({
    action: 'MARK_FUNDS_RECEIVED',
    entityType: 'booking',
    entityId: bookingId,
    metadata: {
      amount,
      booking_reference: booking?.booking_reference
    }
  });

  // After marking received, refresh to apply further status logic (e.g. if payouts already exist)
  await refreshBookingEscrowState(bookingId);
};

/**
 * Refresh the escrow state of a booking based on its payout ledger.
 */
export const syncEscrowToBookingTotal = async (bookingId: string) => {
  // 1. Fetch booking current state
  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select('*')
    .eq('id', bookingId)
    .single();

  if (bookingError) throw bookingError;
  if (!booking) throw new Error('Booking not found');

  // 2. Check if funded
  const wasFunded = 
    booking.payment_status === 'funds_held' || 
    booking.escrow_status === 'funds_received' ||
    (Number(booking.funds_received_amount) || 0) > 0 ||
    (Number(booking.funds_held_amount) || 0) > 0 ||
    (Number(booking.escrow_held) || 0) > 0;

  // 3. Fetch paid payouts
  const ledgers = await getPayoutLedgersForBooking(bookingId);
  const releasedAmount = ledgers
    .filter(l => l.status === 'paid')
    .reduce((sum, l) => {
      const amount = l.adjusted_amount !== null && l.adjusted_amount !== undefined 
        ? Number(l.adjusted_amount) 
        : Number(l.amount_net || 0);
      return sum + amount;
    }, 0);
  const hasPaidPayouts = releasedAmount > 0;

  const oldTotal = Number(booking.escrow_held || 0);
  const newTotal = Number(booking.total_amount || 0);

  let synced = false;

  if (wasFunded && !hasPaidPayouts) {
    const payload: any = {
      escrow_total: newTotal,
      escrow_held: newTotal,
      funds_received_amount: newTotal,
      funds_held_amount: newTotal,
      funds_remaining_amount: newTotal - releasedAmount,
      updated_at: new Date().toISOString()
    };

    const { error: updateError } = await supabase
      .from('bookings')
      .update(payload)
      .eq('id', bookingId);
      
    if (updateError) {
      console.error('[EscrowService] Error syncing booking total:', updateError);
      throw updateError;
    }
    synced = true;
  }

  

  return { synced, hasPaidPayouts, wasFunded };
};

export const refreshBookingEscrowState = async (bookingId: string) => {
  // 1. Fetch booking current state
  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select('*')
    .eq('id', bookingId)
    .single();

  if (bookingError) throw bookingError;
  if (!booking) throw new Error('Booking not found');

  // 2. Fetch payout ledgers
  const ledgers = await getPayoutLedgersForBooking(bookingId);
  
  // 3. Calculate released amount
  const releasedAmount = ledgers
    .filter(l => l.status === 'paid')
    .reduce((sum, l) => {
      const amount = l.adjusted_amount !== null && l.adjusted_amount !== undefined 
        ? Number(l.adjusted_amount) 
        : Number(l.amount_net || 0);
      return sum + amount;
    }, 0);

  // 4. Calculate remaining amount
  const fundsForEscrow = Number(booking.funds_held_amount || booking.escrow_held || booking.funds_received_amount || 0);
  const remainingAmount = Math.max(0, fundsForEscrow - releasedAmount);

  // 5. Determine Payment Status
  let newStatus = booking.payment_status;
  let newEscrowStatus = booking.escrow_status || 'pending_payment';

  let syncTotalAmount = false;
  const isPaidOrConfirmed = 
    ['confirmed', 'assigned', 'in_progress', 'completed'].includes(booking.status) || 
    ['paid', 'funds_received', 'funds_held'].includes(booking.payment_status) || 
    ['funds_received', 'partially_released', 'fully_released'].includes(booking.escrow_status);

  // Auto-sync escrow totals from booking total_amount if funds have been received but no payouts released yet.
  // Only auto-sync if both received amount and held amount are 0 (not yet funded).
  if (isPaidOrConfirmed && releasedAmount === 0 && (booking.total_amount || 0) > 0) {
    if ((Number(booking.funds_received_amount) || 0) === 0 && (Number(booking.escrow_held) || 0) === 0) {
      syncTotalAmount = true;
    }
  }

  if (!syncTotalAmount && (booking.funds_received_amount || 0) === 0 && (booking.escrow_held || 0) === 0 && !isPaidOrConfirmed) {
    newStatus = 'payment_pending';
    newEscrowStatus = 'pending_payment';
  } else {
    // We have funds.
    if (releasedAmount >= (booking.escrow_total || booking.total_amount || 0) && (booking.escrow_total || booking.total_amount || 0) > 0) {
      newEscrowStatus = 'fully_released';
      newStatus = 'payout_completed';
    } else if (releasedAmount > 0) {
      newEscrowStatus = 'partially_released';
      newStatus = 'payout_ready';
    } else {
      newEscrowStatus = 'funds_received';
      newStatus = 'funds_held';
    }
  }

  // 6. Update booking
  const payload: any = {
    funds_released_amount: releasedAmount,
    funds_remaining_amount: remainingAmount,
    payment_status: newStatus,
    // Sync new escrow fields
    escrow_status: newEscrowStatus,
    escrow_released: releasedAmount,
    updated_at: new Date().toISOString()
  };

  if (syncTotalAmount) {
    const t = Number(booking.total_amount || 0);
    payload.escrow_total = t;
    payload.escrow_held = t;
    payload.funds_received_amount = t;
    payload.funds_held_amount = t;
    payload.funds_remaining_amount = t - releasedAmount;
    payload.payment_received_at = booking.payment_received_at || payload.updated_at;
  }
  const { error: updateError } = await supabase
    .from('bookings')
    .update(payload)
    .eq('id', bookingId);

  if (updateError) {
    console.error('[EscrowService] Update error:', updateError);
    if (updateError.message && updateError.message.toLowerCase().includes('completed bookings are locked')) {
      console.warn('[EscrowService] Swallowing lock error to allow payout process to continue without DB state crash');
    } else {
      throw updateError;
    }
  }
};
