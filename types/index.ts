export type UserRole = 'admin' | 'operator' | 'guide' | 'driver' | 'vehicle_owner';

export type VerificationStatus = 'unverified' | 'pending' | 'verified' | 'rejected';

export type DocumentType = 
  | 'id_document' 
  | 'pdp_license' 
  | 'prdp'
  | 'operating_license' 
  | 'vehicle_insurance' 
  | 'guide_certificate' 
  | 'tour_guide_permit'
  | 'liability_insurance' 
  | 'business_reg' 
  | 'bank_proof' 
  | 'vat_cert' 
  | 'first_aid' 
  | 'driver_license' 
  | 'vehicle_reg' 
  | 'insurance_cert' 
  | 'other';

// Mapping 'approved' concept to 'valid' to match legacy schema if constraints exist
export type DocumentStatus = 'pending' | 'valid' | 'expired' | 'rejected';

// Computed status for UI display only
export type DocumentDisplayStatus = 'pending' | 'valid' | 'rejected' | 'expired' | 'expiring_soon';

export interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  full_name: string | null;
  company_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  profile_image_url: string | null;
  verification_status: VerificationStatus;
  is_active: boolean;
  metadata: Record<string, any>;
  default_day_rate: number | null;
  default_hour_rate: number | null;
  vat_registered?: boolean;
  vat_number?: string | null;
  vat_rate?: number | null;
  city?: string | null;
  province?: string | null;
  country?: string | null;
  bio?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  user_id: string;
  document_type: DocumentType;
  file_path: string; 
  status: DocumentStatus;
  expiry_date: string | null; // YYYY-MM-DD
  metadata: Record<string, any>;
  created_at: string;
  
  // Review Workflow
  role?: string;
  rejection_reason?: string | null;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
}

export interface ComplianceSummary {
  isCompliant: boolean;
  missingCount: number;
  expiredCount: number;
  expiringSoonCount: number;
  pendingReviewCount: number;
  rejectedCount: number;
  totalRequired: number;
}

export type TourStatus = 'draft' | 'published' | 'archived';

export interface Tour {
  id: string;
  operator_id: string;
  title: string;
  description: string | null;
  region: string | null;
  duration_days: number;
  duration_hours: number;
  max_guests: number;
  price_amount: number;
  currency: string;
  vat_rate: number;
  is_price_including_vat: boolean;
  status: TourStatus;
  gallery_urls: string[] | null;
  tags: string[] | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type BookingStatus = 'draft' | 'pending' | 'confirmed' | 'cancelled' | 'completed';

export type PaymentStatus = 'payment_pending' | 'funds_received' | 'funds_held' | 'payout_ready' | 'payout_completed';

export interface Booking {
  id: string;
  operator_id: string;
  tour_id: string;
  booking_reference: string;
  status: BookingStatus;
  start_date: string;
  end_date: string;
  
  // Updated schema fields
  num_guests: number;
  guest_name: string | null;
  guest_email: string | null;
  guest_phone?: string | null;
  
  currency: string;
  subtotal_amount: number;
  vat_rate: number;
  vat_amount: number;
  total_amount: number;

  // Escrow / Payment Tracking
  payment_status: PaymentStatus;
  funds_received_amount: number;
  funds_held_amount: number;
  funds_released_amount: number;
  funds_remaining_amount: number;
  payment_received_at: string | null;

  // Proper Escrow System Fields
  escrow_status?: 'pending_payment' | 'funds_received' | 'partially_released' | 'fully_released' | 'refunded' | 'disputed';
  escrow_total?: number;
  escrow_held?: number;
  escrow_released?: number;
  escrow_remaining?: number;

    // Vehicle snapshot fields (B2B)
  vehicle_id?: string | null;
  vehicle_rate_type?: 'day' | 'hour' | null;
  vehicle_rate_amount?: number | null;
  vehicle_rate_overridden: boolean;
  
  // Computed internal costs (SQL)
  internal_cost_vehicle?: number | null;
  internal_cost_driver?: number | null;
  internal_cost_guide?: number | null;
  internal_cost_total?: number | null;
  internal_margin?: number | null;
  
  // Fee Snapshots (New)
  applied_fee_percent?: number | null;
  applied_platform_fee?: number | null;
  applied_net_amount?: number | null;
  
  pickup_location?: string | null;
  dropoff_location?: string | null;
  special_requests?: string | null;
  internal_notes?: string | null;
  notes: string | null;
  is_pricing_locked?: boolean;
  archived_at?: string | null;
  archived_by?: string | null;
  created_at: string;
  updated_at: string;
  
  // Joins
  tours?: Pick<Tour, 'title' | 'id' | 'region'>;
}

export interface BookingAssignment {
  id: string;
  booking_id: string;
  resource_id: string;
  resource_type: 'driver' | 'guide' | 'vehicle';
  status: 'pending' | 'accepted' | 'rejected' | 'completed';
  updated_at: string;
  
  // Snapshot fields
  rate_amount?: number | null;
  rate_type?: 'day' | 'hour' | null;
  rate_overridden?: boolean;

  // Joins
  bookings?: Booking;
}

export interface ProviderAssignmentArchive {
  id: string;
  assignment_id: string;
  resource_id: string;
  resource_type: 'driver' | 'guide';
  archived_at: string;
}

export interface DriverAvailabilityRequest {
  id: string;
  operator_id: string;
  driver_id: string;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
  start_date: string;
  end_date: string;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  responded_at?: string | null;
  responded_by?: string | null;
  converted_booking_id?: string | null;
  // Hydrated fields
  driver?: {
    full_name: string | null;
    email: string | null;
    avatar_url?: string | null;
    profile_image_url?: string | null;
  };
  operator?: {
    full_name: string | null;
    email: string | null;
    company_name?: string | null;
    avatar_url?: string | null;
    profile_image_url?: string | null;
  };
}

export interface GuideAvailabilityRequest {
  id: string;
  operator_id: string;
  guide_id: string;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
  start_date: string;
  end_date: string;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  responded_at?: string | null;
  responded_by?: string | null;
  converted_booking_id?: string | null;
  // Hydrated fields
  guide?: {
    full_name: string | null;
    email: string | null;
    avatar_url?: string | null;
    profile_image_url?: string | null;
  };
  operator?: {
    full_name: string | null;
    email: string | null;
    company_name?: string | null;
    avatar_url?: string | null;
    profile_image_url?: string | null;
  };
}

export type VehicleAvailabilityRequestStatus = 'pending' | 'accepted' | 'declined' | 'cancelled';

export interface VehicleAvailabilityRequest {
  id: string;
  operator_id: string;
  vehicle_id: string;
  status: VehicleAvailabilityRequestStatus;
  start_date: string;
  end_date: string;
  rate_type: 'day' | 'hour';
  notes: string | null;
  created_at: string;
  updated_at: string;
  responded_at: string | null;
  responded_by: string | null;
  converted_booking_id: string | null;
  
  // Joins
  vehicles?: Pick<Vehicle, 'id' | 'make' | 'model' | 'license_plate' | 'owner_id'>;
  profiles?: Pick<UserProfile, 'id' | 'company_name' | 'full_name'>;
}

export type VehicleStatus = 'Active' | 'Inactive' | 'Maintenance';

export interface VehiclePhoto {
  id: string;
  url: string;
  path: string;
  is_primary: boolean;
  created_at: string;
}

export interface Vehicle {
  id: string;
  operator_id: string;
  owner_id?: string; // Optional depending on role
  
  // Basic Details
  make: string;
  model: string;
  year_model: number;
  body_type: string;
  license_plate: string;
  
  // Capacity & Performance
  seat_count: number;
  fuel_type: 'Petrol' | 'Diesel' | 'Hybrid' | 'Electric';
  transmission: 'Manual' | 'Automatic';
  
  // Comfort & Features
  has_aircon: boolean;
  has_wifi: boolean;
  has_tow_bar: boolean;
  wheelchair_access: boolean;
  has_child_seat: boolean;
  
  // Interior
  seat_type: 'Leather' | 'Cloth' | 'Other';
  seat_type_other?: string | null;
  luggage_capacity?: string | null;
  
  // Rental Rates
  default_day_rate: number | null;
  default_hour_rate: number | null;
  effective_day_rate?: number | null;
  effective_hour_rate?: number | null;
  rate_currency: string;
  rates_updated_at?: string;
  
  // Operations
  ownership_type: 'Owned' | 'Leased' | 'Partner';
  status: VehicleStatus;
  is_active: boolean;
  license_expiry?: string | null;
  notes?: string | null;
  
  // Location
  // Location fields for fleet discovery and regional filtering
  country?: string | null;
  province?: string | null;
  city?: string | null;
  
  // Media
  photos?: VehiclePhoto[];
  
  // Joins
  profiles?: UserProfile;
  
  created_at: string;
  updated_at: string;
}

export type PayoutStatus = 'pending' | 'approved' | 'paid';

export interface Payout {
  id: string;
  operator_id: string;
  provider_id: string;
  booking_id: string;
  payout_reference: string;
  status: PayoutStatus;
  
  // Financials
  currency: string;
  amount_gross: number;
  platform_fee: number;
  amount_net: number;
  original_amount?: number;
  adjusted_amount?: number;
  adjustment_reason?: string | null;
  adjusted_by?: string | null;
  adjusted_at?: string | null;
  vat_amount: number;
  vat_rate: number;
  resource_type?: 'driver' | 'guide' | 'vehicle' | string | null;

  // Tracking
  approved_at?: string | null;
  approved_by?: string | null;
  paid_at?: string | null;
  paid_by?: string | null;
  payout_method?: string | null;

  archived_at?: string | null;
  archived_by?: string | null;
  created_at: string;
  updated_at: string;

  // Hold Support
  is_on_hold: boolean;
  hold_reason: string | null;
  hold_at?: string | null;
  released_at?: string | null;
  released_by?: string | null;
  
  // Withdrawal Support
  withdrawal_request_status?: 'available' | 'requested' | 'approved' | 'rejected' | 'paid' | null;
  withdrawal_requested_at?: string | null;
  withdrawal_approved_at?: string | null;
  withdrawal_rejected_at?: string | null;
  withdrawal_processed_by?: string | null;
  withdrawal_notes?: string | null;

  // Batching Support
  batch_id?: string | null;
  batch_reference?: string | null;
  batch_ref?: string | null;

  // Audit/Receipt Fields (Aliases/Joined)
  provider_name?: string;
  provider_type?: string;
  booking_ref?: string;
  gross_amount?: number;
  net_amount?: number;
  // Joined data
  bookings?: {
    booking_reference: string;
    start_date?: string;
    tours?: {
      title: string;
    };
  } | null;
  operator_display_name?: string;
  provider_display_name?: string;
  tour_title?: string;
  service_date?: string;
}

export interface FinancialSummary {
  totalRevenue: number;
  totalPlatformFees: number;
  totalPaidOut: number;
  platformMargin: number;
  pendingLiability: number;
  totalProviderCosts: number;
  netMargin: number;
  marginPercentage: number;
  topTours: {
    tour_id: string;
    title: string;
    revenue: number;
    margin: number;
  }[];
}

export interface FeeTier {
  id?: string;
  tier_code: string;
  fee_percent?: number;
  platform_fee_rate_percent?: number;
  active?: boolean;
  is_active?: boolean;
  status?: string;
  effective_from?: string;
  effective_to?: string | null;
  updated_at?: string;
}

export interface OperatorFeeAssignment {
  id?: string;
  operator_id: string;
  fee_tier_id: string;
  tier_code?: string; // from join
  assigned_at?: string;
  effective_from: string;
}

export interface PayoutDispute {
  id: string;
  payout_id: string;
  booking_id: string | null;
  provider_id: string | null;
  operator_id: string | null;
  type: string;
  reason: string;
  notes: string | null;
  status: 'open' | 'resolved' | 'cancelled';
  resolution: string | null;
  created_by: string;
  created_at: string;
  resolved_by: string | null;
  resolved_at: string | null;
  
  // Joins
  payout?: Payout;
  booking?: Booking;
  provider?: UserProfile;
  operator?: UserProfile;
  created_by_profile?: UserProfile | null;
  resolved_by_profile?: UserProfile | null;
}
