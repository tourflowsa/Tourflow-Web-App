import { supabase } from './supabase';

const STORAGE_BUCKET = 'public-assets';

let cachedCountries: string[] | null = null;
const cachedProvinces: Record<string, string[]> = {};

/**
 * Returns supported countries. Fixed to "South Africa" as per platform requirements.
 */
export async function fetchCountries(): Promise<string[]> {
  return ["South Africa"];
}

export async function getCountries(): Promise<string[]> {
  if (cachedCountries) return cachedCountries;
  const { data, error } = await supabase.from('countries').select('name').order('name');
  if (error) throw error;
  cachedCountries = data.map(c => c.name);
  return cachedCountries;
}

export async function getProvincesByCountry(countryName: string): Promise<string[]> {
  if (!countryName) return [];
  if (cachedProvinces[countryName]) return cachedProvinces[countryName];
  const { data, error } = await supabase.from('provinces').select('name').eq('country', countryName).order('name');
  if (error) throw error;
  const list = data.map(p => p.name);
  cachedProvinces[countryName] = list;
  return list;
}

/**
 * Shared helper to fetch provinces by country code/name.
 * Respects the country_code field for mapping provinces.
 */
export async function fetchProvinces(country: string): Promise<string[]> {
  if (!country) return [];
  try {
    // Map "South Africa" to "ZA" for the country_code column, but also fallback to the original string
    const countryCode = country === 'South Africa' ? 'ZA' : country;
    const { data, error } = await supabase
      .from('provinces')
      .select('name')
      .or(`country_code.eq.${countryCode},country_code.eq.${country}`)
      .order('name', { ascending: true });

    if (error) {
      console.error('Supabase error fetching provinces:', error);
      throw error;
    }

    return (data || []).map(p => p.name);
  } catch (err) {
    console.error('Failed to fetch provinces for country:', country, err);
    return [];
  }
}

// Internal helper to ensure we only write allowed lowercase enum values to the DB.
function normalizeStatusForDb(status: any): 'active' | 'inactive' | 'maintenance' {
  const s = String(status ?? 'active').trim().toLowerCase();
  if (s === 'inactive' || s === 'archived' || s === 'disabled') return 'inactive';
  if (s === 'maintenance' || s.includes('maintenance')) return 'maintenance';
  return 'active';
}

// What you SHOW in the UI.
function normalizeStatusLabel(status: any): 'Active' | 'Inactive' | 'Maintenance' {
  const s = normalizeStatusForDb(status);
  if (s === 'inactive') return 'Inactive';
  if (s === 'maintenance') return 'Maintenance';
  return 'Active';
}

/**
 * Operator "Owned" vehicles:
 * vehicles.operator_id = operatorId
 * and (vehicles.owner_id is null OR vehicles.owner_id = operatorId)
 * Excludes inactive.
 */
export async function getOperatorOwnedVehicles(operatorId: string) {
  const { data, error } = await supabase
    .from('vehicles')
    .select('*')
    .eq('operator_id', operatorId)
    .or(`owner_id.is.null,owner_id.eq.${operatorId}`)
    .neq('status', 'inactive')
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data || []).map((v: any) => ({ ...v, status: normalizeStatusLabel(v.status) }));
}

/**
 * Operator "Hired" vehicles:
 * Queries public.operator_vehicle_links directly with a join on vehicles.
 * This is the source of truth for active hire relationships and negotiation state.
 * Returns only approved links for the picker and calculates effective rates.
 */
export async function getOperatorHiredVehicles(operatorId: string) {
  const { data, error } = await supabase
    .from('operator_vehicle_links')
    .select(`
      vehicle_id,
      status,
      rate_status,
      operator_proposed_day_rate,
      operator_proposed_hour_rate,
      owner_counter_day_rate,
      owner_counter_hour_rate,
      vehicles:vehicle_id (
        id,
        make,
        model,
        license_plate,
        seat_count,
        status,
        is_active,
        is_verified,
        default_day_rate,
        default_hour_rate,
        rate_currency,
        city,
        province,
        country,
        owner_id,
        operator_id,
        main_photo_url,
        photo_urls
      )
    `)
    .eq('operator_id', operatorId)
    .eq('status', 'approved');

  if (error) throw error;

  const rows = (data || []).map((row: any) => {
    const v = row.vehicles;
    if (!v) return null;

    return {
      ...v,
      link_status: row.status,
      rate_status: row.rate_status,
      operator_proposed_day_rate: row.operator_proposed_day_rate,
      operator_proposed_hour_rate: row.operator_proposed_hour_rate,
      owner_counter_day_rate: row.owner_counter_day_rate,
      owner_counter_hour_rate: row.owner_counter_hour_rate
    };
  }).filter(Boolean) as any[];

  // HARD RULE: hired vehicles must NOT be owned by this operator
  // Operator-owned vehicles in your schema are identified by vehicles.operator_id === operatorId
  const hiredOnly = rows.filter((v: any) => {
    const ownerId = v.owner_id ?? null;
    const operatorVehicleOwnerId = v.operator_id ?? null;

    // exclude operator-owned and self-owned and records with missing owner
    if (operatorVehicleOwnerId === operatorId) return false;
    if (ownerId === operatorId) return false;
    if (!ownerId) return false;

    // keep only vehicles owned by someone else
    return ownerId !== operatorId;
  });

  return hiredOnly;
}

/**
 * Aliases used by existing UI imports.
 */
export const getLinkedVehiclesForOperator = getOperatorHiredVehicles;
export async function getOperatorVehicles(operatorId: string) {
  return getOperatorOwnedVehicles(operatorId);
}
export async function getFleetVehicles(operatorId: string) {
  return getOperatorVehicles(operatorId);
}

/**
 * Used by operator UI widgets (badges / cards) to show active fleet size.
 * Counts ACTIVE vehicles owned by the operator (not hired).
 */
export async function getActiveFleetCountForOperator(operatorId: string) {
  const { count, error } = await supabase
    .from('vehicles')
    .select('id', { count: 'exact', head: true })
    .eq('operator_id', operatorId)
    .in('status', ['active', 'Active'])
    .or(`owner_id.is.null,owner_id.eq.${operatorId}`);

  if (error) throw error;
  return count ?? 0;
}
/**
 * Backwards-compatible alias used by some UI modules.
 * Do not remove without updating imports.
 */
export const activeFleetCountForOperator = getActiveFleetCountForOperator;

/**
 * Fleet owner vehicles.
 */
export async function getOwnerVehicles(ownerId: string) {
  const { data, error } = await supabase
    .from('vehicles')
    .select('*')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data || []).map((v: any) => ({ ...v, status: normalizeStatusLabel(v.status) }));
}

/**
 * Alias used in VehicleOwnerDashboard and other pages.
 */
export async function getFleetOwnerVehicles(ownerId: string) {
  return getOwnerVehicles(ownerId);
}

/**
 * Generic fetch by id.
 */
export async function getVehicleById(vehicleId: string) {
  const { data, error } = await supabase
    .from('vehicles')
    .select(`
      *,
      profiles:owner_id (id, role, full_name, company_name, avatar_url, profile_image_url, verification_status, is_active, metadata, default_day_rate, default_hour_rate, city, province, country, bio, created_at, updated_at)
    `)
    .eq('id', vehicleId)
    .single();
  if (error) throw error;
  return { ...data, status: normalizeStatusLabel((data as any)?.status) };
}

/**
 * Returns a subset of vehicle details for public listing (Operators browsing Directory)
 */
export async function getVehiclePublicProfile(vehicleId: string) {
  const { data, error } = await supabase
    .from('vehicles')
    .select(`
      id, make, model, year_model, body_type, seat_count, 
      fuel_type, transmission, has_aircon, has_wifi, 
      has_tow_bar, wheelchair_access, has_child_seat, 
      seat_type, luggage_capacity, default_day_rate, 
      default_hour_rate, rate_currency, photos,
      owner_id, country, province, city, notes,
      profiles:owner_id (id, role, full_name, company_name, avatar_url, profile_image_url, verification_status, is_active, metadata, default_day_rate, default_hour_rate, city, province, country, bio, created_at, updated_at)
    `)
    .eq('id', vehicleId)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Fetches a single public profile by ID.
 * Updated to query profiles table directly to ensure all fields are included.
 */
export async function getPublicProfile(userId: string) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, role, full_name, company_name, avatar_url, profile_image_url, verification_status, is_active, metadata, default_day_rate, default_hour_rate, city, province, country, bio, created_at, updated_at, vat_registered')
      .eq('id', userId)
      .maybeSingle();
    if (error) throw error;
    return data as any;
  } catch (err) {
    console.error('getPublicProfile failed:', err);
    return null;
  }
}

/**
 * Create a vehicle record.
 * Keep this thin. Validation belongs in the UI and RLS policies.
 */
export const createVehicle = async (vehicle: Record<string, any>) => {
  const payload = {
    ...vehicle,
    status: normalizeStatusForDb(vehicle.status ?? 'active'),
    is_active: normalizeStatusForDb(vehicle.status ?? 'active') === 'active'
  };

  const { data, error } = await supabase
    .from('vehicles')
    .insert(payload)
    .select('*')
    .single();

  if (error) throw error;
  return data;
};

/**
 * Update a vehicle record by id.
 */
export const updateVehicle = async (vehicleId: string, patch: Record<string, any>) => {
  const nextPatch = { ...patch };

  if (nextPatch.status) {
    const dbStatus = normalizeStatusForDb(nextPatch.status);
    nextPatch.status = dbStatus;
    nextPatch.is_active = dbStatus === 'active';
  }

  const { data, error } = await supabase
    .from('vehicles')
    .update(nextPatch)
    .eq('id', vehicleId)
    .select('*')
    .single();

  if (error) throw error;
  return data;
};

/**
 * Set vehicle status (operator or owner).
 * IMPORTANT: writes lowercase enum values to vehicles.status.
 */
export async function setVehicleStatus(vehicleId: string, actorId: string, status: string) {
  const dbStatus = normalizeStatusForDb(status);

  const { error } = await supabase
    .from('vehicles')
    .update({
      status: dbStatus,
      is_active: dbStatus === 'active',
    })
    .eq('id', vehicleId)
    .or(`operator_id.eq.${actorId},owner_id.eq.${actorId}`);

  if (error) {
    return { ok: false, reason: (error as any)?.message || String(error) };
  }

  return { ok: true, reason: null as string | null };
}

/**
 * Archive / Unarchive.
 * Keep deleteVehicle for backwards compatibility.
 */
export async function archiveVehicle(vehicleId: string, actorId: string) {
  const { count, error: countError } = await supabase
    .from('bookings')
    .select('*', { count: 'exact', head: true })
    .eq('vehicle_id', vehicleId)
    .gte('start_date', new Date().toISOString())
    .neq('status', 'cancelled');

  if (countError) throw countError;

  if (count && count > 0) {
    return { success: false, error: 'HAS_FUTURE_BOOKINGS', count };
  }

  const res = await setVehicleStatus(vehicleId, actorId, 'inactive');
  return { success: res.ok, error: res.reason, count: 0 };
}

export async function unarchiveVehicle(vehicleId: string, actorId: string) {
  const res = await setVehicleStatus(vehicleId, actorId, 'active');
  return { success: res.ok, error: res.reason };
}

export async function deleteVehicle(vehicleId: string, actorId: string) {
  return archiveVehicle(vehicleId, actorId);
}

/**
 * Photos
 */
export async function uploadVehiclePhotos(vehicleId: string, files: File[]) {
  const uploaded: any[] = [];
  let failedCount = 0;
  const errors: string[] = [];

  for (const file of files) {
    try {
      if (!file.name) {
        failedCount++;
        continue;
      }

      // Sanitize extension to lowercase alphanumeric
      const rawExt = file.name.split('.').pop() || '';
      const ext = rawExt.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
      
      // Sanitize file name: lowercase, spaces to hyphens, remove unsafe chars
      const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || 'photo';
      const safeName = baseName
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');
      
      const path = `vehicles/${vehicleId}/${crypto.randomUUID()}-${safeName}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(path, file, { 
          upsert: true,
          contentType: file.type || 'image/jpeg'
        });

      if (uploadError) {
        console.error('Upload error for file:', file.name, uploadError);
        failedCount++;
        errors.push(`${file.name}: ${uploadError.message}`);
        continue;
      }

      const { data: publicUrlData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);

      uploaded.push({
        id: crypto.randomUUID(),
        path,
        url: publicUrlData.publicUrl,
        is_primary: false,
        created_at: new Date().toISOString(),
      });
    } catch (err: any) {
      console.error('Unexpected error uploading file:', file.name, err);
      failedCount++;
      errors.push(`${file.name}: ${err.message || 'Unknown error'}`);
    }
  }

  return { uploaded, failedCount, errors };
}

/**
 * Internal storage deletion.
 */
async function deleteStoragePhoto(photoPath: string) {
  const { error } = await supabase.storage.from(STORAGE_BUCKET).remove([photoPath]);
  if (error) console.error('Error deleting photo:', error.message);
}

/**
 * Remove a vehicle photo from DB and Storage.
 */
export async function deleteVehiclePhoto(vehicleId: string, photoId: string) {
  // 1. Fetch vehicle
  const vehicle = await getVehicleById(vehicleId);
  if (!vehicle) {
    throw new Error('Vehicle not found');
  }

  const photos = vehicle.photos || [];

  const photoToDelete = photos.find((p: any) => p.id === photoId);
  if (!photoToDelete) {
     throw new Error('Photo not found');
  }

  // 2. Delete storage object
  await deleteStoragePhoto(photoToDelete.path);

  // 3. Remove from JSONB array
  const remainingPhotos = photos.filter((p: any) => p.id !== photoId);

  // 4. Handle primary photo
  let mainPhotoUrl = vehicle.main_photo_url;
  if (photoToDelete.is_primary) {
      // If deleted photo was primary, find a new one
      const newPrimary = remainingPhotos[0] || null;
      if (newPrimary) {
          // We must update the record for the new primary too, but updateVehicle
          // will take the whole array.
          newPrimary.is_primary = true;
          mainPhotoUrl = newPrimary.url;
      } else {
          mainPhotoUrl = null;
      }
  }

  // Update vehicle in DB
  const updatedVehicle = await updateVehicle(vehicleId, {
      photos: remainingPhotos,
      main_photo_url: mainPhotoUrl
  });

  return { photos: updatedVehicle.photos, main_photo_url: updatedVehicle.main_photo_url };
}


/**
 * Directory search.
 * Enforces "South Africa" context (with legacy "ZA" support) and excludes requester's own fleet.
 */
export async function searchVehiclesForDirectory(
  operatorId: string,
  filters: { make?: string; model?: string; seats?: number; country?: string; province?: string; city?: string; body_type?: string }
) {
  const parts = [filters.make, filters.model].map((x) => (x ?? '').trim()).filter(Boolean);
  const q = parts.length ? parts.join(' ') : null;
  const cityQ = filters.city?.trim().toLowerCase();
  
  try {
    let query = supabase
      .from('vehicles')
      .select(`
        *,
        profiles:owner_id (full_name, company_name, verification_status, metadata, vat_registered)
      `)
      .in('status', ['active', 'active'])
      .eq('is_active', true);

    // Exclude current user's own vehicles from the discovery directory
    if (operatorId) {
      query = query.neq('owner_id', operatorId);
    }

    // Country filter - default to South Africa if not specified or "Any"
    // Supports future country rollout by checking filters.country
    const countryFilter = (filters.country && filters.country !== 'Any') ? filters.country : 'South Africa';
    
    if (countryFilter === 'South Africa') {
      query = query.in('country', ['South Africa', 'ZA']);
    } else {
      query = query.eq('country', countryFilter);
    }

    if (q) {
      query = query.or(`make.ilike.%${q}%,model.ilike.%${q}%`);
    }

    if (filters.seats) {
      query = query.gte('seat_count', filters.seats);
    }

    // Ensure we don't apply an empty string or "Any" string as a filter
    if (filters.province && filters.province !== 'Any' && filters.province !== '') {
      query = query.eq('province', filters.province);
    }

    if (filters.body_type && filters.body_type !== 'Any' && filters.body_type !== '') {
      query = query.eq('body_type', filters.body_type);
    }

    // Apply city filter only when normalized query has length >= 2
    // Uses case-insensitive partial match via ilike
    if (cityQ && cityQ.length >= 2) {
      query = query.ilike('city', `%${cityQ}%`);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

if (error) throw error;

    const rows = (data || []);
    const hasMissingProfile = (r: any) =>
      (!r.profiles || (Array.isArray(r.profiles) && r.profiles.length === 0)) && r.owner_id;

    if (rows.some(hasMissingProfile)) {
      const ownerIds = Array.from(new Set(rows.filter(r => r.owner_id).map(r => r.owner_id)));
      const { data: profs } = await supabase.rpc('get_public_profiles', { p_ids: ownerIds });
      const profMap = new Map((profs || []).map((p: any) => [p.id, p]));
      
      rows.forEach(r => {
        if (hasMissingProfile(r)) {
          r.profiles = profMap.get(r.owner_id) || null;
        }
      });
    }

    return rows;
  } catch (err) {
    console.error("Provider Directory search failed:", err);
    throw err;
  }
}

/**
 * Fetches all vehicle link records for an operator, joined with vehicle details.
 * Queries public.operator_vehicle_links instead of legacy vehicle_links.
 */
export async function listVehicleLinksForOperator(operatorId: string) {
  const { data, error } = await supabase
    .from('vehicle_links')
    .select(`
      id,
      operator_id,
      vehicle_id,
      status,
      created_at,
      updated_at,
      vehicle:vehicles (
        id,
        make,
        model,
        license_plate,
        seat_count,
        status,
        photos,
        owner_id,
        operator_id,
        ownership_type
      )
    `)
    .eq('operator_id', operatorId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  const rows = (data as any[]) || [];

  // Exclude operator-owned vehicles from "Hired"
  const filtered = rows.filter((r) => {
    const v = r?.vehicle;
    if (!v) return false;

    const vehicleOwnerId = v.owner_id ?? null;
    const vehicleOperatorId = v.operator_id ?? null;

    // If the operator owns the vehicle (either field), it is NOT hired
    if (vehicleOwnerId === operatorId) return false;
    if (vehicleOperatorId === operatorId) return false;

    return true;
  });

  return filtered;
}

/**
 * Fetches the specific link status between an operator and a vehicle.
 */
export async function fetchLinkStatusForOperator(operatorId: string, vehicleId: string): Promise<string> {
  const { data, error } = await supabase
    .from('operator_vehicle_links')
    .select('status')
    .eq('operator_id', operatorId)
    .eq('vehicle_id', vehicleId)
    .maybeSingle();

  if (error) return 'none';
  return data?.status || 'none';
}

/**
 * Fetches vehicle link requests for a some owner.
 * Filters vehicle_links where the associated vehicle is owned by ownerId.
 */
export async function listVehicleLinkRequestsForOwner(ownerId: string) {
  const { data, error } = await supabase
    .from('vehicle_links')
    .select('*, vehicle:vehicles!inner(make, model, license_plate, seat_count)')
    .eq('vehicles.owner_id', ownerId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error listing link requests:', error);
    throw error;
  }

  return data as any[];
}

/**
 * Summary counts of link requests for a Fleet Owner
 */
export async function getOwnerLinkRequestCounts(ownerId: string) {
  const { data, error } = await supabase
    .from('vehicle_links')
    .select('status, vehicles!inner(owner_id)')
    .eq('vehicles.owner_id', ownerId);

  if (error) throw error;

  const counts = { pending: 0, approved: 0, revoked: 0 };
  (data || []).forEach(row => {
    const s = String(row.status).toLowerCase();
    if (s === 'pending') counts.pending++;
    else if (s === 'approved') counts.approved++;
    else if (s === 'revoked' || s === 'rejected') counts.revoked++;
  });

  return counts;
}

/**
 * Paginated and searchable link requests for a Fleet Owner.
 * Hydrates operator profile data using the secure get_public_profiles RPC.
 * Hydrates rate link data from operator_vehicle_links.
 */
export async function listOwnerLinkRequestsPaginated(params: {
  ownerId: string;
  status: string;
  search?: string;
  page: number;
  limit: number;
}) {
  const { ownerId, status, search, page, limit } = params;
  const offset = (page - 1) * limit;

  let query = supabase
    .from('vehicle_links')
    .select(`
      *,
      vehicle:vehicles!inner(id, make, model, license_plate, owner_id)
    `, { count: 'exact' })
    .eq('vehicles.owner_id', ownerId);

  if (status === 'revoked') {
    query = query.in('status', ['revoked', 'rejected']);
  } else {
    query = query.eq('status', status);
  }

  if (search) {
    query = query.or(`vehicles.make.ilike.%${search}%,vehicles.model.ilike.%${search}%,vehicles.license_plate.ilike.%${search}%`);
  }

  const { data, error, count } = await query
    .order('updated_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;

  // Hydrate operator data using the public profile RPC
  if (data && data.length > 0) {
    const operatorIds = Array.from(new Set(data.map(d => d.operator_id)));
    const vehicleIds = Array.from(new Set(data.map(d => d.vehicle_id)));

    const [profilesRes, rateLinksRes] = await Promise.all([
      supabase.rpc('get_public_profiles', { p_ids: operatorIds }),
      supabase
        .from('operator_vehicle_links')
        .select('id, operator_id, vehicle_id, rate_status, rate_currency, operator_proposed_day_rate, operator_proposed_hour_rate, owner_counter_day_rate, owner_counter_hour_rate, rates_updated_at, rates_updated_by')
        .in('operator_id', operatorIds)
        .in('vehicle_id', vehicleIds)
    ]);

    const { data: profiles, error: profError } = profilesRes;
    const { data: rateLinks, error: rateError } = rateLinksRes;

    const profMap = new Map((profiles || []).map((p: any) => [p.id, p]));
    const rateMap = new Map((rateLinks || []).map((rl: any) => [`${rl.operator_id}:${rl.vehicle_id}`, rl]));

    data.forEach(row => {
      row.operator = profMap.get(row.operator_id) || null;
      row.rate_link = rateMap.get(`${row.operator_id}:${row.vehicle_id}`) || null;
    });
  }

  return {
    data: data as any[],
    count: count || 0,
    totalPages: Math.ceil((count || 0) / limit)
  };
}

/**
 * Updates the status of a vehicle link request.
 */
export async function setVehicleLinkStatus(linkId: string, status: 'approved' | 'rejected' | 'revoked') {
  const { error } = await supabase
    .from('vehicle_links')
    .update({ 
      status, 
      updated_at: new Date().toISOString() 
    })
    .eq('id', linkId);

  if (error) {
    console.error('Error updating link status:', error);
    throw error;
  }

  return true;
}

/**
 * Strict revocation by link ID.
 * Updates public.vehicle_links set status='revoked' where id=linkId.
 */
export async function revokeVehicleLink(linkId: string): Promise<void> {
  const { data, error } = await supabase
    .from('vehicle_links')
    .update({ 
      status: 'revoked', 
      updated_at: new Date().toISOString() 
    })
    .eq('id', linkId)
    .select();

  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error('No matching link found to revoke.');
  }
}

/**
 * Revokes access for a specific vehicle and operator pair.
 * Kept for backwards compatibility but updated to be strict.
 */
export async function revokeVehicleAccess(params: { vehicleId: string; operatorId: string }): Promise<void> {
  const { data, error } = await supabase
    .from('vehicle_links')
    .update({ status: 'revoked', updated_at: new Date().toISOString() })
    .eq('vehicle_id', params.vehicleId)
    .eq('operator_id', params.operatorId)
    .eq('status', 'approved')
    .select();

  if (error) throw error;
  if (!data || data.length === 0) throw new Error('No matching approved link found to revoke');
}

// ===============================
// Vehicle Availability (Owner)
// Table: public.availability
// Columns: user_id, vehicle_id, date_start, date_end, is_blocked, reason
// ===============================

export async function listVehicleAvailabilityBlocks(vehicleId: string) {
  const { data, error } = await supabase
    .from('availability')
    .select('*')
    .eq('vehicle_id', vehicleId)
    .order('date_start', { ascending: true });

  if (error) throw error;

  const rows = data || [];

  // Map DB column names to the names the UI is likely rendering
  return rows.map((r: any) => ({
    ...r,
    start_date: r.date_start,
    end_date: r.date_end,
  }));
}

export async function listVehiclesAvailabilityBlocks(vehicleIds: string[]) {
  if (!vehicleIds || vehicleIds.length === 0) return [];
  const { data, error } = await supabase
    .from('availability')
    .select('*')
    .in('vehicle_id', vehicleIds)
    .order('date_start', { ascending: true });

  if (error) throw error;

  const rows = data || [];

  return rows.map((r: any) => ({
    ...r,
    start_date: r.date_start,
    end_date: r.date_end,
  }));
}

export async function getVehicleAvailabilityBlocks(vehicleIds: string[], startDate: string, endDate: string) {
  if (vehicleIds.length === 0) return [];
  
  // Truncate timestamps to date if needed, but Postgres handles ISO date-time vs date well
  const { data, error } = await supabase
    .from('availability')
    .select('vehicle_id, date_start, date_end, reason')
    .in('vehicle_id', vehicleIds)
    .eq('is_blocked', true)
    .lte('date_start', endDate)
    .gte('date_end', startDate);

  if (error) throw error;
  return data || [];
}

export async function createVehicleAvailabilityBlock(
  vehicleId: string,
  userId: string,
  startDate: string,
  endDate: string,
  reason?: string
) {
  const { error } = await supabase.from('availability').insert({
    vehicle_id: vehicleId,
    user_id: userId,
    date_start: startDate,
    date_end: endDate,
    is_blocked: true,
    reason: reason || null,
  });

  if (error) throw error;
}

export async function deleteVehicleAvailabilityBlock(blockId: string) {
  const { error } = await supabase.from('availability').delete().eq('id', blockId);
  if (error) throw error;
}

// Link requests (operator -> vehicle owner)

export type VehicleLinkStatus = 'pending' | 'approved' | 'rejected' | 'revoked' | null;

export async function getVehicleLinkStatus(vehicleId: string, operatorId: string): Promise<VehicleLinkStatus> {
  const { data, error } = await supabase
    .from('operator_vehicle_links')
    .select('status')
    .eq('vehicle_id', vehicleId)
    .eq('operator_id', operatorId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data?.status as VehicleLinkStatus) ?? null;
}

/**
 * Request link (RPC).
 * Unified implementation with pre-check and correct argument ordering.
 */
export async function requestVehicleLink(vehicleId: string, operatorId: string): Promise<{ success: boolean; message: string; status: VehicleLinkStatus }> {
  // Check for existing pending or approved link
  const { data: existing, error: checkError } = await supabase
    .from('operator_vehicle_links')
    .select('id, status')
    .eq('operator_id', operatorId)
    .eq('vehicle_id', vehicleId)
    .in('status', ['pending', 'approved'])
    .maybeSingle();

  if (checkError) throw checkError;
  if (existing) {
    return { success: false, message: "Request already exists.", status: existing.status as VehicleLinkStatus };
  }

  // Use the established RPC for the request
  const { data, error } = await supabase.rpc('request_vehicle_link', {
    p_operator_id: operatorId,
    p_vehicle_id: vehicleId,
  });

  if (error) throw error;

  // Handles both return shapes:
  // A) TABLE(success boolean, message text) -> data is array
  // B) json -> data is object
  const row = Array.isArray(data) ? data[0] : data;

  const success = Boolean(row?.success ?? true);
  const message = String(row?.message ?? (success ? 'Request sent.' : 'Request failed.'));
  const status = (row?.status as VehicleLinkStatus) ?? (success ? 'pending' : null);

  return { success, message, status };
}

/**
 * Rate Negotiation Service
 */

export async function getOperatorVehicleRateLink(operatorId: string, vehicleId: string) {
  const { data, error } = await supabase
    .from('operator_vehicle_links')
    .select('*')
    .eq('operator_id', operatorId)
    .eq('vehicle_id', vehicleId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Propose Rates
 * Uses an atomic upsert with strictly formatted on_conflict columns.
 * Requires a unique index on (operator_id, vehicle_id) in the DB.
 */
export async function proposeRates(params: {
  operatorId: string;
  vehicleId: string;
  actorId: string;
  dayRate: number | null;
  hourRate: number | null;
  currency: string;
}) {
  // 1) Find the existing approved link row
  const { data: existing, error: findError } = await supabase
    .from('operator_vehicle_links')
    .select('id, status')
    .eq('operator_id', params.operatorId)
    .eq('vehicle_id', params.vehicleId)
    .maybeSingle();

  if (findError) throw findError;

  if (!existing) {
    throw new Error('No operator-vehicle link row found. Ask the owner to approve the link again.');
  }

  if (String(existing.status).toLowerCase() !== 'approved') {
    throw new Error('Vehicle link must be approved before proposing rates.');
  }

  // 2) Update only, no upsert
  const { data, error } = await supabase
    .from('operator_vehicle_links')
    .update({
      operator_proposed_day_rate: params.dayRate,
      operator_proposed_hour_rate: params.hourRate,
      rate_status: 'proposed',
      rate_currency: params.currency || 'ZAR',
      rates_updated_at: new Date().toISOString(),
      rates_updated_by: params.actorId,
    })
    .eq('id', existing.id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function counterRates(params: { rateLinkId: string, actorId: string, dayRate: number, hourRate: number }) {
  const { data, error } = await supabase
    .from('operator_vehicle_links')
    .update({
      owner_counter_day_rate: params.dayRate,
      owner_counter_hour_rate: params.hourRate,
      rate_status: 'countered',
      rates_updated_at: new Date().toISOString(),
      rates_updated_by: params.actorId
    })
    .eq('id', params.rateLinkId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function acceptRates(params: { rateLinkId: string, actorId: string }) {
  const { data, error } = await supabase
    .from('operator_vehicle_links')
    .update({
      rate_status: 'accepted',
      rates_updated_at: new Date().toISOString(),
      rates_updated_by: params.actorId
    })
    .eq('id', params.rateLinkId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Fetches effective accepted negotiated rates for an operator-vehicle link.
 */
export async function getAcceptedRatesForOperatorVehicle(operatorId: string, vehicleId: string): Promise<null | { dayRate: number | null; hourRate: number | null; currency: string }> {
  const { data, error } = await supabase
    .from('operator_vehicle_links')
    .select('status, rate_status, rate_currency, operator_proposed_day_rate, operator_proposed_hour_rate, owner_counter_day_rate, owner_counter_hour_rate')
    .eq('operator_id', operatorId)
    .eq('vehicle_id', vehicleId)
    .maybeSingle();

  if (error || !data) return null;
  if (String(data.status).toLowerCase() !== 'approved' || String(data.rate_status).toLowerCase() !== 'accepted') return null;

  const dayRate = data.owner_counter_day_rate ?? data.operator_proposed_day_rate;
  const hourRate = data.owner_counter_hour_rate ?? data.operator_proposed_hour_rate;

  const validDay = (typeof dayRate === 'number' && Number.isFinite(dayRate) && dayRate > 0) ? dayRate : null;
  const validHour = (typeof hourRate === 'number' && Number.isFinite(hourRate) && hourRate > 0) ? hourRate : null;

  return {
    dayRate: validDay,
    hourRate: validHour,
    currency: data.rate_currency || 'ZAR'
  };
}