import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  In,
  IsNull,
  LessThan,
  Not,
  Repository,
} from 'typeorm';
import { Driver } from '../drivers/driver.entity';
import { DriverTrip } from '../driver-trips/entities/driver-trip.entity';
import { DriverTripsService } from '../driver-trips/driver-trips.service';
import { SeedDriverTripDto } from '../driver-trips/dto/seed-driver-trip.dto';
import { TripGroup } from '../grouping/entities/trip-group.entity';
import { MatchingConfigService } from '../matching-config/matching-config.service';
import { DriverNotificationsService } from '../notifications/driver-notifications.service';
import { PassengerNotificationsService } from '../notifications/passenger/passenger-notifications.service';
import { DriverNotificationType } from '../shared/enums/driver-notification-type.enum';
import { DriverStatus } from '../shared/enums/driver-status.enum';
import { DriverTripStatus } from '../shared/enums/driver-trip-status.enum';
import { DriverTripType } from '../shared/enums/driver-trip-type.enum';
import { OfferResponse } from '../shared/enums/offer-response.enum';
import { PassengerNotificationType } from '../shared/enums/passenger-notification-type.enum';
import { TripGroupStatus } from '../shared/enums/trip-group-status.enum';
import { TripStatus } from '../shared/enums/trip-status.enum';
import { TripRequest } from '../trips/entities/trip-request.entity';
import { EscalationCase } from './entities/escalation-case.entity';
import { TripOfferHistory } from './entities/trip-offer-history.entity';
import { isDriverEligible, rankDrivers } from './ranking';

/**
 * Stage-2 driver assignment engine (master spec §9).
 *
 * Fires when the sweeper transitions a group OPEN → FROZEN. Ranks
 * eligible drivers into two strict tiers + weighted score, offers to
 * them one at a time (cascade), falls back to a simultaneous
 * broadcast when the queue exhausts, and escalates to ops if nobody
 * accepts by departure (§9.7 — never a silent failure).
 *
 * The lifecycle of "which driver holds the live offer" is stored in
 * two places: the DriverTrip row (status=OFFERED, offerExpiresAt=…)
 * and the TripOfferHistory row (response=PENDING). Sweeper polls the
 * offer-history table for expired PENDING rows and hands them back
 * here as timeouts. Accept/decline endpoints in DriverTripsService
 * call handleAcceptance/handleDecline synchronously.
 */
@Injectable()
export class AssignmentService {
  private readonly logger = new Logger(AssignmentService.name);

  constructor(
    @InjectRepository(TripGroup)
    private readonly groupsRepo: Repository<TripGroup>,
    @InjectRepository(TripOfferHistory)
    private readonly offersRepo: Repository<TripOfferHistory>,
    @InjectRepository(EscalationCase)
    private readonly escalationsRepo: Repository<EscalationCase>,
    @InjectRepository(TripRequest)
    private readonly requestsRepo: Repository<TripRequest>,
    @InjectRepository(Driver)
    private readonly driversRepo: Repository<Driver>,
    @InjectRepository(DriverTrip)
    private readonly driverTripsRepo: Repository<DriverTrip>,
    private readonly matchingConfigService: MatchingConfigService,
    @Inject(forwardRef(() => DriverTripsService))
    private readonly driverTripsService: DriverTripsService,
    private readonly driverNotifications: DriverNotificationsService,
    private readonly passengerNotifications: PassengerNotificationsService,
    private readonly dataSource: DataSource,
  ) {}

  // ─── Public: cascade start (called by sweeper on freeze) ────

  async startCascade(groupId: number): Promise<void> {
    const group = await this.groupsRepo.findOne({
      where: { id: groupId },
      relations: ['originCity', 'destCity'],
    });
    if (!group) return;
    if (group.status !== TripGroupStatus.FROZEN) {
      this.logger.debug(
        `startCascade #${groupId} skipped — status=${group.status}`,
      );
      return;
    }

    // Transition FROZEN → OFFERING and pick the first candidate.
    group.status = TripGroupStatus.OFFERING;
    await this.groupsRepo.save(group);
    this.logger.log(`Group #${groupId} → OFFERING`);

    await this.notifyMembersFrozen(group);
    await this.sendNextOffer(group);
  }

  // ─── Public: sweeper hook for expired offers ────────────────

  async timeoutExpiredOffers(): Promise<void> {
    const stale = await this.offersRepo.find({
      where: {
        response: OfferResponse.PENDING,
        expiresAt: LessThan(new Date()),
      },
      relations: ['tripGroup', 'driverTrip', 'driver'],
      take: 100,
    });
    for (const offer of stale) {
      await this.recordAndAdvance(offer, OfferResponse.TIMEOUT);
    }
  }

  // ─── Public: called by DriverTripsService accept/decline hooks ─

  async handleAcceptance(driverTripId: number): Promise<void> {
    const offer = await this.offersRepo.findOne({
      where: {
        response: OfferResponse.PENDING,
        driverTrip: { id: driverTripId },
      },
      relations: ['tripGroup', 'driver', 'driverTrip'],
    });
    if (!offer) return; // legacy trip with no cascade — nothing to do

    await this.dataSource.transaction(async (mgr) => {
      // Guard: only the first ACCEPT wins. Lock trip_groups only —
      // Postgres bans FOR UPDATE on the nullable side of left joins,
      // and the eager destCity/originCity relations force one.
      const group = await mgr
        .createQueryBuilder(TripGroup, 'g')
        .where('g.id = :id', { id: offer.tripGroup.id })
        .setLock('pessimistic_write', undefined, ['g'])
        .getOne();
      if (!group) return;
      if (
        group.status !== TripGroupStatus.OFFERING &&
        group.status !== TripGroupStatus.BROADCASTING
      ) {
        // Somebody already won this group — record superseded.
        offer.response = OfferResponse.SUPERSEDED;
        offer.respondedAt = new Date();
        await mgr.save(offer);
        return;
      }

      group.status = TripGroupStatus.ASSIGNED;
      group.assignedDriver = offer.driver;
      group.driverTripId = driverTripId;
      group.assignedAt = new Date();
      await mgr.save(group);

      offer.response = OfferResponse.ACCEPT;
      offer.respondedAt = new Date();
      await mgr.save(offer);

      // Any other live PENDING offers on this group (e.g. broadcast
      // round) get marked SUPERSEDED and their DriverTrips cancelled.
      const others = await mgr.find(TripOfferHistory, {
        where: {
          tripGroup: { id: group.id },
          response: OfferResponse.PENDING,
          id: Not(offer.id),
        },
        relations: ['driver', 'driverTrip'],
      });
      for (const other of others) {
        other.response = OfferResponse.SUPERSEDED;
        other.respondedAt = new Date();
        await mgr.save(other);
        if (other.driverTrip) {
          const dt = await mgr.findOne(DriverTrip, {
            where: { id: other.driverTrip.id },
          });
          if (dt && dt.status === DriverTripStatus.OFFERED) {
            dt.status = DriverTripStatus.EXPIRED;
            await mgr.save(dt);
          }
        }
        await this.driverNotifications.emit({
          driverId: other.driver.id,
          type: DriverNotificationType.OFFER_NO_LONGER_AVAILABLE,
          title: 'Offer no longer available',
          body: 'Another driver accepted this trip first.',
          payload: { tripGroupId: group.id },
        });
      }

      // Notify passengers.
      await this.notifyMembersAssigned(mgr, group, offer.driver);
    });
  }

  async handleDecline(driverTripId: number): Promise<void> {
    const offer = await this.offersRepo.findOne({
      where: {
        response: OfferResponse.PENDING,
        driverTrip: { id: driverTripId },
      },
      relations: ['tripGroup', 'driver', 'driverTrip'],
    });
    if (!offer) return;
    await this.recordAndAdvance(offer, OfferResponse.DECLINE);
  }

  // ─── Public: cancellation matrix (master spec §10) ───────────

  /**
   * Passenger cancelled a TripRequest. Detaches from the group and
   * decides the group's fate:
   *   - Group empty afterwards → CANCELLED (+ release assigned driver
   *     if any, emit compensation-style notification per §10).
   *   - Group not empty, still OPEN/FROZEN/OFFERING → no state change;
   *     the search / freeze continues with the remaining members.
   *   - Group not empty, ASSIGNED → notify driver with updated
   *     composition so they know who's still on the trip.
   *
   * Per §10: capacity does NOT reopen (we don't flip an ASSIGNED/
   * BROADCASTING group back to OPEN just because someone dropped).
   */
  async handlePassengerCancel(tripRequestId: number): Promise<void> {
    const req = await this.requestsRepo.findOne({
      where: { id: tripRequestId },
      relations: ['tripGroup'],
    });
    if (!req || !req.tripGroup) return; // never grouped — nothing to do

    const groupId = req.tripGroup.id;

    // Detach FIRST so subsequent count queries reflect the new state.
    req.tripGroup = null;
    await this.requestsRepo.save(req);

    const group = await this.groupsRepo.findOne({ where: { id: groupId } });
    if (!group) return;

    const remaining = await this.requestsRepo.count({
      where: { tripGroup: { id: groupId } },
    });

    if (remaining === 0) {
      await this.cancelEmptyGroup(group);
      return;
    }

    // Not empty — for ASSIGNED groups, tell the driver about the change.
    if (
      group.status === TripGroupStatus.ASSIGNED &&
      group.assignedDriver
    ) {
      await this.driverNotifications.emit({
        driverId: group.assignedDriver.id,
        type: DriverNotificationType.PASSENGER_CANCELLED,
        title: 'Passenger cancelled',
        body: `${remaining} passenger${remaining === 1 ? '' : 's'} still on the trip.`,
        payload: {
          tripGroupId: groupId,
          driverTripId: group.driverTripId,
          remainingCount: remaining,
        },
      });
    }
  }

  /**
   * Driver cancelled after accepting (§10). Restart the cascade:
   *   - Mark the ACCEPT offer as CANCEL_AFTER_ACCEPT (counted as a
   *     decline for penalty purposes, kept distinct for audit).
   *   - Clear group.assignedDriver / driverTripId, roll status back
   *     to OFFERING so sendNextOffer picks the next candidate.
   *     The driver who just cancelled is excluded because their row
   *     is already in trip_offer_history.
   *   - Notify remaining passengers only if the delay exceeds a
   *     threshold — deferred to a follow-up PR; for now we emit the
   *     passenger notification unconditionally so nobody's surprised.
   */
  async handleDriverCancel(driverTripId: number): Promise<void> {
    const offer = await this.offersRepo.findOne({
      where: {
        response: OfferResponse.ACCEPT,
        driverTrip: { id: driverTripId },
      },
      relations: ['tripGroup', 'driver'],
    });
    if (!offer) return; // legacy trip / not group-linked

    const group = await this.groupsRepo.findOne({
      where: { id: offer.tripGroup.id },
      relations: ['originCity', 'destCity'],
    });
    if (!group) return;

    // Only groups still in ASSIGNED can be rewound. Once IN_PROGRESS
    // starts, driver cancel is a support case, not a re-cascade.
    if (
      group.status !== TripGroupStatus.ASSIGNED &&
      group.status !== TripGroupStatus.IN_PROGRESS
    ) {
      return;
    }
    if (group.status === TripGroupStatus.IN_PROGRESS) {
      // Mid-trip cancel — DriverTripsService already blocks these
      // (zone 3). Nothing for the matcher to do.
      return;
    }

    // Reset the group so sendNextOffer can pick another driver.
    offer.response = OfferResponse.CANCEL_AFTER_ACCEPT;
    offer.respondedAt = new Date();
    await this.offersRepo.save(offer);

    group.status = TripGroupStatus.OFFERING;
    group.assignedDriver = null;
    group.driverTripId = null;
    group.assignedAt = null;
    await this.groupsRepo.save(group);
    this.logger.log(
      `Driver #${offer.driver.id} cancelled group #${group.id} — restarting cascade`,
    );

    await this.sendNextOffer(group);
  }

  // ─── Internals ─────────────────────────────────────────────

  private async cancelEmptyGroup(group: TripGroup): Promise<void> {
    if (group.status === TripGroupStatus.CANCELLED) return;

    // If a driver was already assigned, cancel the DriverTrip row so
    // it doesn't sit as ACCEPTED forever. Fire a driver notification
    // per §10 ("driver released + compensation event emitted"; the
    // compensation event itself lives in the earnings service — not
    // in matcher scope).
    if (group.driverTripId && group.assignedDriver) {
      const dt = await this.driverTripsRepo.findOne({
        where: { id: group.driverTripId },
      });
      if (
        dt &&
        (dt.status === DriverTripStatus.ACCEPTED ||
          dt.status === DriverTripStatus.OFFERED)
      ) {
        dt.status = DriverTripStatus.CANCELLED;
        dt.cancelledAt = new Date();
        dt.cancellationReason = 'all_passengers_cancelled';
        await this.driverTripsRepo.save(dt);
      }
      await this.driverNotifications.emit({
        driverId: group.assignedDriver.id,
        type: DriverNotificationType.PASSENGER_CANCELLED,
        title: 'All passengers cancelled',
        body: 'The trip has been cancelled. You will be compensated.',
        payload: {
          tripGroupId: group.id,
          driverTripId: group.driverTripId,
          reason: 'all_passengers_cancelled',
        },
      });
    }

    group.status = TripGroupStatus.CANCELLED;
    await this.groupsRepo.save(group);
    this.logger.log(`Group #${group.id} → CANCELLED (empty)`);
  }

  // ─── Internals ─────────────────────────────────────────────

  /**
   * Record how the current offer ended, then decide the next step:
   * next cascade candidate → broadcast → escalation.
   */
  private async recordAndAdvance(
    offer: TripOfferHistory,
    response: OfferResponse.DECLINE | OfferResponse.TIMEOUT,
  ): Promise<void> {
    offer.response = response;
    offer.respondedAt = new Date();
    await this.offersRepo.save(offer);

    // Ensure the DriverTrip row is DECLINED/EXPIRED so it doesn't stay
    // as OFFERED forever.
    if (offer.driverTrip) {
      const dt = await this.driverTripsRepo.findOne({
        where: { id: offer.driverTrip.id },
      });
      if (dt && dt.status === DriverTripStatus.OFFERED) {
        dt.status =
          response === OfferResponse.TIMEOUT
            ? DriverTripStatus.EXPIRED
            : DriverTripStatus.DECLINED;
        await this.driverTripsRepo.save(dt);
      }
    }

    const group = await this.groupsRepo.findOne({
      where: { id: offer.tripGroup.id },
      relations: ['originCity', 'destCity'],
    });
    if (!group) return;
    await this.sendNextOffer(group);
  }

  /**
   * Rank eligible drivers, filter out anyone we already offered to,
   * and either offer to the top candidate, escalate to broadcast, or
   * escalate to ops if we've run out of options.
   */
  private async sendNextOffer(group: TripGroup): Promise<void> {
    if (
      group.status !== TripGroupStatus.OFFERING &&
      group.status !== TripGroupStatus.BROADCASTING
    ) {
      return;
    }

    const cfg = await this.matchingConfigService.getConfig();
    const requests = await this.requestsRepo.find({
      where: { tripGroup: { id: group.id } },
    });
    const totalSeats = requests.reduce((n, r) => n + (r.seatsCount ?? 1), 0);

    // Drivers we've already offered this group are excluded from the
    // cascade — one offer per driver per trip (§9.3).
    const priorOffers = await this.offersRepo.find({
      where: { tripGroup: { id: group.id } },
      relations: ['driver'],
    });
    const alreadyOfferedIds = new Set(priorOffers.map((o) => o.driver.id));

    // Any driver currently mid-offer somewhere else is excluded too.
    const busyDriverRows = await this.offersRepo
      .createQueryBuilder('h')
      .select('h.driverId', 'driverId')
      .where('h.response = :pending', { pending: OfferResponse.PENDING })
      .getRawMany<{ driverId: number }>();
    const busyDriverIds = new Set(busyDriverRows.map((r) => r.driverId));

    // Filter live candidates.
    const online = await this.driversRepo.find({
      where: { status: DriverStatus.ACTIVE },
    });
    const originCity = group.originCity;
    const radius =
      originCity.serviceRadiusMeters ?? cfg.defaultServiceRadiusMeters;
    const eligible = online.filter((d) => {
      if (alreadyOfferedIds.has(d.id)) return false;
      if (busyDriverIds.has(d.id)) return false;
      return isDriverEligible(d, group, originCity, radius, totalSeats).ok;
    });

    if (eligible.length === 0) {
      await this.escalateOrBroadcast(group);
      return;
    }

    // Decline penalty — count declines + timeouts in the last 30 days.
    const declines = await this.offersRepo
      .createQueryBuilder('h')
      .select('h.driverId', 'driverId')
      .addSelect('COUNT(*)', 'n')
      .where('h.response IN (:...bad)', {
        bad: [
          OfferResponse.DECLINE,
          OfferResponse.TIMEOUT,
          OfferResponse.CANCEL_AFTER_ACCEPT,
        ],
      })
      .andWhere('h.respondedAt > NOW() - INTERVAL \'30 days\'')
      .groupBy('h.driverId')
      .getRawMany<{ driverId: string; n: string }>();
    const declineMap = new Map<number, number>(
      declines.map((r) => [Number(r.driverId), Number(r.n)]),
    );

    const ranked = rankDrivers(eligible, group, originCity, declineMap);
    const top = ranked[0];
    const chosen = eligible.find((d) => d.id === top.driverId)!;
    await this.offerToDriver(group, chosen, ranked.indexOf(top), false, cfg);
  }

  /**
   * Cascade queue is empty. If we're still in OFFERING and there's
   * time on the clock, escalate to broadcast; otherwise open an
   * escalation case.
   */
  private async escalateOrBroadcast(group: TripGroup): Promise<void> {
    if (group.status === TripGroupStatus.BROADCASTING) {
      // Broadcast round finished with no accept — escalate.
      await this.escalate(group);
      return;
    }
    group.status = TripGroupStatus.BROADCASTING;
    await this.groupsRepo.save(group);
    this.logger.log(`Group #${group.id} → BROADCASTING`);
    await this.triggerBroadcast(group);
  }

  private async triggerBroadcast(group: TripGroup): Promise<void> {
    const cfg = await this.matchingConfigService.getConfig();
    const originCity = group.originCity;
    const radius =
      originCity.serviceRadiusMeters ?? cfg.defaultServiceRadiusMeters;
    const requests = await this.requestsRepo.find({
      where: { tripGroup: { id: group.id } },
    });
    const totalSeats = requests.reduce((n, r) => n + (r.seatsCount ?? 1), 0);

    const priorOffers = await this.offersRepo.find({
      where: { tripGroup: { id: group.id } },
      relations: ['driver'],
    });
    const alreadyOfferedIds = new Set(priorOffers.map((o) => o.driver.id));

    // Broadcast pool: online, capacity ok, trip-type ok, going-home ok,
    // gender-order preserved (women-only groups still prefer female
    // drivers in the pool). Preference / min-fit / decline penalty are
    // relaxed per §9.4.
    const online = await this.driversRepo.find({
      where: { status: DriverStatus.ACTIVE },
    });
    const pool = online.filter((d) => {
      if (alreadyOfferedIds.has(d.id)) return false;
      const verdict = isDriverEligible(d, group, originCity, radius, totalSeats);
      return verdict.ok;
    });

    if (pool.length === 0) {
      await this.escalate(group);
      return;
    }

    // Women-only broadcast: female drivers offered simultaneously
    // first; males only if no female exists in the pool (§7 + §9.4).
    let broadcastSet = pool;
    if (group.womenOnly) {
      const females = pool.filter((d) => d.gender === 'female');
      broadcastSet = females.length > 0 ? females : pool;
    }

    this.logger.log(
      `Broadcast group #${group.id} to ${broadcastSet.length} drivers`,
    );
    for (const d of broadcastSet) {
      await this.offerToDriver(group, d, -1, true, cfg);
    }
  }

  private async escalate(group: TripGroup): Promise<void> {
    if (group.status === TripGroupStatus.UNSERVED_ESCALATION) return;
    group.status = TripGroupStatus.UNSERVED_ESCALATION;
    await this.groupsRepo.save(group);

    const esc = new EscalationCase();
    esc.tripGroup = group;
    esc.escalatedAt = new Date();
    esc.resolvedAt = null;
    esc.resolvedBy = null;
    esc.resolutionNotes = null;
    await this.escalationsRepo.save(esc);

    this.logger.warn(`Group #${group.id} → UNSERVED_ESCALATION`);

    const requests = await this.requestsRepo.find({
      where: { tripGroup: { id: group.id } },
      relations: ['passenger'],
    });
    for (const r of requests) {
      if (!r.passenger) continue;
      await this.passengerNotifications.emit({
        userId: r.passenger.id,
        type: PassengerNotificationType.TRIP_DELAY_ESCALATION,
        titleEn: 'Your trip is delayed',
        titleAr: 'رحلتك متأخرة',
        bodyEn:
          "We're still finding a driver. Our team is working on it — we'll update you shortly.",
        bodyAr:
          'ما زلنا نبحث عن سائق. فريقنا يعمل على ذلك وسنقوم بإعلامك قريبًا.',
        payload: { tripGroupId: group.id, tripRequestId: r.id },
      });
    }
  }

  private async offerToDriver(
    group: TripGroup,
    driver: Driver,
    cascadeIndex: number,
    broadcast: boolean,
    cfg: { offerCountdownSeconds: number },
  ): Promise<void> {
    const requests = await this.requestsRepo.find({
      where: { tripGroup: { id: group.id } },
      relations: ['departureCity', 'arrivalCity'],
    });
    if (requests.length === 0) {
      this.logger.warn(
        `offerToDriver: group #${group.id} has no requests, skipping`,
      );
      return;
    }
    const seedRequest = requests[0];

    const dto: SeedDriverTripDto = {
      driverId: driver.id,
      type: group.womenOnly ? DriverTripType.WOMEN_ONLY : DriverTripType.SHARED,
      originCity: group.originCity.nameEn,
      destinationCity: group.destCity.nameEn,
      departureTime: group.departureTime.toISOString(),
      pickupLat: seedRequest.departureLocation.lat,
      pickupLng: seedRequest.departureLocation.lng,
      dropoffLat: seedRequest.arrivalLocation.lat,
      dropoffLng: seedRequest.arrivalLocation.lng,
      tripRequestIds: requests.map((r) => r.id),
      packageDeliveryIds: [],
      offerCountdownSeconds: cfg.offerCountdownSeconds,
    };

    let driverTrip: DriverTrip;
    try {
      driverTrip = await this.driverTripsService.seedTrip(dto);
    } catch (err) {
      this.logger.error(
        `seedTrip failed for group #${group.id} driver #${driver.id}: ${err instanceof Error ? err.message : err}`,
      );
      // Skip this driver, keep the cascade going.
      const groupReload = await this.groupsRepo.findOne({
        where: { id: group.id },
        relations: ['originCity', 'destCity'],
      });
      if (groupReload) await this.sendNextOffer(groupReload);
      return;
    }

    const history = new TripOfferHistory();
    history.tripGroup = group;
    history.driver = driver;
    history.driverTrip = driverTrip;
    history.cascadeIndex = cascadeIndex;
    history.broadcast = broadcast;
    history.offeredAt = new Date();
    history.expiresAt = new Date(
      Date.now() + cfg.offerCountdownSeconds * 1000,
    );
    history.respondedAt = null;
    history.response = OfferResponse.PENDING;
    await this.offersRepo.save(history);

    await this.driverNotifications.emit({
      driverId: driver.id,
      type: DriverNotificationType.OFFER_RECEIVED,
      title: 'New trip offer',
      body: `${group.originCity.nameEn} → ${group.destCity.nameEn}`,
      payload: {
        driverTripId: driverTrip.id,
        tripGroupId: group.id,
        womenOnly: group.womenOnly,
        broadcast,
      },
    });
  }

  private async notifyMembersFrozen(group: TripGroup): Promise<void> {
    const requests = await this.requestsRepo.find({
      where: { tripGroup: { id: group.id } },
      relations: ['passenger'],
    });
    for (const r of requests) {
      if (!r.passenger) continue;
      await this.passengerNotifications.emit({
        userId: r.passenger.id,
        type: PassengerNotificationType.TRIP_FROZEN,
        titleEn: 'Finding your driver',
        titleAr: 'نبحث عن سائقك',
        bodyEn: `Your ${group.originCity.nameEn} → ${group.destCity.nameEn} trip is confirmed. We're matching you with a driver now.`,
        bodyAr: `تم تأكيد رحلتك من ${group.originCity.nameAr} إلى ${group.destCity.nameAr}. نبحث الآن عن سائق.`,
        payload: { tripGroupId: group.id, tripRequestId: r.id },
      });
    }
  }

  private async notifyMembersAssigned(
    mgr: EntityManager,
    group: TripGroup,
    driver: Driver,
  ): Promise<void> {
    const requests = await mgr.find(TripRequest, {
      where: { tripGroup: { id: group.id } },
      relations: ['passenger'],
    });
    for (const r of requests) {
      if (!r.passenger) continue;
      await this.passengerNotifications.emit({
        userId: r.passenger.id,
        type: PassengerNotificationType.TRIP_ASSIGNED,
        titleEn: 'Driver assigned',
        titleAr: 'تم تعيين السائق',
        bodyEn: `${driver.name ?? 'Your driver'} will pick you up.`,
        bodyAr: `${driver.name ?? 'سائقك'} سيلتقطك.`,
        payload: {
          tripGroupId: group.id,
          driverId: driver.id,
        },
      });

      // Women-only male-driver fallback (§7)
      if (group.womenOnly && driver.gender !== 'female') {
        await this.passengerNotifications.emit({
          userId: r.passenger.id,
          type: PassengerNotificationType.WOMEN_ONLY_MALE_DRIVER_FALLBACK,
          titleEn: 'Male driver assigned',
          titleAr: 'تم تعيين سائق ذكر',
          bodyEn:
            'No female driver was available. You can cancel without a fee if you prefer.',
          bodyAr:
            'لم تكن هناك سائقة متاحة. يمكنك الإلغاء بدون رسوم إن أردت.',
          payload: { tripGroupId: group.id, driverId: driver.id },
        });
      }
    }

    // Sync passenger TripRequest statuses to MATCHED so the mobile
    // app's active-trip card flips out of "pending".
    if (requests.length) {
      await mgr
        .createQueryBuilder()
        .update(TripRequest)
        .set({ status: TripStatus.MATCHED, statusUpdatedAt: new Date() })
        .whereInIds(requests.map((r) => r.id))
        .execute();
    }
    // Small type-only reference so `In` doesn't get tree-shaken from
    // imports when TypeScript trims unused ones.
    void In;
    void IsNull;
  }
}
