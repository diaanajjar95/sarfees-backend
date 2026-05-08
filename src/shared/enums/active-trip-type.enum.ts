/**
 * Business classification of the user's currently-active item on
 * GET /trips/active. Mobile clients map this directly to their TripType
 * enum (Dart camelCase) — keep these literal values stable.
 */
export enum ActiveTripType {
  SHARED = 'shared',
  WOMEN_ONLY = 'womenOnly',
  SEND_PACKAGE = 'sendPackage',
}
