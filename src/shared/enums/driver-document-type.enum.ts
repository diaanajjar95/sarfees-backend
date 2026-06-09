/**
 * The four document types the driver app's Documents screen surfaces.
 * Add new types here when ops wants to track additional paperwork
 * (e.g. background check, tax certificate).
 */
export enum DriverDocumentType {
  DRIVING_LICENSE = 'driving_license',
  VEHICLE_REGISTRATION = 'vehicle_registration',
  INSURANCE_CERTIFICATE = 'insurance_certificate',
  NATIONAL_ID = 'national_id',
}

/**
 * Lifecycle status of an uploaded document. PENDING_REVIEW is the
 * default after upload; admin ops flips it to VERIFIED / REJECTED.
 * EXPIRED is computed by the service from `expiresAt` — it never
 * actually lives in this column.
 */
export enum DriverDocumentStatus {
  PENDING_REVIEW = 'pending_review',
  VERIFIED = 'verified',
  REJECTED = 'rejected',
}

/**
 * Derived UI status the mobile client uses to render the badge on each
 * document card. Computed from `status` + `expiresAt` at read time so
 * the client doesn't have to do its own date math.
 */
export enum DriverDocumentDisplayStatus {
  VERIFIED = 'verified',
  EXPIRING_SOON = 'expiring_soon',
  PENDING_REVIEW = 'pending_review',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
}

/** Days-out threshold that flips a verified document to "expiring soon" in the UI. */
export const DOCUMENT_EXPIRING_SOON_DAYS = 30;
