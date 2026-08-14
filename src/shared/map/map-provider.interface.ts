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

/**
 * A routed path following the road network. `geometry` is an array
 * of [lng, lat] pairs (GeoJSON convention). Providers that can't
 * produce road geometry (Haversine) return null from route().
 */
export interface RouteResult extends DistanceResult {
  geometry: [number, number][];
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

  /**
   * Follow the road network through the given waypoints and return
   * the polyline geometry + total distance + duration. Optional —
   * providers without road data return null and the caller falls
   * back to straight lines between waypoints.
   */
  route?(waypoints: LatLng[]): Promise<RouteResult | null>;
}
