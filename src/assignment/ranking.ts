import type { City } from '../cities/city.entity';
import type { Driver } from '../drivers/driver.entity';
import type { TripGroup } from '../grouping/entities/trip-group.entity';
import type { MatchingConfig } from '../matching-config/matching-config.entity';
import type { VehicleClassCapacity } from '../matching-config/vehicle-class-capacity.entity';
import { haversineMeters } from '../shared/map/haversine.util';

/**
 * Stage-2 driver ranking per master spec §9.
 *
 * Structure:
 *   Hard filters → then two strict tiers → then weighted score.
 *
 * Weights for factors 3–6 (§9.2) are declared here as constants; the
 * plan calls out that these will be reviewed with product before
 * launch (§16). They're chosen so proximity (worth up to 100) is the
 * dominant lever and preference/min-fit provide meaningful boosts,
 * while decline penalty grows quickly enough to keep serial decliners
 * from re-surfacing at the top of the queue.
 */

export const RANKING_WEIGHTS = {
  proximity: 100,
  preferenceMatch: 30,
  minPassengerFit: 10,
  declinePenalty: 10, // per decline in the recent window
} as const;

// ─── Hard filters (§9.1) ──────────────────────────────────────

export interface GroupLoad {
  /** Sum of passenger seatsCount across all TripRequests. */
  totalSeats: number;
  /** Sum of slotsFor(pkg.size) across all PackageDelivery members. */
  totalPackageSlots: number;
  /** Sum of package weights. */
  totalPackageWeightKg: number;
  /** True iff the group has any passenger requests (mixed vs pkg-only). */
  hasPassengers: boolean;
  /** True iff the group has any package deliveries. */
  hasPackages: boolean;
  /** Vehicle-class capacity lookup by class enum key. */
  capacityByClass: Map<string, VehicleClassCapacity>;
  /**
   * Prepaid-wallet gate: commission the platform will deduct for this
   * group (commissionPercent × group total price). A driver whose
   * walletBalance can't cover it is skipped.
   */
  requiredWalletCommission: number;
}

/** Every eligible driver must pass every filter — no half-passes. */
export function isDriverEligible(
  driver: Driver,
  group: TripGroup,
  originCity: City,
  radiusMeters: number,
  load: GroupLoad,
): { ok: true } | { ok: false; reason: string } {
  // Online + non-suspended is enforced by the caller's query (driver.status
  // = ACTIVE), so we assume that here.

  // Location — driver must be inside the origin city's service circle.
  if (
    !originCity.centerLat ||
    !originCity.centerLng ||
    driver.prefLocationLat == null ||
    driver.prefLocationLng == null
  ) {
    return { ok: false, reason: 'no_location_snapshot' };
  }
  const distM = haversineMeters(
    Number(originCity.centerLat),
    Number(originCity.centerLng),
    Number(driver.prefLocationLat),
    Number(driver.prefLocationLng),
  );
  if (distM > radiusMeters) return { ok: false, reason: 'outside_origin_city' };

  // Trip-type match per master spec §9.1. "mix" drivers take anything;
  // "passengers-only" drivers never see package-carrying trips; a
  // package-carrying group needs a driver whose list includes packages
  // or mixed. A driver with no preference set is treated as "mix" —
  // matches legacy MatchingService behavior.
  const prefs = driver.prefTripTypes ?? [];
  if (prefs.length > 0) {
    if (load.hasPassengers) {
      const acceptsPassengers =
        prefs.includes('mixed') ||
        prefs.includes('shared') ||
        prefs.includes('women_only');
      if (!acceptsPassengers)
        return { ok: false, reason: 'trip_type_passengers_mismatch' };
      if (
        group.womenOnly &&
        !(prefs.includes('women_only') || prefs.includes('mixed'))
      ) {
        return { ok: false, reason: 'women_only_type_mismatch' };
      }
    }
    if (load.hasPackages) {
      const acceptsPackages =
        prefs.includes('mixed') || prefs.includes('packages');
      if (!acceptsPackages)
        return { ok: false, reason: 'trip_type_packages_mismatch' };
    }
  }

  // Passenger capacity — driver.passengerCapacity must fit total seats.
  if (driver.passengerCapacity < load.totalSeats)
    return { ok: false, reason: 'passenger_capacity_too_small' };

  // Package capacity — check driver's vehicle-class trunk + weight limits.
  if (load.hasPackages) {
    const vc = driver.vehicleClass
      ? load.capacityByClass.get(driver.vehicleClass)
      : null;
    if (!vc) return { ok: false, reason: 'driver_missing_vehicle_class' };

    // Mixed trip: packages ride in trunk only (§6.2).
    // Packages-only: trunk + empty-seats × seatSlotValue.
    const emptySeats = load.hasPassengers
      ? 0
      : Math.max(0, driver.passengerCapacity - load.totalSeats);
    const availableSlots =
      vc.trunkSlots + emptySeats * vc.seatSlotValue;
    if (load.totalPackageSlots > availableSlots)
      return { ok: false, reason: 'package_slot_capacity_too_small' };
    if (load.totalPackageWeightKg > vc.weightLimitKg)
      return { ok: false, reason: 'package_weight_over_limit' };
  }

  // Going-home restriction — a going-home driver only takes trips
  // whose destination is their home city.
  if (driver.prefGoingHome) {
    const home = (driver.homeCity ?? '').toLowerCase();
    const dest = (group.destCity.nameEn ?? '').toLowerCase();
    if (!home || home !== dest)
      return { ok: false, reason: 'going_home_dest_mismatch' };
  }

  // Prepaid wallet (§ wallet spec): the balance must cover this
  // group's commission or the driver receives no offer for it.
  if (Number(driver.walletBalance) < load.requiredWalletCommission) {
    return { ok: false, reason: 'insufficient_wallet_balance' };
  }

  return { ok: true };
}

// ─── Two strict tiers + weighted score (§9.2) ─────────────────

export interface RankedDriver {
  driverId: number;
  tier: number; // lower is better
  score: number;
  reason: string; // short debug line for logs
}

export function rankDrivers(
  drivers: Driver[],
  group: TripGroup,
  originCity: City,
  decline30dByDriver: Map<number, number>,
): RankedDriver[] {
  return drivers
    .map((d) => scoreDriver(d, group, originCity, decline30dByDriver.get(d.id) ?? 0))
    .sort((a, b) => {
      if (a.tier !== b.tier) return a.tier - b.tier;
      return b.score - a.score;
    });
}

function scoreDriver(
  driver: Driver,
  group: TripGroup,
  originCity: City,
  decline30d: number,
): RankedDriver {
  // Tier 0 (best) = female drivers on women-only groups
  //   OR going-home drivers whose dest matches
  // Tier 1 = normal candidates
  // The plan says gender tier takes precedence, then going-home. To
  // implement "gender first, going-home second, no cross" we mint a
  // composite tier: (gender * 2) + goingHome.
  const genderTier = group.womenOnly && driver.gender !== 'female' ? 1 : 0;
  const goingHomeMatch =
    driver.prefGoingHome &&
    (driver.homeCity ?? '').toLowerCase() ===
      (group.destCity.nameEn ?? '').toLowerCase();
  const goingHomeTier = goingHomeMatch ? 0 : 1;
  const tier = genderTier * 2 + goingHomeTier;

  // Proximity — Haversine to origin-city center as a proxy. Closer =
  // higher score. Score decays linearly from 100 at 0 m to 0 at
  // radius*4 (past that we're way out of consideration anyway).
  const distM =
    driver.prefLocationLat != null && driver.prefLocationLng != null && originCity.centerLat && originCity.centerLng
      ? haversineMeters(
          Number(originCity.centerLat),
          Number(originCity.centerLng),
          Number(driver.prefLocationLat),
          Number(driver.prefLocationLng),
        )
      : Number.POSITIVE_INFINITY;
  const cutoff =
    (originCity.serviceRadiusMeters ?? 5000) * 4;
  const proximity =
    distM >= cutoff ? 0 : (1 - distM / cutoff) * RANKING_WEIGHTS.proximity;

  // Preference — driver's preferred destination matches group's dest
  const prefMatch =
    driver.prefDestinationCity &&
    driver.prefDestinationCity.toLowerCase() ===
      (group.destCity.nameEn ?? '').toLowerCase()
      ? RANKING_WEIGHTS.preferenceMatch
      : 0;

  // Min-passenger fit — driver's floor ≤ group's passenger count.
  // We don't have the group count on the entity yet (PR 3 counts
  // linked TripRequests separately); this term becomes meaningful in
  // PR 4 once we track group counts. For now: 0 penalty if
  // driver.prefMinPassengers is null; small bonus otherwise.
  const minFit =
    driver.prefMinPassengers == null || driver.prefMinPassengers <= 1
      ? RANKING_WEIGHTS.minPassengerFit
      : 0;

  // Decline penalty — recent declines/timeouts (§9.5).
  const penalty = decline30d * RANKING_WEIGHTS.declinePenalty;

  const score = proximity + prefMatch + minFit - penalty;
  const reason = `distM=${Math.round(distM)} prox=${proximity.toFixed(0)} pref=${prefMatch} minFit=${minFit} decline=${decline30d}(-${penalty})`;

  return { driverId: driver.id, tier, score, reason };
}
