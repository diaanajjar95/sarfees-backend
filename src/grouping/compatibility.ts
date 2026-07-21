import type { City } from '../cities/city.entity';
import type { MatchingConfig } from '../matching-config/matching-config.entity';
import type {
  DistanceResult,
  LatLng,
  MapProvider,
} from '../shared/map/map-provider.interface';
import { haversineMeters } from '../shared/map/haversine.util';

/**
 * Compatibility checks for Stage-1 grouping (master spec §5.2).
 * Every predicate returns { ok, reason }. Reasons are stable strings
 * so the sweeper can log per-reason metrics and QA can assert them.
 *
 * A "candidate" is a passenger TripRequest that wants to join an
 * existing OPEN group. Package delivery grouping (§6.3) reuses the
 * same helpers in PR 5 with the same predicates plus slot/weight math.
 */

export interface GroupMemberStop {
  /** Passenger/request/package id — logged in QA output. */
  readonly ownerId: number;
  readonly pickup: LatLng;
  readonly dropoff: LatLng;
  readonly requestedPickupTime: Date;
}

export interface CandidateStop extends GroupMemberStop {}

export type Ok = { ok: true };
export type Reject = { ok: false; reason: string };
export type Verdict = Ok | Reject;

const ok: Ok = { ok: true };
const reject = (reason: string): Reject => ({ ok: false, reason });

// ─── Geography (§5.2) ────────────────────────────────────────

/**
 * Pickup must sit inside the origin city's service circle, dropoff
 * inside the destination city's. Radius = per-city override or the
 * global default from matching_config.
 */
export function checkGeography(
  candidate: CandidateStop,
  origin: City,
  dest: City,
  cfg: MatchingConfig,
): Verdict {
  const originRadius =
    origin.serviceRadiusMeters ?? cfg.defaultServiceRadiusMeters;
  const destRadius =
    dest.serviceRadiusMeters ?? cfg.defaultServiceRadiusMeters;

  if (!origin.centerLat || !origin.centerLng)
    return reject('origin_city_missing_geometry');
  if (!dest.centerLat || !dest.centerLng)
    return reject('dest_city_missing_geometry');

  const pickupDist = haversineMeters(
    Number(origin.centerLat),
    Number(origin.centerLng),
    candidate.pickup.lat,
    candidate.pickup.lng,
  );
  if (pickupDist > originRadius) return reject('pickup_outside_service_area');

  const dropoffDist = haversineMeters(
    Number(dest.centerLat),
    Number(dest.centerLng),
    candidate.dropoff.lat,
    candidate.dropoff.lng,
  );
  if (dropoffDist > destRadius) return reject('dropoff_outside_service_area');

  return ok;
}

// ─── Wait tolerance (§5.2) ───────────────────────────────────

/**
 * After inserting the candidate at its gate-distance position, no
 * existing member's actual pickup may drift more than tolerance
 * minutes past their requested time. Pure math — assumes the ordered
 * sequence and per-leg durations are already computed by the caller.
 */
export function checkWaitTolerance(
  actualPickupTimes: Map<number, Date>,
  requestedTimes: Map<number, Date>,
  toleranceMinutes: number,
): Verdict {
  for (const [ownerId, actual] of actualPickupTimes) {
    const requested = requestedTimes.get(ownerId);
    if (!requested) continue;
    const driftMinutes =
      (actual.getTime() - requested.getTime()) / 1000 / 60;
    if (driftMinutes > toleranceMinutes)
      return reject(`wait_tolerance_exceeded_owner_${ownerId}`);
  }
  return ok;
}

// ─── Gender rule (§7) ────────────────────────────────────────

/**
 * A women-only group only accepts women-only-flagged female-passenger
 * requests. A "normal" (non-women-only) group accepts anyone — but
 * a woman-only-flagged request never joins a mixed group; it starts
 * or joins its own women-only bundle.
 */
export function checkGender(
  groupWomenOnly: boolean,
  candidateWomenOnly: boolean,
  candidateGender: string,
): Verdict {
  if (groupWomenOnly) {
    if (!candidateWomenOnly)
      return reject('women_only_group_rejects_non_women_only_request');
    if (candidateGender.toLowerCase() !== 'female')
      return reject('women_only_group_rejects_non_female_passenger');
    return ok;
  }
  if (candidateWomenOnly)
    return reject('women_only_request_needs_women_only_group');
  return ok;
}

// ─── Detour bound (§5.2) ─────────────────────────────────────

/**
 * Sum-of-legs check via MapProvider. Inserting the candidate into the
 * ordered pickup+dropoff sequence must not stretch the total route
 * beyond (1 + detourBoundPercent/100) × baseline.
 *
 * V1 impl: compare "with candidate" vs "without candidate" route
 * lengths using MapProvider.matrix() for the pairwise legs. The
 * "without" baseline is the current group route (may just be
 * origin.center → dest.center if the group is empty).
 */
export async function checkDetourBound(
  provider: MapProvider,
  baselineOrdered: LatLng[],
  withCandidateOrdered: LatLng[],
  boundPercent: number,
): Promise<Verdict> {
  const baseMeters = await sumOfLegs(provider, baselineOrdered);
  const withMeters = await sumOfLegs(provider, withCandidateOrdered);
  if (baseMeters === null || withMeters === null)
    return reject('detour_bound_provider_unavailable');
  if (baseMeters === 0) return ok; // degenerate — first request in a corridor
  const ratio = withMeters / baseMeters;
  const cap = 1 + boundPercent / 100;
  if (ratio > cap) return reject('detour_bound_exceeded');
  return ok;
}

async function sumOfLegs(
  provider: MapProvider,
  seq: LatLng[],
): Promise<number | null> {
  if (seq.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < seq.length - 1; i++) {
    const leg = await provider.distance(seq[i], seq[i + 1]);
    if (leg === null) return null;
    total += leg.meters;
  }
  return total;
}

// ─── Gate-distance ordering (§5.2) ───────────────────────────

/**
 * Pickups sort from farthest-from-origin.exitGate to nearest — that's
 * the direction of the corridor. Returns the candidate stops sorted
 * by descending gate distance. Uses Haversine (fast, deterministic —
 * we don't want the road-distance provider's cost on every insertion
 * probe; gate-distance ordering is a monotone ordering, not an ETA).
 */
export function orderPickupsByGateDistance(
  stops: GroupMemberStop[],
  originExitGate: LatLng,
): GroupMemberStop[] {
  return [...stops].sort((a, b) => {
    const da = haversineMeters(
      originExitGate.lat,
      originExitGate.lng,
      a.pickup.lat,
      a.pickup.lng,
    );
    const db = haversineMeters(
      originExitGate.lat,
      originExitGate.lng,
      b.pickup.lat,
      b.pickup.lng,
    );
    return db - da;
  });
}

// ─── Time feasibility across the ordered pickup sequence ─────

/**
 * Walk the gate-ordered pickup sequence and produce each member's
 * actual pickup time. Each consecutive gap must be ≥
 * MapProvider.distance(...).durationSeconds + optional per-package
 * handling seconds. Returns the map on success; null with a reason
 * on infeasibility.
 *
 * Used by the caller to then feed checkWaitTolerance.
 */
export async function computeActualPickupTimes(
  provider: MapProvider,
  ordered: GroupMemberStop[],
  packagesPerStop: Map<number, number>,
  handlingSecondsPerPackage: number,
): Promise<
  | { ok: true; actualByOwner: Map<number, Date> }
  | { ok: false; reason: string }
> {
  const actualByOwner = new Map<number, Date>();
  if (ordered.length === 0) return { ok: true, actualByOwner };

  // The first pickup happens at its own requested time — matcher can't
  // rush the passenger; if the group's first slot is behind schedule it
  // becomes infeasible below.
  let cursor = ordered[0].requestedPickupTime;
  actualByOwner.set(ordered[0].ownerId, cursor);

  for (let i = 1; i < ordered.length; i++) {
    const prev = ordered[i - 1];
    const curr = ordered[i];
    const leg = await provider.distance(prev.pickup, curr.pickup);
    if (leg === null)
      return { ok: false, reason: 'time_feasibility_provider_unavailable' };
    const handling =
      (packagesPerStop.get(prev.ownerId) ?? 0) * handlingSecondsPerPackage;
    const nextTs = new Date(
      cursor.getTime() + (leg.durationSeconds + handling) * 1000,
    );
    // A member's actual pickup can slide forward if traffic requires it,
    // but cannot slide backward past their requested time — the driver
    // won't arrive early enough to help.
    cursor = nextTs > curr.requestedPickupTime ? nextTs : curr.requestedPickupTime;
    actualByOwner.set(curr.ownerId, cursor);
  }
  return { ok: true, actualByOwner };
}

export const __helpers = { sumOfLegs, haversineMeters } as {
  sumOfLegs: (p: MapProvider, s: LatLng[]) => Promise<number | null>;
  haversineMeters: (
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
  ) => number;
};

// Re-export DistanceResult so the module's public surface is stable
// even if we shuffle the interface files later.
export type { DistanceResult };
