import { supabase } from "./supabase";
import { createNotification } from "./notificationService";
import { getPayoutLedgersForBooking, isBookingFinanciallyLocked } from "./payoutService";
import { syncBookingFinancialSnapshot } from "./financialService";
import { canAssignProvider } from "./compliance";
import { checkProviderConflicts } from "./bookingService";

export type ProviderRole = "driver" | "guide";
export type AssignmentStatus = "pending" | "accepted" | "rejected" | "cancelled" | "completed";

export type ProviderProfile = {
  id: string;
  email: string | null;
  role: string | null;
  full_name: string | null;
  company_name: string | null;
  verification_status: string | null;
  is_active: boolean | null;
  bio: string | null;
  city: string | null;
  province: string | null;
  country: string | null;
  avatar_url: string | null;
  profile_image_url: string | null;
  default_day_rate: number | null;
  default_hour_rate: number | null;
  metadata?: Record<string, any>;
};

export type BookingAssignmentRow = {
  id: string;
  booking_id: string;
  resource_id: string;
  resource_type: string;
  status: AssignmentStatus | null;
  updated_at: string | null;
  rate_type: 'day' | 'hour' | null;
  rate_amount: number | null;
  rate_overridden: boolean;
  cost_total?: number | null;
  profile?: {
    id: string;
    full_name: string | null;
    email: string | null;
    phone?: string | null;
    bio: string | null;
    city: string | null;
    province: string | null;
    country: string | null;
    avatar_url: string | null;
    profile_image_url: string | null;
    default_day_rate: number | null;
    default_hour_rate: number | null;
  } | null;
};

const isUUID = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

export async function searchProviders(role: ProviderRole, query: string): Promise<ProviderProfile[]> {
  const q = (query || "").trim();
  if (!q) return [];
  const orCondition = `email.ilike.%${q}%,full_name.ilike.%${q}%`;
  const { data, error } = await supabase
    .from("profiles")
    .select("id,role,full_name,company_name,verification_status,is_active,bio,city,province,country,avatar_url,profile_image_url,default_day_rate,default_hour_rate,metadata,vat_registered")
    .eq("role", role)
    .eq("is_active", true)
    .or(orCondition)
    .order("full_name", { ascending: true })
    .limit(20);
  if (error) throw error;
  return (data || []) as any as ProviderProfile[];
}

export async function searchProvidersWithFilters(
  role: ProviderRole, 
  filters: { query?: string; city?: string; province?: string; country?: string }
): Promise<ProviderProfile[]> {
  let qb = supabase
    .from("profiles")
    .select("id,role,full_name,company_name,verification_status,is_active,bio,city,province,country,avatar_url,profile_image_url,default_day_rate,default_hour_rate,metadata,vat_registered")
    .eq("role", role)
    .eq("is_active", true);

  if (filters.query?.trim()) {
    const q = filters.query.trim();
    qb = qb.or(`email.ilike.%${q}%,full_name.ilike.%${q}%`);
  }
  
  const cityQ = filters.city?.trim();
  if (cityQ) {
    qb = qb.or(`city.ilike.%${cityQ}%,metadata->>city.ilike.%${cityQ}%`);
  }
  
  const provQ = filters.province?.trim();
  if (provQ && provQ !== 'Any') {
    qb = qb.or(`province.ilike.%${provQ}%,metadata->>province.ilike.%${provQ}%`);
  }
  
  const countryFilter = (filters.country && filters.country !== 'Any') ? filters.country.trim() : 'South Africa';
  if (countryFilter === 'South Africa') {
    qb = qb.or(`country.ilike.%South Africa%,country.ilike.%ZA%,metadata->>country.ilike.%South Africa%,metadata->>country.ilike.%ZA%`);
  } else if (countryFilter) {
    qb = qb.or(`country.ilike.%${countryFilter}%,metadata->>country.ilike.%${countryFilter}%`);
  }

  const { data, error } = await qb.order("full_name", { ascending: true }).limit(50);
  if (error) {
    console.error(`[searchProvidersWithFilters] Error searching ${role}:`, error);
    throw error;
  }
  return (data || []) as any as ProviderProfile[];
}

export const searchDrivers = (query: string) => searchProviders("driver", query);
export const searchGuides = (query: string) => searchProviders("guide", query);
export const searchDriversWithFilters = (filters: any) => searchProvidersWithFilters("driver", filters);
export const searchGuidesWithFilters = (filters: any) => searchProvidersWithFilters("guide", filters);

export async function getBookingAssignments(bookingId: string): Promise<BookingAssignmentRow[]> {
  if (!bookingId) return [];
  const { data, error } = await supabase
    .from("booking_assignments")
    .select("id,booking_id,resource_id,resource_type,status,updated_at,rate_type,rate_amount,rate_overridden,cost_total")
    .eq("booking_id", bookingId)
    .order("updated_at", { ascending: false });

  if (error) return [];

  return await Promise.all((data || []).map(async (a) => {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, full_name, email, phone, bio, city, province, country, avatar_url, profile_image_url, default_day_rate, default_hour_rate')
      .eq('id', a.resource_id)
      .maybeSingle();
    return { ...a, profile } as BookingAssignmentRow;
  }));
}

/**
 * Returns the latest active assignment for a resource type.
 * If the latest row is rejected or cancelled, returns null.
 */
export function getCurrentAssignment(assignments: BookingAssignmentRow[], resourceType: string): BookingAssignmentRow | null {
  if (!assignments || assignments.length === 0) return null;
  
  const filtered = assignments.filter(a => a.resource_type === resourceType);
  if (filtered.length === 0) return null;

  // Sort by updated_at desc to ensure we have the latest
  const sorted = [...filtered].sort((a, b) => {
    const timeA = a.updated_at ? new Date(a.updated_at).getTime() : 0;
    const timeB = b.updated_at ? new Date(b.updated_at).getTime() : 0;
    return timeB - timeA;
  });

  const latest = sorted[0];
  
  // Active/Final/History: pending, accepted, completed, rejected
  if (latest.status === 'pending' || latest.status === 'accepted' || latest.status === 'completed' || latest.status === 'rejected') {
    return latest;
  }
  
  // Inactive: cancelled -> return null
  return null;
}

async function internalAssign(
  bookingId: string, 
  providerId: string, 
  role: ProviderRole,
  opts?: { rateType: 'day' | 'hour', rateAmount: number, rateOverridden: boolean }
) {
  if (!bookingId) throw new Error("Invalid Booking ID");
  if (!providerId) throw new Error("Invalid Provider ID");

  // COMPLIANCE GUARD: Prevent assignment of non-compliant drivers/guides
  const check = await canAssignProvider(providerId, role);
  if (!check.canAssign) {
    throw new Error(`CANNOT_ASSIGN_PROVIDER: Compliance issue - ${check.blockers[0]}`);
  }

  // AVAILABILITY GUARD: Prevent overlapping assignments
  const { data: booking } = await supabase
    .from('bookings')
    .select('booking_reference, start_date, end_date')
    .eq('id', bookingId)
    .single();

  if (booking) {
    const hasConflict = await checkProviderConflicts(
      providerId,
      booking.start_date,
      booking.end_date,
      bookingId
    );
    if (hasConflict) {
      throw new Error(`PROVIDER_CONFLICT: Provider cannot be assigned because they are already booked for this date range.`);
    }
  }

  // Fetch provider profile for default rates
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, default_day_rate, default_hour_rate')
    .eq('id', providerId)
    .single();

  // Check if there's already an active assignment for this role
  const { data: existing } = await supabase
    .from('booking_assignments')
    .select('*')
    .eq('booking_id', bookingId)
    .eq('resource_type', role);
  
  const current = getCurrentAssignment(existing || [], role);

  // Check if booking is financially locked (any payout is paid)
  if (await isBookingFinanciallyLocked(bookingId)) {
    throw new Error("BOOKING_FINANCIALLY_LOCKED");
  }

  if (current && (current.status === 'accepted' || current.status === 'completed')) {
    // Check if there's a payout that is approved or paid
    const payouts = await getPayoutLedgersForBooking(bookingId);
    const payout = payouts.find(p => p.provider_id === current.resource_id);
    if (payout?.status === 'approved') {
      throw new Error("PAYOUT_APPROVED");
    }
    if (payout?.status === 'paid') {
      throw new Error("PAYOUT_PAID");
    }
    throw new Error(`This booking already has an accepted or completed ${role}`);
  }

  let finalRateType = opts?.rateType;
  let finalRateAmount = opts?.rateAmount;
  let finalRateOverridden = opts?.rateOverridden ?? false;

  if (!opts || opts.rateAmount == null) {
    if (profile?.default_day_rate != null) {
      finalRateType = 'day';
      finalRateAmount = profile.default_day_rate;
    } else if (profile?.default_hour_rate != null) {
      finalRateType = 'hour';
      finalRateAmount = profile.default_hour_rate;
    } else {
      finalRateType = 'day';
      finalRateAmount = 0;
      console.warn(`Provider ${providerId} has no default rates set. Defaulting to 0.`);
    }
  }

  let costTotal = 0;
  if (finalRateType && finalRateAmount != null && booking?.start_date && booking?.end_date) {
    const start = new Date(booking.start_date);
    const end = new Date(booking.end_date);
    
    if (finalRateType === 'day') {
      const msPerDay = 1000 * 60 * 60 * 24;
      const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / msPerDay));
      costTotal = finalRateAmount * days;
    } else if (finalRateType === 'hour') {
      const msPerHour = 1000 * 60 * 60;
      // Rough approx 24h as absolute max per day if using hours
      const hours = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / msPerHour));
      costTotal = finalRateAmount * Math.min(hours, 24); // Cap at 24 hrs for fallback
    }
  }

  const { data, error: insErr } = await supabase.rpc('rpc_operator_assign_resource', {
    p_booking_id: bookingId,
    p_resource_id: providerId,
    p_resource_type: role,
    p_rate_type: finalRateType,
    p_rate_amount: finalRateAmount,
    p_rate_overridden: finalRateOverridden
  });

  if (insErr) throw insErr;

  // Post-update for cost_total because RPC doesn't accept it
  if (data?.id) {
    await supabase.from('booking_assignments')
      .update({ cost_total: costTotal, cost_currency: 'ZAR' })
      .eq('id', data.id);
  }

  // Re-calculate financial snapshot immediately after write
  if (bookingId) {
    syncBookingFinancialSnapshot(bookingId).catch(err =>
      console.error('[assignmentService] syncBookingFinancialSnapshot failed after assignment:', err)
    );
  }

  window.dispatchEvent(new CustomEvent('ASSIGNMENTS_UPDATED'));

  // Notify Resource
  createNotification({
    user_id: providerId,
    type: 'ASSIGNED_TO_BOOKING',
    title: 'Assigned to Booking',
    message: `You have been assigned to booking ${booking?.booking_reference || ''}.`,
    link: role === 'driver' ? `/driver/assignments/${data.id}` : `/guide/assignments/${data.id}`
  }).catch(err => console.error('Failed to create notification:', err));

  // Audit Assignment Sent
  import('./auditService').then(m => m.logAuditEvent({
    action: 'ASSIGNMENT_SENT',
    entityType: 'booking_assignments',
    entityId: data.id,
    bookingId: bookingId,
    metadata: {
      booking_id: bookingId,
      provider_id: providerId,
      role: role,
      booking_reference: booking?.booking_reference
    }
  })).catch(err => console.error('Failed to log audit event:', err));

  return data;
}

export const assignDriver = async (bookingId: string, driverId: string, opts?: any) => {
  return await internalAssign(bookingId, driverId, 'driver', opts);
};

export const assignGuide = async (bookingId: string, guideId: string, opts?: any) => {
  return await internalAssign(bookingId, guideId, 'guide', opts);
};

export async function respondToAssignment(id: string, status: "accepted" | "rejected", reason?: string) {
  if (!id) throw new Error("Invalid Assignment ID");

  if (status !== "accepted" && status !== "rejected") {
    throw new Error("Invalid assignment status");
  }

  const { data, error } = await supabase.rpc(
    "rpc_provider_respond_assignment",
    {
      p_assignment_id: id,
      p_status: status,
      p_reason: reason ?? null
    }
  );

  if (error) {
    console.error("[respondToAssignment] RPC failed", error);
    throw error;
  }

  if (data?.booking_id) {
    syncBookingFinancialSnapshot(data.booking_id).catch(err =>
      console.error(
        "[assignmentService] syncBookingFinancialSnapshot failed after assignment response:",
        err
      )
    );
  }

  (async () => {
    try {
      if (!data?.booking_id) return;

      const { data: booking } = await supabase
        .from("bookings")
        .select("operator_id, booking_reference")
        .eq("id", data.booking_id)
        .single();

      if (!booking) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, company_name, email")
        .eq("id", data.resource_id)
        .maybeSingle();

      const providerName =
        profile?.company_name ||
        profile?.full_name ||
        profile?.email ||
        "A provider";

      const reasonSuffix =
        status === "rejected" && reason ? ` Reason: ${reason}` : "";

      await createNotification({
        user_id: booking.operator_id,
        type: status === "rejected" ? "ASSIGNMENT_REJECTED" : "ASSIGNMENT_ACCEPTED",
        title: status === "rejected" ? "Assignment Declined" : "Assignment Accepted",
        message: `${providerName} ${status === "rejected" ? "declined" : "accepted"} the ${data.resource_type} assignment for booking ${booking.booking_reference}.${reasonSuffix}`,
        link: `/operator/bookings/${data.booking_id}`
      });

      const m = await import("./auditService");
      await m.logAuditEvent({
        action: status === "rejected" ? "ASSIGNMENT_DECLINED" : "ASSIGNMENT_ACCEPTED",
        entityType: "booking_assignments",
        entityId: id,
        bookingId: data.booking_id,
        metadata: {
          booking_id: data.booking_id,
          provider_id: data.resource_id,
          role: data.resource_type,
          booking_reference: booking.booking_reference,
          decline_reason: reason ?? null
        }
      });
    } catch (err) {
      console.error("Post-assignment response background processing failed:", err);
    }
  })();

  window.dispatchEvent(new CustomEvent("ASSIGNMENTS_UPDATED"));

  return data;
}

export async function getAssignmentsForResource(resourceId: string, resourceType: 'driver' | 'guide') {
  const { data, error } = await supabase
    .from('booking_assignments')
    .select('id, booking_id, resource_id, resource_type, status, updated_at, rate_type, rate_amount, rate_overridden, units, cost_total, cost_currency')
    .eq('resource_id', resourceId)
    .eq('resource_type', resourceType)
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function acceptAssignment(assignmentId: string) {
  return await respondToAssignment(assignmentId, "accepted");
}

export async function rejectAssignment(assignmentId: string, reason?: string) {
  return await respondToAssignment(assignmentId, "rejected", reason);
}

export async function cancelAssignmentByOperator(assignmentId: string, isReplacement = false) {
  const { data, error: rpcErr } = await supabase.rpc('rpc_operator_cancel_assignment', {
    p_assignment_id: assignmentId,
  });

  if (rpcErr) {
    if (rpcErr.message?.includes('BOOKING_FINANCIALLY_LOCKED')) {
      throw new Error("BOOKING_FINANCIALLY_LOCKED");
    }
    if (rpcErr.message?.includes('PAYOUT_ALREADY_PROCESSED')) {
      throw new Error("PAYOUT_APPROVED");
    }
    throw rpcErr;
  }

  // Re-calculate financial snapshot immediately after write
  if (data?.booking_id) {
    syncBookingFinancialSnapshot(data.booking_id).catch(err =>
      console.error('[assignmentService] syncBookingFinancialSnapshot failed after assignment cancel:', err)
    );
  }

  // Notify Resource
  if (data) {
    const { data: booking } = await supabase
      .from('bookings')
      .select('booking_reference')
      .eq('id', data.booking_id)
      .single();

    createNotification({
      user_id: data.resource_id,
      type: isReplacement ? 'ASSIGNMENT_REPLACED' : 'REMOVED_FROM_BOOKING',
      title: isReplacement ? 'Assignment Replaced' : 'Removed from Booking',
      message: isReplacement 
        ? `You have been replaced for booking ${booking?.booking_reference || ''}.`
        : `You have been removed from booking ${booking?.booking_reference || ''}.`,
      link: '#'
    }).catch(err => console.error('Failed to create notification:', err));

    // Audit Event
    import('./auditService').then(m => m.logAuditEvent({
      action: isReplacement ? 'ASSIGNMENT_REPLACED' : 'ASSIGNMENT_REMOVED',
      entityType: 'booking_assignments',
      entityId: assignmentId,
      bookingId: data.booking_id,
      metadata: {
        booking_id: data.booking_id,
        provider_id: data.resource_id,
        role: data.resource_type,
        booking_reference: booking?.booking_reference,
        was_replaced: isReplacement
      }
    })).catch(err => console.error('Failed to log audit event:', err));
  }

  window.dispatchEvent(new CustomEvent('ASSIGNMENTS_UPDATED'));

  return data;
}

export const getPendingAssignmentsCount = async (resourceId: string, resourceType: 'driver' | 'guide') => {
  const { count, error } = await supabase
    .from('booking_assignments')
    .select('id', { count: 'exact', head: true })
    .eq('resource_id', resourceId)
    .eq('resource_type', resourceType)
    .eq('status', 'pending');

  if (error) {
    console.error(`Error fetching pending ${resourceType} assignments count:`, error);
    return 0;
  }
  return count || 0;
};

export const getDriverAssignments = async (driverId: string) => {
  const { data, error } = await supabase
    .from('booking_assignments')
    .select('*, bookings (*, tours (title, region))')
    .eq('resource_id', driverId)
    .eq('resource_type', 'driver')
    .order('updated_at', { ascending: false });
  return error ? [] : data;
};

export const getGuideAssignments = async (guideId: string) => {
  const { data, error } = await supabase
    .from('booking_assignments')
    .select('*, bookings (*, tours (title, region))')
    .eq('resource_id', guideId)
    .eq('resource_type', 'guide')
    .order('updated_at', { ascending: false });
  return error ? [] : data;
};

export const getAssignmentById = async (id: string, resourceId: string) => {
  const { data, error } = await supabase
    .from('booking_assignments')
    .select('*, bookings (*, tours (title, region), profiles!operator_id (full_name, company_name))')
    .eq('id', id)
    .eq('resource_id', resourceId)
    .single();
  return error ? null : data;
};

export async function archiveAssignmentForResource(assignmentId: string, resourceId: string, resourceType: 'driver' | 'guide') {
  const { data, error } = await supabase
    .from('provider_assignment_archives')
    .insert({
      assignment_id: assignmentId,
      resource_id: resourceId,
      resource_type: resourceType,
      archived_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function unarchiveAssignmentForResource(assignmentId: string, resourceId: string) {
  const { data, error } = await supabase
    .from('provider_assignment_archives')
    .delete()
    .eq('assignment_id', assignmentId)
    .eq('resource_id', resourceId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getArchivedAssignmentIdsForResource(resourceId: string, resourceType: 'driver' | 'guide'): Promise<string[]> {
  const { data, error } = await supabase
    .from('provider_assignment_archives')
    .select('assignment_id')
    .eq('resource_id', resourceId)
    .eq('resource_type', resourceType);

  if (error) throw error;
  return data.map(row => row.assignment_id);
}
