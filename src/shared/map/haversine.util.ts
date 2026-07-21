/**
 * Haversine great-circle distance. Radius = 6371 km,
 * formula: 2 * R * asin(sqrt(sin²(Δφ/2) + cos(φ1)·cos(φ2)·sin²(Δλ/2))).
 * Lifted verbatim from the previous private helper in DriversService.
 */

const EARTH_RADIUS_KM = 6371;

const toRad = (deg: number): number => (deg * Math.PI) / 180;

export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

export function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  return haversineKm(lat1, lng1, lat2, lng2) * 1000;
}
