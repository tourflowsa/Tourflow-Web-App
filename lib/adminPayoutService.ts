
import { supabase } from './supabase';
import { Payout } from '../types';
import { logAuditEvent } from './auditService';
import { createNotification } from './notificationService';
import { logPayoutEvent } from './payoutService';
import { refreshBookingEscrowState } from './escrowService';

export interface AdminPayoutStats {
  pendingCount: number;
  pendingTotal: number;
  paidCount: number;
  paidTotal: number;
}

export const getAdminPayoutStats = async (): Promise<AdminPayoutStats> => {
  const { data, error } = await supabase
    .from('payout_ledger')
    .select('status, amount_net, adjusted_amount');

  if (error) throw error;

  const stats = {
    pendingCount: 0,
    pendingTotal: 0,
    paidCount: 0,
    paidTotal: 0
  };

  data?.forEach((row: any) => {
    const amount = Number(row.adjusted_amount ?? row.amount_net) || 0;
    if (row.status === 'pending') {
      stats.pendingCount++;
      stats.pendingTotal += amount;
    } else if (row.status === 'paid') {
      stats.paidCount++;
      stats.paidTotal += amount;
    }
  });

  return stats;
};

export const listPayoutLedgerAdmin = async (filters: {
  status?: string;
  withdrawalStatus?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  includeArchived?: boolean;
}) => {
  let query = supabase
    .from('payout_ledger')
    .select('*')
    .order('created_at', { ascending: false });

  if (filters.status && filters.status !== 'all') {
    query = query.eq('status', filters.status);
  }

  if (filters.withdrawalStatus && filters.withdrawalStatus !== 'all') {
    query = query.eq('withdrawal_request_status', filters.withdrawalStatus);
  }

  if (filters.startDate) {
    query = query.gte('created_at', filters.startDate);
  }

  if (filters.endDate) {
    query = query.lte('created_at', filters.endDate);
  }

  if (filters.search) {
    query = query.ilike('payout_reference', `%${filters.search}%`);
  }

  if (!filters.includeArchived) {
    // query = query.is('archived_at', null); // Removed to prevent 400 errors
  }

  const { data, error } = await query;
  if (error) throw error;
  
  return (data || []).map((item: any) => ({
    id: item.id,
    operator_id: item.operator_id,
    provider_id: item.provider_id,
    booking_id: item.booking_id,
    payout_reference: item.payout_reference || 'N/A',
    status: item.status,
    currency: item.booking_currency || 'ZAR',
    amount_gross: item.amount_gross || 0,
    platform_fee: item.platform_fee || 0,
    amount_net: item.amount_net || 0,
    vat_amount: item.vat_amount || 0,
    vat_rate: item.vat_rate || 0,
    created_at: item.created_at,
    updated_at: item.updated_at,
    archived_at: item.archived_at,
    archived_by: item.archived_by,
    is_on_hold: item.is_on_hold || false,
    hold_reason: item.hold_reason,
    hold_at: item.hold_created_at,
    hold_created_by: item.hold_created_by,
    withdrawal_request_status: item.withdrawal_request_status,
    withdrawal_requested_at: item.withdrawal_requested_at,
    // Audit fields
    provider_name: item.provider_display_name || 'Unknown Provider',
    provider_type: item.provider_type || 'Unknown',
    booking_ref: item.booking_reference || item.booking_id,
    gross_amount: item.amount_gross || 0,
    net_amount: item.amount_net || 0,
    paid_at: item.paid_at,
    paid_by: item.paid_by
  })) as Payout[];
};

export const getPayoutLedgerByIdAdmin = async (id: string) => {
  const { data, error } = await supabase
    .from('payout_ledger')
    .select('*, bookings(booking_reference, start_date, tour_id, tours(title))')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Payout record not found.");

  // Fetch operator and provider profiles for names
  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, full_name, company_name')
    .in('id', [data.operator_id, data.provider_id]);

  let operatorDisplayName = 'Unknown Operator';
  let providerDisplayName = 'Unknown Provider';

  if (!profileError && profiles) {
    const opProfile = profiles.find(p => p.id === data.operator_id);
    const provProfile = profiles.find(p => p.id === data.provider_id);
    if (opProfile) operatorDisplayName = opProfile.company_name || opProfile.full_name || 'Unknown Operator';
    if (provProfile) providerDisplayName = provProfile.company_name || provProfile.full_name || 'Unknown Provider';
  }

  // Fallback for vehicle provider
  if (providerDisplayName === 'Unknown Provider' && data.provider_id) {
    const { data: vehicle } = await supabase
      .from('vehicles')
      .select('name, owner_id, profiles:owner_id(company_name, full_name)')
      .eq('id', data.provider_id)
      .maybeSingle();
    
    if (vehicle) {
      const ownerName = (vehicle as any).profiles?.company_name || (vehicle as any).profiles?.full_name || vehicle.name || 'Vehicle Provider';
      providerDisplayName = `${ownerName} (Vehicle)`;
    } else if (data.payout_reference?.includes('-VEHICLE')) {
      providerDisplayName = 'Vehicle Provider';
    }
  }
  
  return {
    id: data.id,
    operator_id: data.operator_id,
    provider_id: data.provider_id,
    booking_id: data.booking_id,
    payout_reference: data.payout_reference || 'N/A',
    status: data.status,
    currency: data.booking_currency || 'ZAR',
    amount_gross: data.amount_gross || 0,
    platform_fee: data.platform_fee || 0,
    amount_net: data.amount_net || 0,
    vat_amount: data.vat_amount || 0,
    vat_rate: data.vat_rate || 0,
    created_at: data.created_at,
    updated_at: data.updated_at,
    archived_at: data.archived_at,
    archived_by: data.archived_by,
    is_on_hold: data.is_on_hold || false,
    hold_reason: data.hold_reason,
    hold_created_at: data.hold_created_at,
    hold_created_by: data.hold_created_by,
    operator_display_name: operatorDisplayName,
    provider_display_name: providerDisplayName,
    tour_title: data.bookings?.tours?.title || 'Custom Tour',
    service_date: data.bookings?.start_date,
    bookings: data.bookings
  } as Payout;
};

export const placePayoutOnHold = async (payoutId: string, adminId: string, reason: string) => {
  // 1. Fetch payout_ledger row to get IDs for dispute
  const { data: payout, error: fetchError } = await supabase
    .from('payout_ledger')
    .select('*')
    .eq('id', payoutId)
    .maybeSingle();

  if (fetchError) throw fetchError;
  if (!payout) throw new Error("Payout record not found.");

  if (payout.status === 'paid') {
    throw new Error("Cannot place a paid payout on hold.");
  }

  // 2. Update the specific payout_ledger row
  const { data, error: updateError } = await supabase
    .from('payout_ledger')
    .update({
      is_on_hold: true,
      hold_reason: reason,
      hold_created_at: payout.hold_created_at || new Date().toISOString(),
      hold_created_by: adminId,
      hold_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', payoutId)
    .select()
    .single();

  if (updateError) throw updateError;

  // 3. Insert into payout_disputes
  const { error: disputeError } = await supabase
    .from('payout_disputes')
    .insert({
      payout_id: payoutId,
      booking_id: payout.booking_id,
      provider_id: payout.provider_id,
      operator_id: payout.operator_id,
      type: 'hold',
      reason: reason,
      status: 'open',
      created_by: adminId,
      created_at: new Date().toISOString()
    });

  if (disputeError) throw disputeError;

  if (data) {
    try {
      await logPayoutEvent({
        payout_id: payoutId,
        booking_id: payout.booking_id,
        provider_id: payout.provider_id,
        event_type: 'hold',
        previous_state: payout,
        new_state: data,
        triggered_by: adminId,
        triggered_role: 'admin',
        notes: reason
      });
    } catch (err) {
      console.error('[placePayoutOnHold] Payout event logging failed:', err);
    }
  }

  try {
    await logAuditEvent({
      action: 'payout_hold_placed',
      entityType: 'payout_ledger',
      entityId: payoutId,
      metadata: { reason, adminId }
    });
  } catch (auditErr) {
    console.error('[placePayoutOnHold] Audit logging failed:', auditErr);
  }

  // 4. Trigger Notification for Operator
  await createNotification({
    user_id: payout.operator_id,
    type: 'PAYOUT_HOLD',
    title: 'Payout placed on hold',
    message: `Payout ${payout.payout_reference || payoutId} has been placed on hold. Reason: ${reason}`,
    link: `/operator/payouts/${payoutId}`
  });

  // 5. Trigger Notification for Provider
  await createNotification({
    user_id: payout.provider_id,
    type: 'PAYOUT_HOLD',
    title: 'Payout placed on hold',
    message: `Your payout ${payout.payout_reference || payoutId} has been placed on hold.`,
    link: `/provider/earnings`
  });

  return data;
};

export const getPayoutEvents = async (payoutId: string) => {
  let data = null;
  const { data: eventsData, error } = await supabase
    .from('payout_events')
    .select('*')
    .eq('payout_id', payoutId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[AdminPayoutHistory] error fetching payout_events (table might not exist):', error);
    // Do not throw, proceed to fallback
  } else {
    data = eventsData;
  }

  // Fallback to audit_logs if no events found or error occurred
  if (!data || data.length === 0) {
    const { data: auditData, error: auditError } = await supabase
      .from('system_audit_log')
      .select('*')
      .eq('entity_id', payoutId)
      .eq('entity_type', 'payout_ledger')
      .order('created_at', { ascending: false });

    if (auditError) {
      console.error('[AdminPayoutHistory] error fetching system_audit_log:', auditError);
    } else if (auditData && auditData.length > 0) {
      return auditData.map(log => {
        let eventType = 'unknown';
        if (log.action === 'payout_created') eventType = 'created';
        if (log.action === 'payout_approved') eventType = 'approved';
        if (log.action === 'payout_paid') eventType = 'paid';
        if (log.action === 'payout_hold_placed') eventType = 'hold';
        if (log.action === 'payout_hold_released') eventType = 'released';
        if (log.action === 'withdrawal_requested') eventType = 'requested';
        
        return {
          id: log.id,
          payout_id: log.entity_id,
          event_type: eventType,
          created_at: log.created_at,
          triggered_by: log.actor_id,
          new_state: log.metadata,
          notes: log.metadata?.reason || log.metadata?.notes
        };
      });
    }

    // Final fallback: construct events from payout_ledger timestamps
    const { data: payoutData, error: payoutError } = await supabase
      .from('payout_ledger')
      .select('*')
      .eq('id', payoutId)
      .single();

    if (payoutError || !payoutData) {
      return [];
    }

    const constructedEvents = [];
    if (payoutData.created_at) {
      constructedEvents.push({ id: `created-${payoutId}`, payout_id: payoutId, event_type: 'created', created_at: payoutData.created_at });
    }
    if (payoutData.approved_at) {
      constructedEvents.push({ id: `approved-${payoutId}`, payout_id: payoutId, event_type: 'approved', created_at: payoutData.approved_at });
    }
    if (payoutData.withdrawal_requested_at) {
      constructedEvents.push({ id: `requested-${payoutId}`, payout_id: payoutId, event_type: 'requested', created_at: payoutData.withdrawal_requested_at });
    }
    if (payoutData.withdrawal_approved_at) {
      constructedEvents.push({ id: `withdrawal_approved-${payoutId}`, payout_id: payoutId, event_type: 'withdrawal_approved', created_at: payoutData.withdrawal_approved_at });
    }
    if (payoutData.hold_created_at) {
      constructedEvents.push({ id: `hold-${payoutId}`, payout_id: payoutId, event_type: 'hold', created_at: payoutData.hold_created_at, notes: payoutData.hold_reason, new_state: { hold_reason: payoutData.hold_reason } });
    }
    if (payoutData.paid_at) {
      constructedEvents.push({ id: `paid-${payoutId}`, payout_id: payoutId, event_type: 'paid', created_at: payoutData.paid_at });
    }

    constructedEvents.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return constructedEvents;
  }

  return data || [];
};

export const exportBatchToCSV = async (batchId: string) => {
  const { data: batchData } = await supabase
    .from('payout_batches')
    .select('batch_ref, batch_reference')
    .eq('id', batchId)
    .single();

  const batchRef = batchData?.batch_ref || batchData?.batch_reference || "";

  const { data: payouts, error } = await supabase
    .from('payout_ledger')
    .select('id, amount_gross, platform_fee, amount_net, original_amount, adjusted_amount, payout_reference, booking_id, provider_id, status, paid_at, paid_by')
    .eq('batch_id', batchId);

  if (error) throw error;
  if (!payouts || payouts.length === 0) throw new Error("No payouts found in this batch.");

  // Fetch profiles, bookings, and bank details separately
  const providerIds = Array.from(new Set(payouts.map(p => p.provider_id))).filter(Boolean);
  const bookingIds = Array.from(new Set(payouts.map(p => p.booking_id))).filter(Boolean);

  let profileMap: Record<string, any> = {};
  if (providerIds.length > 0) {
    const { data: profiles } = await supabase.from('profiles').select('id, full_name, company_name, role').in('id', providerIds);
    profiles?.forEach(p => profileMap[p.id] = p);
  }

  let bankMap: Record<string, any> = {};
  if (providerIds.length > 0) {
    const { data: banks } = await supabase.from('provider_bank_details').select('*').in('provider_id', providerIds);
    banks?.forEach(b => bankMap[b.provider_id] = b);
  }

  let bookingMap: Record<string, any> = {};
  if (bookingIds.length > 0) {
    const { data: bookings } = await supabase.from('bookings').select('id, booking_reference, start_date').in('id', bookingIds);
    bookings?.forEach(b => bookingMap[b.id] = b);
  }

  const headers = [
    "Account Holder",
    "Bank Name",
    "Account Number",
    "Account Type",
    "Branch Code",
    "Provider Name",
    "Provider Type",
    "Booking Ref",
    "Batch Ref",
    "Gross Amount",
    "Platform Fee",
    "Original Net",
    "Adjustment",
    "Final Settlement",
    "Status"
  ];

  const rows = payouts.map(p => {
    const profile = profileMap[p.provider_id] || {};
    const bank = bankMap[p.provider_id] || {};
    const booking = bookingMap[p.booking_id] || {};
    
    let type = profile.role;
    const ref = (p.payout_reference || '').toUpperCase();
    if (type === 'vehicle_owner' || type === 'vehicle') type = 'Vehicle';
    else if (type === 'driver') type = 'Driver';
    else if (type === 'guide') type = 'Guide';
    else if (ref.includes('VEHICLE')) type = 'Vehicle';
    else if (ref.includes('DRIVER')) type = 'Driver';
    else if (ref.includes('GUIDE')) type = 'Guide';
    else type = 'Unknown';
    
    const capStatus = (s: string) => {
      if (!s) return 'Unknown';
      if (s.toLowerCase() === 'on_hold') return 'On Hold';
      return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
    };
    
    const finalSettlement = 
      p.adjusted_amount != null ? Number(p.adjusted_amount) :
      p.amount_net != null ? Number(p.amount_net) :
      p.original_amount != null ? Number(p.original_amount) :
      0;
      
    const originalNet = 
      p.original_amount != null ? Number(p.original_amount) :
      p.amount_net != null ? Number(p.amount_net) :
      finalSettlement;
      
    const adjustment = originalNet - finalSettlement;

    const clean = (val: any) => `"${String(val ?? "").replace(/"/g, '""')}"`;

    return [
      clean(bank.account_holder_name || ""),
      clean(bank.bank_name || ""),
      clean(bank.account_number || ""),
      clean(bank.account_type || ""),
      clean(bank.branch_code || ""),
      clean(profile.company_name || profile.full_name || "Unknown"),
      clean(type),
      clean(booking.booking_reference || ""),
      clean(batchRef || ""),
      Number(p.amount_gross || 0).toFixed(2),
      Number(p.platform_fee || 0).toFixed(2),
      originalNet.toFixed(2),
      adjustment.toFixed(2),
      finalSettlement.toFixed(2),
      clean(capStatus(p.status))
    ].join(",");
  });

  return [headers.join(","), ...rows].join("\n");
};

export const releasePayoutHold = async (payoutId: string, adminId?: string) => {
  // Fetch current state for logging
  const { data: current } = await supabase
    .from('payout_ledger')
    .select('*')
    .eq('id', payoutId)
    .single();

  const { data, error } = await supabase
    .from('payout_ledger')
    .update({
      is_on_hold: false,
      hold_reason: null,
      hold_created_at: null,
      hold_created_by: null,
      released_at: new Date().toISOString(),
      released_by: adminId,
      updated_at: new Date().toISOString()
    })
    .eq('id', payoutId)
    .select()
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Payout record not found.");

  if (data) {
    try {
      await logPayoutEvent({
        payout_id: payoutId,
        booking_id: data.booking_id,
        provider_id: data.provider_id,
        event_type: 'released',
        previous_state: current,
        new_state: data,
        triggered_by: adminId,
        triggered_role: 'admin'
      });
    } catch (err) {
      console.error('[releasePayoutHold] Payout event logging failed:', err);
    }
  }

  try {
    await logAuditEvent({
      action: 'payout_hold_released',
      entityType: 'payout_ledger',
      entityId: payoutId,
      metadata: { payoutId }
    });
  } catch (auditErr) {
    console.error('[releasePayoutHold] Audit logging failed:', auditErr);
  }

  // Trigger Notification for Operator
  await createNotification({
    user_id: data.operator_id,
    type: 'PAYOUT_HOLD_RELEASED',
    title: 'Payout hold released',
    message: `The hold on payout ${data.payout_reference || payoutId} has been released.`,
    link: `/operator/payouts/${payoutId}`
  });

  // Trigger Notification for Provider
  await createNotification({
    user_id: data.provider_id,
    type: 'PAYOUT_HOLD_RELEASED',
    title: 'Payout hold released',
    message: `The hold on your payout ${data.payout_reference || payoutId} has been released.`,
    link: `/provider/earnings`
  });

  return data;
};

export const createPayoutDispute = async (dispute: any) => {
  // Check if payout is already paid
  if (dispute.payout_id) {
    const { data: payout } = await supabase
      .from('payout_ledger')
      .select('status')
      .eq('id', dispute.payout_id)
      .single();
    
    if (payout?.status === 'paid') {
      throw new Error("Cannot create a dispute for a paid payout.");
    }
  }

  const { data, error } = await supabase
    .from('payout_disputes')
    .insert(dispute)
    .select()
    .single();

  if (error) throw error;

  let existingPayout = null;

  // Hold the specific payout for this dispute
  if (dispute.payout_id) {
    // Fetch current payout state to check hold date
    const { data: payoutData } = await supabase
      .from('payout_ledger')
      .select('*')
      .eq('id', dispute.payout_id)
      .single();

    existingPayout = payoutData;

    const { data: updatedPayout, error: holdError } = await supabase
      .from('payout_ledger')
      .update({
        is_on_hold: true,
        status: 'on_hold',
        hold_reason: 'dispute',
        hold_created_at: existingPayout?.hold_created_at || new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', dispute.payout_id)
      .select()
      .single();
    
    if (holdError) console.error("Failed to apply payout hold:", holdError);

    if (updatedPayout) {
      await logPayoutEvent({
        payout_id: dispute.payout_id,
        booking_id: updatedPayout.booking_id,
        provider_id: updatedPayout.provider_id,
        event_type: 'dispute_opened',
        previous_state: existingPayout,
        new_state: updatedPayout,
        triggered_by: dispute.created_by,
        triggered_role: 'admin',
        notes: dispute.reason
      });
    }
  }

  await logAuditEvent({
    action: 'dispute_created',
    entityType: 'payout_disputes',
    entityId: data.id,
    metadata: { 
      payoutId: dispute.payout_id, 
      type: dispute.type,
      reason: dispute.reason,
      operator_id: dispute.operator_id,
      provider_id: dispute.provider_id,
      booking_id: dispute.booking_id,
      payout_reference: existingPayout?.payout_reference || dispute.payout_id
    }
  });

  // Notify Operator
  if (dispute.operator_id && existingPayout) {
    await createNotification({
      user_id: dispute.operator_id,
      type: 'NEW_DISPUTE',
      title: 'New Payout Dispute',
      message: `A dispute has been raised for payout ${existingPayout.payout_reference || dispute.payout_id}. Reason: ${dispute.reason}`,
      link: `/operator/payouts/${dispute.payout_id}`
    });
  }

  return data;
};

export const getActiveDisputeCount = async (): Promise<number> => {
  const { count, error } = await supabase
    .from('payout_disputes')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'open');

  if (error) {
    console.error('Error fetching dispute count:', error);
    return 0;
  }
  return count || 0;
};

export const getRequestedWithdrawalCount = async (): Promise<number> => {
  const { count, error } = await supabase
    .from('payout_ledger')
    .select('*', { count: 'exact', head: true })
    .eq('withdrawal_request_status', 'requested');

  if (error) {
    console.error('Error fetching requested withdrawal count:', error);
    return 0;
  }
  return count || 0;
};

export const resolvePayoutDispute = async (
  disputeId: string, 
  adminId: string, 
  resolution: string,
  action: 'FULL_RELEASE' | 'PARTIAL_RELEASE' | 'CANCEL' = 'FULL_RELEASE',
  adjustedAmount?: number
) => {
  const { data: dispute, error: disputeError } = await supabase
    .from('payout_disputes')
    .update({
      status: 'resolved',
      resolution,
      resolved_by: adminId,
      resolved_at: new Date().toISOString()
    })
    .eq('id', disputeId)
    .select()
    .single();

  if (disputeError) throw disputeError;

  let existingPayout = null;
  let updatedPayout = null;
  let outcome = 'unknown';

  // Release hold and apply adjustment for the specific payout related to this dispute
  if (dispute.payout_id) {
    const { data: payoutData } = await supabase
      .from('payout_ledger')
      .select('*')
      .eq('id', dispute.payout_id)
      .single();

    existingPayout = payoutData;

    if (!existingPayout) throw new Error("Payout record not found.");

    const originalAmt = existingPayout.original_amount || existingPayout.amount_net;
    let finalAdjustedAmount = originalAmt;
    let finalStatus = 'approved';

    if (action === 'PARTIAL_RELEASE') {
      if (adjustedAmount === undefined) throw new Error("Adjusted amount required for partial release");
      if (adjustedAmount > originalAmt) {
        throw new Error("Adjusted amount cannot exceed original amount");
      }
      finalAdjustedAmount = adjustedAmount;
    } else if (action === 'CANCEL') {
      finalAdjustedAmount = 0;
      finalStatus = 'cancelled';
    }

    // Determine resolution outcome for internal reference
    outcome = action === 'CANCEL' ? 'rejected' : (finalAdjustedAmount < originalAmt ? 'reduced' : 'approved');

    const { data: updated, error: payoutError } = await supabase
      .from('payout_ledger')
      .update({
        is_on_hold: false,
        status: finalStatus,
        adjusted_amount: finalAdjustedAmount,
        adjustment_reason: resolution,
        adjusted_by: adminId,
        adjusted_at: new Date().toISOString(),
        hold_reason: null,
        hold_created_at: null,
        hold_created_by: null,
        hold_at: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', dispute.payout_id)
      .select()
      .single();
    
    if (payoutError) throw payoutError;
    updatedPayout = updated;

    if (updatedPayout) {
      try {
        // 1. Log resolution event
        await logPayoutEvent({
          payout_id: dispute.payout_id,
          booking_id: updatedPayout.booking_id,
          provider_id: updatedPayout.provider_id,
          event_type: 'dispute_resolved',
          previous_state: existingPayout,
          new_state: { ...updatedPayout, resolution_outcome: outcome },
          triggered_by: adminId,
          triggered_role: 'admin',
          notes: resolution
        });

        // 2. Log adjustment event if amount changed
        const prevAmount = existingPayout.adjusted_amount || existingPayout.amount_net;
        if (Number(finalAdjustedAmount) !== Number(prevAmount)) {
          await logPayoutEvent({
            payout_id: dispute.payout_id,
            booking_id: updatedPayout.booking_id,
            provider_id: updatedPayout.provider_id,
            event_type: 'adjusted',
            previous_state: existingPayout,
            new_state: updatedPayout,
            triggered_by: adminId,
            triggered_role: 'admin',
            notes: `Adjusted from ${prevAmount} to ${finalAdjustedAmount}. Resolution: ${outcome.toUpperCase()}. Reason: ${resolution}`
          });
        }
      } catch (err) {
        console.error('[resolvePayoutDispute] Payout event logging failed:', err);
      }

      // 3. Refresh escrow state
      if (updatedPayout.booking_id) {
        await refreshBookingEscrowState(updatedPayout.booking_id);
      }
    }
  }

  try {
    await logAuditEvent({
      action: 'dispute_resolved',
      entityType: 'payout_disputes',
      entityId: disputeId,
      metadata: { 
        resolution, 
        adminId, 
        action, 
        adjustedAmount,
        outcome: outcome.toUpperCase(),
        original_amount: existingPayout?.original_amount || existingPayout?.amount_net,
        final_amount: updatedPayout?.adjusted_amount ?? updatedPayout?.amount_net,
        adjustment: (existingPayout?.original_amount || existingPayout?.amount_net || 0) - (updatedPayout?.adjusted_amount ?? updatedPayout?.amount_net ?? 0),
        payout_reference: updatedPayout?.payout_reference || existingPayout?.payout_reference
      }
    });
  } catch (auditErr) {
    console.error('[resolvePayoutDispute] Audit logging failed:', auditErr);
  }

  // Trigger Notifications
  if (dispute.payout_id && existingPayout) {
    const originalAmt = existingPayout.original_amount || existingPayout.amount_net || 0;
    const finalAmt = updatedPayout?.adjusted_amount ?? updatedPayout?.amount_net ?? 0;
    const adjustment = originalAmt - finalAmt;
    const isReduced = outcome === 'reduced';
    const currency = existingPayout.booking_currency || 'ZAR';

    let detailMsg = `The dispute for payout ${updatedPayout?.payout_reference || existingPayout.payout_reference} has been resolved. Outcome: ${outcome.toUpperCase()}.`;
    if (isReduced) {
      detailMsg += ` Payout was reduced by ${currency} ${adjustment.toFixed(2)}. Original: ${currency} ${originalAmt.toFixed(2)}, Final: ${currency} ${finalAmt.toFixed(2)}. Note: ${resolution}`;
    } else if (outcome === 'rejected') {
      detailMsg += ` Payout was cancelled. Note: ${resolution}`;
    } else {
      detailMsg += ` Payout was approved for the full original amount of ${currency} ${originalAmt.toFixed(2)}. Note: ${resolution}`;
    }

    // Notify Operator
    if (dispute.operator_id) {
      await createNotification({
        user_id: dispute.operator_id,
        type: 'DISPUTE_RESOLVED',
        title: 'Dispute Resolved',
        message: detailMsg,
        link: `/operator/payouts/${dispute.payout_id}`
      });
    }

    // Notify Provider
    if (dispute.provider_id) {
      let providerLink = '/dashboard';
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', dispute.provider_id)
        .single();
      
      if (profile?.role === 'guide') providerLink = '/guide/earnings';
      else if (profile?.role === 'driver') providerLink = '/driver/earnings';
      else if (profile?.role === 'vehicle_owner') providerLink = '/owner/earnings';

      await createNotification({
        user_id: dispute.provider_id,
        type: 'DISPUTE_RESOLVED',
        title: 'Dispute Resolved',
        message: detailMsg,
        link: providerLink
      });
    }
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('DISPUTE_UPDATED'));
  }

  return dispute;
};

export const listPayoutDisputes = async () => {
  const { data: disputes, error: disputesError } = await supabase
    .from('payout_disputes')
    .select('*')
    .order('created_at', { ascending: false });

  if (disputesError) throw disputesError;
  if (!disputes || disputes.length === 0) return [];

  const payoutIds = Array.from(new Set(disputes.map(d => d.payout_id).filter(Boolean)));
  const bookingIds = Array.from(new Set(disputes.map(d => d.booking_id).filter(Boolean)));

  const profileIds = Array.from(new Set([
    ...disputes.map(d => d.provider_id),
    ...disputes.map(d => d.operator_id),
    ...disputes.map(d => d.created_by),
    ...disputes.map(d => d.resolved_by)
  ].filter(Boolean)));

  const payoutSelect = `
    id,
    booking_id,
    provider_id,
    payout_reference,
    original_amount,
    amount_net,
    adjusted_amount,
    status,
    is_on_hold,
    hold_reason,
    adjustment_reason
  `;

  const [payoutsByIdRes, payoutsByBookingRes, bookingsRes, profilesRes] = await Promise.all([
    payoutIds.length > 0
      ? supabase.from('payout_ledger').select(payoutSelect).in('id', payoutIds)
      : Promise.resolve({ data: [], error: null }),

    bookingIds.length > 0
      ? supabase.from('payout_ledger').select(payoutSelect).in('booking_id', bookingIds)
      : Promise.resolve({ data: [], error: null }),

    bookingIds.length > 0
      ? supabase.from('bookings').select('id, booking_reference').in('id', bookingIds)
      : Promise.resolve({ data: [], error: null }),

    profileIds.length > 0
      ? supabase.from('profiles').select('id, full_name, company_name').in('id', profileIds)
      : Promise.resolve({ data: [], error: null })
  ]);

  if (payoutsByIdRes.error) throw payoutsByIdRes.error;
  if (payoutsByBookingRes.error) throw payoutsByBookingRes.error;
  if (bookingsRes.error) throw bookingsRes.error;
  if (profilesRes.error) throw profilesRes.error;

  const allPayouts = [
    ...(payoutsByIdRes.data || []),
    ...(payoutsByBookingRes.data || [])
  ];

  const dedupedPayouts = Array.from(
    new Map(allPayouts.map((p: any) => [p.id, p])).values()
  );

  const payoutsById = dedupedPayouts.reduce((acc: any, p: any) => {
    acc[p.id] = p;
    return acc;
  }, {});

  const payoutsByBookingProvider = dedupedPayouts.reduce((acc: any, p: any) => {
    if (p.booking_id && p.provider_id) {
      acc[`${p.booking_id}:${p.provider_id}`] = p;
    }
    return acc;
  }, {});

  const bookingsMap = (bookingsRes.data || []).reduce((acc: any, b: any) => {
    acc[b.id] = b;
    return acc;
  }, {});

  const profilesMap = (profilesRes.data || []).reduce((acc: any, p: any) => {
    acc[p.id] = p;
    return acc;
  }, {});

  return disputes.map((d: any) => {
    const payout =
      payoutsById[d.payout_id] ||
      payoutsByBookingProvider[`${d.booking_id}:${d.provider_id}`] ||
      null;

    return {
      ...d,
      payout,
      booking: bookingsMap[d.booking_id] || null,
      provider: profilesMap[d.provider_id] || null,
      operator: profilesMap[d.operator_id] || null,
      created_by_profile: profilesMap[d.created_by] || null,
      resolved_by_profile: profilesMap[d.resolved_by] || null
    };
  });
};

export const markPayoutAsPaidAdmin = async (id: string, adminId: string) => {
  // Check if on hold
  const { data: current } = await supabase
    .from('payout_ledger')
    .select('*')
    .eq('id', id)
    .single();

  if (current?.is_on_hold) {
    throw new Error("Cannot mark payout as paid while it is on hold.");
  }

  const { data, error } = await supabase
    .from('payout_ledger')
    .update({ 
      status: 'paid',
      paid_at: new Date().toISOString(),
      paid_by: adminId,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Update failed, no row updated");

  await logPayoutEvent({
    payout_id: id,
    booking_id: data.booking_id,
    provider_id: data.provider_id,
    event_type: 'paid',
    previous_state: current,
    new_state: data,
    triggered_by: adminId,
    triggered_role: 'admin'
  });

  // Refresh booking escrow state after payout is marked as paid
  if (data.booking_id) {
    await refreshBookingEscrowState(data.booking_id);
  }

  // Notify Provider
  if (data.provider_id) {
    await createNotification({
      user_id: data.provider_id,
      type: 'PAYOUT_PAID',
      title: 'Payout Paid',
      message: `Your payout ${data.payout_reference} has been paid.`,
      link: `/provider/earnings`
    });
  }

  // Notify Operator
  if (data.operator_id) {
    await createNotification({
      user_id: data.operator_id,
      type: 'PAYOUT_PAID',
      title: 'Payout Paid',
      message: `Payout ${data.payout_reference} has been paid.`,
      link: `/operator/payouts`
    });
  }

  return data as Payout;
};

export const archivePayoutAdmin = async (payoutId: string, adminId: string) => {
  const { data, error } = await supabase
    .from('payout_ledger')
    .update({ 
      archived_at: new Date().toISOString(),
      archived_by: adminId 
    })
    .eq('id', payoutId)
    .select()
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Payout record not found.");

  await logAuditEvent({
    action: 'payout_archived',
    entityType: 'payout_ledger',
    entityId: payoutId,
    metadata: { payout_reference: data.payout_reference, archived: true, archived_by: adminId, scope: 'admin' }
  });

  return data as Payout;
};

export const unarchivePayoutAdmin = async (payoutId: string) => {
  const { data, error } = await supabase
    .from('payout_ledger')
    .update({ archived_at: null, archived_by: null })
    .eq('id', payoutId)
    .select()
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Payout record not found.");

  await logAuditEvent({
    action: 'payout_unarchived',
    entityType: 'payout_ledger',
    entityId: payoutId,
    metadata: { payout_reference: data.payout_reference, archived: false }
  });

  return data as Payout;
};

export const exportToCsv = (data: any[]) => {
  if (!data || data.length === 0) return;

  const headers = [
    'ID', 'Reference', 'Operator', 'Provider', 'Provider Type', 
    'Account Holder', 'Bank Name', 'Account Number', 'Branch Code',
    'Booking Ref', 'Status', 'Currency', 'Net Amount', 'Created At'
  ];

  const csvRows = data.map(row => {
    const bank = row.bank_details || {};
    return [
      row.id, 
      row.payout_reference, 
      row.operator_display_name || row.operator_id, 
      row.provider_display_name || row.provider_id,
      row.provider_type || '',
      bank.account_holder_name || '',
      bank.bank_name || '',
      bank.account_number || '',
      bank.branch_code || '',
      row.booking_reference || row.booking_id, 
      row.status,
      row.currency, 
      row.amount_net,
      row.created_at
    ].map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(',');
  });

  const csvContent = [headers.join(','), ...csvRows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `admin_payouts_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const listOperators = async () => {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, company_name')
    .eq('role', 'operator')
    .order('company_name', { ascending: true });

  if (error) throw error;
  return data || [];
};
