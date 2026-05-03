import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { I18nContext } from 'nestjs-i18n';
import { DriverTrip } from './entities/driver-trip.entity';
import { DriverTripStop } from './entities/driver-trip-stop.entity';
import { DriverTripStopPassenger } from './entities/driver-trip-stop-passenger.entity';
import { DriverTripStopPackage } from './entities/driver-trip-stop-package.entity';
import { DriverTripDeclineLog } from './entities/driver-trip-decline-log.entity';
import { Driver } from '../drivers/driver.entity';
import { TripRequest } from '../trips/entities/trip-request.entity';
import { PackageDelivery } from '../packages/entities/package-delivery.entity';
import { DriverTripStatus } from '../shared/enums/driver-trip-status.enum';
import { DriverTripStopStatus } from '../shared/enums/driver-trip-stop-status.enum';
import { DriverTripStopType } from '../shared/enums/driver-trip-stop-type.enum';
import {
  StopPassengerRole,
  StopPassengerStatus,
} from '../shared/enums/stop-passenger-status.enum';
import {
  StopPackageRole,
  StopPackageStatus,
} from '../shared/enums/stop-package-status.enum';
import { DriverTripDeclineReason } from '../shared/enums/driver-trip-decline-reason.enum';
import { DriverStatus } from '../shared/enums/driver-status.enum';
import { TripStatus } from '../shared/enums/trip-status.enum';
import { PackageStatus } from '../shared/enums/package-status.enum';
import { DriverTripType } from '../shared/enums/driver-trip-type.enum';
import { DeclineTripDto } from './dto/decline-trip.dto';
import { ConfirmPickupDto } from './dto/confirm-pickup.dto';
import { ConfirmDropoffDto } from './dto/confirm-dropoff.dto';
import { SeedDriverTripDto } from './dto/seed-driver-trip.dto';
import { OfferResponseDto } from './dto/offer.dto';
import {
  ManifestPackageDto,
  ManifestPassengerDto,
  ManifestResponseDto,
  ManifestStopDto,
} from './dto/manifest.dto';
import { ActiveStateResponseDto } from './dto/active-state.dto';
import { TripCompletionResponseDto } from './dto/trip-completion.dto';
import { CancelTripDto, CancelTripResponseDto } from './dto/cancel-trip.dto';
import { DriverNotificationsService } from '../notifications/driver-notifications.service';
import { DriverNotificationType } from '../shared/enums/driver-notification-type.enum';

const DEFAULT_OFFER_SECONDS = 45;
const DEFAULT_COMMISSION_RATE = 0.15;
const ESTIMATED_MINUTES_PER_STOP = 35;

@Injectable()
export class DriverTripsService {
  constructor(
    @InjectRepository(DriverTrip)
    private readonly tripsRepo: Repository<DriverTrip>,
    @InjectRepository(DriverTripStop)
    private readonly stopsRepo: Repository<DriverTripStop>,
    @InjectRepository(DriverTripStopPassenger)
    private readonly stopPassengersRepo: Repository<DriverTripStopPassenger>,
    @InjectRepository(DriverTripStopPackage)
    private readonly stopPackagesRepo: Repository<DriverTripStopPackage>,
    @InjectRepository(DriverTripDeclineLog)
    private readonly declineLogsRepo: Repository<DriverTripDeclineLog>,
    @InjectRepository(Driver)
    private readonly driversRepo: Repository<Driver>,
    @InjectRepository(TripRequest)
    private readonly tripRequestsRepo: Repository<TripRequest>,
    @InjectRepository(PackageDelivery)
    private readonly packagesRepo: Repository<PackageDelivery>,
    private readonly dataSource: DataSource,
    private readonly notifications: DriverNotificationsService,
  ) {}

  // ═════════════════════════════════════════════════════════════
  // S-07/S-08 — Offer / Accept / Decline
  // ═════════════════════════════════════════════════════════════

  async getOffer(driverId: number, tripId: number): Promise<OfferResponseDto> {
    const trip = await this.requireTripForDriver(driverId, tripId);
    if (trip.status !== DriverTripStatus.OFFERED) {
      throw new BadRequestException(
        I18nContext.current()?.t('driver-trip.Not an offer'),
      );
    }
    if (this.offerExpired(trip)) {
      await this.expireOfferIfNeeded(trip);
      throw new BadRequestException(
        I18nContext.current()?.t('driver-trip.Offer expired'),
      );
    }

    const stops = await this.stopsRepo.find({
      where: { trip: { id: trip.id } },
      relations: ['passengers', 'packages'],
      order: { order: 'ASC' },
    });

    let passengerCount = 0;
    let packageCount = 0;
    for (const stop of stops) {
      for (const sp of stop.passengers) {
        if (sp.role === StopPassengerRole.BOARDING) passengerCount++;
      }
      for (const pkg of stop.packages) {
        if (pkg.role === StopPackageRole.COLLECTING) packageCount++;
      }
    }

    return {
      id: trip.id,
      type: trip.type,
      originCity: trip.originCity,
      destinationCity: trip.destinationCity,
      departureTime: trip.departureTime,
      passengerCount,
      packageCount,
      stopCount: stops.length,
      estimatedDurationMinutes: this.estimateDuration(stops.length),
      estimatedCashToCollect: Number(trip.totalCashExpected),
      offeredAt: trip.offeredAt,
      offerExpiresAt: trip.offerExpiresAt,
      secondsRemaining: Math.max(
        0,
        Math.floor((trip.offerExpiresAt.getTime() - Date.now()) / 1000),
      ),
      stopPreview: stops.map((s) => ({
        order: s.order,
        city: s.city,
        address: s.address ?? null,
        type: s.type,
      })),
    };
  }

  async accept(driverId: number, tripId: number): Promise<ManifestResponseDto> {
    const driver = await this.requireDriver(driverId);
    const trip = await this.requireTripForDriver(driverId, tripId);

    if (trip.status !== DriverTripStatus.OFFERED) {
      throw new BadRequestException(
        I18nContext.current()?.t('driver-trip.Cannot accept'),
      );
    }
    if (this.offerExpired(trip)) {
      await this.expireOfferIfNeeded(trip);
      throw new BadRequestException(
        I18nContext.current()?.t('driver-trip.Offer expired'),
      );
    }

    // Driver must not already be on another trip
    const existing = await this.tripsRepo.findOne({
      where: {
        driver: { id: driverId },
        status: In([DriverTripStatus.ACCEPTED, DriverTripStatus.IN_PROGRESS]),
      },
    });
    if (existing) {
      throw new ForbiddenException(
        I18nContext.current()?.t('driver-trip.Already busy'),
      );
    }

    return this.dataSource.transaction(async (mgr) => {
      const now = new Date();
      trip.status = DriverTripStatus.ACCEPTED;
      trip.acceptedAt = now;
      await mgr.save(trip);

      // Sync passenger TripRequests: assign driver, transition status
      const tripRequestIds = await this.collectLinkedTripRequestIds(trip.id);
      if (tripRequestIds.length) {
        await mgr
          .createQueryBuilder()
          .update(TripRequest)
          .set({
            driver: { id: driver.id },
            status: TripStatus.MATCHED,
            statusUpdatedAt: now,
          })
          .whereInIds(tripRequestIds)
          .execute();
      }

      // Sync package deliveries
      const packageIds = await this.collectLinkedPackageIds(trip.id);
      if (packageIds.length) {
        await mgr
          .createQueryBuilder()
          .update(PackageDelivery)
          .set({ status: PackageStatus.MATCHED })
          .whereInIds(packageIds)
          .execute();
      }

      return this.buildManifest(trip.id);
    });
  }

  async decline(
    driverId: number,
    tripId: number,
    dto: DeclineTripDto,
  ): Promise<{ message: string }> {
    const trip = await this.requireTripForDriver(driverId, tripId);
    if (trip.status !== DriverTripStatus.OFFERED) {
      throw new BadRequestException(
        I18nContext.current()?.t('driver-trip.Cannot decline'),
      );
    }

    const now = new Date();
    trip.status = DriverTripStatus.DECLINED;
    trip.declinedAt = now;
    await this.tripsRepo.save(trip);

    await this.declineLogsRepo.save(
      this.declineLogsRepo.create({
        driver: { id: driverId } as Driver,
        trip: { id: trip.id } as DriverTrip,
        reason: dto.reason,
        notes: dto.notes,
        autoDeclined: false,
      }),
    );

    return { message: 'Declined' };
  }

  // ═════════════════════════════════════════════════════════════
  // S-09/S-10 — Manifest / Start / Active state / Arrive
  // ═════════════════════════════════════════════════════════════

  async getManifest(
    driverId: number,
    tripId: number,
  ): Promise<ManifestResponseDto> {
    await this.requireTripForDriver(driverId, tripId);
    return this.buildManifest(tripId);
  }

  async start(driverId: number, tripId: number): Promise<ManifestResponseDto> {
    const trip = await this.requireTripForDriver(driverId, tripId);
    if (trip.status !== DriverTripStatus.ACCEPTED) {
      throw new BadRequestException(
        I18nContext.current()?.t('driver-trip.Cannot start'),
      );
    }

    return this.dataSource.transaction(async (mgr) => {
      const now = new Date();
      trip.status = DriverTripStatus.IN_PROGRESS;
      trip.startedAt = now;
      await mgr.save(trip);

      await mgr.update(
        Driver,
        { id: driverId },
        { status: DriverStatus.ON_TRIP },
      );

      // Sync passenger TripRequests to DRIVER_EN_ROUTE
      const tripRequestIds = await this.collectLinkedTripRequestIds(trip.id);
      if (tripRequestIds.length) {
        await mgr
          .createQueryBuilder()
          .update(TripRequest)
          .set({
            status: TripStatus.DRIVER_EN_ROUTE,
            statusUpdatedAt: now,
          })
          .whereInIds(tripRequestIds)
          .execute();
      }

      return this.buildManifest(trip.id);
    });
  }

  async getActiveTrip(driverId: number): Promise<ActiveStateResponseDto> {
    const trip = await this.tripsRepo.findOne({
      where: {
        driver: { id: driverId },
        status: In([DriverTripStatus.ACCEPTED, DriverTripStatus.IN_PROGRESS]),
      },
      order: { acceptedAt: 'DESC' },
    });
    if (!trip) {
      throw new NotFoundException(
        I18nContext.current()?.t('driver-trip.No active trip'),
      );
    }
    return this.buildActiveState(trip);
  }

  async getActiveState(
    driverId: number,
    tripId: number,
  ): Promise<ActiveStateResponseDto> {
    const trip = await this.requireTripForDriver(driverId, tripId);
    if (
      trip.status !== DriverTripStatus.IN_PROGRESS &&
      trip.status !== DriverTripStatus.ACCEPTED
    ) {
      throw new BadRequestException(
        I18nContext.current()?.t('driver-trip.Not active'),
      );
    }
    return this.buildActiveState(trip);
  }

  async arriveAtStop(
    driverId: number,
    tripId: number,
    stopId: number,
  ): Promise<ActiveStateResponseDto> {
    const trip = await this.requireTripForDriver(driverId, tripId);
    if (trip.status !== DriverTripStatus.IN_PROGRESS) {
      throw new BadRequestException(
        I18nContext.current()?.t('driver-trip.Trip not started'),
      );
    }
    const stop = await this.requireStopOfTrip(trip.id, stopId);

    if (stop.order !== trip.currentStopIndex) {
      throw new BadRequestException(
        I18nContext.current()?.t('driver-trip.Wrong stop'),
      );
    }
    if (stop.status !== DriverTripStopStatus.PENDING) {
      throw new BadRequestException(
        I18nContext.current()?.t('driver-trip.Stop already arrived'),
      );
    }

    return this.dataSource.transaction(async (mgr) => {
      stop.status = DriverTripStopStatus.ARRIVED;
      stop.arrivedAt = new Date();
      await mgr.save(stop);

      // Sync alighting passengers: ARRIVING_AT_DROPOFF
      // Sync boarding passengers: ARRIVED_AT_PICKUP
      const passengerLinks = await mgr.find(DriverTripStopPassenger, {
        where: { stop: { id: stop.id } },
        relations: ['tripRequest'],
      });
      for (const link of passengerLinks) {
        const newStatus =
          link.role === StopPassengerRole.BOARDING
            ? TripStatus.ARRIVED_AT_PICKUP
            : TripStatus.ARRIVING_AT_DROPOFF;
        await mgr.update(
          TripRequest,
          { id: link.tripRequest.id },
          { status: newStatus, statusUpdatedAt: new Date() },
        );
      }

      return this.buildActiveState(trip);
    });
  }

  // ═════════════════════════════════════════════════════════════
  // S-11/S-12 — Confirm pickup / Confirm dropoff
  // ═════════════════════════════════════════════════════════════

  async confirmPickup(
    driverId: number,
    tripId: number,
    stopId: number,
    dto: ConfirmPickupDto,
  ): Promise<ActiveStateResponseDto> {
    const trip = await this.requireTripForDriver(driverId, tripId);
    if (trip.status !== DriverTripStatus.IN_PROGRESS) {
      throw new BadRequestException(
        I18nContext.current()?.t('driver-trip.Trip not started'),
      );
    }
    const stop = await this.requireStopOfTrip(trip.id, stopId);
    if (stop.status !== DriverTripStopStatus.ARRIVED) {
      throw new BadRequestException(
        I18nContext.current()?.t('driver-trip.Mark arrived first'),
      );
    }
    if (
      stop.type !== DriverTripStopType.PICKUP &&
      stop.type !== DriverTripStopType.PICKUP_DROPOFF
    ) {
      throw new BadRequestException(
        I18nContext.current()?.t('driver-trip.Not a pickup stop'),
      );
    }

    const boarding = await this.stopPassengersRepo.find({
      where: { stop: { id: stop.id }, role: StopPassengerRole.BOARDING },
      relations: ['tripRequest'],
    });
    const collecting = await this.stopPackagesRepo.find({
      where: { stop: { id: stop.id }, role: StopPackageRole.COLLECTING },
      relations: ['packageDelivery'],
    });

    const pickedSet = new Set(dto.passengersPickedUp ?? []);
    const noShowSet = new Set(dto.noShows ?? []);
    const collectedSet = new Set(dto.packagesCollected ?? []);
    const notFoundSet = new Set(dto.packagesNotFound ?? []);

    this.validateAllResolved(
      boarding.map((p) => p.id),
      pickedSet,
      noShowSet,
      'passenger',
    );
    this.validateAllResolved(
      collecting.map((p) => p.id),
      collectedSet,
      notFoundSet,
      'package',
    );

    return this.dataSource.transaction(async (mgr) => {
      const now = new Date();
      for (const link of boarding) {
        const isPicked = pickedSet.has(link.id);
        link.status = isPicked
          ? StopPassengerStatus.PICKED_UP
          : StopPassengerStatus.NO_SHOW;
        link.confirmedAt = now;
        await mgr.save(link);
        await mgr.update(
          TripRequest,
          { id: link.tripRequest.id },
          {
            status: isPicked ? TripStatus.TRIP_IN_PROGRESS : TripStatus.CANCELLED,
            statusUpdatedAt: now,
          },
        );
      }
      for (const link of collecting) {
        const collected = collectedSet.has(link.id);
        link.status = collected
          ? StopPackageStatus.COLLECTED
          : StopPackageStatus.NOT_FOUND;
        link.confirmedAt = now;
        await mgr.save(link);
        await mgr.update(
          PackageDelivery,
          { id: link.packageDelivery.id },
          {
            status: collected ? PackageStatus.PICKED_UP : PackageStatus.CANCELLED,
          },
        );
      }

      stop.status = DriverTripStopStatus.CONFIRMED;
      stop.confirmedAt = now;
      await mgr.save(stop);

      // Advance to next stop unless this is the last stop
      const refreshedTrip = await mgr.findOne(DriverTrip, {
        where: { id: trip.id },
      });
      if (refreshedTrip) {
        refreshedTrip.currentStopIndex = stop.order + 1;
        await mgr.save(refreshedTrip);
      }

      return this.buildActiveState(refreshedTrip ?? trip);
    });
  }

  async confirmDropoff(
    driverId: number,
    tripId: number,
    stopId: number,
    dto: ConfirmDropoffDto,
  ): Promise<ActiveStateResponseDto> {
    const trip = await this.requireTripForDriver(driverId, tripId);
    if (trip.status !== DriverTripStatus.IN_PROGRESS) {
      throw new BadRequestException(
        I18nContext.current()?.t('driver-trip.Trip not started'),
      );
    }
    const stop = await this.requireStopOfTrip(trip.id, stopId);
    if (stop.status !== DriverTripStopStatus.ARRIVED) {
      throw new BadRequestException(
        I18nContext.current()?.t('driver-trip.Mark arrived first'),
      );
    }
    if (
      stop.type !== DriverTripStopType.DROPOFF &&
      stop.type !== DriverTripStopType.PICKUP_DROPOFF
    ) {
      throw new BadRequestException(
        I18nContext.current()?.t('driver-trip.Not a dropoff stop'),
      );
    }

    const alighting = await this.stopPassengersRepo.find({
      where: { stop: { id: stop.id }, role: StopPassengerRole.ALIGHTING },
      relations: ['tripRequest'],
    });
    const delivering = await this.stopPackagesRepo.find({
      where: { stop: { id: stop.id }, role: StopPackageRole.DELIVERING },
      relations: ['packageDelivery'],
    });

    const droppedEntries = dto.passengersDroppedOff ?? [];
    const droppedIds = new Set(droppedEntries.map((e) => e.id));
    if (droppedIds.size !== alighting.length) {
      throw new BadRequestException(
        I18nContext.current()?.t('driver-trip.Resolve all passengers'),
      );
    }
    for (const link of alighting) {
      if (!droppedIds.has(link.id)) {
        throw new BadRequestException(
          I18nContext.current()?.t('driver-trip.Resolve all passengers'),
        );
      }
    }

    const deliveredSet = new Set(dto.packagesDelivered ?? []);
    const failures = dto.deliveryFailures ?? [];
    const failedIds = new Set(failures.map((f) => f.id));
    this.validateAllResolved(
      delivering.map((p) => p.id),
      deliveredSet,
      failedIds,
      'package',
    );

    return this.dataSource.transaction(async (mgr) => {
      const now = new Date();
      let cashAddedAtStop = 0;
      let cashAddedTotal = 0;

      for (const link of alighting) {
        const entry = droppedEntries.find((e) => e.id === link.id)!;
        link.cashCollected = entry.cashCollected;
        link.status = entry.cashCollected
          ? StopPassengerStatus.DROPPED_OFF
          : StopPassengerStatus.CASH_NOT_COLLECTED;
        link.confirmedAt = now;
        await mgr.save(link);

        if (entry.cashCollected) {
          cashAddedAtStop += Number(link.fare);
          cashAddedTotal += Number(link.fare);
        }

        await mgr.update(
          TripRequest,
          { id: link.tripRequest.id },
          { status: TripStatus.COMPLETED, statusUpdatedAt: now },
        );
      }

      for (const link of delivering) {
        const delivered = deliveredSet.has(link.id);
        if (delivered) {
          link.status = StopPackageStatus.DELIVERED;
          cashAddedAtStop += Number(link.fee);
          cashAddedTotal += Number(link.fee);
          await mgr.update(
            PackageDelivery,
            { id: link.packageDelivery.id },
            { status: PackageStatus.DELIVERED },
          );
        } else {
          const failure = failures.find((f) => f.id === link.id)!;
          link.status = StopPackageStatus.DELIVERY_FAILED;
          link.failureReason = failure.reason;
          link.failureNotes = (failure.notes ?? null) as unknown as string;
          await mgr.update(
            PackageDelivery,
            { id: link.packageDelivery.id },
            { status: PackageStatus.CANCELLED },
          );
        }
        link.confirmedAt = now;
        await mgr.save(link);
      }

      stop.status = DriverTripStopStatus.CONFIRMED;
      stop.confirmedAt = now;
      await mgr.save(stop);

      const refreshedTrip = await mgr.findOne(DriverTrip, {
        where: { id: trip.id },
      });
      if (refreshedTrip) {
        refreshedTrip.currentStopIndex = stop.order + 1;
        refreshedTrip.totalCashCollected =
          Number(refreshedTrip.totalCashCollected) + cashAddedTotal;
        await mgr.save(refreshedTrip);
      }

      void cashAddedAtStop;
      return this.buildActiveState(refreshedTrip ?? trip);
    });
  }

  // ═════════════════════════════════════════════════════════════
  // S-13 — Complete
  // ═════════════════════════════════════════════════════════════

  async complete(
    driverId: number,
    tripId: number,
  ): Promise<TripCompletionResponseDto> {
    const trip = await this.requireTripForDriver(driverId, tripId);
    if (trip.status !== DriverTripStatus.IN_PROGRESS) {
      throw new BadRequestException(
        I18nContext.current()?.t('driver-trip.Cannot complete'),
      );
    }

    const stops = await this.stopsRepo.find({
      where: { trip: { id: trip.id } },
      relations: ['passengers', 'packages'],
      order: { order: 'ASC' },
    });
    const allConfirmed = stops.every(
      (s) => s.status === DriverTripStopStatus.CONFIRMED,
    );
    if (!allConfirmed) {
      throw new BadRequestException(
        I18nContext.current()?.t('driver-trip.Stops outstanding'),
      );
    }

    return this.dataSource.transaction(async (mgr) => {
      const now = new Date();
      const totalCashCollected = Number(trip.totalCashCollected);
      const commissionRate = Number(trip.commissionRate);
      const commissionAmount =
        Math.round(totalCashCollected * commissionRate * 100) / 100;
      const netEarnings =
        Math.round((totalCashCollected - commissionAmount) * 100) / 100;

      trip.status = DriverTripStatus.COMPLETED;
      trip.completedAt = now;
      trip.netEarnings = netEarnings;
      await mgr.save(trip);

      // Driver returns to inactive (must re-activate for next session per spec)
      // and accumulates the platform's commission as outstanding balance.
      const driver = await mgr.findOne(Driver, { where: { id: driverId } });
      if (driver) {
        driver.status = DriverStatus.INACTIVE;
        driver.totalTrips = (driver.totalTrips ?? 0) + 1;
        driver.outstandingBalance =
          Number(driver.outstandingBalance) + commissionAmount;
        // Clear session preferences on auto-deactivate
        driver.prefDestinationCity = null as unknown as string;
        driver.prefTripTypes = null as unknown as string[];
        driver.prefGoingHome = false;
        driver.prefMinPassengers = null as unknown as number;
        driver.prefActivatedAt = null as unknown as Date;
        driver.prefLocationLat = null as unknown as number;
        driver.prefLocationLng = null as unknown as number;
        await mgr.save(driver);
      }

      const passengersServed = stops.reduce(
        (sum, s) =>
          sum +
          s.passengers.filter(
            (p) =>
              p.role === StopPassengerRole.ALIGHTING &&
              (p.status === StopPassengerStatus.DROPPED_OFF ||
                p.status === StopPassengerStatus.CASH_NOT_COLLECTED),
          ).length,
        0,
      );
      const packagesDelivered = stops.reduce(
        (sum, s) =>
          sum +
          s.packages.filter(
            (p) =>
              p.role === StopPackageRole.DELIVERING &&
              p.status === StopPackageStatus.DELIVERED,
          ).length,
        0,
      );

      const durationMinutes = trip.startedAt
        ? Math.round((now.getTime() - trip.startedAt.getTime()) / 60000)
        : 0;

      // Emit earnings notification for the driver's notifications screen
      await this.notifications.emit({
        driverId,
        type: DriverNotificationType.EARNINGS_RECORDED,
        title: 'Trip earnings recorded',
        body: `Net earnings of ${netEarnings.toFixed(2)} JD have been recorded for ${trip.originCity} → ${trip.destinationCity}.`,
        payload: { tripId: trip.id, netEarnings },
      });

      return {
        tripId: trip.id,
        route: `${trip.originCity} → ${trip.destinationCity}`,
        durationMinutes,
        passengersServed,
        packagesDelivered,
        totalCashCollected,
        commissionRate,
        commissionAmount,
        netEarnings,
        outstandingBalance: driver ? Number(driver.outstandingBalance) : 0,
      };
    });
  }

  // ═════════════════════════════════════════════════════════════
  // S-14 — Cancellation (3-zone system)
  // ═════════════════════════════════════════════════════════════

  /**
   * Cancel an accepted trip. The cancellation zone is derived from current state:
   *   Zone 1 — status=ACCEPTED (before start)              → no penalty, driver returns to ACTIVE
   *   Zone 2 — status=IN_PROGRESS, no PICKED_UP yet         → soft penalty, driver returns to INACTIVE
   *   Zone 3 — status=IN_PROGRESS, at least one PICKED_UP   → forbidden (use support)
   */
  async cancel(
    driverId: number,
    tripId: number,
    dto: CancelTripDto,
  ): Promise<CancelTripResponseDto> {
    const trip = await this.requireTripForDriver(driverId, tripId);

    if (
      trip.status !== DriverTripStatus.ACCEPTED &&
      trip.status !== DriverTripStatus.IN_PROGRESS
    ) {
      throw new BadRequestException(
        I18nContext.current()?.t('driver-trip.Cannot cancel'),
      );
    }

    let zone: 1 | 2;
    if (trip.status === DriverTripStatus.ACCEPTED) {
      zone = 1;
    } else {
      const anyPickedUp = await this.stopPassengersRepo
        .createQueryBuilder('sp')
        .innerJoin('sp.stop', 'stop')
        .where('stop.tripId = :tripId', { tripId: trip.id })
        .andWhere('sp.status = :picked', {
          picked: StopPassengerStatus.PICKED_UP,
        })
        .getCount();
      if (anyPickedUp > 0) {
        throw new ForbiddenException(
          I18nContext.current()?.t('driver-trip.Cancellation blocked mid-trip'),
        );
      }
      zone = 2;
    }

    return this.dataSource.transaction(async (mgr) => {
      const now = new Date();
      trip.status = DriverTripStatus.CANCELLED;
      trip.cancelledAt = now;
      trip.cancellationReason = dto.notes
        ? `${dto.reason}: ${dto.notes}`
        : dto.reason;
      trip.cancellationZone = zone;
      await mgr.save(trip);

      // Sync linked passenger TripRequests to CANCELLED
      const tripRequestIds = await this.collectLinkedTripRequestIds(trip.id);
      if (tripRequestIds.length) {
        await mgr
          .createQueryBuilder()
          .update(TripRequest)
          .set({ status: TripStatus.CANCELLED, statusUpdatedAt: now })
          .whereInIds(tripRequestIds)
          .execute();
      }
      const packageIds = await this.collectLinkedPackageIds(trip.id);
      if (packageIds.length) {
        await mgr
          .createQueryBuilder()
          .update(PackageDelivery)
          .set({ status: PackageStatus.CANCELLED })
          .whereInIds(packageIds)
          .execute();
      }

      // Per spec: zone 1 → driver stays ACTIVE; zone 2 → driver goes INACTIVE
      const driverStatusAfter =
        zone === 1 ? DriverStatus.ACTIVE : DriverStatus.INACTIVE;
      const driverPatch: Partial<Driver> = { status: driverStatusAfter };
      if (zone === 2) {
        // Clear session prefs since driver is being deactivated
        Object.assign(driverPatch, {
          prefDestinationCity: null as unknown as string,
          prefTripTypes: null as unknown as string[],
          prefGoingHome: false,
          prefMinPassengers: null as unknown as number,
          prefActivatedAt: null as unknown as Date,
          prefLocationLat: null as unknown as number,
          prefLocationLng: null as unknown as number,
        });
      }
      await mgr.update(Driver, { id: driverId }, driverPatch);

      return {
        tripId: trip.id,
        zone,
        softPenalty: zone === 2,
        driverStatusAfter,
        message:
          zone === 1
            ? 'Trip cancelled before start. No penalty applied.'
            : 'Trip cancelled mid-route. Soft penalty recorded on your reliability score.',
      };
    });
  }

  // ═════════════════════════════════════════════════════════════
  // Dev seeder — manufacture an OFFERED trip for testing
  // ═════════════════════════════════════════════════════════════

  async seedTrip(dto: SeedDriverTripDto): Promise<DriverTrip> {
    const driver = await this.driversRepo.findOne({
      where: { id: dto.driverId },
    });
    if (!driver) throw new NotFoundException('Driver not found');

    if (
      dto.type === DriverTripType.WOMEN_ONLY &&
      driver.gender !== 'female'
    ) {
      throw new BadRequestException(
        'Cannot offer a women-only trip to a non-female driver',
      );
    }

    const tripRequests = dto.tripRequestIds.length
      ? await this.tripRequestsRepo.find({
          where: { id: In(dto.tripRequestIds) },
        })
      : [];
    if (tripRequests.length !== dto.tripRequestIds.length) {
      throw new NotFoundException('One or more TripRequests not found');
    }

    const packageDeliveryIds = dto.packageDeliveryIds ?? [];
    const packages = packageDeliveryIds.length
      ? await this.packagesRepo.find({ where: { id: In(packageDeliveryIds) } })
      : [];
    if (packages.length !== packageDeliveryIds.length) {
      throw new NotFoundException('One or more PackageDeliveries not found');
    }

    if (!tripRequests.length && !packages.length) {
      throw new BadRequestException(
        'Provide at least one trip request or package',
      );
    }

    const totalFareCash = tripRequests.reduce(
      (sum, tr) => sum + Number(tr.totalFare),
      0,
    );
    const totalPackageCash = packages.reduce(
      (sum, p) => sum + Number(p.deliveryFee),
      0,
    );
    const totalCashExpected =
      Math.round((totalFareCash + totalPackageCash) * 100) / 100;

    const offerSeconds = dto.offerCountdownSeconds ?? DEFAULT_OFFER_SECONDS;
    const now = new Date();

    return this.dataSource.transaction(async (mgr) => {
      const trip = mgr.create(DriverTrip, {
        driver: { id: driver.id },
        type: dto.type,
        status: DriverTripStatus.OFFERED,
        originCity: dto.originCity,
        destinationCity: dto.destinationCity,
        departureTime: new Date(dto.departureTime),
        currentStopIndex: 0,
        totalCashExpected,
        totalCashCollected: 0,
        commissionRate: dto.commissionRate ?? DEFAULT_COMMISSION_RATE,
        offeredAt: now,
        offerExpiresAt: new Date(now.getTime() + offerSeconds * 1000),
      });
      const savedTrip = await mgr.save(trip);

      // Pickup stop (order 0)
      const pickupStop = mgr.create(DriverTripStop, {
        trip: { id: savedTrip.id },
        order: 0,
        type: DriverTripStopType.PICKUP,
        city: dto.originCity,
        address: dto.pickupAddress,
        lat: dto.pickupLat,
        lng: dto.pickupLng,
        status: DriverTripStopStatus.PENDING,
        cashExpected: 0,
      });
      const savedPickup = await mgr.save(pickupStop);

      // Dropoff stop (order 1)
      const dropoffStop = mgr.create(DriverTripStop, {
        trip: { id: savedTrip.id },
        order: 1,
        type: DriverTripStopType.DROPOFF,
        city: dto.destinationCity,
        address: dto.dropoffAddress,
        lat: dto.dropoffLat,
        lng: dto.dropoffLng,
        status: DriverTripStopStatus.PENDING,
        cashExpected: totalCashExpected,
      });
      const savedDropoff = await mgr.save(dropoffStop);

      // Build passenger junctions
      for (const tr of tripRequests) {
        await mgr.save(
          mgr.create(DriverTripStopPassenger, {
            stop: { id: savedPickup.id },
            tripRequest: { id: tr.id },
            role: StopPassengerRole.BOARDING,
            fare: Number(tr.totalFare),
            status: StopPassengerStatus.PENDING,
          }),
        );
        await mgr.save(
          mgr.create(DriverTripStopPassenger, {
            stop: { id: savedDropoff.id },
            tripRequest: { id: tr.id },
            role: StopPassengerRole.ALIGHTING,
            fare: Number(tr.totalFare),
            status: StopPassengerStatus.PENDING,
          }),
        );
      }

      // Build package junctions
      for (const pkg of packages) {
        await mgr.save(
          mgr.create(DriverTripStopPackage, {
            stop: { id: savedPickup.id },
            packageDelivery: { id: pkg.id },
            role: StopPackageRole.COLLECTING,
            fee: Number(pkg.deliveryFee),
            status: StopPackageStatus.PENDING,
          }),
        );
        await mgr.save(
          mgr.create(DriverTripStopPackage, {
            stop: { id: savedDropoff.id },
            packageDelivery: { id: pkg.id },
            role: StopPackageRole.DELIVERING,
            fee: Number(pkg.deliveryFee),
            status: StopPackageStatus.PENDING,
          }),
        );
      }

      return savedTrip;
    }).then(async (savedTrip) => {
      await this.notifications.emit({
        driverId: dto.driverId,
        type: DriverNotificationType.TRIP_ASSIGNED,
        title: 'New trip offer',
        body: `${dto.originCity} → ${dto.destinationCity}`,
        payload: { tripId: savedTrip.id },
      });
      return savedTrip;
    });
  }

  // ═════════════════════════════════════════════════════════════
  // Helpers
  // ═════════════════════════════════════════════════════════════

  private async requireDriver(driverId: number): Promise<Driver> {
    const driver = await this.driversRepo.findOne({
      where: { id: driverId },
    });
    if (!driver) {
      throw new NotFoundException(
        I18nContext.current()?.t('driver.Not found'),
      );
    }
    if (driver.status === DriverStatus.SUSPENDED) {
      throw new ForbiddenException(
        I18nContext.current()?.t('driver-auth.Account suspended'),
      );
    }
    return driver;
  }

  private async requireTripForDriver(
    driverId: number,
    tripId: number,
  ): Promise<DriverTrip> {
    const trip = await this.tripsRepo.findOne({
      where: { id: tripId },
      relations: ['driver'],
    });
    if (!trip) {
      throw new NotFoundException(
        I18nContext.current()?.t('driver-trip.Not found'),
      );
    }
    if (trip.driver?.id !== driverId) {
      throw new ForbiddenException(
        I18nContext.current()?.t('driver-trip.Not your trip'),
      );
    }
    return trip;
  }

  private async requireStopOfTrip(
    tripId: number,
    stopId: number,
  ): Promise<DriverTripStop> {
    const stop = await this.stopsRepo.findOne({
      where: { id: stopId },
      relations: ['trip'],
    });
    if (!stop || stop.trip.id !== tripId) {
      throw new NotFoundException(
        I18nContext.current()?.t('driver-trip.Stop not found'),
      );
    }
    return stop;
  }

  private offerExpired(trip: DriverTrip): boolean {
    return !!trip.offerExpiresAt && trip.offerExpiresAt.getTime() <= Date.now();
  }

  private async expireOfferIfNeeded(trip: DriverTrip): Promise<void> {
    if (
      trip.status === DriverTripStatus.OFFERED &&
      this.offerExpired(trip)
    ) {
      trip.status = DriverTripStatus.EXPIRED;
      await this.tripsRepo.save(trip);
      await this.declineLogsRepo.save(
        this.declineLogsRepo.create({
          driver: { id: trip.driver?.id } as Driver,
          trip: { id: trip.id } as DriverTrip,
          reason: DriverTripDeclineReason.TIMEOUT,
          autoDeclined: true,
        }),
      );
    }
  }

  private estimateDuration(stopCount: number): number {
    return Math.max(stopCount, 1) * ESTIMATED_MINUTES_PER_STOP;
  }

  private validateAllResolved(
    allIds: number[],
    setA: Set<number>,
    setB: Set<number>,
    label: 'passenger' | 'package',
  ) {
    for (const id of allIds) {
      if (!setA.has(id) && !setB.has(id)) {
        throw new BadRequestException(
          I18nContext.current()?.t(
            label === 'passenger'
              ? 'driver-trip.Resolve all passengers'
              : 'driver-trip.Resolve all packages',
          ),
        );
      }
      if (setA.has(id) && setB.has(id)) {
        throw new BadRequestException(
          I18nContext.current()?.t(
            label === 'passenger'
              ? 'driver-trip.Conflicting passenger state'
              : 'driver-trip.Conflicting package state',
          ),
        );
      }
    }
  }

  private async collectLinkedTripRequestIds(
    tripId: number,
  ): Promise<number[]> {
    const links = await this.stopPassengersRepo
      .createQueryBuilder('sp')
      .innerJoin('sp.stop', 'stop')
      .innerJoin('sp.tripRequest', 'tr')
      .where('stop.tripId = :tripId', { tripId })
      .select('DISTINCT tr.id', 'id')
      .getRawMany<{ id: number }>();
    return links.map((l) => l.id);
  }

  private async collectLinkedPackageIds(tripId: number): Promise<number[]> {
    const links = await this.stopPackagesRepo
      .createQueryBuilder('sp')
      .innerJoin('sp.stop', 'stop')
      .innerJoin('sp.packageDelivery', 'pkg')
      .where('stop.tripId = :tripId', { tripId })
      .select('DISTINCT pkg.id', 'id')
      .getRawMany<{ id: number }>();
    return links.map((l) => l.id);
  }

  private async buildManifest(tripId: number): Promise<ManifestResponseDto> {
    const trip = await this.tripsRepo.findOne({ where: { id: tripId } });
    if (!trip) {
      throw new NotFoundException(
        I18nContext.current()?.t('driver-trip.Not found'),
      );
    }
    const stops = await this.stopsRepo.find({
      where: { trip: { id: tripId } },
      relations: [
        'passengers',
        'passengers.tripRequest',
        'passengers.tripRequest.passenger',
        'packages',
        'packages.packageDelivery',
        'packages.packageDelivery.sender',
      ],
      order: { order: 'ASC' },
    });

    const stopDtos: ManifestStopDto[] = stops.map((s) => ({
      id: s.id,
      order: s.order,
      type: s.type,
      city: s.city,
      address: s.address ?? null,
      lat: Number(s.lat),
      lng: Number(s.lng),
      status: s.status,
      cashExpected: Number(s.cashExpected),
      passengers: s.passengers.map(
        (p): ManifestPassengerDto => ({
          id: p.id,
          name: this.firstNameInitial(p.tripRequest?.passenger),
          gender: p.tripRequest?.passenger?.gender ?? null,
          phoneMasked: this.maskPhone(p.tripRequest?.passenger?.phoneNumber),
          role: p.role,
          fare: Number(p.fare),
          status: p.status,
          cashCollected: p.cashCollected,
        }),
      ),
      packages: s.packages.map(
        (pkg): ManifestPackageDto => ({
          id: pkg.id,
          reference: `PKG-${pkg.packageDelivery?.id}`,
          senderName: this.firstNameInitial(pkg.packageDelivery?.sender),
          senderPhoneMasked: this.maskPhone(
            pkg.packageDelivery?.sender?.phoneNumber,
          ),
          receiverName: this.shortenName(pkg.packageDelivery?.receiverName),
          receiverPhoneMasked: this.maskPhone(
            pkg.packageDelivery?.receiverPhone,
          ),
          size: pkg.packageDelivery?.packageSize,
          description: pkg.packageDelivery?.packageDescription ?? null,
          fee: Number(pkg.fee),
          role: pkg.role,
          status: pkg.status,
        }),
      ),
    }));

    const passengerCount = stopDtos.reduce(
      (n, s) => n + s.passengers.filter((p) => p.role === 'boarding').length,
      0,
    );
    const packageCount = stopDtos.reduce(
      (n, s) => n + s.packages.filter((p) => p.role === 'collecting').length,
      0,
    );

    return {
      id: trip.id,
      type: trip.type,
      status: trip.status,
      originCity: trip.originCity,
      destinationCity: trip.destinationCity,
      departureTime: trip.departureTime,
      currentStopIndex: trip.currentStopIndex,
      totalCashExpected: Number(trip.totalCashExpected),
      totalCashCollected: Number(trip.totalCashCollected),
      commissionRate: Number(trip.commissionRate),
      summary: {
        stopCount: stopDtos.length,
        passengerCount,
        packageCount,
        estimatedDurationMinutes: this.estimateDuration(stopDtos.length),
      },
      stops: stopDtos,
    };
  }

  private async buildActiveState(
    trip: DriverTrip,
  ): Promise<ActiveStateResponseDto> {
    const stops = await this.stopsRepo.find({
      where: { trip: { id: trip.id } },
      relations: ['passengers', 'packages'],
      order: { order: 'ASC' },
    });
    const remaining = stops.filter(
      (s) => s.status !== DriverTripStopStatus.CONFIRMED,
    );
    const current = stops.find((s) => s.order === trip.currentStopIndex);

    return {
      tripId: trip.id,
      status: trip.status,
      currentStopIndex: trip.currentStopIndex,
      totalStops: stops.length,
      remainingStops: remaining.length,
      currentStop: current
        ? {
            id: current.id,
            order: current.order,
            type: current.type,
            city: current.city,
            address: current.address ?? null,
            lat: Number(current.lat),
            lng: Number(current.lng),
            status: current.status,
            cashExpected: Number(current.cashExpected),
            passengerCount: current.passengers.length,
            packageCount: current.packages.length,
          }
        : null,
      totalCashCollected: Number(trip.totalCashCollected),
      totalCashExpected: Number(trip.totalCashExpected),
    };
  }

  private firstNameInitial(user?: { firstName?: string; lastName?: string }) {
    if (!user) return '';
    const first = user.firstName ?? '';
    const lastInitial = user.lastName ? `${user.lastName.charAt(0)}.` : '';
    return [first, lastInitial].filter(Boolean).join(' ');
  }

  private shortenName(name?: string) {
    if (!name) return '';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 0) return '';
    if (parts.length === 1) return parts[0];
    return `${parts[0]} ${parts[1].charAt(0)}.`;
  }

  private maskPhone(phone?: string) {
    if (!phone) return '';
    if (phone.length <= 4) return phone;
    const last4 = phone.slice(-4);
    const masked = phone.slice(0, -4).replace(/\d/g, 'X');
    return `${masked}${last4}`;
  }
}
