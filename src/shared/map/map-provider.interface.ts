/**
 * MapProvider — pluggable abstraction over any distance/duration lookup
 * the matcher needs. Impls: Haversine (in-process straight-line),
 * Mapbox (real road distance via Directions/Matrix APIs), and later
 * OSRM / Google if we outgrow Mapbox.
 *
 * Selected at boot time via env `MAP_PROVIDER=mapbox|haversine`.
 */

export const MAP_PROVIDER = Symbol('MAP_PROVIDER');

export interface LatLng {
  lat: number;
  lng: number;
}

export interface DistanceResult {
  meters: number;
  durationSeconds: number;
}

export interface MapProvider {
  /**
   * Returns null when the provider errors (network, quota, missing
   * credentials, etc.) so the caller can fall back to Haversine.
   */
  distance(from: LatLng, to: LatLng): Promise<DistanceResult | null>;

  /**
   * Bulk lookup. Providers with matrix APIs override for efficiency;
   * default impl loops distance().
   */
  matrix(
    origins: LatLng[],
    destinations: LatLng[],
  ): Promise<(DistanceResult | null)[][]>;
}
