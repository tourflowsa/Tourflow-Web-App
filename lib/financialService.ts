
import { supabase } from './supabase';

export interface OperatorFinancialSummary {
  total_revenue: number;
  total_provider_cost: number;
  total_adjusted_payout_cost: number;
  total_platform_fees: number;
  original_margin: number;
  adjusted_margin: number;
  pending_payouts: number;
  on_hold_amount: number;
  dispute_adjustments: number;
  booking_count: number;
  negative_margin_count: number;
  low_margin_count: number;
  critical_issues_count: number;
  warning_issues_count: number;
}

export interface BookingFinancialRow {
  booking_id: string;
  booking_ref: string;
  revenue: number;
  original_provider_cost: number;
  adjusted_provider_cost: number;
  platform_fee: number;
  original_margin: number;
  adjusted_margin: number;
  pending_payout_amount: number;
  on_hold_amount: number;
  dispute_adjustment: number;
  status: string;
  negative_margin: boolean;
  low_margin: boolean;
  high_dispute_impact: boolean;
  financial_status: 'ok' | 'warning' | 'critical';
}

export interface ProviderBreakdown {
  provider_id: string;
  provider_name: string;
  provider_type: string;
  agreed_rate: number;
  payout_amount: number;
  payout_status: string;
  resolution_status?: string;
  is_disputed: boolean;
  adjustment_reason?: string;
}

export interface BookingFinancialBreakdown {
  booking_id: string;
  booking_ref: string;
  total_revenue: number;
  platform_fee: number;
  net_margin: number;
  total_provider_cost: number;
  escrow_amount: number;
  total_paid_out: number;
  outstanding_payout: number;
  dispute_amount: number;
  currency: string;
  providers: ProviderBreakdown[];
}

// Helper to resolve provider display name based on user requirements
export const resolveProviderName = (prof: any, type: string) => {
  return prof?.company_name || prof?.full_name || prof?.email || 'Unknown';
};

export const isDisputedLedger = (ledger: any) =>
  Boolean(ledger?.is_on_hold) &&
  String(ledger?.hold_reason || '').toLowerCase() === 'dispute';

/**
 * Re-calculates and persists the platform fee snapshot for a booking.
 * This should be called whenever total_amount changes or the booking status transitions.
 */
export const syncBookingPlatformFeeSnapshot = async (bookingId: string) => {
  try {
    // 1. Fetch booking and operator
    const { data: booking, error: bError } = await supabase
      .from('bookings')
      .select('id, operator_id, total_amount, applied_fee_percent')
      .eq('id', bookingId)
      .single();

    if (bError || !booking) return;

    // 2. Resolve effective fee tier
    const { feePercent } = await import('./feeService').then(m => m.resolveOperatorFee(booking.operator_id));

    // 3. Calculate based on total_amount
    const totalAmount = Number(booking.total_amount || 0);
    const platformFee = (totalAmount * feePercent) / 100;
    const netAmount = totalAmount - platformFee;

    // 4. Update booking
    const { error: upErr } = await supabase
      .from('bookings')
      .update({
        applied_fee_percent: feePercent,
        applied_platform_fee: platformFee,
        applied_net_amount: netAmount,
        updated_at: new Date().toISOString()
      })
      .eq('id', bookingId);

    if (upErr) {
      console.error(`[syncBookingPlatformFeeSnapshot] Error updating booking ${bookingId}:`, upErr);
    }
    
    return { feePercent, platformFee, netAmount };
  } catch (err) {
    console.error(`[syncBookingPlatformFeeSnapshot] Fatal error for booking ${bookingId}:`, err);
  }
};

/**
 * Builds the provider breakdown rows from assigned resources and booking cost snapshot.
 * This is the shared function for mapping providers to their financial data.
 */
export const getBookingProviderBreakdown = (
  booking: any, 
  assignments: any[], 
  vehicleOwner: any,
  ledgers: any[] = [],
  displayNamesMap: Map<string, string> = new Map()
): ProviderBreakdown[] => {
  const providers: ProviderBreakdown[] = [];

  // Track added provider IDs to avoid duplicates if multiple assignments exist
  const addedProviders = new Set<string>();

  // 1. Map Drivers and Guides from assignments
  const activeAssignments = assignments.filter(a =>
    !['removed', 'cancelled', 'rejected'].includes((a.status || '').toLowerCase())
  );

  // Driver(s)
  activeAssignments.filter(a => a.resource_type === 'driver').forEach(a => {
    const providerId = a.resource_id;
    const ledger = ledgers.find(l => l.provider_id === providerId && l.payout_reference?.includes('DRIVER'));
    const driverAmount = Number(a.cost_total ?? booking.internal_cost_driver ?? 0);
    
    const isDisputed = isDisputedLedger(ledger);
    let payoutStatus = ledger?.status || (a.status === 'accepted' ? 'pending' : a.status || 'pending');
    let resolutionStatus = '';

    // Enhanced status mapping logic
    if (isDisputed) {
      payoutStatus = 'disputed';
    } else if (ledger?.adjustment_reason) {
      const original = Number(ledger.original_amount || ledger.amount_net || 0);
      const adjusted = Number(ledger.adjusted_amount || 0);
      if (adjusted < original) {
        resolutionStatus = 'resolved_reduced';
      } else {
        resolutionStatus = 'resolved_approved';
      }

      // Priority: PAID > RESOLVED
      if (payoutStatus !== 'paid') {
        payoutStatus = resolutionStatus;
      }
    }

    providers.push({
      provider_id: providerId,
      provider_name: displayNamesMap.get(providerId) || resolveProviderName(a.profiles || a.profile, 'driver'),
      provider_type: 'Driver',
      agreed_rate: driverAmount,
      payout_amount: ledger ? Number(ledger.adjusted_amount !== null ? ledger.adjusted_amount : (ledger.amount_net || 0)) : driverAmount,
      payout_status: payoutStatus,
      resolution_status: resolutionStatus || undefined,
      is_disputed: isDisputed,
      adjustment_reason: ledger?.adjustment_reason
    });
    addedProviders.add(providerId);
  });

  // Guide(s)
  activeAssignments.filter(a => a.resource_type === 'guide').forEach(a => {
    const providerId = a.resource_id;
    const ledger = ledgers.find(l => l.provider_id === providerId && l.payout_reference?.includes('GUIDE'));
    const guideAmount = Number(a.cost_total ?? booking.internal_cost_guide ?? 0);
    
    const isDisputed = isDisputedLedger(ledger);
    let payoutStatus = ledger?.status || (a.status === 'accepted' ? 'pending' : a.status || 'pending');
    let resolutionStatus = '';

    // Enhanced status mapping logic
    if (isDisputed) {
      payoutStatus = 'disputed';
    } else if (ledger?.adjustment_reason) {
      const original = Number(ledger.original_amount || ledger.amount_net || 0);
      const adjusted = Number(ledger.adjusted_amount || 0);
      if (adjusted < original) {
        resolutionStatus = 'resolved_reduced';
      } else {
        resolutionStatus = 'resolved_approved';
      }

      // Priority: PAID > RESOLVED
      if (payoutStatus !== 'paid') {
        payoutStatus = resolutionStatus;
      }
    }

    providers.push({
      provider_id: providerId,
      provider_name: displayNamesMap.get(providerId) || resolveProviderName(a.profiles || a.profile, 'guide'),
      provider_type: 'Guide',
      agreed_rate: guideAmount,
      payout_amount: ledger ? Number(ledger.adjusted_amount !== null ? ledger.adjusted_amount : (ledger.amount_net || 0)) : guideAmount,
      payout_status: payoutStatus,
      resolution_status: resolutionStatus || undefined,
      is_disputed: isDisputed,
      adjustment_reason: ledger?.adjustment_reason
    });
    addedProviders.add(providerId);
  });

  // 3. Fleet Owner (from bookings.vehicle_id -> vehicles.owner_id)
  if (booking.vehicle_id) {
    const ownerProf = vehicleOwner?.owner || vehicleOwner || {};
    const ownerId = ownerProf.id || ownerProf.owner_id || booking.vehicle_id;
    
    const ledger = ledgers.find(l => l.provider_id === ownerId && l.payout_reference?.includes('VEHICLE'));
    
    const fleetAmount =
      Number(booking.internal_cost_vehicle || 0) ||
      Number(booking.vehicle_rate_amount || 0);
    
    // Avoid double adding if fleet owner is also the driver
    const existingFleet = providers.find(p => p.provider_type === 'Fleet');
    
    const isDisputed = isDisputedLedger(ledger);
    let payoutStatus = ledger?.status || 'pending';
    let resolutionStatus = '';

    // Enhanced status mapping logic
    if (isDisputed) {
      payoutStatus = 'disputed';
    } else if (ledger?.adjustment_reason) {
      const original = Number(ledger.original_amount || ledger.amount_net || 0);
      const adjusted = Number(ledger.adjusted_amount || 0);
      if (adjusted < original) {
        resolutionStatus = 'resolved_reduced';
      } else {
        resolutionStatus = 'resolved_approved';
      }

      // Priority: PAID > RESOLVED
      if (payoutStatus !== 'paid') {
        payoutStatus = resolutionStatus;
      }
    }

    if (!existingFleet) {
      providers.push({
        provider_id: ownerId,
        provider_name: displayNamesMap.get(ownerId) || resolveProviderName(ownerProf, 'fleet') || 'Fleet Owner',
        provider_type: 'Fleet',
        agreed_rate: fleetAmount,
        payout_amount: ledger ? Number(ledger.adjusted_amount !== null ? ledger.adjusted_amount : (ledger.amount_net || 0)) : fleetAmount,
        payout_status: payoutStatus,
        resolution_status: resolutionStatus || undefined,
        is_disputed: isDisputed,
        adjustment_reason: ledger?.adjustment_reason
      });
    }
  }

  return providers;
};

export const getBookingFinancialBreakdown = async (bookingId: string): Promise<BookingFinancialBreakdown> => {
  const { data, error } = await supabase.rpc('get_booking_financial_breakdown', {
    p_booking_id: bookingId
  });

  if (error) {
    console.error('Error fetching financial breakdown via RPC:', error);
    throw error;
  }

  return data as BookingFinancialBreakdown;
};

export const getOperatorFinancialSummary = async (
  operatorId: string,
  startDate?: string,
  endDate?: string
): Promise<OperatorFinancialSummary> => {
  const { data, error } = await supabase.rpc('get_operator_financial_summary', {
    p_operator_id: operatorId,
    p_start_date: startDate || null,
    p_end_date: endDate || null
  });

  if (error) throw error;
  
  return data as OperatorFinancialSummary;
};

export const getOperatorBookingFinancials = async (
  operatorId: string,
  startDate?: string,
  endDate?: string
): Promise<BookingFinancialRow[]> => {
  let query = supabase
    .from('operator_booking_financials')
    .select('*')
    .eq('operator_id', operatorId);

  if (startDate) {
    query = query.gte('start_date', startDate);
  }
  if (endDate) {
    query = query.lte('start_date', endDate);
  }

  const { data, error } = await query.order('revenue', { ascending: false });

  if (error) throw error;

  return data as BookingFinancialRow[];
};

export async function buildProviderBreakdown(bookingId: string) {
  // 1. Fetch booking (cost snapshot)
  const { data: booking } = await supabase
    .from('bookings')
    .select(`
      id,
      vehicle_id,
      internal_cost_driver,
      internal_cost_guide,
      internal_cost_vehicle,
      internal_cost_total
    `)
    .eq('id', bookingId)
    .single();

  // 2. Fetch assignments (driver + guide) - NO FILTERING
  const { data: assignments } = await supabase
    .from('booking_assignments')
    .select(`
      resource_id,
      resource_type,
      cost_total,
      profiles:resource_id(full_name, company_name)
    `)
    .eq('booking_id', bookingId);
  
  const assignmentsList = assignments || [];

  // 3. Fetch vehicle owner (fleet)
  let fleetOwnerId = null;
  let ownerProfile = null;
  if (booking?.vehicle_id) {
    const { data: vehicle } = await supabase
      .from('vehicles')
      .select(`
        owner_id,
        owner:profiles!vehicles_owner_id_fkey(id, full_name, company_name)
      `)
      .eq('id', booking.vehicle_id)
      .single();

    fleetOwnerId = vehicle?.owner_id;
    ownerProfile = (vehicle as any)?.owner;
  }

  // 4. Locate driver and guide
  const driver = assignmentsList.find(a => a.resource_type === 'driver');
  const guide = assignmentsList.find(a => a.resource_type === 'guide');

  // 5. Build rows explicitly
  const rows = [];

  if (driver) {
    rows.push({
      provider_id: driver.resource_id,
      provider_name:
        (driver.profiles as any)?.company_name ||
        (driver.profiles as any)?.full_name ||
        'Unknown',
      role: 'driver',
      agreed_rate: Number(driver.cost_total ?? booking?.internal_cost_driver ?? 0),
      payout_amount: Number(driver.cost_total ?? booking?.internal_cost_driver ?? 0),
      status: 'pending'
    });
  }

  if (guide) {
    rows.push({
      provider_id: guide.resource_id,
      provider_name:
        (guide.profiles as any)?.company_name ||
        (guide.profiles as any)?.full_name ||
        'Unknown',
      role: 'guide',
      agreed_rate: Number(guide.cost_total ?? booking?.internal_cost_guide ?? 0),
      payout_amount: Number(guide.cost_total ?? booking?.internal_cost_guide ?? 0),
      status: 'pending'
    });
  }

  // 6. Fleet logic but FIX name
  if (fleetOwnerId) {
    rows.push({
      provider_id: fleetOwnerId,
      provider_name:
        (ownerProfile as any)?.company_name ||
        (ownerProfile as any)?.full_name ||
        'Unknown',
      role: 'fleet',
      agreed_rate: booking?.internal_cost_vehicle || 0,
      payout_amount: booking?.internal_cost_vehicle || 0,
      status: 'pending'
    });
  }

  // 7. RETURN
  return {
    rows,
    total: Number(
      booking?.internal_cost_total ??
      rows.reduce((sum, row) => sum + Number(row.agreed_rate || 0), 0)
    )
  };
}

/**
 * Re-calculates and persists the internal cost snapshot for a booking.
 * This is called whenever a resource (driver, guide, vehicle) is assigned or removed.
 */
export const syncBookingFinancialSnapshot = async (bookingId: string) => {
  try {
    // 1. Fetch booking
    const { data: booking, error: bError } = await supabase
      .from('bookings')
      .select(`
        id, 
        start_date, 
        end_date, 
        total_amount, 
        vehicle_id, 
        vehicle_rate_amount, 
        vehicle_rate_type,
        internal_cost_driver,
        internal_cost_guide,
        internal_cost_vehicle,
        applied_fee_percent,
        applied_net_amount
      `)
      .eq('id', bookingId)
      .single();

    if (bError || !booking) return;

    // 2. Fetch active assignments
    const { data: assignmentsData, error: aError } = await supabase
      .from('booking_assignments')
      .select(`
        id,
        resource_id,
        resource_type,
        status,
        updated_at,
        rate_type,
        rate_amount,
        cost_total
      `)
      .eq('booking_id', bookingId);

    if (aError) {
      console.error(`[syncBookingFinancialSnapshot] Error fetching assignments:`, aError);
      return;
    }

    const rawAssignments = (assignmentsData || []).filter((a: any) => 
      ['pending', 'accepted', 'completed'].includes(String(a.status || '').toLowerCase())
    );

    // fetch profiles 
    const pIds = rawAssignments.map(a => a.resource_id).filter(Boolean);
    let profilesMap: Record<string, any> = {};
    if (pIds.length > 0) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, default_day_rate, default_hour_rate')
        .in('id', pIds);
      if (profs) {
        profilesMap = profs.reduce((acc, p) => ({ ...acc, [p.id]: p }), {});
      }
    }

    const assignments = rawAssignments.map(a => ({
      ...a,
      profile: profilesMap[a.resource_id] || {}
    }));

    // 3. Calculate duration
    const start = new Date(booking.start_date);
    const end = new Date(booking.end_date);
    const ms = end.getTime() - start.getTime();
    
    // Use Math.max(1, ...) to ensure at least 1 unit if dates are same day
    const durationHours = Math.max(1, Math.ceil(ms / (1000 * 60 * 60)));
    const durationDays = Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24)));

    const calc = (amount: number, type: string) => {
      const amt = Number(amount) || 0;
      if (type === 'hour') return amt * durationHours;
      return amt * durationDays;
    };

    // Helper to get latest assignment for a type
    const getLatest = (type: string) => {
      const filtered = assignments.filter(a => a.resource_type === type);
      if (filtered.length === 0) return null;
      return filtered.sort((a, b) => {
        const tA = a.updated_at ? new Date(a.updated_at).getTime() : 0;
        const tB = b.updated_at ? new Date(b.updated_at).getTime() : 0;
        return tB - tA;
      })[0];
    };

    // 4. Map Costs
    const driver = getLatest('driver');
    const guide = getLatest('guide');

    const driverCost = driver
      ? Number(
          driver.cost_total ??
          calc(
            driver.rate_amount ??
              (driver.rate_type === 'hour'
                ? driver.profile?.default_hour_rate
                : driver.profile?.default_day_rate) ??
              0,
            driver.rate_type || 'day'
          )
        )
      : 0;

    const guideCost = guide
      ? Number(
          guide.cost_total ??
          calc(
            guide.rate_amount ??
              (guide.rate_type === 'hour'
                ? guide.profile?.default_hour_rate
                : guide.profile?.default_day_rate) ??
              0,
            guide.rate_type || 'day'
          )
        )
      : 0;

    const vehicleCost = booking.vehicle_id ? calc(booking.vehicle_rate_amount || 0, booking.vehicle_rate_type || 'day') : 0;

    const totalCost = driverCost + guideCost + vehicleCost;
    
    // Ensure we have current platform fee data for margin calculation
    const currentFeePercent = Number(booking.applied_fee_percent || 0);
    const totalAmount = Number(booking.total_amount || 0);
    
    // If snapshot is missing, try to resolve it now
    let netAmount = Number(booking.applied_net_amount);
    if (currentFeePercent === 0 && totalAmount > 0) {
      const snap = await syncBookingPlatformFeeSnapshot(bookingId);
      if (snap) netAmount = snap.netAmount;
    } else if (netAmount === 0 && totalAmount > 0) {
      netAmount = totalAmount - (totalAmount * currentFeePercent / 100);
    }

    const margin = (netAmount || totalAmount) - totalCost;

    // 5. Update Snapshot
    const { error: upErr } = await supabase
      .from('bookings')
      .update({
        internal_cost_driver: driverCost,
        internal_cost_guide: guideCost,
        internal_cost_vehicle: vehicleCost,
        internal_cost_total: totalCost,
        internal_margin: margin,
        updated_at: new Date().toISOString()
      })
      .eq('id', bookingId);

    if (upErr) {
      console.error(`[syncBookingFinancialSnapshot] Error updating booking ${bookingId}:`, upErr);
    }
  } catch (err) {
    console.error(`[syncBookingFinancialSnapshot] Fatal error for booking ${bookingId}:`, err);
  }
};
