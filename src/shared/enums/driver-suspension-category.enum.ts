/**
 * Reason bucket driving which suspended-state card the mobile Home tab
 * renders. Chosen by ops when they call `POST /admin/drivers/:id/suspend`.
 *
 *   documents  → paperwork lapse (expired registration / insurance / etc.)
 *   rating     → rating dropped below the platform minimum
 *   payment    → outstanding platform commission overdue
 *   violation  → safety / conduct report under review
 *
 * Legacy suspensions (drivers suspended before this shipped) have `null`
 * here — the mobile UI falls back to a generic "suspended" card.
 */
export enum DriverSuspensionCategory {
  DOCUMENTS = 'documents',
  RATING = 'rating',
  PAYMENT = 'payment',
  VIOLATION = 'violation',
}
