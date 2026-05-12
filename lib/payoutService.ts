
import { supabase } from './supabase';
import { Payout, UserRole } from '../types';
import { logAuditEvent } from './auditService';
import { resolveOperatorFee } from './feeService';
import { createNotification } from './notificationService';
import { refreshBookingEscrowState } from './escrowService';
import { checkComplianceGate } from './complianceGate';
import { getBankDetails, getBankStatus } from './bankDetailsService';

/**
 * Logs a payout lifecycle event to the payout_events table and system_audit_log.
 * This is non-blocking and errors are only logged to console.
 */
export async function logPayoutEvent(params: {
  payout_id: string;
  booking_id: string;
  provider_id: string;
  event_type: 'created' | 'approved' | 'withdrawal_requested' | 'withdrawal_approved' | 'withdrawal_rejected' | 'paid' | 'hold' | 'released' | 'dispute_opened' | 'dispute_resolved' | 'adjusted';
  previous_state?: any;
  new_state?: any;
  triggered_by?: string;
  triggered_role?: 'admin' | 'operator' | 'provider';
  notes?: string;
}) {
  try {
    // 1. Log to legacy payout_events table
    // Remove 'notes' as it might not exist in the schema
    const { notes, ...insertParams } = params;
    const { error } = await supabase
      .from('payout_events')
      .insert({
        ...insertParams,
        created_at: new Date().toISOString()
      });
    if (error) {
      console.error('[logPayoutEvent] Error logging payout event:', error);
    }

    // 2. Log to system_audit_log (Mandatory for Audit Trail System)
    // Map event_type to audit action
    let action = `payout_${params.event_type}`;
    if (params.event_type.startsWith('withdrawal_')) {
      action = params.event_type;
    } else if (params.event_type.startsWith('dispute_')) {
      action = params.event_type;
    } else if (params.event_type === 'hold') {
      action = 'payout_on_hold';
    } else if (params.event_type === 'released') {
      action = 'payout_released';
    } else if (params.event_type === 'adjusted') {
      action = 'payout_adjusted';
    }

    await logAuditEvent({
      action,
      entityType: 'payout_ledger',
      entityId: params.payout_id,
      actorId: params.triggered_by,
      actorRole: params.triggered_role,
      metadata: {
        previous_status: params.previous_state?.status || params.previous_state?.withdrawal_request_status || null,
        new_status: params.new_state?.status || params.new_state?.withdrawal_request_status || null,
        amount: params.new_state?.amount_net || params.previous_state?.amount_net || null,
        original_amount: params.new_state?.original_amount || params.previous_state?.original_amount || null,
        adjusted_amount: params.new_state?.adjusted_amount || null,
        booking_id: params.booking_id || params.new_state?.booking_id || params.previous_state?.booking_id || null,
        provider_id: params.provider_id || params.new_state?.provider_id || params.previous_state?.provider_id || null,
        notes: params.notes
      }
    });
  } catch (err) {
    console.error('[logPayoutEvent] Unexpected error:', err);
  }
}

export interface PayoutStats {
  currentBalance: number;
  nextPayoutDate: string | null;
  nextPayoutAmount: number | null;
  lifetimePayouts: number;
  pendingPipeline: number;
}

export interface PayoutReminders {
  completedAwaitingPayout: number;
  pendingApproval: number;
  approvedAwaitingPayment: number;
}

export const getPayoutLedgersForBookings = async (bookingIds: string[]) => {
  const { data, error } = await supabase
    .from('payout_ledger')
    .select('*')
    .in('booking_id', bookingIds);

  if (error) throw error;
  return data || [];
};

export const getPayoutLedgersForBooking = async (bookingId: string) => {
  const { data, error } = await supabase
    .from('payout_ledger')
    .select('*')
    .eq('booking_id', bookingId);

  if (error) throw error;
  return data || [];
};

export const isBookingFinanciallyLocked = async (bookingId: string) => {
  const { data, error } = await supabase
    .from('payout_ledger')
    .select('id')
    .eq('booking_id', bookingId)
    .eq('status', 'paid')
    .limit(1);

  if (error) {
    console.error("Error checking financial lock:", error);
    return false;
  }
  
  return (data && data.length > 0);
};

export const reconcileBookingFinancials = async (bookingId: string) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data, error } = await supabase.rpc('reconcile_booking_financials', {
    p_booking_id: bookingId,
    p_actor_id: user.id
  });

  if (error) throw error;
  
  const result = Array.isArray(data) ? data[0] : data;

  return result;
};

export const repairPayoutLedgerRow = async (payoutId: string) => {
  // Fetch existing payout
  const { data: payout, error: payoutError } = await supabase
    .from('payout_ledger')
    .select('*')
    .eq('id', payoutId)
    .single();

  if (payoutError || !payout) {
    throw new Error(`Payout repair failed: Payout ${payoutId} not found.`);
  }

  // Fetch booking
  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select('*')
    .eq('id', payout.booking_id)
    .single();

  if (bookingError || !booking) {
    throw new Error(`Payout repair failed: Booking ${payout.booking_id} not found.`);
  }

  // Calculate platform fee and VAT based on current amount_gross
  // If amount_gross is 0, we should ideally fetch the assignments, but for a simple repair
  // we can just trigger the full booking recalculation first, then fallback to direct update
  await createPayoutLedgerForBooking(payout.booking_id);

  // Fetch the row again to see if it was updated by createPayoutLedgerForBooking
  const { data: updatedPayout } = await supabase
    .from('payout_ledger')
    .select('*')
    .eq('id', payoutId)
    .single();

  if (updatedPayout && updatedPayout.platform_fee === 0 && updatedPayout.amount_gross > 0) {
    // If it's still 0 (e.g. because booking is cancelled and createPayoutLedgerForBooking skipped it),
    // force a direct calculation
    const feeInfo = await resolveOperatorFee(booking.operator_id);
    const platformFee = Number(updatedPayout.amount_gross) * (feeInfo.feePercent / 100);
    const netAmount = Number(updatedPayout.amount_gross) - platformFee;
    const vatRate = Number(booking.vat_rate) || 0;
    const vatAmount = vatRate > 0 ? netAmount - (netAmount / (1 + vatRate / 100)) : 0;

    const { error: updateError } = await supabase
      .from('payout_ledger')
      .update({
        platform_fee: platformFee,
        amount_net: netAmount,
        vat_rate: vatRate,
        vat_amount: vatAmount,
        updated_at: new Date().toISOString()
      })
      .eq('id', payoutId);

    if (updateError) {
      console.error(`[PayoutService] Repair error:`, updateError);
      throw new Error("Failed to repair payout ledger record: " + updateError.message);
    }
  }
};

export const createPayoutLedgerForBooking = async (bookingId: string) => {
  if (await isBookingFinanciallyLocked(bookingId)) {
    throw new Error("BOOKING_FINANCIALLY_LOCKED");
  }

  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select('*')
    .eq('id', bookingId)
    .single();

  if (bookingError || !booking) {
    throw new Error(`Payout ledger creation failed: Booking ${bookingId} not found.`);
  }

  // Relaxed status guard: allow 'completed' or 'confirmed'
  if (['cancelled', 'archived'].includes(booking.status)) {
    return;
  }

  // Fetch existing payout rows to preserve status and prevent duplicates
  const existingPayouts = await getPayoutLedgersForBooking(bookingId);

  // Calculate durations for rate calculations
  const start = new Date(booking.start_date);
  const end = new Date(booking.end_date);
  const ms = end.getTime() - start.getTime();
  const durationHours = Math.max(1, Math.ceil(ms / (1000 * 60 * 60)));
  const durationDays = Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24)));

  const calcAmount = (rateAmount: number | null, rateType: string | null) => {
    const amt = Number(rateAmount ?? 0);
    if (!amt) return 0;
    const isHourly = String(rateType ?? '').toLowerCase().includes('hour');
    return isHourly ? amt * durationHours : amt * durationDays;
  };

  // 1. Fetch assignments for Driver and Guide
  // We only want the LATEST accepted/completed assignment per role to prevent duplicates
  const { data: allAssignments, error: assignmentsError } = await supabase
    .from('booking_assignments')
    .select('id, resource_id, resource_type, rate_amount, rate_type, cost_total, status, updated_at')
    .eq('booking_id', bookingId)
    .in('resource_type', ['driver', 'guide'])
    .in('status', ['accepted', 'completed']);

  if (assignmentsError) {
    console.error(`[PayoutService] Error fetching assignments:`, assignmentsError);
  }

  // Deduplicate assignments by role (keep latest)
  const assignments: any[] = [];
  const roleMap: Record<string, any> = {};
  allAssignments?.forEach(a => {
    if (!roleMap[a.resource_type] || new Date(a.updated_at) > new Date(roleMap[a.resource_type].updated_at)) {
      roleMap[a.resource_type] = a;
    }
  });
  Object.values(roleMap).forEach(a => assignments.push(a));

  // 2. Fetch provider profiles separately to ensure we get fallback rates
  const providerIds = assignments?.map(a => a.resource_id).filter(Boolean) || [];
  const profileMap: Record<string, any> = {};
  
  if (providerIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, default_day_rate, default_hour_rate')
      .in('id', providerIds);
    
    profiles?.forEach(p => {
      profileMap[p.id] = p;
    });
  }

  // 3. Build payout items (Driver, Guide, Vehicle)
  const payoutItems: { provider_id: string; amount: number; role: string }[] = [];

  // Add Driver/Guide payouts from assignments
  if (assignments) {
    for (const assignment of assignments) {
      if (!assignment.resource_id) continue;
      
      // Priority: 1. cost_total, 2. rate_amount + rate_type, 3. fallback to profile defaults
      let amount = Number(assignment.cost_total ?? 0);
      
      if (amount <= 0) {
        amount = calcAmount(assignment.rate_amount, assignment.rate_type);
      }

      if (amount <= 0 && profileMap[assignment.resource_id]) {
        const profile = profileMap[assignment.resource_id];
        const fallbackRate = assignment.rate_type === 'hour' ? profile.default_hour_rate : profile.default_day_rate;
        amount = calcAmount(fallbackRate, assignment.rate_type);
      }

      if (amount > 0) {
        payoutItems.push({ 
          provider_id: assignment.resource_id, 
          amount, 
          role: assignment.resource_type.toUpperCase() 
        });
      }
    }
  }

  // Add Vehicle payout from booking snapshot
  if (booking.vehicle_id) {
    const vehicleAmount = calcAmount(booking.vehicle_rate_amount, booking.vehicle_rate_type);
    
    if (vehicleAmount > 0) {
      const { data: vehicle } = await supabase
        .from('vehicles')
        .select('owner_id')
        .eq('id', booking.vehicle_id)
        .single();

      if (vehicle?.owner_id) {
        payoutItems.push({ 
          provider_id: vehicle.owner_id, 
          amount: vehicleAmount, 
          role: 'VEHICLE' 
        });
      }
    }
  }

  // 4. Group by provider_id to ensure "one provider has only one payout row per booking"
  const providerGroups: Record<string, { amount: number; roles: string[] }> = {};
  for (const item of payoutItems) {
    if (!providerGroups[item.provider_id]) {
      providerGroups[item.provider_id] = { amount: 0, roles: [] };
    }
    providerGroups[item.provider_id].amount += item.amount;
    providerGroups[item.provider_id].roles.push(item.role);
  }

    // 5. Build final payout rows
    const payoutRows = [];
    for (const [providerId, group] of Object.entries(providerGroups)) {
      // Find existing payout for this provider and booking
      const existing = existingPayouts.find(p => p.provider_id === providerId);
      
      // Stability check: if approved/paid, keep existing amount
      const grossAmount = (existing?.status === 'approved' || existing?.status === 'paid')
        ? Number(existing.amount_gross)
        : group.amount;

      // Calculate platform fee and VAT
      const feeInfo = await resolveOperatorFee(booking.operator_id);
      const platformFee = grossAmount * (feeInfo.feePercent / 100);
      const netAmount = grossAmount - platformFee;
      const vatRate = Number(booking.vat_rate) || 0;
      const vatAmount = vatRate > 0 ? netAmount - (netAmount / (1 + vatRate / 100)) : 0;

      if (existing) {
        payoutRows.push({
          ...existing,
          amount_gross: grossAmount,
          platform_fee: platformFee,
          amount_net: netAmount,
          vat_rate: vatRate,
          vat_amount: vatAmount,
          original_amount: existing.original_amount || netAmount,
          adjusted_amount: existing.adjusted_amount || netAmount,
          updated_at: new Date().toISOString()
        });
      } else {
        const role = group.roles.length > 1 ? 'COMBINED' : group.roles[0];
        const payoutReference = (existing?.payout_reference && existing.payout_reference.trim() !== '')
          ? existing.payout_reference
          : `PO-${booking.booking_reference}-${role}`;

        payoutRows.push({
          payout_reference: payoutReference,
          booking_id: bookingId,
          provider_id: providerId,
          operator_id: booking.operator_id,
          booking_currency: booking.currency || 'ZAR',
          amount_gross: grossAmount,
          platform_fee: platformFee,
          amount_net: netAmount,
          vat_rate: vatRate,
          vat_amount: vatAmount,
          status: 'pending',
          original_amount: netAmount,
          adjusted_amount: netAmount,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }
    }

  if (payoutRows.length > 0) {
    // Separate into inserts and updates to handle legacy payout_references safely
    const inserts = payoutRows.filter(r => !r.id);
    const updates = payoutRows.filter(r => !!r.id);

    if (inserts.length > 0) {
      const { data: insertedRows, error } = await supabase
        .from('payout_ledger')
        .insert(inserts)
        .select();
        
      if (error) {
        console.error(`[PayoutService] Insert error:`, error);
        throw new Error("Failed to insert payout ledger records: " + error.message);
      }

      // Log audit events for created payouts
      if (insertedRows) {
        await Promise.all(insertedRows.map(row => {
          return logPayoutEvent({
            payout_id: row.id,
            booking_id: row.booking_id,
            provider_id: row.provider_id,
            event_type: 'created',
            new_state: row,
            triggered_role: 'operator'
          });
        }));
      }
    }

    if (updates.length > 0) {
      for (const update of updates) {
        const { id, ...updatePayload } = update;
        const { error } = await supabase
          .from('payout_ledger')
          .update(updatePayload)
          .eq('id', id);
        if (error) {
          console.error(`[PayoutService] Update error for ${id}:`, error);
          throw new Error("Failed to update payout ledger record: " + error.message);
        }
      }
    }
  }
};

/**
 * Backfill helper for completed bookings without payouts
 */
export const backfillPayoutsForCompletedBookings = async (operatorId: string) => {
  const { data: bookings } = await supabase
    .from('bookings')
    .select('id')
    .eq('operator_id', operatorId)
    .eq('status', 'completed');

  if (!bookings) return 0;

  let count = 0;
  for (const b of bookings) {
    try {
      await createPayoutLedgerForBooking(b.id);
      count++;
    } catch (e) {
      console.error(`Backfill failed for booking ${b.id}:`, e);
    }
  }
  return count;
};


export const getOperatorPayoutOverview = async (operatorId: string): Promise<PayoutStats> => {
  try {
    const { data: balanceData } = await supabase
      .from('payout_ledger')
      .select('amount_net, adjusted_amount')
      .eq('operator_id', operatorId)
      .eq('status', 'pending');

    const currentBalance = balanceData?.reduce((sum, item) => {
      const amt = item.adjusted_amount !== null && item.adjusted_amount !== undefined 
        ? Number(item.adjusted_amount) 
        : Number(item.amount_net || 0);
      return sum + amt;
    }, 0) || 0;

    const { data: nextPayout } = await supabase
      .from('payout_ledger')
      .select('created_at, amount_net, adjusted_amount')
      .eq('operator_id', operatorId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    const { data: lifetimeData } = await supabase
      .from('payout_ledger')
      .select('amount_net, adjusted_amount')
      .eq('operator_id', operatorId)
      .eq('status', 'paid');

    const { data: confirmedBookings } = await supabase
      .from('bookings')
      .select('total_amount, applied_net_amount')
      .eq('operator_id', operatorId)
      .eq('status', 'confirmed');

    const pendingPipeline = confirmedBookings?.reduce((sum, b) => sum + (Number(b.applied_net_amount ?? b.total_amount * 0.85)), 0) || 0;

    return {
      currentBalance,
      nextPayoutDate: nextPayout ? nextPayout.created_at : null,
      nextPayoutAmount: nextPayout ? (nextPayout.adjusted_amount !== null && nextPayout.adjusted_amount !== undefined ? Number(nextPayout.adjusted_amount) : Number(nextPayout.amount_net)) : null,
      lifetimePayouts: lifetimeData?.reduce((sum, item) => {
        const amt = item.adjusted_amount !== null && item.adjusted_amount !== undefined 
          ? Number(item.adjusted_amount) 
          : Number(item.amount_net || 0);
        return sum + amt;
      }, 0) || 0,
      pendingPipeline: currentBalance + pendingPipeline 
    };
  } catch (err) {
    return { currentBalance: 0, nextPayoutDate: null, nextPayoutAmount: null, lifetimePayouts: 0, pendingPipeline: 0 };
  }
};

export const getOperatorPayoutReminders = async (operatorId: string): Promise<PayoutReminders> => {
  try {
    // 1. Payouts ready for approval (pending)
    const { count: pendingCount } = await supabase
      .from('payout_ledger')
      .select('*', { count: 'exact', head: true })
      .eq('operator_id', operatorId)
      .eq('status', 'pending');

    // 2. Approved payouts awaiting mark as paid
    const { count: approvedCount } = await supabase
      .from('payout_ledger')
      .select('*', { count: 'exact', head: true })
      .eq('operator_id', operatorId)
      .eq('status', 'approved');

    // 3. Completed bookings awaiting payout
    // Fetch completed bookings
    const { data: completedBookings } = await supabase
      .from('bookings')
      .select('id')
      .eq('operator_id', operatorId)
      .eq('status', 'completed');

    let completedAwaitingPayout = 0;
    if (completedBookings && completedBookings.length > 0) {
      const bookingIds = completedBookings.map(b => b.id);
      
      // Fetch all payout ledgers for these bookings
      const { data: ledgers } = await supabase
        .from('payout_ledger')
        .select('booking_id, status')
        .in('booking_id', bookingIds);

      const ledgerMap: Record<string, string[]> = {};
      ledgers?.forEach(l => {
        if (!ledgerMap[l.booking_id]) ledgerMap[l.booking_id] = [];
        ledgerMap[l.booking_id].push(l.status);
      });

      completedBookings.forEach(b => {
        const statuses = ledgerMap[b.id] || [];
        // Awaiting payout if no payouts exist OR if at least one is pending
        if (statuses.length === 0 || statuses.includes('pending')) {
          completedAwaitingPayout++;
        }
      });
    }

    return {
      completedAwaitingPayout,
      pendingApproval: pendingCount || 0,
      approvedAwaitingPayment: approvedCount || 0
    };
  } catch (err) {
    console.error('[PayoutService] Error fetching reminders:', err);
    return { completedAwaitingPayout: 0, pendingApproval: 0, approvedAwaitingPayment: 0 };
  }
};

export const PAYOUT_STATUS_LABELS: Record<string, string> = {
  pending: 'PENDING',
  approved: 'AVAILABLE',
  paid: 'PAID',
  cancelled: 'CANCELLED',
};

export const listOperatorPayouts = async (operatorId: string, filters?: { status?: string | string[]; startDate?: string; endDate?: string; limit?: number; includeArchived?: boolean }) => {
  let query = supabase.from('payout_ledger').select('*, payout_batches(batch_ref)').eq('operator_id', operatorId).order('created_at', { ascending: false });
  if (!filters?.includeArchived) {
    query = query.is('operator_archived_at', null);
  }
  if (filters?.status) {
    const validStatuses = ['pending', 'approved', 'paid', 'cancelled'];
    if (Array.isArray(filters.status)) {
      const cleanStatuses = filters.status
        .map(s => s.toLowerCase())
        .filter(s => validStatuses.includes(s));
      if (cleanStatuses.length > 0) {
        query = query.in('status', cleanStatuses);
      }
    } else if (filters.status !== 'All') {
      const s = filters.status.toLowerCase();
      if (validStatuses.includes(s)) {
        query = query.eq('status', s);
      }
    }
  }
  if (filters?.startDate) query = query.gte('created_at', filters.startDate);
  if (filters?.endDate) query = query.lte('created_at', filters.endDate);
  if (filters?.limit) query = query.limit(filters.limit);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map((item: any) => ({ ...item, currency: item.booking_currency || 'ZAR', amount_gross: item.amount_gross || 0, platform_fee: item.platform_fee || 0, amount_net: item.amount_net || 0, vat_amount: item.vat_amount || 0 }));
};

export const getPayoutDetail = async (payoutId: string, operatorId: string) => {
  const { data: ledgerItem, error } = await supabase
    .from('payout_ledger')
    .select('*, bookings(booking_reference, start_date, tour_id, tours(title), applied_fee_percent, applied_fee_tier_code)')
    .eq('id', payoutId)
    .eq('operator_id', operatorId)
    .maybeSingle();

  if (error) throw error;
  if (!ledgerItem) throw new Error("Payout record not found.");

  // Call RPC for names
  const { data: context, error: contextError } = await supabase
    .rpc('get_payout_statement_context', { p_payout_id: payoutId });

  if (contextError) console.error("RPC error:", contextError);
  const ctx = context?.[0] || {};

  let providerDisplayName = ctx.provider_display_name || 'Unknown Provider';

  // Fallback resolution for vehicle providers if RPC returns Unknown
  if (providerDisplayName === 'Unknown Provider' && ledgerItem.provider_id) {
    const { data: vehicle } = await supabase
      .from('vehicles')
      .select('name, owner_id, profiles:owner_id(company_name, full_name)')
      .eq('id', ledgerItem.provider_id)
      .maybeSingle();
    
    if (vehicle) {
      const ownerName = (vehicle as any).profiles?.company_name || (vehicle as any).profiles?.full_name || vehicle.name || 'Vehicle Provider';
      providerDisplayName = `${ownerName} (Vehicle)`;
    } else if (ledgerItem.payout_reference?.includes('-VEHICLE')) {
      providerDisplayName = 'Vehicle Provider';
    }
  }

  return { 
    payout: { 
      ...ledgerItem, 
      currency: ledgerItem.booking_currency || 'ZAR', 
      applied_fee_percent: ledgerItem.bookings?.applied_fee_percent,
      operator_display_name: ctx.operator_display_name || 'Unknown Operator',
      provider_display_name: providerDisplayName,
      tour_title: ctx.tour_title || ledgerItem.bookings?.tours?.title || 'Custom Tour',
      service_date: ctx.service_date || ledgerItem.bookings?.start_date,
      // Audit fields
      provider_name: providerDisplayName,
      provider_type: ledgerItem.provider_type || 'Unknown',
      booking_ref: ledgerItem.bookings?.booking_reference || ledgerItem.booking_reference,
      gross_amount: ledgerItem.amount_gross,
      net_amount: ledgerItem.amount_net,
      paid_at: ledgerItem.paid_at,
      paid_by: ledgerItem.paid_by
    }, 
    bookingContext: ledgerItem.bookings 
  };
};

export async function updatePayoutLedgerStatus(id: string, status: 'approved' | 'paid', operatorId?: string) {
  if (!id) throw new Error("Invalid Payout Ledger ID");

  // Fetch payout row
  const { data: current, error: fetchError } = await supabase
    .from('payout_ledger')
    .select('status, is_on_hold, booking_id, batch_id, provider_id')
    .eq('id', id)
    .single();

  if (fetchError || !current) {
    console.error("updatePayoutLedgerStatus fetchError for id", id, ":", fetchError);
    throw new Error(`Payout ledger row not found or error fetching: ${id}`);
  }

  // Explicit status guards
  if (current.batch_id) {
    throw new Error("Cannot modify a payout that is already assigned to a batch.");
  }
  if (current.status === 'paid') {
    throw new Error("PAYOUT_PAID");
  }
  if (current.status === 'cancelled') {
    throw new Error("Cannot approve/pay a cancelled payout.");
  }
  if (status === 'approved' && current.status === 'approved') {
    throw new Error("Payout is already approved.");
  }
  if (current.is_on_hold) {
    throw new Error("Cannot approve/pay a payout while it is on hold.");
  }

  if (status === 'approved') {
    // 0. Fetch booking to ensure it's completed
    if (!current.booking_id) {
      throw new Error("Cannot authorize payout: Missing booking ID.");
    }
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('status')
      .eq('id', current.booking_id)
      .single();
    
    if (bookingError || !booking) {
      throw new Error(`Booking not found or error fetching for ID: ${current.booking_id}`);
    }
    
    if (booking.status !== 'completed') {
      throw new Error("Cannot authorize payout availability before booking is completed.");
    }

    // Provider ID Check
    if (!current.provider_id) {
      throw new Error("Cannot approve payout: Missing provider ID.");
    }

    // 1. Fetch provider profile to determine role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', current.provider_id)
      .single();

    if (profileError || !profile) {
      throw new Error(`Provider profile not found for ID: ${current.provider_id}`);
    }

    // 2. Compliance Gate Check
    const compliance = await checkComplianceGate({
      action: 'receive_payout',
      actorRole: profile.role as UserRole,
      actorUserId: current.provider_id
    });

    if (!compliance.allowed) {
      throw new Error(`Payout approval blocked: ${compliance.message}`);
    }

    // 3. Bank Details Check
    const bankDetails = await getBankDetails(current.provider_id);
    const bankStatus = getBankStatus(bankDetails);
    
    if (bankStatus !== 'Complete' && bankStatus !== 'Updated recently') {
      throw new Error(`Payout approval blocked: Provider bank details are ${bankStatus}.`);
    }
  }

  if (status === 'paid' && current?.is_on_hold) {
    throw new Error("Cannot mark payout as paid while it is on hold.");
  }

  // Escrow Gate Check for 'paid' status
  if (status === 'paid' && current?.booking_id) {
    const { data: booking } = await supabase
      .from('bookings')
      .select('id, escrow_status, escrow_total, escrow_held, escrow_released, funds_held_amount, funds_released_amount, total_amount')
      .eq('id', current.booking_id)
      .single();

    const { data: payout } = await supabase
      .from('payout_ledger')
      .select('amount_net, adjusted_amount')
      .eq('id', id)
      .single();

    // Calculate already paid amount from payout_ledger
    const { data: paidPayouts } = await supabase
      .from('payout_ledger')
      .select('amount_net, adjusted_amount')
      .eq('booking_id', current.booking_id)
      .eq('status', 'paid');

    if (booking && payout) {
      const payoutAmount = Number(payout.adjusted_amount ?? payout.amount_net ?? 0);
      const alreadyPaidAmount = paidPayouts?.reduce((sum, p) => sum + Number(p.adjusted_amount ?? p.amount_net ?? 0), 0) || 0;
      const totalEscrow = booking.escrow_total || booking.funds_held_amount || booking.total_amount || 0;
      const remainingEscrow = totalEscrow - alreadyPaidAmount;

      if (totalEscrow <= 0) {
        throw new Error('Cannot process payout. Funds have not been received into escrow.');
      }

      if (remainingEscrow < payoutAmount) {
        throw new Error('Cannot process payout. Insufficient escrow remaining for this booking.');
      }
    }
  }

  const update: any = {
    status: status,
    updated_at: new Date().toISOString()
  };

  if (status === 'approved' && operatorId) {
    update.approved_at = new Date().toISOString();
    update.approved_by = operatorId;
  }

  let query = supabase
    .from("payout_ledger")
    .update(update)
    .eq("id", id);

  if (operatorId) {
    query = query.eq("operator_id", operatorId);
  }

  const { data, error } = await query
    .select()
    .maybeSingle();

  if (error) {
    console.error(`[PayoutService] Update error:`, error);
    throw error;
  }

  if (!data) {
    const msg = `Payout status update failed. No payout row was updated for ID: ${id}${operatorId ? ` and operator: ${operatorId}` : ''}.`;
    console.error(`[PayoutService] ${msg}`);
    throw new Error(msg);
  }

  // Log audit event
  await logPayoutEvent({
    payout_id: data.id,
    booking_id: data.booking_id,
    provider_id: data.provider_id,
    event_type: status === 'approved' ? 'approved' : 'paid',
    previous_state: current,
    new_state: data,
    triggered_by: operatorId,
    triggered_role: 'operator'
  });
  
  // Refresh booking escrow state if payout is marked as paid
  if (data && status === 'paid' && data.booking_id) {
    try {
      await refreshBookingEscrowState(data.booking_id);
    } catch (escrowErr) {
      console.error('[PayoutPaid] escrow refresh failed', escrowErr);
      throw escrowErr; // Do NOT swallow escrow sync errors
    }
  }

  // Notify Provider
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', data.provider_id)
    .single();

  let earningsLink = '/dashboard';
  if (profile?.role === 'guide') earningsLink = '/guide/earnings';
  else if (profile?.role === 'driver') earningsLink = '/driver/earnings';
  else if (profile?.role === 'vehicle_owner') earningsLink = '/owner/earnings';

  const title = status === 'approved' ? 'Payout Approved' : 'Payout Paid';
  const message = status === 'approved' 
    ? `Your payout for booking ${data.payout_reference} has been approved.`
    : `Your payout for booking ${data.payout_reference} has been paid.`;
  
  await createNotification({
    user_id: data.provider_id,
    type: status === 'approved' ? 'PAYOUT_APPROVED' : 'PAYOUT_PAID',
    title,
    message,
    link: earningsLink
  });

  if (status === 'paid' && data.operator_id) {
    createNotification({
      user_id: data.operator_id,
      type: 'PAYOUT_PAID',
      title: 'Payout Paid',
      message: `Payout ${data.payout_reference} has been marked as paid.`,
      link: `/operator/payouts`
    }).catch(err => console.error('Failed to notify operator:', err));
  }

  // If approved, check if provider has bank details. If not, notify admins.
  if (status === 'approved') {
    // Notify Operator
    if (data.operator_id) {
      createNotification({
        user_id: data.operator_id,
        type: 'PAYOUT_APPROVED',
        title: 'Payout Approved',
        message: `Payout ${data.payout_reference} for booking has been approved.`,
        link: `/operator/payouts`
      }).catch(err => console.error('Failed to notify operator:', err));
    }

    const { data: bankDetails } = await supabase
      .from('provider_bank_details')
      .select('id')
      .eq('provider_id', data.provider_id)
      .maybeSingle();

    if (!bankDetails) {
      const { data: admins } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', 'admin');

      if (admins) {
        for (const admin of admins) {
          createNotification({
            user_id: admin.id,
            type: 'MISSING_BANK_DETAILS',
            title: 'Missing Bank Details',
            message: `Payout approved for provider ${data.provider_id}, but they have no bank details.`,
            link: '/admin/payouts'
          }).catch(err => console.error('Failed to notify admin:', err));
        }
      }
    }
  }

  window.dispatchEvent(new CustomEvent('PAYOUTS_UPDATED'));
  
  return data;
}

export async function archiveOperatorPayout(payoutId: string) {
  const { data, error } = await supabase.rpc('rpc_operator_archive_payout', { p_payout_id: payoutId });

  if (error) throw error;

  if (data) {
    await logAuditEvent({
      action: 'payout_archived',
      entityType: 'payout_ledger',
      entityId: payoutId,
      metadata: { scope: 'operator', payout_reference: data.payout_reference }
    });
  }

  return data;
};

export async function unarchiveOperatorPayout(payoutId: string) {
  const { data, error } = await supabase.rpc('rpc_operator_unarchive_payout', { p_payout_id: payoutId });

  if (error) throw error;

  if (data) {
    await logAuditEvent({
      action: 'payout_unarchived',
      entityType: 'payout_ledger',
      entityId: payoutId,
      metadata: { scope: 'operator', payout_reference: data.payout_reference }
    });
  }

  return data;
};

export async function archiveProviderPayout(payoutId: string) {
  const { data, error } = await supabase.rpc('rpc_provider_archive_payout', { p_payout_id: payoutId });

  if (error) throw error;

  if (data) {
    await logAuditEvent({
      action: 'payout_archived',
      entityType: 'payout_ledger',
      entityId: payoutId,
      metadata: { scope: 'provider', payout_reference: data.payout_reference }
    });
  }

  return data;
};

export async function archiveAdminPayout(payoutId: string) {
  const { data, error } = await supabase
    .from('payout_ledger')
    .update({
      archived_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', payoutId)
    .select()
    .maybeSingle();

  if (error) throw error;

  if (data) {
    await logAuditEvent({
      action: 'payout_archived',
      entityType: 'payout_ledger',
      entityId: payoutId,
      metadata: { scope: 'admin', payout_reference: data.payout_reference }
    });
  }

  return data;
};

export const listProviderPayouts = async (providerId: string, filters?: { status?: string; limit?: number }) => {
  let query = supabase
    .from('payout_ledger')
    .select('*, payout_batches(batch_ref), bookings!inner(id, booking_reference, start_date, end_date, status, tours(title))')
    .eq('provider_id', providerId)
    .eq('bookings.status', 'completed')
    .order('created_at', { ascending: false });

  const bucket = filters?.status || 'All';

  if (bucket === 'Available') {
    query = query
      .eq('status', 'approved')
      .eq('is_on_hold', false)
      .is('withdrawal_request_status', null);
  } else if (bucket === 'Withdrawal Requested') {
    query = query
      .eq('status', 'approved')
      .in('withdrawal_request_status', ['requested', 'approved']);
  } else if (bucket === 'On Hold') {
    query = query.eq('is_on_hold', true);
  } else if (bucket === 'Paid') {
    query = query.eq('status', 'paid');
  } else if (bucket === 'Pending') {
    query = query.eq('status', 'pending').eq('is_on_hold', false);
  } else if (bucket !== 'All') {
    query = query.eq('status', bucket.toLowerCase());
  }

  if (filters?.limit) {
    query = query.limit(filters.limit);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(entry => ({
    ...entry,
    bookings: entry.bookings,
    // Audit fields
    provider_name: 'You', // Or fetch profile name if needed, but 'You' is fine for provider view
    provider_type: entry.provider_type || (entry.payout_reference?.includes('-VEHICLE') ? 'Vehicle' : 'Unknown'),
    booking_ref: entry.bookings?.booking_reference || entry.booking_reference,
    gross_amount: entry.amount_gross,
    net_amount: entry.amount_net,
    paid_at: entry.paid_at,
    paid_by: entry.paid_by
  }));
};

export const getProviderPayoutSummary = async (providerId: string) => {
  const { data, error } = await supabase
    .from('payout_ledger')
    .select('status, amount_net, adjusted_amount, is_on_hold, withdrawal_request_status, booking_id, bookings!inner(status)')
    .eq('provider_id', providerId)
    .eq('bookings.status', 'completed');

  if (error) throw error;

  const summary = {
    available: 0,
    withdrawalRequested: 0,
    onHold: 0,
    paid: 0,
    pending: 0,
    totalPaidOut: 0
  };

  (data || []).forEach((p: any) => {
    const amt = p.adjusted_amount !== null && p.adjusted_amount !== undefined 
      ? Number(p.adjusted_amount) 
      : Number(p.amount_net || 0);

    if (p.is_on_hold) {
      summary.onHold += amt;
      return;
    }

    if (p.status === 'paid') {
      summary.paid += amt;
      summary.totalPaidOut += amt;
      return;
    }

    if (p.status === 'approved') {
      if (p.withdrawal_request_status && p.withdrawal_request_status !== 'rejected') {
        summary.withdrawalRequested += amt;
      } else if (!p.withdrawal_request_status) {
        summary.available += amt;
      }
      return;
    }

    if (p.status === 'pending') {
      summary.pending += amt;
    }
  });

  return summary;
};

export const getBookingPayoutForProvider = async (bookingId: string, providerId: string) => {
  const { data, error } = await supabase
    .from('payout_ledger')
    .select('*')
    .eq('booking_id', bookingId)
    .eq('provider_id', providerId)
    .maybeSingle();

  if (error) throw error;
  return data;
};

export async function updatePayoutStatus(id: string, status: 'approved' | 'paid', operatorId?: string) {
  return await updatePayoutLedgerStatus(id, status, operatorId);
}

export const getPayoutBatchDetail = async (batchId: string) => {
  // A. Fetch batch directly without nested profiles
  const { data: batch, error: batchError } = await supabase
    .from('payout_batches')
    .select('id, batch_ref, created_at, created_by, operator_id, total_amount, total_count, status, processed_at')
    .eq('id', batchId)
    .single();

  if (batchError) throw batchError;

  // B. Fetch created_by profile separately
  let created_by_name = 'Unknown User';
  if (batch.created_by) {
    const { data: pProfile } = await supabase
      .from('profiles')
      .select('full_name, company_name')
      .eq('id', batch.created_by)
      .single();
    if (pProfile) {
      created_by_name = pProfile.company_name || pProfile.full_name || 'Unknown User';
    }
  }

  // C. Fetch operator profile separately
  let operator_display_name = 'N/A';
  if (batch.operator_id) {
    const { data: oProfile } = await supabase
      .from('profiles')
      .select('full_name, company_name')
      .eq('id', batch.operator_id)
      .single();
    if (oProfile) {
      operator_display_name = oProfile.company_name || oProfile.full_name || 'N/A';
    }
  }

  // D. Enrich batch object
  const enrichedBatch = {
    ...batch,
    created_by_name,
    operator_display_name
  };

  const { data: payouts, error: payoutsError } = await supabase
    .from('payout_ledger')
    .select('*, bookings(booking_reference, start_date, tour_id, tours(title))')
    .eq('batch_id', batchId);

  if (payoutsError) throw payoutsError;

  const enrichedPayouts = await Promise.all((payouts || []).map(async (p: any) => {
    const { data: context } = await supabase.rpc('get_payout_statement_context', { p_payout_id: p.id });
    return {
      ...p,
      ...(context?.[0] || {})
    };
  }));

  return { batch: enrichedBatch, payouts: enrichedPayouts };
};

export const getPayoutBatchStats = async () => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

  const { count: todayCount, error: todayError } = await supabase
    .from('payout_batches')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', today);

  const { count: monthCount, error: monthError } = await supabase
    .from('payout_batches')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', startOfMonth);

  if (todayError || monthError) throw todayError || monthError;

  return { today: todayCount || 0, month: monthCount || 0 };
};

export const listPayoutBatches = async (filters?: { 
  status?: string; 
  operatorId?: string;
  reconciliationStatus?: string;
  startDate?: string;
  endDate?: string;
}) => {
  let query = supabase
    .from('payout_batches')
    .select('*')
    .order('created_at', { ascending: false });

  if (filters?.status && filters.status !== 'All') {
    query = query.eq('status', filters.status.toLowerCase());
  }
  
  if (filters?.reconciliationStatus && filters.reconciliationStatus !== 'All') {
    if (filters.reconciliationStatus.toLowerCase() === 'pending') {
      query = query.or('reconciliation_status.eq.pending,reconciliation_status.is.null');
    } else {
      query = query.eq('reconciliation_status', filters.reconciliationStatus.toLowerCase());
    }
  }

  if (filters?.operatorId) {
    query = query.eq('operator_id', filters.operatorId);
  }
  if (filters?.startDate) {
    query = query.gte('created_at', filters.startDate);
  }
  if (filters?.endDate) {
    query = query.lte('created_at', filters.endDate);
  }

  const { data: batches, error } = await query;
  if (error) {
    console.error('[listPayoutBatches] Error:', error);
    throw error;
  }

  if (!batches || batches.length === 0) return [];

  // Enrich with operator profiles
  const operatorIds = Array.from(new Set(batches.map(b => b.operator_id).filter(Boolean)));
  if (operatorIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, company_name, full_name')
      .in('id', operatorIds);
    
    const profileMap = (profiles || []).reduce((acc: any, p: any) => {
      acc[p.id] = p;
      return acc;
    }, {});

    // Fetch operator bank details
    const { data: bankDetails } = await supabase
      .from('operator_bank_details')
      .select('operator_id, bank_name, account_number')
      .in('operator_id', operatorIds);
    
    const bankMap = (bankDetails || []).reduce((acc: any, b: any) => {
      acc[b.operator_id] = b;
      return acc;
    }, {});

    // Fetch derived actual paid sum from ledger for each batch
    const { data: ledgerSums } = await supabase
      .from('payout_ledger')
      .select('batch_id, adjusted_amount, amount_net')
      .in('batch_id', batches.map(b => b.id))
      .eq('status', 'paid');

    const batchPaidMap = (ledgerSums || []).reduce((acc: any, p: any) => {
      const amount = p.adjusted_amount ?? p.amount_net ?? 0;
      acc[p.batch_id] = (acc[p.batch_id] || 0) + Number(amount);
      return acc;
    }, {});

    return batches.map(b => ({
      ...b,
      profiles: b.operator_id ? profileMap[b.operator_id] : null,
      operator_bank_details: b.operator_id ? bankMap[b.operator_id] : null,
      derived_actual_paid: batchPaidMap[b.id] || 0
    }));
  }

  return batches.map(b => ({ ...b, profiles: null, operator_bank_details: null, derived_actual_paid: 0 }));
};

export const updateBatchStatus = async (batchId: string, status: 'processing' | 'completed' | 'failed', userId: string) => {
  const updateData: any = {
    status,
    updated_at: new Date().toISOString()
  };

  if (status === 'completed') {
    updateData.processed_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from('payout_batches')
    .update(updateData)
    .eq('id', batchId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export interface PayoutValidationItem {
  id: string;
  providerName: string;
  bookingReference: string;
  amount: number;
  reason?: string | null;
}

export interface PayoutValidationResult {
  eligible: PayoutValidationItem[];
  blocked: PayoutValidationItem[];
  eligibleTotal: number;
  blockedTotal: number;
}

/**
 * Validates a list of payouts for processing by the Admin.
 * Identifies eligible and blocked payouts with reasons.
 * Does not modify any data.
 */
export async function validatePayoutsForProcessing(payoutIds: string[]): Promise<PayoutValidationResult> {
  if (!payoutIds || payoutIds.length === 0) {
    return { eligible: [], blocked: [], eligibleTotal: 0, blockedTotal: 0 };
  }

  // 1. Fetch payouts with context
  const { data: payouts, error: fetchError } = await supabase
    .from('payout_ledger')
    .select(`
      id, 
      amount_net, 
      adjusted_amount, 
      operator_id, 
      is_on_hold, 
      status, 
      withdrawal_request_status, 
      booking_id, 
      provider_id, 
      batch_id,
      archived_at,
      payout_reference,
      bookings (id, booking_reference),
      profiles:provider_id (id, full_name, company_name, role)
    `)
    .in('id', payoutIds);

  if (fetchError) throw fetchError;
  if (!payouts) throw new Error("Payouts not found during validation.");

  const result: PayoutValidationResult = {
    eligible: [],
    blocked: [],
    eligibleTotal: 0,
    blockedTotal: 0
  };

  const candidateEligible: any[] = [];

  // 2. Initial individual checks
  for (const p of payouts) {
    const amount = Number(p.adjusted_amount ?? p.amount_net ?? 0);
    const providerName = (p.profiles as any)?.company_name || (p.profiles as any)?.full_name || 'Unknown Provider';
    const bookingReference = (p.bookings as any)?.booking_reference || 'Unknown Booking';

    const item: PayoutValidationItem = {
      id: p.id,
      providerName,
      bookingReference,
      amount
    };

    // a. Basic state checks
    if (p.status === 'paid') {
      result.blocked.push({ ...item, reason: "Payout is already marked as paid." });
      result.blockedTotal += amount;
      continue;
    }
    if (p.batch_id) {
      result.blocked.push({ ...item, reason: "Payout is already assigned to a batch." });
      result.blockedTotal += amount;
      continue;
    }
    if (p.is_on_hold) {
      result.blocked.push({ ...item, reason: "Payout is currently on hold." });
      result.blockedTotal += amount;
      continue;
    }
    if (p.status === 'cancelled') {
        result.blocked.push({ ...item, reason: "Payout is cancelled." });
        result.blockedTotal += amount;
        continue;
    }
    if (p.archived_at) {
        result.blocked.push({ ...item, reason: "Payout is archived." });
        result.blockedTotal += amount;
        continue;
    }
    
    const isProcessableStatus = ['pending', 'approved'].includes((p.status || '').toLowerCase());
    if (!isProcessableStatus) {
        result.blocked.push({ ...item, reason: `Payout status is '${p.status}', which is not processable.` });
        result.blockedTotal += amount;
        continue;
    }

    const allowedWithdrawal = p.withdrawal_request_status === null || 
                             ['approved', 'requested', 'queued'].includes(p.withdrawal_request_status);
    if (!allowedWithdrawal) {
        result.blocked.push({ ...item, reason: `Withdrawal status is '${p.withdrawal_request_status}', which blocks processing.` });
        result.blockedTotal += amount;
        continue;
    }

    // b. Compliance and Bank Details
    if (!p.provider_id) {
       result.blocked.push({ ...item, reason: "Missing provider ID." });
       result.blockedTotal += amount;
       continue;
    }

    const profile = p.profiles as any;
    if (!profile) {
        result.blocked.push({ ...item, reason: "Provider profile not found." });
        result.blockedTotal += amount;
        continue;
    }

    const compliance = await checkComplianceGate({
      action: 'receive_payout',
      actorRole: profile.role as UserRole,
      actorUserId: p.provider_id
    });

    if (!compliance.allowed) {
        result.blocked.push({ ...item, reason: `Compliance check failed: ${compliance.message}` });
        result.blockedTotal += amount;
        continue;
    }

    const bankDetails = await getBankDetails(p.provider_id);
    const bankStatus = getBankStatus(bankDetails);
    
    if (bankStatus !== 'Complete' && bankStatus !== 'Updated recently') {
        result.blocked.push({ ...item, reason: `Provider bank details are ${bankStatus}.` });
        result.blockedTotal += amount;
        continue;
    }

    // If passed all individual checks, add to candidate list for escrow check
    candidateEligible.push(p);
  }

  // 3. Escrow checks (grouping by booking)
  if (candidateEligible.length > 0) {
    const bookingIds = Array.from(new Set(candidateEligible.map(p => p.booking_id).filter(Boolean)));
    
    const { data: bookings } = await supabase
      .from('bookings')
      .select('id, escrow_total, funds_held_amount, total_amount')
      .in('id', bookingIds);

    const { data: allPaidPayouts } = await supabase
      .from('payout_ledger')
      .select('booking_id, amount_net, adjusted_amount')
      .in('booking_id', bookingIds)
      .eq('status', 'paid');

    const bookingMap = (bookings || []).reduce((acc, b) => {
      acc[b.id] = b;
      return acc;
    }, {} as Record<string, any>);

    for (const bookingId of bookingIds) {
      const booking = bookingMap[bookingId];
      const selectedPayoutsForBooking = candidateEligible.filter(p => p.booking_id === bookingId);
      
      const alreadyPaidAmount = (allPaidPayouts || [])
        .filter(p => p.booking_id === bookingId)
        .reduce((sum, p) => sum + Number(p.adjusted_amount ?? p.amount_net ?? 0), 0);

      const totalEscrow = booking?.escrow_total || booking?.funds_held_amount || booking?.total_amount || 0;
      const remainingEscrow = totalEscrow - alreadyPaidAmount;
      const selectedAmountForBooking = selectedPayoutsForBooking
        .reduce((sum, p) => sum + Number(p.adjusted_amount ?? p.amount_net ?? 0), 0);

      if (totalEscrow <= 0 || remainingEscrow < selectedAmountForBooking) {
        // Block all payouts for this booking
        const reason = totalEscrow <= 0 
          ? "Funds have not been received into escrow for this booking." 
          : "Insufficient escrow remaining for this booking to cover all selected payouts.";
          
        for (const p of selectedPayoutsForBooking) {
          const amount = Number(p.adjusted_amount ?? p.amount_net ?? 0);
          const providerName = (p.profiles as any)?.company_name || (p.profiles as any)?.full_name || 'Unknown Provider';
          const bookingReference = (p.bookings as any)?.booking_reference || 'Unknown Booking';
          
          result.blocked.push({
            id: p.id,
            providerName,
            bookingReference,
            amount,
            reason
          });
          result.blockedTotal += amount;
        }
      } else {
        // All good for this booking
        for (const p of selectedPayoutsForBooking) {
          const amount = Number(p.adjusted_amount ?? p.amount_net ?? 0);
          const providerName = (p.profiles as any)?.company_name || (p.profiles as any)?.full_name || 'Unknown Provider';
          const bookingReference = (p.bookings as any)?.booking_reference || 'Unknown Booking';
          
          result.eligible.push({
            id: p.id,
            providerName,
            bookingReference,
            amount
          });
          result.eligibleTotal += amount;
        }
      }
    }
  }

  return result;
}

export const processPayouts = async (payoutIds: string[], userId: string) => {
  if (!userId) throw new Error('Missing actor id for payout batch processing.');

  // 1. Fetch selected payouts (Current state to avoid stale selection)
  const { data: payouts, error: fetchError } = await supabase
    .from('payout_ledger')
    .select('id, amount_net, adjusted_amount, operator_id, is_on_hold, status, withdrawal_request_status, booking_id, provider_id, batch_id, archived_at')
    .in('id', payoutIds);

  if (fetchError) throw fetchError;
  if (!payouts || payouts.length === 0) throw new Error("No payouts found to process.");

  // 2. Filter eligible payouts
  const eligiblePayouts = payouts.filter(p => {
    const isPaid = p.status === 'paid';
    const isBatched = !!p.batch_id;
    const isOnHold = p.is_on_hold;
    const isArchived = !!p.archived_at;
    const isProcessableStatus = ['pending', 'approved'].includes((p.status || '').toLowerCase());
    const allowedWithdrawal = p.withdrawal_request_status === null || 
                             ['approved', 'requested', 'queued'].includes(p.withdrawal_request_status);
    
    return !isPaid && !isBatched && !isOnHold && !isArchived && isProcessableStatus && allowedWithdrawal;
  });

  const skippedCount = payouts.length - eligiblePayouts.length;
  const eligiblePayoutIds = eligiblePayouts.map(p => p.id);
  
  if (eligiblePayouts.length === 0) {
    throw new Error("None of the selected payouts are eligible for processing (they may have been paid or placed on hold).");
  }

  // 2.5 Eligibility Check: Compliance and Bank Details
  for (const p of eligiblePayouts) {
    // Provider ID Check
    if (!p.provider_id) {
      throw new Error(`Payout ${p.id} eligibility error: Missing provider ID.`);
    }

    // Fetch provider profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', p.provider_id)
      .single();

    if (profileError || !profile) {
      throw new Error(`Provider profile not found for ID: ${p.provider_id}`);
    }

    // Compliance Gate Check
    const compliance = await checkComplianceGate({
      action: 'receive_payout',
      actorRole: profile.role as UserRole,
      actorUserId: p.provider_id
    });

    if (!compliance.allowed) {
      throw new Error(`Payout ${p.id} eligibility error: ${compliance.message}`);
    }

    // Bank Details Check
    const bankDetails = await getBankDetails(p.provider_id);
    const bankStatus = getBankStatus(bankDetails);
    
    if (bankStatus !== 'Complete' && bankStatus !== 'Updated recently') {
      throw new Error(`Payout ${p.id} eligibility error: Provider bank details are ${bankStatus}.`);
    }
  }

  // 3. Group by booking and check escrow eligibility
  const bookingIds = Array.from(new Set(eligiblePayouts.map(p => p.booking_id).filter(Boolean)));
  
  // Fetch bookings
  const { data: bookings } = await supabase
    .from('bookings')
    .select('id, escrow_status, escrow_total, escrow_held, escrow_released, funds_held_amount, funds_released_amount, total_amount')
    .in('id', bookingIds);

  // Fetch all already paid payouts for these bookings to calculate distributed escrow fairly
  const { data: allPaidPayouts } = await supabase
    .from('payout_ledger')
    .select('booking_id, amount_net, adjusted_amount')
    .in('booking_id', bookingIds)
    .eq('status', 'paid');

  const bookingMap = (bookings || []).reduce((acc, b) => {
    acc[b.id] = b;
    return acc;
  }, {} as Record<string, any>);

  for (const bookingId of bookingIds) {
    const booking = bookingMap[bookingId];
    if (!booking) continue;

    // Sum already paid for this booking from the ledger (Source of Truth)
    const alreadyPaidAmount = (allPaidPayouts || [])
      .filter(p => p.booking_id === bookingId)
      .reduce((sum, p) => sum + Number(p.adjusted_amount ?? p.amount_net ?? 0), 0);

    const totalEscrow = booking.escrow_total || booking.funds_held_amount || booking.total_amount || 0;
    const remainingEscrow = totalEscrow - alreadyPaidAmount;
    
    // Sum all payouts in this batch for this booking
    const selectedPayoutsForBooking = eligiblePayouts.filter(p => p.booking_id === bookingId);
    const selectedAmountForBooking = selectedPayoutsForBooking
      .reduce((sum, p) => sum + Number(p.adjusted_amount ?? p.amount_net ?? 0), 0);

    if (totalEscrow <= 0) {
      throw new Error(`Cannot process payout for booking ${bookingId}. Funds have not been received into escrow.`);
    }

    if (remainingEscrow < selectedAmountForBooking) {
      throw new Error(`Cannot process payout for booking ${bookingId}. Insufficient escrow remaining for this booking.`);
    }
  }

  // 4. Calculate totals
  const totalAmount = eligiblePayouts.reduce((sum, p) => {
    const payable = p.adjusted_amount !== null && p.adjusted_amount !== undefined 
      ? Number(p.adjusted_amount) 
      : Number(p.amount_net || 0);
    return sum + payable;
  }, 0);
  const operatorIds = Array.from(new Set(eligiblePayouts.map(p => p.operator_id)));
  const operatorId = operatorIds.length === 1 ? operatorIds[0] : null;

  // Generate batch reference: BATCH-YYYYMMDD-XXXX
  const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
  const batchRef = `BATCH-${dateStr}-${randomStr}`;

  // 5. Create batch in 'processing' state
  const { data: batch, error: batchError } = await supabase
    .from('payout_batches')
    .insert({
      batch_ref: batchRef,
      batch_reference: batchRef, // Keep for backward compatibility
      created_by: userId,
      operator_id: operatorId,
      total_amount: totalAmount,
      total_count: eligiblePayouts.length,
      status: 'processing',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .select('*')
    .single();

  if (batchError) throw batchError;

  try {
    // 6. Update payouts: link to batch and mark as paid
    const requestedIds = eligiblePayouts
      .filter(p => ['requested', 'approved'].includes(p.withdrawal_request_status || ''))
      .map(p => p.id);

    const { data: updatedPayouts, error } = await supabase
      .from('payout_ledger')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        paid_by: userId,
        batch_id: batch.id,
        updated_at: new Date().toISOString()
      })
      .in('id', eligiblePayoutIds)
      .select();

    if (error) throw error;

    // Update requested ones to 'paid'
    if (requestedIds.length > 0) {
      const { error: withdrawalError } = await supabase
        .from('payout_ledger')
        .update({ withdrawal_request_status: 'paid' })
        .in('id', requestedIds);
      
      if (withdrawalError) {
        console.error('[PayoutService] Failed to update withdrawal status:', withdrawalError);
      }
    }

    // 7. Mark batch as 'completed'
    await updateBatchStatus(batch.id, 'completed', userId);

    // 8. Log Batch Audit Event
    await logAuditEvent({
      action: 'batch_payout_completed',
      entityType: 'payout_batches',
      entityId: batch.id,
      actorId: userId,
      actorRole: 'admin',
      metadata: {
        batch_ref: batchRef,
        payout_count: eligiblePayouts.length,
        total_amount: totalAmount,
        operator_id: operatorId
      }
    });

    // Log audit events for each updated payout
    if (updatedPayouts) {
      await Promise.all(updatedPayouts.map(row => {
        const prev = eligiblePayouts.find(p => p.id === row.id);
        return logPayoutEvent({
          payout_id: row.id,
          booking_id: row.booking_id,
          provider_id: row.provider_id,
          event_type: 'paid',
          previous_state: prev,
          new_state: row,
          triggered_by: userId,
          triggered_role: 'admin'
        });
      }));

      // Notify Providers
      const providerIds = Array.from(new Set(updatedPayouts.map(p => p.provider_id).filter(Boolean)));
      for (const providerId of providerIds) {
        const providerPayouts = updatedPayouts.filter(p => p.provider_id === providerId);
        createNotification({
          user_id: providerId,
          type: 'PAYOUT_PAID',
          title: 'Payout(s) Paid',
          message: `${providerPayouts.length} payout(s) have been processed and paid.`,
          link: '/provider/earnings'
        }).catch(err => console.error('Failed to notify provider:', err));
      }

      // Notify Operator
      if (operatorId) {
        createNotification({
          user_id: operatorId,
          type: 'PAYOUTS_PROCESSED',
          title: 'Payouts Processed',
          message: `${updatedPayouts.length} payout(s) have been processed in batch ${batchRef}.`,
          link: '/operator/payouts'
        }).catch(err => console.error('Failed to notify operator:', err));
      }

      // Refresh escrow state for all affected bookings
      const bookingIds = Array.from(new Set(updatedPayouts.map(p => p.booking_id).filter(Boolean)));
      for (const bookingId of bookingIds) {
        try {
          await refreshBookingEscrowState(bookingId);
        } catch (escrowErr) {
          console.error('[PayoutPaid] escrow refresh failed', escrowErr);
          throw escrowErr; // Do NOT swallow escrow sync errors
        }
      }
    }

    // Notify Admins about batch creation
    const { data: admins } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'admin');

    if (admins) {
      for (const admin of admins) {
        createNotification({
          user_id: admin.id,
          type: 'BATCH_CREATED',
          title: 'New Payout Batch',
          message: `Batch ${batchRef} created with ${eligiblePayouts.length} payout(s).`,
          link: '/admin/payouts/batches'
        }).catch(err => console.error('Failed to notify admin:', err));
      }
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('PAYOUTS_UPDATED'));
    }

    return { batch: { ...batch, status: 'completed' }, payouts: updatedPayouts, skippedCount };
  } catch (err) {
    console.error('[processPayouts] Processing failed, marking batch as failed:', err);
    await updateBatchStatus(batch.id, 'failed', userId).catch(e => console.error('Failed to mark batch as failed:', e));
    throw err;
  }
};

export const listAllPayouts = async (filters?: { status?: string; withdrawalStatus?: string; startDate?: string; endDate?: string; includeArchived?: boolean }) => {
  let query = supabase
    .from('payout_ledger')
    .select('*, bookings(booking_reference, start_date, tour_id, tours(title))')
    .order('created_at', { ascending: false });

  if (filters?.status && filters.status !== 'All') {
    query = query.eq('status', filters.status.toLowerCase());
  }
  if (filters?.withdrawalStatus && filters.withdrawalStatus !== 'All') {
    if (filters.withdrawalStatus.toLowerCase() === 'none') {
      query = query.is('withdrawal_request_status', null);
    } else {
      query = query.eq('withdrawal_request_status', filters.withdrawalStatus.toLowerCase());
    }
  }
  if (filters?.startDate) query = query.gte('created_at', filters.startDate);
  if (filters?.endDate) query = query.lte('created_at', filters.endDate);

  const { data, error } = await query;
  if (error) {
    console.error('[listAllPayouts] Query error:', error);
    throw error;
  }
  if (!data) return [];

  // Helper to derive a synthetic batch reference based on existing UI/Migration logic
  const deriveBatchRefFromPayout = (p: any) => {
    const dateSource = p.paid_at || p.updated_at || p.created_at;
    if (!dateSource || !p.batch_id) return null;
    try {
      // Logic: BATCH-YYYYMMDD-XXXX (XXXX is first 4 chars of the linked batch UUID)
      const dateStr = new Date(dateSource).toISOString().split('T')[0].replace(/-/g, '');
      const suffix = p.batch_id.substring(0, 4).toUpperCase();
      return `BATCH-${dateStr}-${suffix}`;
    } catch (e) {
      return null;
    }
  };

  // 1. Extract all possible batch linkage keys from payout_ledger data
  const idKeys = new Set<string>();
  const refKeys = new Set<string>();
  
  data.forEach((p: any) => {
    if (p.batch_id) {
       // Heuristic: UUIDs are long and contain hyphens
       if (p.batch_id.length >= 36 && p.batch_id.includes('-')) {
         idKeys.add(p.batch_id);
         // Also add derived ref as a potential match for drifting IDs
         const derived = deriveBatchRefFromPayout(p);
         if (derived) refKeys.add(derived);
       } else {
         refKeys.add(p.batch_id);
       }
    }
    const row = p as any;
    if (row.payout_batch_id) idKeys.add(row.payout_batch_id);
    if (row.batch_ref) refKeys.add(row.batch_ref);
    if (row.batch_reference) refKeys.add(row.batch_reference);
  });
  
  const batchIds = Array.from(idKeys);
  const batchRefs = Array.from(refKeys);
  const providerIds = Array.from(new Set(data.map(p => p.provider_id).filter(Boolean)));
  const operatorIds = Array.from(new Set(data.map(p => p.operator_id).filter(Boolean)));
  
  const batchById: Record<string, any> = {};
  const batchByRef: Record<string, any> = {};
  let bankDetailsMap: Record<string, any> = {};
  let operatorBankMap: Record<string, any> = {};

  const [batchRes, bankRes, opBankRes] = await Promise.all([
    (batchIds.length > 0 || batchRefs.length > 0)
      ? (() => {
          const filters: string[] = [];
          if (batchIds.length > 0) filters.push(`id.in.(${batchIds.map(i => `"${i}"`).join(',')})`);
          if (batchRefs.length > 0) {
            const rStr = batchRefs.map(i => `"${i}"`).join(',');
            filters.push(`batch_ref.in.(${rStr})`);
            filters.push(`batch_reference.in.(${rStr})`);
          }
          return supabase
            .from('payout_batches')
            .select('id, batch_ref, batch_reference, created_at, processed_at, completed_at, status, operator_id, total_amount, total_count, payout_count')
            .or(filters.join(','));
        })()
      : Promise.resolve({ data: [] }),
    providerIds.length > 0 ? supabase
      .from('provider_bank_details')
      .select('provider_id, account_holder_name, bank_name, account_number, branch_code, is_verified, updated_at, provider_type')
      .in('provider_id', providerIds) : Promise.resolve({ data: [] }),
    operatorIds.length > 0 ? supabase
      .from('operator_bank_details')
      .select('operator_id, account_holder_name, bank_name, account_number, branch_code, updated_at')
      .in('operator_id', operatorIds) : Promise.resolve({ data: [] })
  ]);

  if (batchRes.data) {
    batchRes.data.forEach((b: any) => {
      if (b.id) batchById[b.id] = b;
      if (b.batch_ref) batchByRef[b.batch_ref] = b;
      if (b.batch_reference) batchByRef[b.batch_reference] = b;
    });
  }


  if (bankRes.data) {
    bankRes.data.forEach((bd: any) => {
      bankDetailsMap[bd.provider_id] = bd;
    });
  }

  if (opBankRes.data) {
    opBankRes.data.forEach((obd: any) => {
      operatorBankMap[obd.operator_id] = obd;
    });
  }

  return data.map(p => {
    const row = p as any;
    // Robust batch resolution using multiple potential linkage fields as priority
    let batchMetadata = 
      (p.batch_id && batchById[p.batch_id]) ||
      (row.payout_batch_id && batchById[row.payout_batch_id]) ||
      (row.batch_ref && batchByRef[row.batch_ref]) ||
      (row.batch_reference && batchByRef[row.batch_reference]) ||
      (p.batch_id && batchByRef[p.batch_id]) ||
      null;

    // NEW Fallback: If still null and paid, try synthetic derivation
    if (!batchMetadata && p.status === 'paid') {
      const derivedRef = deriveBatchRefFromPayout(p);
      if (derivedRef && batchByRef[derivedRef]) {
        batchMetadata = batchByRef[derivedRef];
      }
    }

    const batch = batchMetadata || row.payout_batches || row.payout_batch || row.batch || null;
    
    if (p.batch_id && !batch) {
      console.warn('[listAllPayouts] Batch not found in any map for key:', p.batch_id);
    }

    const bank = bankDetailsMap[p.provider_id] || null;
    const opBank = operatorBankMap[p.operator_id] || null;

    const rowData = {
      ...p,
      payout_batches: batch,
      bank_details: bank,
      operator_bank_details: opBank,
      // Audit fields
      provider_name: p.provider_display_name || 'Unknown Provider',
      provider_type: p.provider_type || bank?.provider_type || 'Unknown',
      booking_ref: p.bookings?.booking_reference || p.booking_reference,
      gross_amount: p.amount_gross,
      net_amount: p.amount_net,
      paid_at: p.paid_at,
      paid_by: p.paid_by
    };

    return rowData;
  });
};

/**
 * RECONCILIATION HELPERS (Read-only)
 */

export const reconcileBatch = async (params: {
  batchId: string;
  actualPaidTotal: number;
  notes?: string;
  userId: string;
}) => {
  const { batchId, actualPaidTotal, notes, userId } = params;

  // 1. Fetch batch to get expected total
  const { data: batch, error: fetchError } = await supabase
    .from('payout_batches')
    .select('total_amount')
    .eq('id', batchId)
    .single();

  if (fetchError || !batch) throw new Error("Batch not found");

  const expectedTotal = Number(batch.total_amount);
  const difference = actualPaidTotal - expectedTotal;
  const status = Math.abs(difference) < 0.01 ? 'matched' : 'mismatch';

  // 2. Update batch
  const updatePayload: any = {
      actual_paid: actualPaidTotal,
      reconciliation_status: status,
      reconciled_at: new Date().toISOString(),
      reconciled_by: userId,
      updated_at: new Date().toISOString()
    };
    if (notes) updatePayload.reconciliation_notes = notes;
    
  const { data, error } = await supabase
    .from('payout_batches')
    .update(updatePayload)                
    .eq('id', batchId)
    .select()
    .single();


  if (error) throw error;

  // 3. Audit Log
  await logAuditEvent({
    action: 'batch_reconciled',
    entityType: 'payout_batches',
    entityId: batchId,
    metadata: {
      status,
      actualPaidTotal,
      expectedTotal,
      difference,
      userId
    }
  });

  // 4. Notify Admins if mismatch
  if (status === 'mismatch') {
    const { data: admins } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'admin');

    if (admins) {
      for (const admin of admins) {
        createNotification({
          user_id: admin.id,
          type: 'RECONCILIATION_MISMATCH',
          title: 'Reconciliation Mismatch',
          message: `Batch ${data.batch_reference || batchId} has a mismatch of ${difference.toFixed(2)}.`,
          link: '/admin/payouts/batches'
        }).catch(err => console.error('Failed to notify admin:', err));
      }
    }
  }

  return data;
};

export const getPayoutFinanceReport = async (filters?: { startDate?: string; endDate?: string }) => {
  // 1. Lifetime Paid
  const { data: paidData } = await supabase
    .from('payout_ledger')
    .select('amount_net, adjusted_amount')
    .eq('status', 'paid');
  
  const lifetimePaid = paidData?.reduce((sum, p) => sum + Number(p.adjusted_amount ?? p.amount_net), 0) || 0;

  // 2. Pending Payouts (Ready)
  const { data: pendingData } = await supabase
    .from('payout_ledger')
    .select('amount_net, adjusted_amount')
    .eq('status', 'pending')
    .eq('is_on_hold', false);
  
  const totalPending = pendingData?.reduce((sum, p) => sum + Number(p.adjusted_amount ?? p.amount_net), 0) || 0;

  // 3. Total On Hold
  const { data: holdData } = await supabase
    .from('payout_ledger')
    .select('amount_net, adjusted_amount')
    .eq('is_on_hold', true);
  
  const totalOnHold = holdData?.reduce((sum, p) => sum + Number(p.adjusted_amount ?? p.amount_net), 0) || 0;

  // 4. Total Requested
  const { data: requestedData } = await supabase
    .from('payout_ledger')
    .select('amount_net, adjusted_amount, withdrawal_request_status')
    .in('withdrawal_request_status', ['requested', 'approved']);
  
  const totalRequested = requestedData?.reduce((sum, p) => sum + Number(p.adjusted_amount ?? p.amount_net), 0) || 0;
  const requestedCount = requestedData?.filter(p => p.withdrawal_request_status === 'requested').length || 0;

  // 5. Mismatched Batches
  const { data: allBatches } = await supabase
    .from('payout_batches')
    .select('id, total_amount, actual_paid');
    
  const { data: ledgerSums } = await supabase
    .from('payout_ledger')
    .select('batch_id, adjusted_amount, amount_net')
    .eq('status', 'paid');
    
  const batchPaidMap = (ledgerSums || []).reduce((acc: any, p: any) => {
    const amount = p.adjusted_amount ?? p.amount_net ?? 0;
    acc[p.batch_id] = (acc[p.batch_id] || 0) + Number(amount);
    return acc;
  }, {});

  const mismatchCount = (allBatches || []).filter(b => {
      const batchTotal = Number(b.total_amount || 0);
      const actualPaid = Number(b.actual_paid || 0);
      return Math.abs(batchTotal - actualPaid) > 0.01;
  }).length;

  return {
    lifetimePaid,
    totalPending,
    totalOnHold,
    totalRequested,
    requestedCount,
    mismatchCount
  };
};

export async function requestWithdrawal(payoutIds: string[], userId: string) {
  if (!payoutIds || payoutIds.length === 0) throw new Error("No payouts selected.");

  // 1. Fetch payouts to verify eligibility
  const { data: payouts, error: fetchError } = await supabase
    .from('payout_ledger')
    .select('id, status, is_on_hold, withdrawal_request_status, payout_reference, provider_id')
    .in('id', payoutIds);

  if (fetchError) throw fetchError;
  if (!payouts) throw new Error("Payouts not found.");

  // 2. Validate eligibility
  const providerIds = Array.from(new Set(payouts.map(p => p.provider_id).filter(Boolean)));
  for (const providerId of providerIds) {
    const bankDetails = await getBankDetails(providerId as string);
    const bankStatus = getBankStatus(bankDetails);
    
    if (bankStatus === 'Missing' || bankStatus === 'Incomplete') {
      throw new Error("Please complete your bank details before requesting withdrawal.");
    }
  }

  for (const p of payouts) {
    if (p.status !== 'approved') {
      throw new Error(`Payout ${p.payout_reference} is not approved.`);
    }
    if (p.is_on_hold) {
      throw new Error(`Payout ${p.payout_reference} is on hold.`);
    }
    if (p.withdrawal_request_status === 'requested' || p.withdrawal_request_status === 'approved') {
      throw new Error(`Withdrawal already requested for ${p.payout_reference}.`);
    }
    if (p.withdrawal_request_status === 'paid') {
      throw new Error(`Payout ${p.payout_reference} has already been processed.`);
    }
  }

  // 3. Update payouts using RPC
  const updatedRows = [];
  for (const payoutId of payoutIds) {
    const { data, error: rpcError } = await supabase.rpc('rpc_provider_request_withdrawal', { 
      p_payout_id: payoutId 
    });
    if (rpcError) throw rpcError;
    if (data) updatedRows.push(data);
  }

  if (updatedRows.length > 0) {
    // Log audit events for each updated payout
    await Promise.all(updatedRows.map(row => {
      const prev = payouts.find(p => p.id === row.id);
      return logPayoutEvent({
        payout_id: row.id,
        booking_id: row.booking_id,
        provider_id: row.provider_id,
        event_type: 'withdrawal_requested',
        previous_state: prev,
        new_state: row,
        triggered_by: userId,
        triggered_role: 'provider'
      });
    }));
  }

  // 4. Notifications
  // Notify Provider
  await createNotification({
    user_id: userId,
    type: 'WITHDRAWAL_REQUESTED',
    title: 'Withdrawal Requested',
    message: `Your withdrawal request for ${payoutIds.length} payout(s) has been submitted.`,
    link: '/provider/earnings'
  });

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('PAYOUTS_UPDATED'));
  }

  // Notify Admins
  /* 
  // Disabled due to RLS restrictions on providers creating notifications for admins.
  // Admins monitor requested withdrawals via the Payout Management dashboard.
  const { data: admins } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'admin');

  if (admins) {
    for (const admin of admins) {
      await createNotification({
        user_id: admin.id,
        type: 'NEW_WITHDRAWAL_REQUEST',
        title: 'New Withdrawal Request',
        message: `A provider has requested withdrawal for ${payoutIds.length} payout(s).`,
        link: '/admin/payouts'
      });
    }
  }
  */

  // 5. Audit Log
  await logAuditEvent({
    action: 'withdrawal_requested',
    entityType: 'payout_ledger',
    entityId: null,
    metadata: { 
      payout_ids: payoutIds,
      user_id: userId
    }
  });

  window.dispatchEvent(new CustomEvent('PAYOUTS_UPDATED'));
  return { success: true };
}

export async function approveWithdrawal(payoutIds: string[], userId: string) {
  if (!payoutIds || payoutIds.length === 0) throw new Error("No payouts selected.");

  const { data: payouts, error: fetchError } = await supabase
    .from('payout_ledger')
    .select('*')
    .in('id', payoutIds);

  if (fetchError) throw fetchError;
  if (!payouts) throw new Error("Payouts not found.");

  for (const p of payouts) {
    if (p.withdrawal_request_status !== 'requested') {
      throw new Error(`Payout ${p.payout_reference} is not in 'requested' state.`);
    }
  }

  const { data: updatedRows, error: updateError } = await supabase
    .from('payout_ledger')
    .update({
      withdrawal_request_status: 'approved',
      withdrawal_approved_at: new Date().toISOString(),
      withdrawal_processed_by: userId,
      updated_at: new Date().toISOString()
    })
    .in('id', payoutIds)
    .select('*, bookings(id)');

  if (updateError) throw updateError;

  if (updatedRows) {
    await Promise.all(updatedRows.map(row => {
      const prev = payouts.find(p => p.id === row.id);
      return logPayoutEvent({
        payout_id: row.id,
        booking_id: row.booking_id,
        provider_id: row.provider_id,
        event_type: 'withdrawal_approved',
        previous_state: prev,
        new_state: row,
        triggered_by: userId,
        triggered_role: 'admin'
      });
    }));

    // Notify Providers
    const providerIds = Array.from(new Set(updatedRows.map(p => p.provider_id).filter(Boolean)));
    for (const providerId of providerIds) {
      const providerPayouts = updatedRows.filter(p => p.provider_id === providerId);
      createNotification({
        user_id: providerId,
        type: 'WITHDRAWAL_APPROVED',
        title: 'Withdrawal Approved',
        message: `Your withdrawal request for ${providerPayouts.length} payout(s) has been approved.`,
        link: '/provider/earnings'
      }).catch(err => console.error('Failed to notify provider:', err));
    }
  }

  window.dispatchEvent(new CustomEvent('PAYOUTS_UPDATED'));
  return updatedRows;
}

export async function rejectWithdrawal(payoutIds: string[], userId: string, notes?: string) {
  if (!payoutIds || payoutIds.length === 0) throw new Error("No payouts selected.");

  const { data: payouts, error: fetchError } = await supabase
    .from('payout_ledger')
    .select('*')
    .in('id', payoutIds);

  if (fetchError) throw fetchError;
  if (!payouts) throw new Error("Payouts not found.");

  for (const p of payouts) {
    if (p.withdrawal_request_status !== 'requested') {
      throw new Error(`Payout ${p.payout_reference} is not in 'requested' state.`);
    }
  }

  const { data: updatedRows, error: updateError } = await supabase
    .from('payout_ledger')
    .update({
      withdrawal_request_status: 'rejected',
      withdrawal_rejected_at: new Date().toISOString(),
      withdrawal_processed_by: userId,
      withdrawal_notes: notes,
      updated_at: new Date().toISOString()
    })
    .in('id', payoutIds)
    .select('*, bookings(id)');

  if (updateError) throw updateError;

  if (updatedRows) {
    await Promise.all(updatedRows.map(row => {
      const prev = payouts.find(p => p.id === row.id);
      return logPayoutEvent({
        payout_id: row.id,
        booking_id: row.booking_id,
        provider_id: row.provider_id,
        event_type: 'withdrawal_rejected',
        previous_state: prev,
        new_state: row,
        triggered_by: userId,
        triggered_role: 'admin',
        notes
      });
    }));

    // Notify Providers
    const providerIds = Array.from(new Set(updatedRows.map(p => p.provider_id).filter(Boolean)));
    for (const providerId of providerIds) {
      const providerPayouts = updatedRows.filter(p => p.provider_id === providerId);
      createNotification({
        user_id: providerId,
        type: 'WITHDRAWAL_REJECTED',
        title: 'Withdrawal Rejected',
        message: `Your withdrawal request for ${providerPayouts.length} payout(s) has been rejected.`,
        link: '/provider/earnings'
      }).catch(err => console.error('Failed to notify provider:', err));
    }
  }

  window.dispatchEvent(new CustomEvent('PAYOUTS_UPDATED'));
  return updatedRows;
}

export const getReconciliationSummary = async (filters?: { startDate?: string; endDate?: string; operatorId?: string; includeArchived?: boolean }) => {
  // 1. Completed Bookings
  let bookingsQuery = supabase
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'completed');
  if (filters?.startDate) bookingsQuery = bookingsQuery.gte('start_date', filters.startDate);
  if (filters?.endDate) bookingsQuery = bookingsQuery.lte('start_date', filters.endDate);
  if (filters?.operatorId && filters.operatorId !== 'all') bookingsQuery = bookingsQuery.eq('operator_id', filters.operatorId);
  const { count: completedBookingsCount } = await bookingsQuery;

  // 2. Payout Status Totals
  let payoutsQuery = supabase
    .from('payout_ledger')
    .select('status, amount_net');
  if (filters?.operatorId && filters.operatorId !== 'all') payoutsQuery = payoutsQuery.eq('operator_id', filters.operatorId);
  const { data: payoutsData } = await payoutsQuery;

  const statusTotals = {
    pending: { count: 0, total: 0 },
    approved: { count: 0, total: 0 },
    paid: { count: 0, total: 0 }
  };

  payoutsData?.forEach(p => {
    const status = p.status as keyof typeof statusTotals;
    if (statusTotals[status]) {
      statusTotals[status].count++;
      statusTotals[status].total += Number(p.amount_net || 0);
    }
  });

  return {
    completedBookingsCount: completedBookingsCount || 0,
    statusTotals
  };
};

export const getMissingPayoutBookings = async (filters?: { startDate?: string; endDate?: string; operatorId?: string; includeArchived?: boolean }) => {
  // 1. Fetch completed bookings
  let bookingsQuery = supabase
    .from('bookings')
    .select('*, tours(title), profiles:operator_id(company_name, full_name)')
    .eq('status', 'completed');
  if (filters?.startDate) bookingsQuery = bookingsQuery.gte('start_date', filters.startDate);
  if (filters?.endDate) bookingsQuery = bookingsQuery.lte('start_date', filters.endDate);
  if (filters?.operatorId && filters.operatorId !== 'all') bookingsQuery = bookingsQuery.eq('operator_id', filters.operatorId);
  const { data: bookings } = await bookingsQuery;
  if (!bookings || bookings.length === 0) return [];

  // 2. Fetch all payout rows for these bookings
  const bookingIds = bookings.map(b => b.id);
  const { data: payouts } = await supabase
    .from('payout_ledger')
    .select('booking_id, id')
    .in('booking_id', bookingIds);

  // 3. Fetch all assignments for these bookings
  const { data: assignments } = await supabase
    .from('booking_assignments')
    .select('booking_id, resource_type, status')
    .in('booking_id', bookingIds)
    .in('status', ['accepted', 'completed'])
    .in('resource_type', ['driver', 'guide']);

  // 4. Map and identify missing
  const missing = bookings.map(b => {
    const actualRows = payouts?.filter(p => p.booking_id === b.id).length || 0;
    
    // Logic: 1 if has accepted/completed driver assignment, 1 if has accepted/completed guide assignment, 1 if booking.vehicle_id exists and has a rate
    let expectedRows = 0;
    const bookingAssignments = assignments?.filter(a => a.booking_id === b.id) || [];
    if (bookingAssignments.some(a => a.resource_type === 'driver')) expectedRows++;
    if (bookingAssignments.some(a => a.resource_type === 'guide')) expectedRows++;
    if (b.vehicle_id && Number(b.vehicle_rate_amount || 0) > 0) expectedRows++;

    return {
      ...b,
      expectedRows,
      actualRows,
      operator_name: (b.profiles as any)?.company_name || (b.profiles as any)?.full_name || 'Unknown'
    };
  }).filter(b => b.expectedRows !== b.actualRows);

  return missing;
};

export const getDuplicatePayoutRows = async (filters?: { operatorId?: string; includeArchived?: boolean }) => {
  let query = supabase
    .from('payout_ledger')
    .select('*, bookings(booking_reference), profiles:provider_id(full_name, company_name)');
  if (filters?.operatorId && filters.operatorId !== 'all') query = query.eq('operator_id', filters.operatorId);

  const { data: payouts } = await query;
  if (!payouts) return [];

  const groups: Record<string, any[]> = {};
  payouts.forEach(p => {
    const key = `${p.booking_id}_${p.provider_id}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(p);
  });

  const duplicates = Object.values(groups)
    .filter(group => group.length > 1)
    .map(group => ({
      booking_id: group[0].booking_id,
      booking_reference: group[0].bookings?.booking_reference || 'N/A',
      provider_name: group[0].profiles?.company_name || group[0].profiles?.full_name || 'Unknown',
      duplicateCount: group.length,
      payoutRefs: group.map(p => p.payout_reference).join(', '),
      statuses: group.map(p => p.status).join(', ')
    }));

  return duplicates;
};

export const getAdminFinancialSummary = async (filters: {
  startDate?: string;
  endDate?: string;
  operatorId?: string;
  includeArchived?: boolean;
}) => {
  // 1. Fetch bookings for revenue and platform fees
  let bookingsQuery = supabase
    .from('bookings')
    .select('id, total_amount, applied_platform_fee, tour_id, tours(title)')
    .not('status', 'eq', 'cancelled');

  if (filters.startDate) bookingsQuery = bookingsQuery.gte('start_date', filters.startDate);
  if (filters.endDate) bookingsQuery = bookingsQuery.lte('start_date', filters.endDate);
  if (filters.operatorId && filters.operatorId !== 'all') bookingsQuery = bookingsQuery.eq('operator_id', filters.operatorId);

  const { data: bookings } = await bookingsQuery;

  // 2. Fetch payout ledger for net, gross, and status
  let payoutsQuery = supabase
    .from('payout_ledger')
    .select('id, booking_id, amount_gross, platform_fee, amount_net, adjusted_amount, status, bookings!inner(start_date)');

  if (filters.startDate) payoutsQuery = payoutsQuery.gte('bookings.start_date', filters.startDate);
  if (filters.endDate) payoutsQuery = payoutsQuery.lte('bookings.start_date', filters.endDate);
  if (filters.operatorId && filters.operatorId !== 'all') payoutsQuery = payoutsQuery.eq('operator_id', filters.operatorId);

  const { data: payouts } = await payoutsQuery;

  const totalRevenue = (bookings || []).reduce((sum, b) => sum + Number(b.total_amount || 0), 0);
  // Platform Fee should come from the booking's applied_platform_fee field
  const totalPlatformFees = (bookings || []).reduce((sum, b) => sum + Number(b.applied_platform_fee || 0), 0);
  const totalPaidOut = (payouts || []).filter(p => p.status === 'paid').reduce((sum, p) => sum + Number(p.adjusted_amount ?? p.amount_net ?? 0), 0);
  const pendingLiability = (payouts || []).filter(p => p.status !== 'paid').reduce((sum, p) => sum + Number(p.adjusted_amount ?? p.amount_net ?? 0), 0);
  const totalProviderCosts = (payouts || []).reduce((sum, p) => sum + Number(p.amount_gross || 0), 0);

  const netMargin = totalRevenue - totalProviderCosts;
  const marginPercentage = totalRevenue > 0 ? (netMargin / totalRevenue) * 100 : 0;

  // Top Performing Tours
  const tourStats: Record<string, { title: string; revenue: number; costs: number }> = {};
  (bookings || []).forEach(b => {
    if (!b.tour_id) return;
    if (!tourStats[b.tour_id]) {
      tourStats[b.tour_id] = { title: (b.tours as any)?.title || 'Unknown Tour', revenue: 0, costs: 0 };
    }
    tourStats[b.tour_id].revenue += Number(b.total_amount || 0);
  });

  (payouts || []).forEach(p => {
    const booking = (bookings || []).find(b => b.id === p.booking_id);
    if (booking?.tour_id) {
      if (!tourStats[booking.tour_id]) {
        tourStats[booking.tour_id] = { title: (booking.tours as any)?.title || 'Unknown Tour', revenue: 0, costs: 0 };
      }
      tourStats[booking.tour_id].costs += Number(p.amount_gross || 0);
    }
  });

  const topTours = Object.entries(tourStats).map(([id, stats]) => ({
    tour_id: id,
    title: stats.title,
    revenue: stats.revenue,
    margin: stats.revenue - stats.costs
  })).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

  return {
    totalRevenue,
    totalPlatformFees,
    totalPaidOut,
    platformMargin: totalPlatformFees,
    pendingLiability,
    totalProviderCosts,
    netMargin,
    marginPercentage,
    topTours
  };
};

export const getOperatorFinancialSummary = async (operatorId: string, filters: {
  startDate?: string;
  endDate?: string;
  includeArchived?: boolean;
}) => {
  // 1. Fetch bookings for revenue
  let bookingsQuery = supabase
    .from('bookings')
    .select('id, total_amount')
    .eq('operator_id', operatorId)
    .not('status', 'eq', 'cancelled');

  if (filters.startDate) bookingsQuery = bookingsQuery.gte('start_date', filters.startDate);
  if (filters.endDate) bookingsQuery = bookingsQuery.lte('start_date', filters.endDate);

  const { data: bookings } = await bookingsQuery;

  // 2. Fetch payout ledger for costs
  let payoutsQuery = supabase
    .from('payout_ledger')
    .select('id, amount_gross, amount_net, adjusted_amount, platform_fee, bookings!inner(start_date)')
    .eq('operator_id', operatorId);

  if (filters.startDate) payoutsQuery = payoutsQuery.gte('bookings.start_date', filters.startDate);
  if (filters.endDate) payoutsQuery = payoutsQuery.lte('bookings.start_date', filters.endDate);

  const { data: payouts } = await payoutsQuery;

  const totalRevenue = (bookings || []).reduce((sum, b) => sum + Number(b.total_amount || 0), 0);
  
  // Provider costs should reflect adjustments. 
  // If a payout was adjusted down, the operator's cost for that booking is also reduced.
  const totalProviderCosts = (payouts || []).reduce((sum, p) => {
    const payableNet = p.adjusted_amount !== null && p.adjusted_amount !== undefined 
      ? Number(p.adjusted_amount) 
      : Number(p.amount_net || 0);
    
    // Gross cost = Net + Platform Fee
    const actualGross = payableNet + Number(p.platform_fee || 0);
    return sum + actualGross;
  }, 0);
  const netMargin = totalRevenue - totalProviderCosts;
  const marginPercentage = totalRevenue > 0 ? (netMargin / totalRevenue) * 100 : 0;

  return {
    totalRevenue,
    totalProviderCosts,
    netMargin,
    marginPercentage
  };
};

export const getBookingFinancialMismatches = async (filters?: { operatorId?: string; startDate?: string; endDate?: string }) => {
  let query = supabase
    .from('bookings')
    .select('*, tours(title), profiles:operator_id(company_name, full_name)')
    .eq('status', 'completed');

  if (filters?.operatorId && filters.operatorId !== 'all') query = query.eq('operator_id', filters.operatorId);
  if (filters?.startDate) query = query.gte('start_date', filters.startDate);
  if (filters?.endDate) query = query.lte('start_date', filters.endDate);

  const { data: bookings } = await query;
  if (!bookings) return [];

  const bookingIds = bookings.map(b => b.id);
  const { data: payouts } = await supabase
    .from('payout_ledger')
    .select('booking_id, original_amount, amount_net, adjusted_amount, status')
    .in('booking_id', bookingIds);

  const mismatches: any[] = [];
  
  const getFinalAmount = (p: any) =>
    p.adjusted_amount != null ? Number(p.adjusted_amount) :
    p.amount_net != null ? Number(p.amount_net) :
    p.original_amount != null ? Number(p.original_amount) :
    0;

  bookings.forEach(b => {
    const bookingPayouts = (payouts || []).filter(p => p.booking_id === b.id);
    const expectedTotal = bookingPayouts.reduce((sum, p) => sum + getFinalAmount(p), 0);
    const actualPaid = bookingPayouts
      .filter(p => p.status === 'paid')
      .reduce((sum, p) => sum + getFinalAmount(p), 0);
    const approvedTotal = bookingPayouts
      .filter(p => p.status === 'approved')
      .reduce((sum, p) => sum + getFinalAmount(p), 0);

    let mismatchType = '';
    let difference = 0;

    // 1. ESCROW_SYNC_MISMATCH
    if (Math.abs((b.funds_released_amount || 0) - actualPaid) > 0.01 || Math.abs((b.escrow_released || 0) - actualPaid) > 0.01) {
      if (Math.abs(expectedTotal - actualPaid) > 0.01) {
        mismatchType = 'Escrow Sync';
        difference = Math.abs((b.funds_released_amount || 0) - actualPaid);
      }
    }
    // 2. PAYOUT_STATUS_GAP
    else if (b.status === 'completed' && bookingPayouts.length > 0) {
      const allPaid = bookingPayouts.every(p => p.status === 'paid');
      if (allPaid && (b.payment_status !== 'payout_completed' || b.escrow_status !== 'fully_released')) {
        mismatchType = 'Payout Status Gap';
        difference = 0;
      }
    }
    // 3. APPROVED_PAID_GAP
    else if (approvedTotal > 0 && (b.funds_released_amount > actualPaid || b.escrow_status === 'fully_released')) {
      mismatchType = 'Approved vs Paid';
      difference = approvedTotal;
    }

    if (mismatchType) {
      mismatches.push({
        id: `booking-${b.id}`,
        booking_id: b.id,
        booking_reference: b.booking_reference,
        operator_name: b.profiles?.company_name || b.profiles?.full_name || 'Unknown',
        expected_total: expectedTotal,
        actual_paid: actualPaid,
        approved_total: approvedTotal,
        booking_funds_released_amount: b.funds_released_amount || 0,
        booking_escrow_released: b.escrow_released || 0,
        mismatch_type: mismatchType,
        difference,
        currency: b.currency,
        isBookingMismatch: true
      });
    }
  });

  return mismatches;
};

export const getPayoutMathMismatches = async (filters?: { operatorId?: string; includeArchived?: boolean; startDate?: string; endDate?: string }) => {
  let query = supabase
    .from('payout_ledger')
    .select('*, bookings(booking_reference, start_date), profiles:provider_id(full_name, company_name)');
  
  if (filters?.operatorId && filters.operatorId !== 'all') query = query.eq('operator_id', filters.operatorId);
  // Note: We don't filter by start_date/end_date here directly on payout_ledger because it's usually filtered by booking date in this context
  
  const { data: payouts } = await query;
  if (!payouts) return [];

  const payoutMismatches = payouts.filter(p => {
    // Filter by booking date if provided
    if (filters?.startDate && p.bookings?.start_date < filters.startDate) return false;
    if (filters?.endDate && p.bookings?.start_date > filters.endDate) return false;

    const gross = Number(p.amount_gross || 0);
    const fee = Number(p.platform_fee || 0);
    const net = Number(p.amount_net || 0);
    const expectedNet = gross - fee;
    return Math.abs(net - expectedNet) > 0.01;
  }).map(p => ({
    ...p,
    expectedNet: Number(p.amount_gross || 0) - Number(p.platform_fee || 0),
    provider_name: p.profiles?.company_name || p.profiles?.full_name || 'Unknown',
    booking_reference: p.bookings?.booking_reference || 'N/A',
    mismatch_type: 'Math Error',
    isBookingMismatch: false
  }));

  const bookingMismatches = await getBookingFinancialMismatches(filters);

  return [...payoutMismatches, ...bookingMismatches];
};

export const raisePayoutDispute = async (payload: {
  payout_id: string;
  booking_id: string;
  provider_id: string;
  operator_id: string;
  reason: string;
  created_by: string;
}) => {
  // Check if payout is already paid
  const { data: payout } = await supabase
    .from('payout_ledger')
    .select('status')
    .eq('id', payload.payout_id)
    .single();
  
  if (payout?.status === 'paid') {
    throw new Error("Cannot create a dispute for a paid payout.");
  }

  // Check if an open dispute already exists
  const { data: existingDispute, error: existingDisputeError } = await supabase
    .from('payout_disputes')
    .select('id')
    .eq('payout_id', payload.payout_id)
    .eq('status', 'open')
    .maybeSingle();

  if (existingDisputeError) throw existingDisputeError;
  if (existingDispute) {
    throw new Error("An open dispute already exists for this payout.");
  }

  // 1. Insert into payout_disputes
  const { data: dispute, error: disputeError } = await supabase
    .from('payout_disputes')
    .insert({
      payout_id: payload.payout_id,
      booking_id: payload.booking_id,
      provider_id: payload.provider_id,
      operator_id: payload.operator_id,
      type: 'operator_dispute',
      reason: payload.reason,
      status: 'open',
      created_by: payload.created_by,
      created_at: new Date().toISOString()
    })
    .select()
    .single();

  if (disputeError) throw disputeError;

  // 2. Fetch current payout state to check hold date
  const { data: existingPayout } = await supabase
    .from('payout_ledger')
    .select('hold_at, payout_reference, amount_net')
    .eq('id', payload.payout_id)
    .single();

  // 3. Update the specific payout_ledger row to set is_on_hold = true
  const { error: ledgerError } = await supabase
    .from('payout_ledger')
    .update({
      is_on_hold: true,
      hold_reason: 'dispute',
      hold_at: existingPayout?.hold_at || new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', payload.payout_id);

  if (ledgerError) throw ledgerError;

  // 3. Log Audit Events
  await logPayoutEvent({
    payout_id: payload.payout_id,
    booking_id: payload.booking_id,
    provider_id: payload.provider_id,
    event_type: 'dispute_opened',
    new_state: dispute,
    triggered_by: payload.created_by,
    triggered_role: 'operator',
    notes: payload.reason
  });

  try {
    await logAuditEvent({
      action: 'dispute_created',
      entityType: 'payout_disputes',
      entityId: dispute.id,
      metadata: {
        payout_id: payload.payout_id,
        booking_id: payload.booking_id,
        provider_id: payload.provider_id,
        operator_id: payload.operator_id,
        amount: existingPayout?.amount_net || 0,
        reason: payload.reason,
        payout_reference: existingPayout?.payout_reference || payload.payout_id
      }
    });
  } catch (auditErr) {
    console.error('[raisePayoutDispute] Audit logging failed:', auditErr);
  }

  // 4. Trigger Notifications
  // Notify Admin
  const { data: admins } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'admin');

  if (admins) {
    for (const admin of admins) {
      await createNotification({
        user_id: admin.id,
        type: 'NEW_DISPUTE',
        title: 'New Payout Dispute',
        message: `Operator raised a dispute for payout ${existingPayout?.payout_reference || payload.payout_id}. Reason: ${payload.reason}`,
        link: `/admin/payouts/disputes`
      });
    }
  }

  // Notify Provider
  await createNotification({
    user_id: payload.provider_id,
    type: 'PAYOUT_DISPUTE_OPENED',
    title: 'Payout Dispute Opened',
    message: `A dispute has been raised by the operator for your payout ${existingPayout?.payout_reference || payload.payout_id}.`,
    link: '/dashboard' // Link to earnings or dashboard
  }).catch(err => console.error('Failed to notify provider of dispute:', err));

  return dispute;
}
