import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { AssignmentService } from '../assignment/assignment.service';
import type { MatchingConfig } from '../matching-config/matching-config.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, DataSource, EntityManager, Repository } from 'typeorm';
import { MatchingConfigService } from '../matching-config/matching-config.service';
import { VehicleClassCapacity } from '../matching-config/vehicle-class-capacity.entity';
import { PackageDelivery } from '../packages/entities/package-delivery.entity';
import { VehicleClass } from '../shared/enums/vehicle-class.enum';
import { MAP_PROVIDER } from '../shared/map/map-provider.interface';
import type {
  LatLng,
  MapProvider,
} from '../shared/map/map-provider.interface';
import { TripGroupStatus } from '../shared/enums/trip-group-status.enum';
import { TripRequest } from '../trips/entities/trip-request.entity';
import { User } from '../users/user.entity';
import {
  CandidateStop,
  checkCapacity,
  checkDetourBound,
  checkGender,
  checkGeography,
  checkWaitTolerance,
  computeActualPickupTimes,
  GroupMemberStop,
  orderPickupsByGateDistance,
  PackageForCapacity,
} from './compatibility';
import { TripGroup } from './entities/trip-group.entity';

/**
 * Stage-1 grouping engine (master spec §5). Called from
 * TripsService.createRequest (and PackagesService.createDelivery in
 * PR 5) for every new passenger/package request.
 *
 * PR 2 ships shadow-mode: TripGroups are populated in the DB but
 * the existing MatchingService.attemptMatch keeps running so no
 * driver-assignment behavior changes. PR 3 will drop the old matcher
 * and hand groups to the cascade.
 */
@Injectable()
export class GroupingService {
  private readonly logger = new Logger(GroupingService.name);

  constructor(
    @InjectRepository(TripGroup)
    private readonly groupsRepo: Repository<TripGroup>,
    @InjectRepository(TripRequest)
    private readonly requestsRepo: Repository<TripRequest>,
    @InjectRepository(PackageDelivery)
    private readonly packagesRepo: Repository<PackageDelivery>,
    @InjectRepository(VehicleClassCapacity)
    private readonly vehicleCapacityRepo: Repository<VehicleClassCapacity>,
    private readonly matchingConfigService: MatchingConfigService,
    private readonly dataSource: DataSource,
    @Inject(MAP_PROVIDER) private readonly mapProvider: MapProvider,
    @Inject(forwardRef(() => AssignmentService))
    private readonly assignmentService: AssignmentService,
  ) {}

  /**
   * Kick off Stage 2 for a group whose sweeper wait doesn't apply —
   * "now" requests, urgent packages, and full-car+immediate. Uses
   * setImmediate so we don't block the createRequest response on the
   * cascade transaction. A regular scheduled full-car falls through
   * to the sweeper at the T-30 mark like any other frozen group.
   */
  private scheduleImmediateCascade(
    groupId: number,
    isImmediate: boolean,
    _cfg: MatchingConfig,
  ): void {
    if (!isImmediate) return;
    setImmediate(() => {
      this.assignmentService
        .startCascade(groupId)
        .catch((err) =>
          this.logger.error(
            `Immediate cascade for group #${groupId} failed: ${err instanceof Error ? err.message : err}`,
          ),
        );
    });
  }

  /**
   * Assign a passenger TripRequest to a group. Called after the
   * request is saved. Returns the group it landed in — either an
   * existing OPEN group or a freshly-created one.
   *
   * The advisory lock keyed on (origin, dest, 5-min window) prevents
   * the master-spec §10 "two simultaneous compatible requests" race
   * — the lock waits, second request sees the first's group, joins
   * it if compatible.
   */
  async attemptGroupingForTripRequest(
    tripRequestId: number,
  ): Promise<TripGroup | null> {
    return this.dataSource.transaction(async (mgr) => {
      const request = await mgr.findOne(TripRequest, {
        where: { id: tripRequestId },
        relations: ['departureCity', 'arrivalCity', 'passenger'],
      });
      if (!request) {
        this.logger.warn(
          `TripRequest #${tripRequestId} vanished before grouping`,
        );
        return null;
      }
      if (!request.travelDate) {
        this.logger.warn(
          `TripRequest #${tripRequestId} has no travelDate — cannot group`,
        );
        return null;
      }
      const originCity = request.departureCity;
      const destCity = request.arrivalCity;
      if (!originCity || !destCity) {
        this.logger.warn(
          `TripRequest #${tripRequestId} missing origin/dest city refs`,
        );
        return null;
      }

      await this.takeCorridorLock(
        mgr,
        originCity.id,
        destCity.id,
        request.travelDate,
      );

      const cfg = await this.matchingConfigService.getConfig();

      // Full-car (§8) — born FROZEN, no other members ever join. Bypass
      // candidate search entirely and let AssignmentService kick off the
      // cascade (either immediately for isImmediate=true, or at the
      // normal T-30 sweeper tick for scheduled full-car).
      if (request.bookWholeCar) {
        const group = await this.createGroup(mgr, request, originCity, destCity);
        group.fullCar = true;
        group.status = TripGroupStatus.FROZEN;
        group.frozenAt = new Date();
        await mgr.save(group);
        request.tripGroup = group;
        await mgr.save(request);
        this.logger.log(
          `TripRequest #${tripRequestId} started full-car TripGroup #${group.id} (born FROZEN)`,
        );
        // Fire cascade if the trip is imminent — no point waiting for
        // the sweeper if we already know the driver-search moment.
        this.scheduleImmediateCascade(group.id, request.isImmediate, cfg);
        return group;
      }

      const candidate: CandidateStop = {
        ownerId: request.id,
        pickup: request.departureLocation,
        dropoff: request.arrivalLocation,
        requestedPickupTime: request.travelDate,
      };

      // Geography is the cheap gate — reject fast.
      const geo = checkGeography(candidate, originCity, destCity, cfg);
      if (!geo.ok) {
        this.logger.log(
          `TripRequest #${tripRequestId} rejected at geography: ${geo.reason}`,
        );
        // Fall through to a solo group — spec §1: "every passenger who
        // requests a trip gets served". Outside-service-area is a DTO
        // reject upstream; if we get here the request is at the edge but
        // still inside a wider radius, so we let it start its own group.
      }

      const candidates = await this.findCandidateGroups(
        mgr,
        originCity.id,
        destCity.id,
        request.travelDate,
        cfg.passengerWaitToleranceMinutes,
      );

      for (const group of candidates) {
        const verdict = await this.evaluateInsertion(
          mgr,
          group,
          request,
          originCity,
          destCity,
          cfg.detourBoundPercent,
          cfg.passengerWaitToleranceMinutes,
          cfg.handlingSecondsPerPackageStop,
        );
        if (verdict.ok) {
          request.tripGroup = group;
          await mgr.save(request);
          this.logger.log(
            `TripRequest #${tripRequestId} joined TripGroup #${group.id}`,
          );
          return group;
        }
        this.logger.debug(
          `TripRequest #${tripRequestId} rejected from TripGroup #${group.id}: ${verdict.reason}`,
        );
      }

      // No compatible group — create a new one.
      const group = await this.createGroup(mgr, request, originCity, destCity);
      request.tripGroup = group;
      await mgr.save(request);
      this.logger.log(
        `TripRequest #${tripRequestId} started new TripGroup #${group.id}`,
      );
      return group;
    });
  }

  /**
   * Assign a PackageDelivery to a group. Same shape as the passenger
   * path — corridor + tolerance filter, advisory lock, compatibility
   * cascade — plus a slot/weight capacity check.
   *
   * Urgent packages (§6.6) bypass grouping entirely; PR 6 wires that.
   * Here we defensively skip urgent so grouping never claims one.
   */
  async attemptGroupingForPackage(
    packageId: number,
  ): Promise<TripGroup | null> {
    return this.dataSource.transaction(async (mgr) => {
      const pkg = await mgr.findOne(PackageDelivery, {
        where: { id: packageId },
        relations: ['departureCity', 'arrivalCity'],
      });
      if (!pkg) {
        this.logger.warn(`PackageDelivery #${packageId} vanished`);
        return null;
      }
      if (!pkg.pickupDate) {
        this.logger.warn(
          `PackageDelivery #${packageId} has no pickupDate — cannot group`,
        );
        return null;
      }
      const originCity = pkg.departureCity;
      const destCity = pkg.arrivalCity;
      if (!originCity || !destCity) {
        this.logger.warn(
          `PackageDelivery #${packageId} missing origin/dest city refs`,
        );
        return null;
      }

      const cfg = await this.matchingConfigService.getConfig();

      // Urgent packages (§6.6) — solo trip, born FROZEN, driver search
      // starts immediately. No corridor lock or candidate search.
      if (pkg.urgent) {
        const group = await this.createGroupForPackage(
          mgr,
          pkg,
          originCity,
          destCity,
        );
        group.urgent = true;
        group.status = TripGroupStatus.FROZEN;
        group.frozenAt = new Date();
        await mgr.save(group);
        pkg.tripGroup = group;
        await mgr.save(pkg);
        this.logger.log(
          `PackageDelivery #${packageId} started urgent solo TripGroup #${group.id}`,
        );
        this.scheduleImmediateCascade(group.id, true, cfg);
        return group;
      }

      await this.takeCorridorLock(
        mgr,
        originCity.id,
        destCity.id,
        pkg.pickupDate,
      );

      const candidateStop: CandidateStop = {
        ownerId: pkg.id,
        pickup: pkg.pickupLocation,
        dropoff: pkg.dropOffLocation,
        requestedPickupTime: pkg.pickupDate,
      };

      // Geography reject → fall through to a solo group (per §1 promise
      // that every request lands somewhere).
      const geo = checkGeography(candidateStop, originCity, destCity, cfg);
      if (!geo.ok) {
        this.logger.log(
          `PackageDelivery #${packageId} rejected at geography: ${geo.reason}`,
        );
      }

      const candidates = await this.findCandidateGroups(
        mgr,
        originCity.id,
        destCity.id,
        pkg.pickupDate,
        cfg.packageWaitToleranceMinutes,
      );

      for (const group of candidates) {
        const verdict = await this.evaluatePackageInsertion(
          mgr,
          group,
          pkg,
          originCity,
          destCity,
          cfg.detourBoundPercent,
          cfg.packageWaitToleranceMinutes,
          cfg.handlingSecondsPerPackageStop,
        );
        if (verdict.ok) {
          pkg.tripGroup = group;
          await mgr.save(pkg);
          this.logger.log(
            `PackageDelivery #${packageId} joined TripGroup #${group.id}`,
          );
          return group;
        }
        this.logger.debug(
          `PackageDelivery #${packageId} rejected from TripGroup #${group.id}: ${verdict.reason}`,
        );
      }

      const group = await this.createGroupForPackage(
        mgr,
        pkg,
        originCity,
        destCity,
      );
      pkg.tripGroup = group;
      await mgr.save(pkg);
      this.logger.log(
        `PackageDelivery #${packageId} started new TripGroup #${group.id}`,
      );
      return group;
    });
  }

  // ─── Internals ─────────────────────────────────────────────

  /**
   * pg_advisory_xact_lock(int4, int4) is released when the txn commits.
   * The first int is the corridor key (origin*100000 + dest), the second
   * is a 5-minute window index counted from the epoch.
   */
  private async takeCorridorLock(
    mgr: EntityManager,
    originCityId: number,
    destCityId: number,
    departureTime: Date,
  ): Promise<void> {
    const corridorKey = originCityId * 100_000 + destCityId;
    const windowIdx = Math.floor(departureTime.getTime() / (5 * 60 * 1000));
    // Postgres int4 is signed 32-bit — window index over ~40k years fits.
    await mgr.query('SELECT pg_advisory_xact_lock($1::int4, $2::int4)', [
      corridorKey,
      windowIdx,
    ]);
  }

  /**
   * OPEN groups on the same corridor whose departureTime falls within
   * the candidate's wait-tolerance window on either side. Ordered by
   * soonest departure — the caller stops at the first acceptor.
   */
  private async findCandidateGroups(
    mgr: EntityManager,
    originCityId: number,
    destCityId: number,
    candidateDeparture: Date,
    toleranceMinutes: number,
  ): Promise<TripGroup[]> {
    const from = new Date(
      candidateDeparture.getTime() - toleranceMinutes * 60 * 1000,
    );
    const to = new Date(
      candidateDeparture.getTime() + toleranceMinutes * 60 * 1000,
    );
    return mgr.find(TripGroup, {
      where: {
        status: TripGroupStatus.OPEN,
        originCity: { id: originCityId },
        destCity: { id: destCityId },
        departureTime: Between(from, to),
      },
      order: { departureTime: 'ASC' },
    });
  }

  /**
   * Runs the full compatibility gauntlet: gender → geography (already
   * done for the candidate; also check nothing about the group breaks)
   * → gate-distance ordering → time feasibility → wait tolerance →
   * detour bound.
   */
  private async evaluateInsertion(
    mgr: EntityManager,
    group: TripGroup,
    candidate: TripRequest,
    origin: (typeof group)['originCity'],
    dest: (typeof group)['destCity'],
    detourBoundPercent: number,
    toleranceMinutes: number,
    handlingSecondsPerPackage: number,
  ): Promise<{ ok: true } | { ok: false; reason: string }> {
    // Gender rule (cheapest hard-fail after geography).
    const passenger = await mgr.findOne(User, {
      where: { id: candidate.passenger.id },
    });
    const genderVerdict = checkGender(
      group.womenOnly,
      candidate.isFemaleOnly,
      passenger?.gender ?? 'unspecified',
    );
    if (!genderVerdict.ok) return genderVerdict;

    // Full-car and urgent groups are born frozen — never accept
    // insertions after creation (§8, §6.6).
    if (group.fullCar) return { ok: false, reason: 'group_is_full_car' };
    if (group.urgent) return { ok: false, reason: 'group_is_urgent' };

    // Existing members + candidate → ordered pickup sequence.
    const existingRequests = await mgr.find(TripRequest, {
      where: { tripGroup: { id: group.id } },
    });
    const existingStops: GroupMemberStop[] = existingRequests.map((r) => ({
      ownerId: r.id,
      pickup: r.departureLocation,
      dropoff: r.arrivalLocation,
      requestedPickupTime: r.travelDate,
    }));
    const candidateStop: GroupMemberStop = {
      ownerId: candidate.id,
      pickup: candidate.departureLocation,
      dropoff: candidate.arrivalLocation,
      requestedPickupTime: candidate.travelDate,
    };
    const withCandidate = [...existingStops, candidateStop];

    if (!origin.exitGateLat || !origin.exitGateLng)
      return { ok: false, reason: 'origin_missing_exit_gate' };
    const originGate: LatLng = {
      lat: Number(origin.exitGateLat),
      lng: Number(origin.exitGateLng),
    };
    const orderedWith = orderPickupsByGateDistance(withCandidate, originGate);

    // Time feasibility (drives wait-tolerance check next).
    const packagesPerStop = new Map<number, number>(); // PR 5 fills this
    const feas = await computeActualPickupTimes(
      this.mapProvider,
      orderedWith,
      packagesPerStop,
      handlingSecondsPerPackage,
    );
    if (!feas.ok) return { ok: false, reason: feas.reason };

    // Wait tolerance across all members including the newcomer.
    const requestedTimes = new Map<number, Date>(
      orderedWith.map((s) => [s.ownerId, s.requestedPickupTime]),
    );
    const wt = checkWaitTolerance(
      feas.actualByOwner,
      requestedTimes,
      toleranceMinutes,
    );
    if (!wt.ok) return wt;

    // Detour bound: compare "without candidate" vs "with candidate"
    // total route lengths. Route = ordered pickups then ordered dropoffs.
    const orderedWithout = orderPickupsByGateDistance(existingStops, originGate);
    const baselineRoute = this.stopsToRouteCoords(orderedWithout);
    const withRoute = this.stopsToRouteCoords(orderedWith);
    const detour = await checkDetourBound(
      this.mapProvider,
      baselineRoute,
      withRoute,
      detourBoundPercent,
    );
    if (!detour.ok) return detour;

    return { ok: true };
  }

  private stopsToRouteCoords(stops: GroupMemberStop[]): LatLng[] {
    if (stops.length === 0) return [];
    // Pickups in gate-distance order, then dropoffs in the same order.
    // Master spec §6.3 flips this to packages-first when we ship
    // packages in PR 5; passenger-only route below is the passenger
    // baseline.
    return [
      ...stops.map((s) => s.pickup),
      ...stops.map((s) => s.dropoff),
    ];
  }

  private async createGroup(
    mgr: EntityManager,
    request: TripRequest,
    originCity: TripGroup['originCity'],
    destCity: TripGroup['destCity'],
  ): Promise<TripGroup> {
    const group = new TripGroup();
    group.originCity = originCity;
    group.destCity = destCity;
    group.departureTime = request.travelDate;
    group.status = TripGroupStatus.OPEN;
    group.womenOnly = request.isFemaleOnly;
    group.fullCar = false;
    group.urgent = false;
    group.assignedDriver = null;
    group.driverTripId = null;
    group.frozenAt = null;
    group.assignedAt = null;
    group.completedAt = null;
    return mgr.save(group);
  }

  private async createGroupForPackage(
    mgr: EntityManager,
    pkg: PackageDelivery,
    originCity: TripGroup['originCity'],
    destCity: TripGroup['destCity'],
  ): Promise<TripGroup> {
    const group = new TripGroup();
    group.originCity = originCity;
    group.destCity = destCity;
    group.departureTime = pkg.pickupDate;
    group.status = TripGroupStatus.OPEN;
    group.womenOnly = false; // packages have no gender (§7)
    group.fullCar = false;
    group.urgent = false;
    group.assignedDriver = null;
    group.driverTripId = null;
    group.frozenAt = null;
    group.assignedAt = null;
    group.completedAt = null;
    return mgr.save(group);
  }

  /**
   * Same compatibility gauntlet as passenger insertion, with slot +
   * weight capacity added and no gender check. Uses a
   * capacity-representative vehicle class — since drivers aren't
   * chosen yet at grouping time, we assume the smallest supported
   * class (SEDAN) as a conservative lower bound. That way we never
   * accept a group we couldn't fit into the cheapest driver. When
   * PR 3's ranking picks a specific driver, it re-checks capacity
   * against that driver's actual class.
   */
  private async evaluatePackageInsertion(
    mgr: EntityManager,
    group: TripGroup,
    candidate: PackageDelivery,
    origin: (typeof group)['originCity'],
    dest: (typeof group)['destCity'],
    detourBoundPercent: number,
    toleranceMinutes: number,
    handlingSecondsPerPackage: number,
  ): Promise<{ ok: true } | { ok: false; reason: string }> {
    if (group.fullCar) return { ok: false, reason: 'group_is_full_car' };
    if (group.urgent) return { ok: false, reason: 'group_is_urgent' };

    // Slot + weight capacity check against the SEDAN baseline.
    const baselineCap = await this.vehicleCapacityRepo.findOne({
      where: { vehicleClass: VehicleClass.SEDAN },
    });
    if (!baselineCap)
      return { ok: false, reason: 'vehicle_class_capacity_missing' };

    const cfg = await this.matchingConfigService.getConfig();
    const existingPackages = await mgr.find(PackageDelivery, {
      where: { tripGroup: { id: group.id } },
    });
    const passengerCount = await mgr.count(TripRequest, {
      where: { tripGroup: { id: group.id } },
    });

    const capacityVerdict = checkCapacity(
      existingPackages.map<PackageForCapacity>((p) => ({
        size: p.packageSize,
        weightKg: p.weightKg != null ? Number(p.weightKg) : 0,
      })),
      {
        size: candidate.packageSize,
        weightKg: candidate.weightKg != null ? Number(candidate.weightKg) : 0,
      },
      baselineCap,
      cfg,
      passengerCount > 0,
      // Empty-seat slot bonus only kicks in for packages-only trips.
      // We don't know the driver yet, so assume 0 empty seats when
      // deciding whether to admit — worst case for capacity.
      0,
    );
    if (!capacityVerdict.ok) return capacityVerdict;

    // Existing stop set (passengers + packages) + candidate.
    const existingRequests = await mgr.find(TripRequest, {
      where: { tripGroup: { id: group.id } },
    });
    const existingStops: GroupMemberStop[] = [
      ...existingRequests.map((r) => ({
        ownerId: r.id,
        pickup: r.departureLocation,
        dropoff: r.arrivalLocation,
        requestedPickupTime: r.travelDate,
      })),
      ...existingPackages.map((p) => ({
        ownerId: -p.id, // negative owner ids distinguish packages from requests
        pickup: p.pickupLocation,
        dropoff: p.dropOffLocation,
        requestedPickupTime: p.pickupDate,
      })),
    ];
    const candidateStop: GroupMemberStop = {
      ownerId: -candidate.id,
      pickup: candidate.pickupLocation,
      dropoff: candidate.dropOffLocation,
      requestedPickupTime: candidate.pickupDate,
    };
    const withCandidate = [...existingStops, candidateStop];

    if (!origin.exitGateLat || !origin.exitGateLng)
      return { ok: false, reason: 'origin_missing_exit_gate' };
    const originGate: LatLng = {
      lat: Number(origin.exitGateLat),
      lng: Number(origin.exitGateLng),
    };
    const orderedWith = orderPickupsByGateDistance(withCandidate, originGate);

    // Time feasibility — packages contribute a handling time per stop.
    const packagesPerStop = new Map<number, number>();
    for (const p of existingPackages) packagesPerStop.set(-p.id, 1);
    packagesPerStop.set(-candidate.id, 1);
    const feas = await computeActualPickupTimes(
      this.mapProvider,
      orderedWith,
      packagesPerStop,
      handlingSecondsPerPackage,
    );
    if (!feas.ok) return { ok: false, reason: feas.reason };

    const requestedTimes = new Map<number, Date>(
      orderedWith.map((s) => [s.ownerId, s.requestedPickupTime]),
    );
    const wt = checkWaitTolerance(
      feas.actualByOwner,
      requestedTimes,
      toleranceMinutes,
    );
    if (!wt.ok) return wt;

    // Detour bound — recomputed against the passenger-only baseline
    // per PR 2 helper. Includes packages in the "with candidate" set.
    const orderedWithout = orderPickupsByGateDistance(existingStops, originGate);
    const baselineRoute = this.stopsToRouteCoords(orderedWithout);
    const withRoute = this.stopsToRouteCoords(orderedWith);
    const detour = await checkDetourBound(
      this.mapProvider,
      baselineRoute,
      withRoute,
      detourBoundPercent,
    );
    if (!detour.ok) return detour;

    return { ok: true };
  }
}
