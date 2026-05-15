
import { supabase } from './supabase';

export interface AuditEvent {
  action: string;
  entityType?: string;
  entity_type?: string;
  entityId?: string | null;
  entity_id?: string | null;
  actorId?: string | null;
  actorRole?: string | null;
  metadata?: Record<string, any> | null;
  bookingId?: string | null;
  booking_id?: string | null;
}

export interface AuditLogEntry {
  created_at: string;
  actor_id: string;
  actor_role: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, any>;
  booking_id: string | null;
}

// Simple memory cache for the session to avoid repeated profile fetches
let cachedRole: string | null = null;
let cachedUserId: string | null = null;

const getCurrentActorRole = async (userId: string): Promise<string> => {
  if (cachedUserId === userId && cachedRole) {
    return cachedRole;
  }

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (error || !data) {
      return 'unknown';
    }

    cachedUserId = userId;
    cachedRole = data.role;
    return data.role;
  } catch (e) {
    return 'unknown';
  }
};

/**
 * Logs a system event to the audit table.
 * Resolves the current user's role automatically.
 * Fails silently on error to prevent blocking main UI flows.
 */
export const logAuditEvent = async (params: AuditEvent): Promise<boolean> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    const userId = user?.id || null;

    if (!userId) {
      console.warn('Audit Log Skipped: no authenticated user');
      return false;
    }

    let userRole = params.actorRole;
    if (!userRole && userId) {
      userRole = await getCurrentActorRole(userId);
    }

    const typeToUse = params.entity_type || params.entityType || 'unknown';
    const idToUse = params.entity_id || params.entityId || null;
    const bookingIdToUse = params.booking_id || params.bookingId || null;

    const payload = {
      action: params.action,
      entity_type: typeToUse.toLowerCase(),
      entity_id: (idToUse && idToUse.trim() !== '') ? idToUse : null,
      booking_id: bookingIdToUse,
      metadata: params.metadata || {},
      actor_id: userId,
      actor_role: userRole || 'operator'
    };

    const { error } = await supabase.from('system_audit_log').insert(payload);

    if (error) {
      console.warn('Audit Log Insert Failed:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Audit Log Exception:', err);
    return false;
  }
};

/**
 * Fetches audit logs with strict column selection.
 */
export const fetchSystemAuditLogs = async (filters: {
  action?: string;
  entityTable?: string;
  startDate?: string;
  endDate?: string;
  actorRole?: string;
  entityId?: string;
  limit?: number;
}) => {
  let query = supabase
    .from('system_audit_log')
    .select('created_at, actor_id, actor_role, action, entity_type, entity_id, metadata, booking_id')
    .order('created_at', { ascending: false })
    .limit(filters.limit || 100);

  if (filters.action) {
    query = query.ilike('action', `%${filters.action}%`);
  }

  if (filters.entityTable) {
    query = query.eq('entity_type', filters.entityTable.toLowerCase());
  }

  if (filters.actorRole) {
    query = query.eq('actor_role', filters.actorRole);
  }

  if (filters.entityId) {
    // If it looks like a booking reference (e.g. TF-...), search metadata as well
    if (filters.entityId.startsWith('TF-')) {
      query = query.eq('metadata->>booking_reference', filters.entityId);
    } else {
      query = query.eq('entity_id', filters.entityId);
    }
  }

  if (filters.startDate) {
    query = query.gte('created_at', filters.startDate);
  }

  if (filters.endDate) {
    query = query.lt('created_at', filters.endDate);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching system_audit_log:', error);
    throw error;
  }

  return data as AuditLogEntry[];
};

/**
 * Fetches audit logs for a specific entity ID.
 */
export const fetchAuditLogsForEntity = async (entityTable: string, entityId: string) => {
  const { data, error } = await supabase
    .from('system_audit_log')
    .select('created_at, actor_id, actor_role, action, entity_type, entity_id, metadata, booking_id')
    .eq('entity_type', entityTable.toLowerCase())
    .eq('entity_id', entityId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error(`Error fetching audit logs for ${entityTable}:${entityId}:`, error);
    throw error;
  }

  return data as AuditLogEntry[];
};

/**
 * Fetches audit logs related to a specific booking ID.
 * This includes logs explicitly linked via booking_id column
 * AND old logs where entity_type was 'booking' and entity_id was the booking ID.
 */
export const fetchAuditLogsByBookingId = async (bookingId: string) => {
  const { data, error } = await supabase
    .from('system_audit_log')
    .select('created_at, actor_id, actor_role, action, entity_type, entity_id, metadata, booking_id')
    .or(`booking_id.eq.${bookingId},and(entity_type.eq.booking,entity_id.eq.${bookingId})`)
    .order('created_at', { ascending: false });

  if (error) {
    console.error(`Error fetching audit logs for booking ${bookingId}:`, error);
    throw error;
  }

  return data as AuditLogEntry[];
};
