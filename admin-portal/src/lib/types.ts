// Mirrors the backend response envelope: every successful response is
// `{ code, message, data }`; errors return `{ code, message, data: null }`.
export interface ApiEnvelope<T> {
  code: number;
  message: string;
  data: T | null;
}

export type AdminRole =
  | 'super_admin'
  | 'ops_manager'
  | 'support'
  | 'finance'
  | 'seller';

export interface AdminUser {
  id: number;
  email: string;
  fullName: string | null;
  role: AdminRole;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  admin: AdminUser;
}

export type DriverStatus = 'inactive' | 'active' | 'on_trip' | 'suspended';

export interface DriverVehicle {
  make: string | null;
  model: string | null;
  color: string | null;
  year: number | null;
  plateNumber: string | null;
  passengerCapacity: number;
}

export interface DriverPreferences {
  destinationCity: string | null;
  tripTypes: string[];
  goingHome: boolean;
  minPassengers: number | null;
  activatedAt: string | null;
  locationLat: number | null;
  locationLng: number | null;
}

export interface DriverProfile {
  id: number;
  name: string | null;
  phoneNumber: string;
  countryCode: string;
  gender: 'male' | 'female' | null;
  homeCity: string | null;
  profilePhotoUrl: string | null;
  status: DriverStatus;
  language: 'ar' | 'en';
  vehicle: DriverVehicle;
  rating: number;
  ratingCount: number;
  totalTrips: number;
  outstandingBalance: number;
  activePreferences: DriverPreferences | null;
  createdAt: string;
  updatedAt: string;
}

export interface DriverTripHistoryRow {
  id: number;
  route: string;
  type: string;
  status: string;
  departureTime: string;
  completedAt: string | null;
  totalCashCollected: number;
  netEarnings: number | null;
}

export interface DriverDeclineLogRow {
  id: number;
  reason: string;
  autoDeclined: boolean;
  declinedAt: string;
}

export interface AdminDriverDetail extends DriverProfile {
  completedTripCount: number;
  cancelledTripCount: number;
  tripHistory: DriverTripHistoryRow[];
  declineLog: DriverDeclineLogRow[];
}

export interface DriverListResponse {
  data: DriverProfile[];
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface CreateDriverPayload {
  name: string;
  phoneNumber: string;
  countryCode: string;
  gender: 'male' | 'female';
  homeCity: string;
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleColor?: string;
  vehicleYear?: number;
  plateNumber?: string;
  passengerCapacity?: number;
  language?: 'ar' | 'en';
}

export type UpdateDriverPayload = Partial<
  Omit<CreateDriverPayload, 'phoneNumber' | 'countryCode'>
>;

// ─── Trips ─────────────────────────────────────────────────────
export type DriverTripStatus =
  | 'offered'
  | 'accepted'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'expired'
  | 'declined';

export type DriverTripType =
  | 'shared'
  | 'women_only'
  | 'mixed'
  | 'packages_only';

export interface AdminTripRow {
  id: number;
  status: DriverTripStatus;
  type: DriverTripType;
  originCity: string;
  destinationCity: string;
  departureTime: string;
  driverId: number | null;
  driverName: string | null;
  totalCashExpected: number;
  totalCashCollected: number;
  netEarnings: number | null;
  acceptedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  cancellationZone: number | null;
}

export interface AdminTripsListResponse {
  data: AdminTripRow[];
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface ManifestPassenger {
  id: number;
  name: string;
  gender: string | null;
  phoneMasked: string;
  role: 'boarding' | 'alighting';
  fare: number;
  status: string;
  cashCollected: boolean | null;
}

export interface ManifestPackage {
  id: number;
  reference: string;
  senderName: string;
  senderPhoneMasked: string;
  receiverName: string;
  receiverPhoneMasked: string;
  size: string;
  description: string | null;
  fee: number;
  role: 'collecting' | 'delivering';
  status: string;
}

export interface ManifestStop {
  id: number;
  order: number;
  type: 'pickup' | 'dropoff' | 'pickup_dropoff';
  city: string;
  address: string | null;
  lat: number;
  lng: number;
  status: 'pending' | 'arrived' | 'confirmed';
  cashExpected: number;
  passengers: ManifestPassenger[];
  packages: ManifestPackage[];
}

export interface ManifestResponse {
  id: number;
  type: DriverTripType;
  status: DriverTripStatus;
  originCity: string;
  destinationCity: string;
  departureTime: string;
  currentStopIndex: number;
  totalCashExpected: number;
  totalCashCollected: number;
  commissionRate: number;
  summary: {
    stopCount: number;
    passengerCount: number;
    packageCount: number;
    estimatedDurationMinutes: number;
  };
  stops: ManifestStop[];
}

export interface ManualAssignPayload {
  driverId: number;
  type: DriverTripType;
  originCity: string;
  destinationCity: string;
  departureTime: string;
  pickupLat: number;
  pickupLng: number;
  dropoffLat: number;
  dropoffLng: number;
  pickupAddress?: string;
  dropoffAddress?: string;
  tripRequestIds: number[];
  packageDeliveryIds?: number[];
  commissionRate?: number;
  offerCountdownSeconds?: number;
}

// ─── Announcements ─────────────────────────────────────────────
export interface Announcement {
  id: number;
  title: string;
  body: string;
  ctaUrl: string | null;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  priority: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAnnouncementPayload {
  title: string;
  body: string;
  ctaUrl?: string;
  isActive?: boolean;
  startsAt?: string;
  endsAt?: string;
  priority?: number;
}

// ─── Earnings ──────────────────────────────────────────────────
export type EarningsPeriod = 'today' | 'week' | 'month';

export interface AdminEarningsKpi {
  period: EarningsPeriod;
  totalCashCollected: number;
  totalCommission: number;
  totalNetPaidToDrivers: number;
  tripCount: number;
  activeDrivers: number;
  outstandingTotal: number;
}

export interface CityRollupRow {
  city: string;
  tripCount: number;
  cashCollected: number;
  commission: number;
}

export interface AdminEarningsDashboard {
  kpi: AdminEarningsKpi;
  byOriginCity: CityRollupRow[];
}

export interface DriverBalanceRow {
  driverId: number;
  driverName: string | null;
  phoneNumber: string;
  totalTrips: number;
  outstandingBalance: number;
}

export interface DriverBalancesResponse {
  data: DriverBalanceRow[];
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  outstandingTotal: number;
}

export interface SettleBalanceResponse {
  driverId: number;
  previousBalance: number;
  amountSettled: number;
  newBalance: number;
}

// ─── Passenger requests (admin view) ───────────────────────────
export type PassengerRequestStatus =
  | 'PENDING'
  | 'MATCHED'
  | 'DRIVER_EN_ROUTE'
  | 'ARRIVED_AT_PICKUP'
  | 'TRIP_IN_PROGRESS'
  | 'ARRIVING_AT_DROPOFF'
  | 'COMPLETED'
  | 'CANCELLED';

export interface PassengerRequestRow {
  id: number;
  status: PassengerRequestStatus;
  passengerName: string;
  passengerPhone: string;
  passengerGender: string | null;
  departureCity: string | null;
  arrivalCity: string | null;
  departureLat: number;
  departureLng: number;
  arrivalLat: number;
  arrivalLng: number;
  travelDate: string | null;
  isImmediate: boolean;
  seatsCount: number;
  isFemaleOnly: boolean;
  perSeatFare: number;
  totalFare: number;
  driverId: number | null;
  driverName: string | null;
  createdAt: string;
}

export interface PassengerRequestsListResponse {
  data: PassengerRequestRow[];
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  pendingCount: number;
}

// ─── Admin trip detail (manifest + lifecycle) ──────────────────
export type LifecycleEventKind =
  | 'offered'
  | 'offer_expired'
  | 'accepted'
  | 'declined'
  | 'started'
  | 'arrived_stop'
  | 'pickup_confirmed'
  | 'dropoff_confirmed'
  | 'completed'
  | 'cancelled';

export interface LifecycleEvent {
  kind: LifecycleEventKind;
  at: string;
  label: string;
  detail: string | null;
  stopOrder: number | null;
  stopCity: string | null;
}

export interface AdminTripDriverInfo {
  id: number;
  name: string | null;
  phone: string;
  rating: number;
  ratingCount: number;
  totalTrips: number;
}

export interface TripDeclineRow {
  id: number;
  reason: string;
  autoDeclined: boolean;
  notes: string | null;
  declinedAt: string;
}

export interface TripCancellation {
  zone: number;
  reason: string;
  cancelledAt: string;
}

export interface TripPricing {
  totalCashExpected: number;
  totalCashCollected: number;
  commissionRate: number;
  commissionAmount: number;
  netEarnings: number;
}

export interface AdminTripDetail extends ManifestResponse {
  driver: AdminTripDriverInfo | null;
  lifecycle: LifecycleEvent[];
  declineHistory: TripDeclineRow[];
  cancellation: TripCancellation | null;
  pricing: TripPricing;
}

// ─── FAQ ───────────────────────────────────────────────────────
export interface FaqItem {
  id: number;
  slug: string;
  categoryEn: string;
  categoryAr: string;
  questionEn: string;
  questionAr: string;
  answerEn: string;
  answerAr: string;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFaqItemPayload {
  slug: string;
  categoryEn: string;
  categoryAr: string;
  questionEn: string;
  questionAr: string;
  answerEn: string;
  answerAr: string;
  displayOrder?: number;
  isActive?: boolean;
}

export type UpdateFaqItemPayload = Partial<Omit<CreateFaqItemPayload, 'slug'>>;
