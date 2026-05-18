import { supabase } from './supabase';
import { createNotification } from './notificationService';
import { Booking, VehicleAvailabilityRequest, DriverAvailabilityRequest, GuideAvailabilityRequest } from '../types';
import { logAuditEvent } from './auditService';
import { createPayoutLedgerForBooking, getPayoutLedgersForBooking, isBookingFinanciallyLocked } from './payoutService';
import { getCurrentAssignment } from './assignmentService';
import { syncBookingFinancialSnapshot, syncBookingPlatformFeeSnapshot } from './financialService';

export const createVehicleAvailabilityRequest = async (
  operatorId: string,
  vehicleId: string,
  startDate: string,
  endDate: string,
  rateType: 'day' | 'hour',
  notes: string | null
) => {
  const { data, error } = await supabase
    .from('vehicle_availability_requests')
    .insert({
      operator_id: operatorId,
      vehicle_id: vehicleId,
      start_date: startDate,
      end_date: endDate,
      rate_type: rateType,
      notes,
      status: 'pending'
    })
    .select()
    .single();

  if (error) throw error;

  // Notify Vehicle Owner
  const { data: vehicle } = await supabase
    .from('vehicles')
    .select('owner_id, make, model')
    .eq('id', vehicleId)
    .single();

  if (vehicle?.owner_id) {
    const { data: operator } = await supabase
      .from('profiles')
      .select('company_name, full_name')
      .eq('id', operatorId)
      .single();

    const operatorName = operator?.company_name || operator?.full_name || 'an operator';

    await createNotification({
      user_id: vehicle.owner_id,
      type: 'NEW_AVAILABILITY_REQUEST',
      title: 'New Vehicle Request',
      message: `You have a new availability request from ${operatorName} for your ${vehicle.make} ${vehicle.model}.`,
      link: '/fleet/requests'
    });
  }

  return data;
};

export const listVehicleAvailabilityRequestsForOperator = async (operatorId: string) => {
  const { data, error } = await supabase
    .from('vehicle_availability_requests')
    .select(`
      *,
      vehicles ( id, make, model, license_plate, owner_id )
    `)
    .eq('operator_id', operatorId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  // Hydrate profiles separately using RPC
  const ownerIds = Array.from(new Set(data.map(r => {
    const v = Array.isArray(r.vehicles) ? r.vehicles[0] : r.vehicles;
    return v?.owner_id;
  }).filter(Boolean)));
  
  const { data: profiles, error: profileError } = await supabase.rpc('get_public_profiles', { p_ids: ownerIds });

  if (profileError) {
    console.error('Failed to hydrate owner profiles:', profileError);
  }

  const profileMap = (profiles || []).reduce((acc: any, p: any) => ({ ...acc, [p.id]: p }), {} as Record<string, any>);

  return data.map(r => {
    const v = Array.isArray(r.vehicles) ? r.vehicles[0] : r.vehicles;
    return {
      ...r,
      profiles: v?.owner_id ? profileMap[v.owner_id] : null
    };
  }) as VehicleAvailabilityRequest[];
};

export const listVehicleAvailabilityRequestsForFleetOwner = async (ownerId: string) => {
  // 1. Get vehicles owned by this user
  const { data: ownedVehicles } = await supabase
    .from('vehicles')
    .select('id')
    .eq('owner_id', ownerId);
  
  const vehicleIds = (ownedVehicles || []).map(v => v.id);
  if (vehicleIds.length === 0) return [];

  // 2. Fetch requests for those vehicles
  const { data, error } = await supabase
    .from('vehicle_availability_requests')
    .select(`
      *,
      vehicles ( id, make, model, license_plate, owner_id )
    `)
    .in('vehicle_id', vehicleIds)
    .order('created_at', { ascending: false });

  if (error) throw error;

  // 3. Hydrate operator profiles separately using RPC
  const operatorIds = Array.from(new Set(data.map(r => r.operator_id)));
  const { data: profiles, error: profileError } = await supabase.rpc('get_public_profiles', { p_ids: operatorIds });

  if (profileError) {
    console.error('Failed to hydrate operator profiles:', profileError);
  }

  const profileMap = (profiles || []).reduce((acc: any, p: any) => ({ ...acc, [p.id]: p }), {} as Record<string, any>);

  return data.map(r => ({
    ...r,
    profiles: profileMap[r.operator_id]
  })) as VehicleAvailabilityRequest[];
};

export const acceptVehicleAvailabilityRequest = async (requestId: string, ownerId: string) => {
  const { data, error } = await supabase
    .from('vehicle_availability_requests')
    .update({
      status: 'accepted',
      responded_at: new Date().toISOString(),
      responded_by: ownerId
    })
    .eq('id', requestId)
    .select()
    .single();

  if (error) throw error;

  // Notify Operator
  await createNotification({
    user_id: data.operator_id,
    type: 'VEHICLE_REQUEST_ACCEPTED',
    title: 'Vehicle Request Accepted',
    message: `Vehicle request for booking ${data.converted_booking_id || ''} was accepted.`,
    link: data.converted_booking_id ? `/operator/bookings/${data.converted_booking_id}` : '/operator/requests'
  });

  if (data.converted_booking_id) {
    await checkBookingReadyForConfirmation(data.converted_booking_id);
  }

  return data;
};

export const declineVehicleAvailabilityRequest = async (requestId: string, ownerId: string) => {
  const { data, error } = await supabase
    .from('vehicle_availability_requests')
    .update({
      status: 'declined',
      responded_at: new Date().toISOString(),
      responded_by: ownerId
    })
    .eq('id', requestId)
    .select()
    .single();

  if (error) throw error;

  // Notify Operator
  await createNotification({
    user_id: data.operator_id,
    type: 'VEHICLE_REQUEST_DECLINED',
    title: 'Vehicle Request Declined',
    message: `Vehicle request was declined.`,
    link: '/operator/requests'
  });

  return data;
};

export const markVehicleRequestConverted = async (requestId: string, bookingId: string) => {
  const { data, error } = await supabase
    .from('vehicle_availability_requests')
    .update({
      converted_booking_id: bookingId
    })
    .eq('id', requestId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const convertAcceptedVehicleRequestToDraftBooking = async (
  requestId: string,
  tourId: string,
  numGuests: number,
  guestName: string,
  guestEmail: string,
  guestPhone?: string | null
) => {
  // 1. Fetch request to get dates and vehicle
  const { data: request, error: reqError } = await supabase
    .from('vehicle_availability_requests')
    .select('*')
    .eq('id', requestId)
    .single();

  if (reqError) throw reqError;
  if (!request) throw new Error('Request not found');
  if (request.status !== 'accepted') throw new Error('Request must be accepted to convert.');
  if (request.converted_booking_id) throw new Error('Request already converted.');

  // 2. Fetch tour for pricing and currency
  const { data: tour, error: tourError } = await supabase
    .from('tours')
    .select('*')
    .eq('id', tourId)
    .single();
  
  if (tourError) throw tourError;
  if (!tour) throw new Error('Tour not found');

  // 3. Calculate financials based on tour pricing
  const vatRate = tour.vat_rate || 0;
  const isInc = tour.is_price_including_vat;
  const basePrice = tour.price_amount * numGuests;

  let subtotal = 0;
  let vat = 0;
  let total = 0;

  if (isInc) {
    total = basePrice;
    subtotal = total / (1 + (vatRate / 100));
    vat = total - subtotal;
  } else {
    subtotal = basePrice;
    vat = subtotal * (vatRate / 100);
    total = subtotal + vat;
  }

  const ref = `BK-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
  
  // 4. Create draft booking
  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .insert({
      operator_id: request.operator_id,
      tour_id: tourId,
      booking_reference: ref,
      status: 'draft',
      start_date: request.start_date,
      end_date: request.end_date,
      num_guests: numGuests,
      guest_name: guestName,
      guest_email: guestEmail,
      guest_phone: guestPhone || null,
      currency: tour.currency,
      subtotal_amount: subtotal,
      vat_rate: vatRate,
      vat_amount: vat,
      total_amount: total,
      vehicle_rate_overridden: false,
      notes: 'Converted from availability request'
    })
    .select()
    .single();

  if (bookingError) throw bookingError;

  // Sync platform fee snapshot
  await syncBookingPlatformFeeSnapshot(booking.id);

  // 5. Resolve negotiated/default vehicle pricing
  const { effectiveRate } = await getEffectiveVehicleRateForBookingAssignment(
    request.operator_id,
    request.vehicle_id,
    request.rate_type
  );

  // 6. Immediately assign the requested vehicle to the booking using existing vehicle snapshot logic
  await updateBookingVehicleSnapshots(booking.id, request.operator_id, {
    vehicleId: request.vehicle_id,
    vehicleRateType: request.rate_type,
    vehicleRateAmount: effectiveRate,
    vehicleRateOverridden: false
  });

  // 7. Mark request converted
  await markVehicleRequestConverted(requestId, booking.id);
  
  return booking;
};

export const markDriverRequestConverted = async (requestId: string, bookingId: string) => {
  const { data, error } = await supabase
    .from('driver_availability_requests')
    .update({
      converted_booking_id: bookingId
    })
    .eq('id', requestId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const convertAcceptedDriverRequestToDraftBooking = async (
  requestId: string,
  tourId: string,
  numGuests: number,
  guestName: string,
  guestEmail: string,
  guestPhone?: string | null
) => {
  // 1. Fetch request to get dates and driver
  const { data: request, error: reqError } = await supabase
    .from('driver_availability_requests')
    .select('*')
    .eq('id', requestId)
    .single();

  if (reqError) throw reqError;
  if (!request) throw new Error('Request not found');
  if (request.status !== 'accepted') throw new Error('Request must be accepted to convert.');
  if (request.converted_booking_id) throw new Error('Request already converted.');

  // 2. Fetch tour for pricing and currency
  const { data: tour, error: tourError } = await supabase
    .from('tours')
    .select('*')
    .eq('id', tourId)
    .single();
  
  if (tourError) throw tourError;
  if (!tour) throw new Error('Tour not found');

  // 3. Calculate financials based on tour pricing
  const vatRate = tour.vat_rate || 0;
  const isInc = tour.is_price_including_vat;
  const basePrice = tour.price_amount * numGuests;

  let subtotal = 0;
  let vat = 0;
  let total = 0;

  if (isInc) {
    total = basePrice;
    subtotal = total / (1 + (vatRate / 100));
    vat = total - subtotal;
  } else {
    subtotal = basePrice;
    vat = subtotal * (vatRate / 100);
    total = subtotal + vat;
  }

  const ref = `BK-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
  
  // 4. Create draft booking
  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .insert({
      operator_id: request.operator_id,
      tour_id: tourId,
      booking_reference: ref,
      status: 'draft',
      start_date: request.start_date,
      end_date: request.end_date,
      num_guests: numGuests,
      guest_name: guestName,
      guest_email: guestEmail,
      guest_phone: guestPhone || null,
      currency: tour.currency,
      subtotal_amount: subtotal,
      vat_rate: vatRate,
      vat_amount: vat,
      total_amount: total,
      vehicle_rate_overridden: false,
      notes: 'Converted from driver availability request'
    })
    .select()
    .single();

  if (bookingError) throw bookingError;

  // Sync platform fee snapshot
  await syncBookingPlatformFeeSnapshot(booking.id);

  // 5. Assign the driver using existing assignment logic
  const { error: assignError } = await supabase.rpc('rpc_operator_assign_resource', {
    p_booking_id: booking.id,
    p_resource_id: request.driver_id,
    p_resource_type: 'driver',
    p_rate_overridden: false
  });

  if (assignError) throw assignError;

  // 6. Mark request converted
  await markDriverRequestConverted(requestId, booking.id);
  
  return booking;
};

export const markGuideRequestConverted = async (requestId: string, bookingId: string) => {
  const { data, error } = await supabase
    .from('guide_availability_requests')
    .update({
      converted_booking_id: bookingId
    })
    .eq('id', requestId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const convertAcceptedGuideRequestToDraftBooking = async (
  requestId: string,
  tourId: string,
  numGuests: number,
  guestName: string,
  guestEmail: string,
  guestPhone?: string | null
) => {
  // 1. Fetch request to get dates and guide
  const { data: request, error: reqError } = await supabase
    .from('guide_availability_requests')
    .select('*')
    .eq('id', requestId)
    .single();

  if (reqError) throw reqError;
  if (!request) throw new Error('Request not found');
  if (request.status !== 'accepted') throw new Error('Request must be accepted to convert.');
  if (request.converted_booking_id) throw new Error('Request already converted.');

  // 2. Fetch tour for pricing and currency
  const { data: tour, error: tourError } = await supabase
    .from('tours')
    .select('*')
    .eq('id', tourId)
    .single();
  
  if (tourError) throw tourError;
  if (!tour) throw new Error('Tour not found');

  // 3. Calculate financials based on tour pricing
  const vatRate = tour.vat_rate || 0;
  const isInc = tour.is_price_including_vat;
  const basePrice = tour.price_amount * numGuests;

  let subtotal = 0;
  let vat = 0;
  let total = 0;

  if (isInc) {
    total = basePrice;
    subtotal = total / (1 + (vatRate / 100));
    vat = total - subtotal;
  } else {
    subtotal = basePrice;
    vat = subtotal * (vatRate / 100);
    total = subtotal + vat;
  }

  const ref = `BK-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
  
  // 4. Create draft booking
  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .insert({
      operator_id: request.operator_id,
      tour_id: tourId,
      booking_reference: ref,
      status: 'draft',
      start_date: request.start_date,
      end_date: request.end_date,
      num_guests: numGuests,
      guest_name: guestName,
      guest_email: guestEmail,
      guest_phone: guestPhone || null,
      currency: tour.currency,
      subtotal_amount: subtotal,
      vat_rate: vatRate,
      vat_amount: vat,
      total_amount: total,
      vehicle_rate_overridden: false,
      notes: 'Converted from guide availability request'
    })
    .select()
    .single();

  if (bookingError) throw bookingError;

  // Sync platform fee snapshot
  await syncBookingPlatformFeeSnapshot(booking.id);

  // 5. Assign the guide using existing assignment logic
  // We need to import assignGuide from assignmentService, but to avoid circular dependencies,
  // we can just insert the assignment directly here or import it if safe.
  // Actually, we can just insert it directly into booking_assignments as pending.
  const { error: assignError } = await supabase.rpc('rpc_operator_assign_resource', {
    p_booking_id: booking.id,
    p_resource_id: request.guide_id,
    p_resource_type: 'guide',
    p_rate_overridden: false
  });

  if (assignError) throw assignError;

  // 6. Mark request converted
  await markGuideRequestConverted(requestId, booking.id);
  
  return booking;
};

/**
 * Fetch all bookings for a specific operator.
 * Ordered by start date descending (newest first).
 */
export const fetchBookingsForOperator = async (operatorId: string, includeArchived = false) => {
  let query = supabase
    .from('bookings')
    .select('*, tours(title, id, region), vehicles(make, model, license_plate)')
    .eq('operator_id', operatorId)
    .order('start_date', { ascending: false });
  
  if (includeArchived) {
    query = query.not('archived_at', 'is', null);
  } else {
    query = query.is('archived_at', null);
  }
  
  const { data, error } = await query;
  
  if (error) {
    console.error("Error fetching bookings:", error);
    throw error;
  }
  
  return data as Booking[];
};

/**
 * Fetch a single booking by ID and Operator ID.
 * Ensures data isolation by checking operator ownership.
 */
export const getBookingById = async (bookingId: string, operatorId: string) => {
  const { data, error } = await supabase
    .from('bookings')
    .select(`
      id,
      operator_id,
      tour_id,
      booking_reference,
      status,
      start_date,
      end_date,
      num_guests,
      guest_name,
      guest_email,
      currency,
      subtotal_amount,
      vat_rate,
      vat_amount,
      total_amount,
      vehicle_id,
      vehicle_rate_type,
      vehicle_rate_amount,
      vehicle_rate_overridden,
      internal_cost_vehicle,
      internal_cost_driver,
      internal_cost_guide,
      internal_cost_total,
      internal_margin,
      applied_fee_percent,
      applied_platform_fee,
      applied_net_amount,
      payment_status,
      funds_received_amount,
      funds_held_amount,
      funds_released_amount,
      funds_remaining_amount,
      payment_received_at,
      escrow_status,
      escrow_total,
      escrow_held,
      escrow_released,
      escrow_remaining,
      pickup_location,
      dropoff_location,
      special_requests,
      internal_notes,
      notes,
      guest_phone,
      archived_at,
      archived_by,
      created_at,
      updated_at,
      tours (
        title,
        id,
        region
      )
    `)
    .eq('id', bookingId)
    .eq('operator_id', operatorId)
    .single();

  if (error) {
    console.error(`Error fetching booking ${bookingId}:`, error);
    throw error;
  }

  const booking = data as any;
  if (booking && Array.isArray(booking.tours)) {
    booking.tours = booking.tours[0];
  }

  return booking as Booking;
};

/**
 * Allowed booking statuses in the database.
 */
const BOOKING_STATUS_VALUES = ['draft', 'pending', 'confirmed', 'assigned', 'in_progress', 'completed', 'cancelled', 'no_show'] as const;
type BookingStatusValue = typeof BOOKING_STATUS_VALUES[number];

/**
 * Normalizes and validates a booking status string.
 */
function normalizeBookingStatus(input: string): BookingStatusValue {
  const normalized = input.trim().toLowerCase();
  if (!BOOKING_STATUS_VALUES.includes(normalized as any)) {
    throw new Error(`Invalid booking status: ${input}`);
  }
  return normalized as BookingStatusValue;
}

/**
 * Update the status of a booking.
 * Only allows updating status, no other fields.
 */
export const updateBookingStatus = async (bookingId: string, newStatus: string, actorId?: string, source?: string) => {
  if (await isBookingFinanciallyLocked(bookingId)) {
    throw new Error("BOOKING_FINANCIALLY_LOCKED");
  }

  const normalizedStatus = normalizeBookingStatus(newStatus);

  const { error } = await supabase
    .from('bookings')
    .update({ status: normalizedStatus })
    .eq('id', bookingId);

  if (error) {
    console.error(`Error updating booking status ${bookingId}:`, error);
    throw error;
  }

  // Sync platform fee if status is confirmed or completed, or moved to assigned/in_progress
  if (['confirmed', 'assigned', 'in_progress', 'completed'].includes(normalizedStatus)) {
    await syncBookingPlatformFeeSnapshot(bookingId);
    try {
      const { refreshBookingEscrowState } = await import('./escrowService');
      await refreshBookingEscrowState(bookingId);
    } catch (e) {
      console.error('Failed to refresh escrow state for status update', e);
    }
  }
};

export async function completeBooking(bookingId: string) {
  // 1. Mark as completed in DB
  const { data, error } = await supabase.rpc('rpc_complete_booking', {
    p_booking_id: bookingId,
  });
  if (error) throw error;

  // Sync platform fee snapshot
  await syncBookingPlatformFeeSnapshot(bookingId);
  try {
    const { refreshBookingEscrowState } = await import('./escrowService');
    await refreshBookingEscrowState(bookingId);
  } catch (e) {}

  // 2. Create payout ledger entries
  await createPayoutLedgerForBooking(bookingId);

  // Notify Operator and Resources
  const { data: booking } = await supabase
    .from('bookings')
    .select('operator_id, booking_reference')
    .eq('id', bookingId)
    .single();

  if (booking) {
    await createNotification({
      user_id: booking.operator_id,
      type: 'BOOKING_COMPLETED',
      title: 'Booking Completed',
      message: `Booking ${booking.booking_reference} has been completed.`,
      link: `/operator/bookings/${bookingId}`
    });

    const { data: assignments } = await supabase
      .from('booking_assignments')
      .select('resource_id')
      .eq('booking_id', bookingId)
      .in('status', ['accepted', 'completed']);

    if (assignments) {
      for (const a of assignments) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', a.resource_id)
          .single();

        let earningsLink = '/dashboard';
        if (profile?.role === 'guide') earningsLink = '/guide/earnings';
        else if (profile?.role === 'driver') earningsLink = '/driver/earnings';
        else if (profile?.role === 'vehicle_owner') earningsLink = '/owner/earnings';

        await createNotification({
          user_id: a.resource_id,
          type: 'BOOKING_COMPLETED',
          title: 'Booking Completed',
          message: `Booking ${booking.booking_reference} has been completed.`,
          link: earningsLink
        });
      }
    }
  }

  return data;
}

export async function cancelBooking(bookingId: string, reason?: string) {
  const { data, error } = await supabase.rpc('rpc_cancel_booking', {
    p_booking_id: bookingId,
    p_reason: reason || null
  });
  if (error) throw error;
  return data;
}

export async function markBookingNoShow(bookingId: string, reason?: string) {
  const { data, error } = await supabase.rpc('rpc_mark_booking_no_show', {
    p_booking_id: bookingId,
    p_reason: reason || null
  });
  if (error) throw error;
  return data;
}

export async function markAssignmentNoShow(assignmentId: string, reason?: string) {
  try {
    const { data, error } = await supabase.rpc('rpc_mark_assignment_no_show', {
      p_assignment_id: assignmentId,
      p_reason: reason || null
    });
    if (error) throw error;
    return data;
  } catch (error: any) {
    const errMessage = (error.message || JSON.stringify(error)).toLowerCase();
    if (errMessage.includes('system_audit_log') || errMessage.includes('audit')) {
      console.warn('Audit log insert failed, but assignment no-show was processed.', error);
      return { success: true };
    }
    throw error;
  }
}

export async function archiveBookingRpc(bookingId: string) {
  const { data, error } = await supabase.rpc('rpc_archive_booking', {
    p_booking_id: bookingId,
  });
  if (error) throw error;
  return data;
}

export async function unarchiveBookingRpc(bookingId: string) {
  const { data, error } = await supabase.rpc('rpc_unarchive_booking', {
    p_booking_id: bookingId,
  });
  if (error) throw error;
  return data;
}

export type BookingVehicleSnapshotInput = {
  vehicleId: string | null;
  vehicleName?: string | null;
  vehicleRateType: 'day' | 'hour' | null;
  vehicleRateAmount: number | null;
  vehicleRateOverridden: boolean;
};

export const updateBookingVehicleSnapshots = async (
  bookingId: string,
  operatorId: string,
  input: BookingVehicleSnapshotInput
) => {
  // 1. Fetch current booking to see if vehicle is being removed
  const { data: currentBooking } = await supabase
    .from('bookings')
    .select('vehicle_id, booking_reference, status, start_date, end_date')
    .eq('id', bookingId)
    .single();

  // Prevent changes if payout is approved or paid
  if (currentBooking) {
    if (await isBookingFinanciallyLocked(bookingId)) {
      throw new Error("BOOKING_FINANCIALLY_LOCKED");
    }
    if (currentBooking.status === 'completed') {
      throw new Error("Cannot modify vehicle assignment for a completed booking.");
    }

    // VEHICLE AVAILABILITY GUARD
    if (input.vehicleId && input.vehicleId !== currentBooking.vehicle_id) {
      const isUnavailable = await checkVehicleConflicts(
        input.vehicleId,
        currentBooking.start_date,
        currentBooking.end_date,
        bookingId
      );
      if (isUnavailable) {
        throw new Error(`VEHICLE_CONFLICT: Vehicle cannot be assigned because it is already booked for this date range.`);
      }
    }

    const payouts = await getPayoutLedgersForBooking(bookingId);
    // Find vehicle payout (if any)
    // We need the vehicle owner_id to find the correct payout row
    if (currentBooking.vehicle_id) {
      const { data: vehicle } = await supabase
        .from('vehicles')
        .select('owner_id')
        .eq('id', currentBooking.vehicle_id)
        .single();
      
      if (vehicle?.owner_id) {
        const payout = payouts.find(p => p.provider_id === vehicle.owner_id);
        if (payout?.status === 'approved') {
          throw new Error("PAYOUT_APPROVED");
        }
        if (payout?.status === 'paid') {
          throw new Error("PAYOUT_PAID");
        }
      }
    }
  }

  const { data, error } = await supabase.rpc('rpc_operator_update_booking_vehicle', {
    p_booking_id: bookingId,
    p_vehicle_id: input.vehicleId,
    p_vehicle_rate_type: input.vehicleRateType,
    p_vehicle_rate_amount: input.vehicleRateAmount,
    p_vehicle_rate_overridden: input.vehicleRateOverridden ?? false
  });

  if (error) {
    console.error(`Error updating booking vehicle snapshots ${bookingId}:`, error);
    throw error;
  }

  // NOTE: Audit logging for vehicle assignment is now handled server-side within the `rpc_operator_update_booking_vehicle` RPC
  // to guarantee atomicity and avoid silent client failures or duplicate logging.

  // 3. Notify previous owner if vehicle was removed or changed

  if (currentBooking?.vehicle_id && currentBooking.vehicle_id !== input.vehicleId) {
    const { data: oldVehicle } = await supabase
      .from('vehicles')
      .select('owner_id')
      .eq('id', currentBooking.vehicle_id)
      .single();

    if (oldVehicle?.owner_id) {
      await createNotification({
        user_id: oldVehicle.owner_id,
        type: 'VEHICLE_REMOVED_FROM_BOOKING',
        title: 'Vehicle Removed from Booking',
        message: `Your vehicle has been removed from booking ${currentBooking.booking_reference || 'a booking'}.`,
        link: '/owner/vehicles'
      });
    }
  }

  // 4. Notify new owner if vehicle was assigned and it's different from current
  if (input.vehicleId && input.vehicleId !== currentBooking?.vehicle_id) {
    const { data: vehicle } = await supabase
      .from('vehicles')
      .select('owner_id')
      .eq('id', input.vehicleId)
      .single();

    if (vehicle?.owner_id) {
      await createNotification({
        user_id: vehicle.owner_id,
        type: 'VEHICLE_ASSIGNED_TO_BOOKING',
        title: 'Vehicle Assigned to Booking',
        message: `Your vehicle has been assigned to booking ${data.booking_reference || 'a booking'}.`,
        link: '/owner/vehicles'
      });
    }
  }

  // 5. Synchronize financial snapshot
  await syncBookingFinancialSnapshot(bookingId);

  return true;
};

export const updateBookingInternalCosts = async (
  bookingId: string,
  operatorId: string,
  costs: {
    vehicle: number;
    driver: number;
    guide: number;
    total: number;
    margin: number;
  }
) => {
  if (await isBookingFinanciallyLocked(bookingId)) {
    throw new Error("BOOKING_FINANCIALLY_LOCKED");
  }

  // 1. Fetch current booking to check status and payout locks
  const { data: booking } = await supabase
    .from('bookings')
    .select('status, vehicle_id, total_amount, applied_net_amount')
    .eq('id', bookingId)
    .single();

  if (booking?.status === 'completed') {
    throw new Error("Cannot modify costs for a completed booking.");
  }

  const payouts = await getPayoutLedgersForBooking(bookingId);
  const lockedPayouts = payouts.filter(p => p.status && p.status !== 'pending');

  if (lockedPayouts.length > 0) {
    // Check which costs are being changed and if they are locked
    const { data: currentCosts } = await supabase
      .from('bookings')
      .select('internal_cost_vehicle, internal_cost_driver, internal_cost_guide')
      .eq('id', bookingId)
      .single();

    if (currentCosts) {
      // Check Driver
      const driverPayout = payouts.find(p => p.payout_reference.includes('DRIVER') || p.payout_reference.includes('GUIDE')); // This is a bit loose, better to check by provider_id
      // Actually, let's just block the whole thing if ANY payout is locked, as it's safer for financial integrity.
      // Or more granularly:
      const { data: assignments } = await supabase
        .from('booking_assignments')
        .select('resource_id, resource_type')
        .eq('booking_id', bookingId)
        .in('status', ['accepted', 'completed']);

      const driverId = assignments?.find(a => a.resource_type === 'driver')?.resource_id;
      const guideId = assignments?.find(a => a.resource_type === 'guide')?.resource_id;

      if (driverId && payouts.find(p => p.provider_id === driverId && p.status !== 'pending')) {
        if (costs.driver !== currentCosts.internal_cost_driver) {
          const payout = payouts.find(p => p.provider_id === driverId);
          if (payout?.status === 'approved') throw new Error("PAYOUT_APPROVED");
          if (payout?.status === 'paid') throw new Error("PAYOUT_PAID");
          throw new Error("Cannot modify driver cost at this stage.");
        }
      }
      if (guideId && payouts.find(p => p.provider_id === guideId && p.status !== 'pending')) {
        if (costs.guide !== currentCosts.internal_cost_guide) {
          const payout = payouts.find(p => p.provider_id === guideId);
          if (payout?.status === 'approved') throw new Error("PAYOUT_APPROVED");
          if (payout?.status === 'paid') throw new Error("PAYOUT_PAID");
          throw new Error("Cannot modify guide cost at this stage.");
        }
      }
      // Vehicle
      if (booking?.vehicle_id) {
        const { data: vehicle } = await supabase
          .from('vehicles')
          .select('owner_id')
          .eq('id', booking?.vehicle_id)
          .single();
        if (vehicle?.owner_id && payouts.find(p => p.provider_id === vehicle.owner_id && p.status !== 'pending')) {
          if (costs.vehicle !== currentCosts.internal_cost_vehicle) {
            const payout = payouts.find(p => p.provider_id === vehicle.owner_id);
            if (payout?.status === 'approved') throw new Error("PAYOUT_APPROVED");
            if (payout?.status === 'paid') throw new Error("PAYOUT_PAID");
            throw new Error("Cannot modify vehicle cost at this stage.");
          }
        }
      }
    }
  }

  const total = costs.vehicle + costs.driver + costs.guide;
  const margin = Number(booking?.applied_net_amount || booking?.total_amount || 0) - total;

  const { error } = await supabase
    .from('bookings')
    .update({
      internal_cost_vehicle: costs.vehicle,
      internal_cost_driver: costs.driver,
      internal_cost_guide: costs.guide,
      internal_cost_total: total,
      internal_margin: margin,
      updated_at: new Date().toISOString()
    })
    .eq('id', bookingId);

  if (error) {
    console.error(`Error updating booking internal costs ${bookingId}:`, error);
    throw error;
  }

  await logAuditEvent({
    action: 'BOOKING_INTERNAL_COSTS_UPDATED',
    entityType: 'booking',
    entityId: bookingId,
    metadata: {
      costs
    }
  });

  return true;
};

/**
 * Resolves the effective rate for a vehicle assignment based on negotiated rates or defaults.
 */
export const getEffectiveVehicleRateForBookingAssignment = async (
  operatorId: string,
  vehicleId: string,
  rateType: 'day' | 'hour'
): Promise<{ effectiveRate: number; negotiated: boolean; source: 'negotiated' | 'default' }> => {
  // 1. Check operator_vehicle_links
  const { data: link } = await supabase
    .from('operator_vehicle_links')
    .select('status, rate_status, owner_counter_day_rate, owner_counter_hour_rate, operator_proposed_day_rate, operator_proposed_hour_rate')
    .eq('operator_id', operatorId)
    .eq('vehicle_id', vehicleId)
    .eq('status', 'approved')
    .maybeSingle();

  if (link && link.rate_status === 'accepted') {
    // Owner counter takes precedence if accepted, otherwise fallback to proposal
    const counterRate = rateType === 'day' ? link.owner_counter_day_rate : link.owner_counter_hour_rate;
    const proposedRate = rateType === 'day' ? link.operator_proposed_day_rate : link.operator_proposed_hour_rate;
    const finalNegotiated = counterRate ?? proposedRate;

    if (finalNegotiated != null) {
      return { effectiveRate: Number(finalNegotiated), negotiated: true, source: 'negotiated' };
    }
  }

  // 2. Fallback to vehicle defaults
  const { data: vehicle } = await supabase
    .from('vehicles')
    .select('default_day_rate, default_hour_rate')
    .eq('id', vehicleId)
    .single();

  const defaultRate = rateType === 'day' ? vehicle?.default_day_rate : vehicle?.default_hour_rate;

  return {
    effectiveRate: Number(defaultRate || 0),
    negotiated: false,
    source: 'default'
  };
};

/**
 * Computes weekly statistics from a list of bookings on the client side.
 * Filters for the current week (Monday to Sunday) based on local time.
 */
export const computeWeeklyStats = (bookings: Booking[]): WeeklyStats => {
  const now = new Date();
  const day = now.getDay(); // 0 (Sun) to 6 (Sat)
  
  // Calculate days to subtract to get to the previous Monday
  const diffToMonday = day === 0 ? 6 : day - 1; 
  
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - diffToMonday);
  weekStart.setHours(0, 0, 0, 0);
  
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7); // Next Monday 00:00

  const stats: WeeklyStats = {
    confirmed: 0,
    completed: 0,
    cancelled: 0,
  };

  bookings.forEach(booking => {
    if (booking.archived_at) return;
    
    if (!booking.start_date) return;
    const startDate = new Date(booking.start_date);

    if (startDate >= weekStart && startDate < weekEnd) {
       if (booking.status === 'confirmed') stats.confirmed += 1;
       if (booking.status === 'completed') stats.completed += 1;
       if (booking.status === 'cancelled') stats.cancelled += 1;
    }
  });

  return stats;
};

// Fleet Owner: bookings linked via bookings.vehicle_id -> vehicles.owner_id
export const fetchBookingsForVehicleOwner = async (
  ownerId: string,
  includeArchived: boolean = false
) => {
  const { data: vehicles, error: vehiclesError } = await supabase
    .from('vehicles')
    .select('id')
    .eq('owner_id', ownerId);

  if (vehiclesError) throw vehiclesError;

  const vehicleIds = (vehicles || []).map((v: any) => v.id).filter(Boolean);

  if (vehicleIds.length === 0) return [];

  let q = supabase
    .from('bookings')
    .select(`
      *,
      tours (
        id,
        title,
        region
      ),
      vehicles (
        id,
        make,
        model,
        license_plate
      )
    `)
    .in('vehicle_id', vehicleIds)
    .order('start_date', { ascending: false });

  /*
  if (!includeArchived) {
    q = q.is('archived_at', null);
  }
  */

  const { data, error } = await q;
  if (error) throw error;

  return data || [];
};

export const getBookingStatusHistory = async (bookingId: string) => {
  const { data, error } = await supabase
    .from('booking_status_history')
    .select('booking_id, old_status, new_status, actor_id, source, note, created_at')
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error(`Error fetching booking status history for ${bookingId}:`, error);
    throw error;
  }

  return data || [];
};

/**
 * Checks for overlapping bookings for a specific set of vehicles.
 * Returns a list of vehicle IDs that have conflicts.
 */
export const getVehicleBookingConflicts = async (
  vehicleIds: string[],
  startDate: string,
  endDate: string,
  excludeBookingId?: string
) => {
  if (vehicleIds.length === 0) return [];

  const blockingStatuses = ['pending', 'confirmed', 'assigned', 'in_progress'];

  let query = supabase
    .from('bookings')
    .select('vehicle_id')
    .in('vehicle_id', vehicleIds)
    .in('status', blockingStatuses)
    .lte('start_date', endDate)
    .gte('end_date', startDate);

  if (excludeBookingId) {
    query = query.neq('id', excludeBookingId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error checking vehicle booking conflicts:", error);
    throw error;
  }

  return Array.from(new Set((data || []).map((b: any) => b.vehicle_id)));
};

/**
 * Checks if a specific vehicle has any conflicts (availability blocks or overlapping bookings).
 */
export const checkVehicleConflicts = async (
  vehicleId: string,
  startDate: string,
  endDate: string,
  excludeBookingId?: string
) => {
  // 1. Check availability blocks
  const { data: blocks, error: blockError } = await supabase
    .from('availability')
    .select('id')
    .eq('vehicle_id', vehicleId)
    .eq('is_blocked', true)
    .lte('date_start', endDate.split('T')[0])
    .gte('date_end', startDate.split('T')[0]);

  if (blockError) throw blockError;
  if (blocks && blocks.length > 0) return true;

  // 2. Check overlapping bookings
  const conflicts = await getVehicleBookingConflicts([vehicleId], startDate, endDate, excludeBookingId);
  return conflicts.length > 0;
};

/**
 * Checks if a specific driver or guide has any overlapping assignments.
 */
export const checkProviderConflicts = async (
  providerId: string,
  startDate: string,
  endDate: string,
  excludeBookingId?: string
): Promise<boolean> => {
  // 1. Check manual availability blocks via secure RPC
  const { data: isBlocked, error: rpcError } = await supabase.rpc('rpc_check_provider_manual_blocks', {
    p_provider_id: providerId,
    p_start_date: startDate.split('T')[0],
    p_end_date: endDate.split('T')[0]
  });

  if (rpcError) throw rpcError;
  if (isBlocked) return true;

  // 2. Check overlapping bookings
  const { data, error } = await supabase
    .from('booking_assignments')
    .select('id, bookings(start_date, end_date)')
    .eq('resource_id', providerId)
    .in('status', ['accepted', 'pending'])
    .not('booking_id', 'eq', excludeBookingId);

  if (error) throw error;
  if (!data || data.length === 0) return false;

  const searchStart = new Date(startDate).getTime();
  const searchEnd = new Date(endDate).getTime();

  return data.some((a: any) => {
    const b = Array.isArray(a.bookings) ? a.bookings[0] : a.bookings;
    if (!b || !b.start_date || !b.end_date) return false;
    const bStart = new Date(b.start_date).getTime();
    const bEnd = new Date(b.end_date).getTime();
    return (bStart < searchEnd) && (bEnd > searchStart);
  });
};

export interface WeeklyStats {
  confirmed: number;
  completed: number;
  cancelled: number;
}

export type BookingTripInfoInput = {
  startDate: string;
  endDate: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string | null;
  numGuests: number;
  pickupLocation?: string | null;
  dropoffLocation?: string | null;
  specialRequests?: string | null;
  internalNotes?: string | null;
};

export const updateBookingInternalNotes = async (
  bookingId: string,
  internalNotes: string | null
) => {
  const { error } = await supabase
    .from('bookings')
    .update({ internal_notes: internalNotes })
    .eq('id', bookingId);

  if (error) {
    console.error(`Error updating internal notes ${bookingId}:`, error);
    throw error;
  }
  return true;
};

export const updateBookingTripInfo = async (
  bookingId: string,
  operatorId: string,
  input: BookingTripInfoInput
) => {
  // We keep the check here for better UI feedback, but the RPC also enforces it
  if (await isBookingFinanciallyLocked(bookingId)) {
    throw new Error("Completed bookings are locked from trip edits");
  }

  const { data, error } = await supabase.rpc('rpc_update_booking_trip_info', {
    p_booking_id: bookingId,
    p_start_date: input.startDate,
    p_end_date: input.endDate,
    p_pickup_location: input.pickupLocation || null,
    p_dropoff_location: input.dropoffLocation || null,
    p_guest_name: input.guestName,
    p_guest_email: input.guestEmail,
    p_guest_phone: input.guestPhone,
    p_number_of_guests: input.numGuests,
    p_special_requests: input.specialRequests || null,
    p_internal_notes: input.internalNotes || null
  });

  if (error) {
    console.error(`Error updating booking trip info ${bookingId}:`, error);
    throw error;
  }

  let escrowSyncResult: { synced: boolean, hasPaidPayouts: boolean, wasFunded: boolean } | null = null;
  try {
    const { syncEscrowToBookingTotal } = await import('./escrowService');
    escrowSyncResult = await syncEscrowToBookingTotal(bookingId);
  } catch (e) {
    console.warn('Failed to sync escrow after trip update', e);
  }

  return { success: true, escrowSyncResult };
};

/**
 * Driver Availability Requests
 */

export const createDriverAvailabilityRequest = async (input: {
  operator_id: string;
  driver_id: string;
  start_date: string;
  end_date: string;
  notes?: string | null;
}) => {
  const { data, error } = await supabase
    .from('driver_availability_requests')
    .insert({
      operator_id: input.operator_id,
      driver_id: input.driver_id,
      start_date: input.start_date,
      end_date: input.end_date,
      notes: input.notes,
      status: 'pending'
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating driver availability request:", error);
    throw error;
  }

  // Notify Driver
  const { data: operator } = await supabase
    .from('profiles')
    .select('company_name, full_name')
    .eq('id', input.operator_id)
    .single();

  const operatorName = operator?.company_name || operator?.full_name || 'an operator';

  await createNotification({
    user_id: input.driver_id,
    type: 'NEW_AVAILABILITY_REQUEST',
    title: 'New Availability Request',
    message: `You have a new availability request from ${operatorName}.`,
    link: '/driver/requests'
  });

  return data;
};

export const listDriverAvailabilityRequestsForOperator = async (operatorId: string): Promise<DriverAvailabilityRequest[]> => {
  const { data, error } = await supabase
    .from('driver_availability_requests')
    .select('*')
    .eq('operator_id', operatorId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  if (!data || data.length === 0) return [];

  const driverIds = Array.from(new Set(data.map(r => r.driver_id)));
  const { data: profiles, error: profileError } = await supabase.rpc('get_public_profiles', { p_ids: driverIds });
  
  if (profileError) {
    console.error("Error hydrating driver profiles:", profileError);
    return data as DriverAvailabilityRequest[];
  }

  const profileMap = (profiles || []).reduce((acc: any, p: any) => {
    acc[p.id] = p;
    return acc;
  }, {});

  return data.map(r => ({
    ...r,
    driver: profileMap[r.driver_id] ? {
      full_name: profileMap[r.driver_id].full_name,
      email: profileMap[r.driver_id].email,
      avatar_url: profileMap[r.driver_id].avatar_url,
      profile_image_url: profileMap[r.driver_id].profile_image_url
    } : undefined
  })) as DriverAvailabilityRequest[];
};

export const listDriverAvailabilityRequestsForDriver = async (driverId: string): Promise<DriverAvailabilityRequest[]> => {
  const { data, error } = await supabase
    .from('driver_availability_requests')
    .select('*')
    .eq('driver_id', driverId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  if (!data || data.length === 0) return [];

  const operatorIds = Array.from(new Set(data.map(r => r.operator_id)));
  const { data: profiles, error: profileError } = await supabase.rpc('get_public_profiles', { p_ids: operatorIds });
  
  if (profileError) {
    console.error("Error hydrating operator profiles:", profileError);
    return data as DriverAvailabilityRequest[];
  }

  const profileMap = (profiles || []).reduce((acc: any, p: any) => {
    acc[p.id] = p;
    return acc;
  }, {});

  return data.map(r => ({
    ...r,
    operator: profileMap[r.operator_id] ? {
      full_name: profileMap[r.operator_id].full_name,
      email: profileMap[r.operator_id].email,
      company_name: profileMap[r.operator_id].company_name,
      avatar_url: profileMap[r.operator_id].avatar_url,
      profile_image_url: profileMap[r.operator_id].profile_image_url
    } : undefined
  })) as DriverAvailabilityRequest[];
};

export const updateDriverAvailabilityRequestStatus = async (
  requestId: string,
  userId: string,
  status: 'accepted' | 'declined' | 'cancelled'
) => {
  const { data, error } = await supabase
    .from('driver_availability_requests')
    .update({
      status,
      responded_at: status !== 'cancelled' ? new Date().toISOString() : undefined,
      responded_by: status !== 'cancelled' ? userId : undefined,
      updated_at: new Date().toISOString()
    })
    .eq('id', requestId)
    .select()
    .single();

  if (error) {
    console.error(`Error updating driver request ${requestId} to ${status}:`, error);
    throw error;
  }

  // Notify Operator
  await createNotification({
    user_id: data.operator_id,
    type: `DRIVER_REQUEST_${status.toUpperCase()}`,
    title: `Driver Request ${status.charAt(0).toUpperCase() + status.slice(1)}`,
    message: `Driver request for booking ${data.booking_id || ''} was ${status}.`,
    link: data.booking_id ? `/operator/bookings/${data.booking_id}` : '/operator/requests'
  });

  if (status === 'accepted' && data.booking_id) {
    await checkBookingReadyForConfirmation(data.booking_id);
  }

  return data;
};

export const checkBookingReadyForConfirmation = async (bookingId: string) => {
  const { data: booking } = await supabase
    .from('bookings')
    .select('operator_id, booking_reference, status')
    .eq('id', bookingId)
    .single();

  if (!booking || booking.status !== 'draft') return;

  // Check if all requests are accepted
  const [vehicleRes, driverRes, guideRes] = await Promise.all([
    supabase
      .from('vehicle_availability_requests')
      .select('status')
      .eq('converted_booking_id', bookingId),
    supabase
      .from('driver_availability_requests')
      .select('status')
      .eq('booking_id', bookingId),
    supabase
      .from('guide_availability_requests')
      .select('status')
      .eq('booking_id', bookingId)
  ]);

  const allVehicleAccepted = (vehicleRes.data || []).every(r => r.status === 'accepted');
  const allDriverAccepted = (driverRes.data || []).every(r => r.status === 'accepted');
  const allGuideAccepted = (guideRes.data || []).every(r => r.status === 'accepted');

  // Also check if there's at least one request if needed, or if assignments are complete
  // For now, if all existing requests are accepted, it's ready
  if (allVehicleAccepted && allDriverAccepted && allGuideAccepted) {
    await createNotification({
      user_id: booking.operator_id,
      type: 'BOOKING_READY_FOR_CONFIRMATION',
      title: 'Booking Ready for Confirmation',
      message: `All resources for booking ${booking.booking_reference} have accepted. It is now ready for confirmation.`,
      link: `/operator/bookings/${bookingId}`
    });
  }
};

export const getPendingRequestsCount = async (operatorId: string) => {
  const [vehicleRes, driverRes, guideRes] = await Promise.all([
    supabase
      .from('vehicle_availability_requests')
      .select('id', { count: 'exact', head: true })
      .eq('operator_id', operatorId)
      .eq('status', 'pending'),
    supabase
      .from('driver_availability_requests')
      .select('id', { count: 'exact', head: true })
      .eq('operator_id', operatorId)
      .eq('status', 'pending'),
    supabase
      .from('guide_availability_requests')
      .select('id', { count: 'exact', head: true })
      .eq('operator_id', operatorId)
      .eq('status', 'pending')
  ]);

  return (vehicleRes.count || 0) + (driverRes.count || 0) + (guideRes.count || 0);
};

export const getPendingRequestsCountForGuide = async (guideId: string) => {
  const { count, error } = await supabase
    .from('guide_availability_requests')
    .select('id', { count: 'exact', head: true })
    .eq('guide_id', guideId)
    .eq('status', 'pending');

  if (error) {
    console.error("Error fetching pending guide requests count:", error);
    return 0;
  }
  return count || 0;
};

/**
 * Driver Availability Requests
 */

export const getPendingRequestsCountForDriver = async (driverId: string) => {
  const { count, error } = await supabase
    .from('driver_availability_requests')
    .select('id', { count: 'exact', head: true })
    .eq('driver_id', driverId)
    .eq('status', 'pending');

  if (error) {
    console.error("Error fetching pending driver requests count:", error);
    return 0;
  }
  return count || 0;
};

export const getPendingRequestsCountForVehicleOwner = async (ownerId: string) => {
  // 1. Get vehicles owned by this user
  const { data: ownedVehicles } = await supabase
    .from('vehicles')
    .select('id')
    .eq('owner_id', ownerId);
  
  const vehicleIds = (ownedVehicles || []).map(v => v.id);
  if (vehicleIds.length === 0) return 0;

  // 2. Fetch count for those vehicles
  const { count, error } = await supabase
    .from('vehicle_availability_requests')
    .select('id', { count: 'exact', head: true })
    .in('vehicle_id', vehicleIds)
    .eq('status', 'pending');

  if (error) {
    console.error("Error fetching pending vehicle owner requests count:", error);
    return 0;
  }
  return count || 0;
};

/**
 * Guide Availability Requests
 */

export const createGuideAvailabilityRequest = async (input: {
  operator_id: string;
  guide_id: string;
  start_date: string;
  end_date: string;
  notes?: string | null;
}) => {
  const { data, error } = await supabase
    .from('guide_availability_requests')
    .insert({
      operator_id: input.operator_id,
      guide_id: input.guide_id,
      start_date: input.start_date,
      end_date: input.end_date,
      notes: input.notes,
      status: 'pending'
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating guide availability request:", error);
    throw error;
  }

  // Notify Guide
  const { data: operator } = await supabase
    .from('profiles')
    .select('company_name, full_name')
    .eq('id', input.operator_id)
    .single();

  const operatorName = operator?.company_name || operator?.full_name || 'an operator';

  await createNotification({
    user_id: input.guide_id,
    type: 'NEW_AVAILABILITY_REQUEST',
    title: 'New Availability Request',
    message: `You have a new availability request from ${operatorName}.`,
    link: '/guide/requests'
  });

  return data;
};

export const listGuideAvailabilityRequestsForOperator = async (operatorId: string): Promise<GuideAvailabilityRequest[]> => {
  const { data, error } = await supabase
    .from('guide_availability_requests')
    .select('*')
    .eq('operator_id', operatorId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  if (!data || data.length === 0) return [];

  const guideIds = Array.from(new Set(data.map(r => r.guide_id)));
  const { data: profiles, error: profileError } = await supabase.rpc('get_public_profiles', { p_ids: guideIds });
  
  if (profileError) {
    console.error("Error hydrating guide profiles:", profileError);
    return data as GuideAvailabilityRequest[];
  }

  const profileMap = (profiles || []).reduce((acc: any, p: any) => {
    acc[p.id] = p;
    return acc;
  }, {});

  return data.map(r => ({
    ...r,
    guide: profileMap[r.guide_id] ? {
      full_name: profileMap[r.guide_id].full_name,
      email: profileMap[r.guide_id].email,
      avatar_url: profileMap[r.guide_id].avatar_url,
      profile_image_url: profileMap[r.guide_id].profile_image_url
    } : undefined
  })) as GuideAvailabilityRequest[];
};

export const listGuideAvailabilityRequestsForGuide = async (guideId: string): Promise<GuideAvailabilityRequest[]> => {
  const { data, error } = await supabase
    .from('guide_availability_requests')
    .select('*')
    .eq('guide_id', guideId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  if (!data || data.length === 0) return [];

  const operatorIds = Array.from(new Set(data.map(r => r.operator_id)));
  const { data: profiles, error: profileError } = await supabase.rpc('get_public_profiles', { p_ids: operatorIds });
  
  if (profileError) {
    console.error("Error hydrating operator profiles:", profileError);
    return data as GuideAvailabilityRequest[];
  }

  const profileMap = (profiles || []).reduce((acc: any, p: any) => {
    acc[p.id] = p;
    return acc;
  }, {});

  return data.map(r => ({
    ...r,
    operator: profileMap[r.operator_id] ? {
      full_name: profileMap[r.operator_id].full_name,
      email: profileMap[r.operator_id].email,
      company_name: profileMap[r.operator_id].company_name,
      avatar_url: profileMap[r.operator_id].avatar_url,
      profile_image_url: profileMap[r.operator_id].profile_image_url
    } : undefined
  })) as GuideAvailabilityRequest[];
};

export const updateGuideAvailabilityRequestStatus = async (
  requestId: string,
  userId: string,
  status: 'accepted' | 'declined' | 'cancelled'
) => {
  const { data, error } = await supabase
    .from('guide_availability_requests')
    .update({
      status,
      responded_at: status !== 'cancelled' ? new Date().toISOString() : undefined,
      responded_by: status !== 'cancelled' ? userId : undefined,
      updated_at: new Date().toISOString()
    })
    .eq('id', requestId)
    .select()
    .single();

  if (error) {
    console.error(`Error updating guide request ${requestId} to ${status}:`, error);
    throw error;
  }

  // Notify Operator
  await createNotification({
    user_id: data.operator_id,
    type: `GUIDE_REQUEST_${status.toUpperCase()}`,
    title: `Guide Request ${status.charAt(0).toUpperCase() + status.slice(1)}`,
    message: `Guide request for booking ${data.booking_id || ''} was ${status}.`,
    link: data.booking_id ? `/operator/bookings/${data.booking_id}` : '/operator/requests'
  });

  if (status === 'accepted' && data.booking_id) {
    await checkBookingReadyForConfirmation(data.booking_id);
  }

  return data;
};

export const createRecurringBookings = async (
  sourceBookingId: string,
  config: {
    frequency: 'daily' | 'weekly';
    startDate: string; // First repeat start date
    endCondition: 'count' | 'endDate';
    repeatCount?: number;
    endDate?: string;
    includeResources: boolean;
  }
) => {
  // 1. Fetch source booking
  const { data: source, error: sourceError } = await supabase
    .from('bookings')
    .select(`
      operator_id,
      tour_id,
      booking_reference,
      num_guests,
      guest_name,
      guest_email,
      guest_phone,
      currency,
      subtotal_amount,
      vat_rate,
      vat_amount,
      total_amount,
      notes,
      start_date,
      end_date,
      vehicle_id,
      vehicle_rate_type,
      vehicle_rate_amount,
      vehicle_rate_overridden
    `)
    .eq('id', sourceBookingId)
    .single();

  if (sourceError) throw sourceError;
  if (!source) throw new Error('Source booking not found');

  // 2. Calculate dates
  const dates: { start: Date; end: Date }[] = [];
  const sourceStart = new Date(source.start_date);
  const sourceEnd = new Date(source.end_date);
  const durationMs = sourceEnd.getTime() - sourceStart.getTime();

  let currentStart = new Date(config.startDate);
  
  const increment = config.frequency === 'daily' ? 1 : 7;
  
  if (config.endCondition === 'count') {
    const count = config.repeatCount || 1;
    for (let i = 0; i < count; i++) {
      const start = new Date(currentStart);
      const end = new Date(start.getTime() + durationMs);
      dates.push({ start, end });
      currentStart.setDate(currentStart.getDate() + increment);
    }
  } else {
    const lastDate = new Date(config.endDate!);
    while (currentStart <= lastDate) {
      const start = new Date(currentStart);
      const end = new Date(start.getTime() + durationMs);
      dates.push({ start, end });
      currentStart.setDate(currentStart.getDate() + increment);
    }
  }

  if (dates.length === 0) {
    throw new Error("No recurring dates were generated. Please check your start date and end condition.");
  }

  // 3. Get current assignments if needed
  let sourceAssignments: any[] = [];
  if (config.includeResources) {
    const { data: assignments } = await supabase
      .from('booking_assignments')
      .select('*')
      .eq('booking_id', sourceBookingId);
    sourceAssignments = assignments || [];
  }

  const createdBookings = [];
  const warnings: string[] = [];

  for (const datePair of dates) {
    const ref = `BK-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
    
    // Create new booking
    const { data: newBooking, error: createError } = await supabase
      .from('bookings')
      .insert({
        operator_id: source.operator_id,
        tour_id: source.tour_id,
        booking_reference: ref,
        status: 'draft',
        start_date: datePair.start.toISOString(),
        end_date: datePair.end.toISOString(),
        num_guests: source.num_guests,
        guest_name: source.guest_name,
        guest_email: source.guest_email,
        guest_phone: source.guest_phone,
        currency: source.currency,
        subtotal_amount: source.subtotal_amount,
        vat_rate: source.vat_rate,
        vat_amount: source.vat_amount,
        total_amount: source.total_amount,
        notes: source.notes || `Recurring booking from ${source.booking_reference}`,
        // Pricing snapshots
        vehicle_id: config.includeResources ? source.vehicle_id : null,
        vehicle_rate_type: config.includeResources ? source.vehicle_rate_type : null,
        vehicle_rate_amount: config.includeResources ? source.vehicle_rate_amount : null,
        vehicle_rate_overridden: config.includeResources ? source.vehicle_rate_overridden : false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select('id')
      .single();

    if (createError) {
      console.error('Error creating recurring booking:', createError);
      continue;
    }

    if (newBooking) {
      createdBookings.push(newBooking);

      // Sync platform fee snapshot
      await syncBookingPlatformFeeSnapshot(newBooking.id);

      // Carry forward resources
      if (config.includeResources) {
        // Driver
        const driverAssignment = getCurrentAssignment(sourceAssignments, 'driver');
        if (driverAssignment) {
          const { error: driverErr } = await supabase.rpc('rpc_operator_assign_resource', {
            p_booking_id: newBooking.id,
            p_resource_id: driverAssignment.resource_id,
            p_resource_type: 'driver',
            p_rate_overridden: false
          });
          if (driverErr) {
            console.error('Error carrying forward driver:', driverErr);
            warnings.push(`Failed to carry forward driver for booking ${ref}`);
          }
        }

        // Guide
        const guideAssignment = getCurrentAssignment(sourceAssignments, 'guide');
        if (guideAssignment) {
          const { error: guideErr } = await supabase.rpc('rpc_operator_assign_resource', {
            p_booking_id: newBooking.id,
            p_resource_id: guideAssignment.resource_id,
            p_resource_type: 'guide',
            p_rate_overridden: false
          });
          if (guideErr) {
            console.error('Error carrying forward guide:', guideErr);
            warnings.push(`Failed to carry forward guide for booking ${ref}`);
          }
        }
      }

      // Audit Log
      await logAuditEvent({
        entityId: newBooking.id,
        entityType: 'booking',
        action: 'RECURRING_BOOKING_CREATED',
        metadata: { source_booking_id: sourceBookingId, source_reference: source.booking_reference }
      });
    }
  }

  if (createdBookings.length === 0) {
    throw new Error("No recurring bookings were created. Please review the repeat settings.");
  }

  return { count: createdBookings.length, warnings };
};
