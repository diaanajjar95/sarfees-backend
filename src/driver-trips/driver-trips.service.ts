import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Between,
  DataSource,
  FindOptionsWhere,
  In,
  LessThanOrEqual,
  MoreThanOrEqual,
  ObjectLiteral,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';
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
import {
  TripHistoryItemDto,
  TripHistoryQueryDto,
  TripHistoryResponseDto,
} from './dto/trip-history.dto';
import { DriverNotificationsService } from '../notifications/driver-notifications.service';
import { DriverNotificationType } from '../shared/enums/driver-notification-type.enum';
import { PassengerNotificationsService } from '../notifications/passenger/passenger-notifications.service';
import { PassengerNotificationType } from '../shared/enums/passenger-notification-type.enum';
import { AssignmentService } from '../assignment/assignment.service';
import { Inject, forwardRef } from '@nestjs/common';
import { WalletsService } from '../wallets/wallets.service';
import { WalletConfigService } from '../wallets/wallet-config.service';
import { WalletTransactionType } from '../shared/enums/wallet.enum';

const DEFAULT_OFFER_SECONDS = 45;
const ESTIMATED_MINUTES_PER_STOP = 35;

/**
 * Returns "tomorrow at 00:00 local time" as a UTC Date. Used by the
 * going-home auto-offline lock (§9.6). The boundary is
 * matching_config.goingHomeDayBoundaryHourLocal — 0 by default;
 * ops can shift to e.g. 4am if drivers hit "going home" at 11pm
 * and would rather be re-eligible sooner.
 */
function nextLocalMidnight(): Date {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return tomorrow;
}

@Injectable()
export class DriverTripsService {
  private readonly logger = new Logger(DriverTripsService.name);

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
    private readonly passengerNotifications: PassengerNotificationsService,
    @Inject(forwardRef(() => AssignmentService))
    private readonly assignmentService: AssignmentService,
    private readonly walletsService: WalletsService,
    private readonly walletConfig: WalletConfigService,
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

    const tripRequestIds = await this.collectLinkedTripRequestIds(trip.id);
    const packageIds = await this.collectLinkedPackageIds(trip.id);

    await this.dataSource.transaction(async (mgr) => {
      const now = new Date();
      trip.status = DriverTripStatus.ACCEPTED;
      trip.acceptedAt = now;
      await mgr.save(trip);

      // Sync passenger TripRequests: assign driver, transition status
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
      if (packageIds.length) {
        await mgr
          .createQueryBuilder()
          .update(PackageDelivery)
          .set({ status: PackageStatus.MATCHED })
          .whereInIds(packageIds)
          .execute();
      }
    });

    // Build the manifest AFTER the transaction commits. buildManifest
    // reads through the default connection, which cannot see this
    // txn's uncommitted rows — calling it inside used to return a
    // manifest still stamped `status: "offered"` even though the
    // accept had fully succeeded.
    const manifest = await this.buildManifest(trip.id);

    // Notify passengers + package senders that a driver has been matched
    const passengerUserIds =
      await this.passengerUserIdsForRequests(tripRequestIds);
    await this.emitPassengerNotifications({
      userIds: passengerUserIds,
      type: PassengerNotificationType.REQUEST_MATCHED,
      titleEn: 'Driver matched',
      titleAr: 'تم العثور على سائق',
      bodyEn: 'Your driver has been matched and will be on the way soon.',
      bodyAr: 'تم تعيين سائق لرحلتك وسيكون في طريقه إليك قريبًا.',
      payload: { tripId: trip.id },
    });
    const senderUserIds = await this.senderUserIdsForPackages(packageIds);
    await this.emitPassengerNotifications({
      userIds: senderUserIds,
      type: PassengerNotificationType.REQUEST_MATCHED,
      titleEn: 'Driver matched for your package',
      titleAr: 'تم العثور على سائق لطردك',
      bodyEn: 'A driver has been assigned to deliver your package.',
      bodyAr: 'تم تعيين سائق لتوصيل طردك.',
      payload: { tripId: trip.id },
    });

    // Feed the Stage-2 cascade so a group-linked trip transitions
    // TripGroup → ASSIGNED and any parallel broadcast offers are
    // superseded. Legacy trips (no offer_history row) are a no-op.
    try {
      await this.assignmentService.handleAcceptance(trip.id);
    } catch (err) {
      this.logger.warn(
        `AssignmentService.handleAcceptance failed for trip #${trip.id}: ${err instanceof Error ? err.message : err}`,
      );
    }

    return manifest;
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

    // Feed the Stage-2 cascade — records the DECLINE on the offer
    // history row and offers to the next candidate. Legacy trips
    // (no offer_history row) are a no-op.
    try {
      await this.assignmentService.handleDecline(trip.id);
    } catch (err) {
      this.logger.warn(
        `AssignmentService.handleDecline failed for trip #${trip.id}: ${err instanceof Error ? err.message : err}`,
      );
    }

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

    const tripRequestIds = await this.collectLinkedTripRequestIds(trip.id);

    const manifest = await this.dataSource.transaction(async (mgr) => {
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

    // Notify passengers that the driver is now en route
    const passengerUserIds =
      await this.passengerUserIdsForRequests(tripRequestIds);
    await this.emitPassengerNotifications({
      userIds: passengerUserIds,
      type: PassengerNotificationType.DRIVER_EN_ROUTE,
      titleEn: 'Driver is on the way',
      titleAr: 'السائق في الطريق إليك',
      bodyEn: 'Your driver has started the trip and is heading to your pickup point.',
      bodyAr: 'انطلق سائقك وهو في طريقه إلى نقطة الإقلال.',
      payload: { tripId: trip.id },
    });

    return manifest;
  }

  /**
   * Paginated history of a driver's past trips. By default returns only
   * terminal statuses (COMPLETED, CANCELLED, EXPIRED, DECLINED) so the
   * mobile "My Trips" list never mixes current work with history.
   */
  async getHistory(
    driverId: number,
    query: TripHistoryQueryDto,
  ): Promise<TripHistoryResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const statuses =
      query.status && query.status.length > 0
        ? query.status
        : [
            DriverTripStatus.COMPLETED,
            DriverTripStatus.CANCELLED,
            DriverTripStatus.EXPIRED,
            DriverTripStatus.DECLINED,
          ];

    const where: FindOptionsWhere<DriverTrip> = {
      driver: { id: driverId },
      status: In(statuses),
    };
    if (query.from && query.to) {
      where.departureTime = Between(new Date(query.from), new Date(query.to));
    } else if (query.from) {
      where.departureTime = MoreThanOrEqual(new Date(query.from));
    } else if (query.to) {
      where.departureTime = LessThanOrEqual(new Date(query.to));
    }

    const [rows, totalItems] = await this.tripsRepo.findAndCount({
      where,
      order: { departureTime: 'DESC', id: 'DESC' },
      skip,
      take: limit,
    });
    const totalPages = Math.max(1, Math.ceil(totalItems / limit));

    // Fetch boarding-passenger and collecting-package counts for the
    // returned page in one round-trip each (avoids N+1).
    const tripIds = rows.map((t) => t.id);
    const passengerCountByTrip = await this.countByTrip(
      this.stopPassengersRepo
        .createQueryBuilder('sp')
        .innerJoin('sp.stop', 'stop')
        .where('stop.tripId IN (:...tripIds)', { tripIds })
        .andWhere('sp.role = :role', { role: StopPassengerRole.BOARDING }),
      tripIds,
    );
    const packageCountByTrip = await this.countByTrip(
      this.stopPackagesRepo
        .createQueryBuilder('sp')
        .innerJoin('sp.stop', 'stop')
        .where('stop.tripId IN (:...tripIds)', { tripIds })
        .andWhere('sp.role = :role', { role: StopPackageRole.COLLECTING }),
      tripIds,
    );

    const data: TripHistoryItemDto[] = rows.map((t) => ({
      id: t.id,
      status: t.status,
      type: t.type,
      originCity: t.originCity,
      destinationCity: t.destinationCity,
      departureTime: t.departureTime,
      passengerCount: passengerCountByTrip.get(t.id) ?? 0,
      packageCount: packageCountByTrip.get(t.id) ?? 0,
      netEarnings: t.netEarnings != null ? Number(t.netEarnings) : null,
      totalCashCollected: Number(t.totalCashCollected),
      acceptedAt: t.acceptedAt ?? null,
      startedAt: t.startedAt ?? null,
      completedAt: t.completedAt ?? null,
      cancelledAt: t.cancelledAt ?? null,
      cancellationZone: t.cancellationZone ?? null,
    }));

    return {
      data,
      page,
      limit,
      totalItems,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    };
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

    const result = await this.dataSource.transaction(async (mgr) => {
      stop.status = DriverTripStopStatus.ARRIVED;
      stop.arrivedAt = new Date();
      await mgr.save(stop);

      // Sync alighting passengers: ARRIVING_AT_DROPOFF
      // Sync boarding passengers: ARRIVED_AT_PICKUP
      const passengerLinks = await mgr.find(DriverTripStopPassenger, {
        where: { stop: { id: stop.id } },
        relations: ['tripRequest'],
      });
      const boardingRequestIds: number[] = [];
      for (const link of passengerLinks) {
        const isBoarding = link.role === StopPassengerRole.BOARDING;
        const newStatus = isBoarding
          ? TripStatus.ARRIVED_AT_PICKUP
          : TripStatus.ARRIVING_AT_DROPOFF;
        await mgr.update(
          TripRequest,
          { id: link.tripRequest.id },
          { status: newStatus, statusUpdatedAt: new Date() },
        );
        if (isBoarding) boardingRequestIds.push(link.tripRequest.id);
      }

      return {
        state: await this.buildActiveState(trip),
        boardingRequestIds,
      };
    });

    // Notify boarding passengers that the driver has arrived at pickup
    const boardingUserIds = await this.passengerUserIdsForRequests(
      result.boardingRequestIds,
    );
    await this.emitPassengerNotifications({
      userIds: boardingUserIds,
      type: PassengerNotificationType.DRIVER_ARRIVED,
      titleEn: 'Driver has arrived',
      titleAr: 'السائق وصل',
      bodyEn: 'Your driver is waiting at the pickup point.',
      bodyAr: 'سائقك في انتظارك عند نقطة الإقلال.',
      payload: { tripId: trip.id, stopId: stop.id },
    });

    return result.state;
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
      where: {
        stop: { id: stop.id },
        role: StopPassengerRole.BOARDING,
        status: StopPassengerStatus.PENDING,
      },
      relations: ['tripRequest'],
    });
    const collecting = await this.stopPackagesRepo.find({
      where: {
        stop: { id: stop.id },
        role: StopPackageRole.COLLECTING,
        status: StopPackageStatus.PENDING,
      },
      relations: ['packageDelivery'],
    });

    const pickedSet = new Set(dto.passengersPickedUp ?? []);
    const noShowSet = new Set(dto.noShows ?? []);
    const collectedSet = new Set(dto.packagesCollected ?? []);
    const refusalByLink = new Map(
      (dto.packagesRefused ?? []).map((r) => [r.id, r]),
    );
    // §6.7 sender no-show and §6.4 refusal both leave the package
    // behind, but for different reasons with different consequences —
    // fold refusals into the not-found bucket only for the
    // completeness check.
    const notFoundSet = new Set([
      ...(dto.packagesNotFound ?? []),
      ...refusalByLink.keys(),
    ]);

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

    const result = await this.dataSource.transaction(async (mgr) => {
      const now = new Date();
      const pickedUpRequestIds: number[] = [];
      const noShowRequestIds: number[] = [];
      const collectedPackageIds: number[] = [];
      const notFoundPackageIds: number[] = [];

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
        if (isPicked) pickedUpRequestIds.push(link.tripRequest.id);
        else noShowRequestIds.push(link.tripRequest.id);
      }
      let packageCashAtStop = 0;
      for (const link of collecting) {
        const collected = collectedSet.has(link.id);
        const refusal = refusalByLink.get(link.id);
        if (collected) {
          link.status = StopPackageStatus.COLLECTED;
          // §6.1 — the sender pays at pickup.
          packageCashAtStop += Number(link.fee);
        } else if (refusal) {
          // §6.4 — logged with reason; sender not charged; never a
          // decline penalty.
          link.status = StopPackageStatus.REFUSED;
          link.refusalReason = refusal.reason;
          link.refusalPhotoUrl = (refusal.photoUrl ?? null) as string;
        } else {
          link.status = StopPackageStatus.NOT_FOUND;
        }
        link.confirmedAt = now;
        await mgr.save(link);
        await mgr.update(
          PackageDelivery,
          { id: link.packageDelivery.id },
          collected
            ? { status: PackageStatus.PICKED_UP }
            : {
                status: PackageStatus.CANCELLED,
                cancellationReason: refusal
                  ? `Refused at pickup by driver: ${refusal.reason}${refusal.notes ? ` — ${refusal.notes}` : ''}`
                  : 'Sender no-show at pickup',
              },
        );
        if (collected) collectedPackageIds.push(link.packageDelivery.id);
        else notFoundPackageIds.push(link.packageDelivery.id);
      }

      if (packageCashAtStop > 0) {
        await mgr.increment(
          DriverTrip,
          { id: trip.id },
          'totalCashCollected',
          packageCashAtStop,
        );
      }

      // Anyone/anything that never entered the vehicle can't be
      // dropped off — resolve their downstream links now so the
      // dropoff stops don't demand action on them.
      if (noShowRequestIds.length) {
        await mgr
          .createQueryBuilder()
          .update(DriverTripStopPassenger)
          .set({ status: StopPassengerStatus.NO_SHOW, confirmedAt: now })
          .where('"tripRequestId" IN (:...ids)', { ids: noShowRequestIds })
          .andWhere('role = :role', { role: StopPassengerRole.ALIGHTING })
          .andWhere('status = :pending', {
            pending: StopPassengerStatus.PENDING,
          })
          .andWhere(
            '"stopId" IN (SELECT id FROM driver_trip_stops WHERE "tripId" = :tripId)',
            { tripId: trip.id },
          )
          .execute();
      }
      if (notFoundPackageIds.length) {
        await mgr
          .createQueryBuilder()
          .update(DriverTripStopPackage)
          .set({ status: StopPackageStatus.NOT_FOUND, confirmedAt: now })
          .where('"packageDeliveryId" IN (:...ids)', {
            ids: notFoundPackageIds,
          })
          .andWhere('role = :role', { role: StopPackageRole.DELIVERING })
          .andWhere('status = :pending', {
            pending: StopPackageStatus.PENDING,
          })
          .andWhere(
            '"stopId" IN (SELECT id FROM driver_trip_stops WHERE "tripId" = :tripId)',
            { tripId: trip.id },
          )
          .execute();
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

      return {
        state: await this.buildActiveState(refreshedTrip ?? trip),
        pickedUpRequestIds,
        noShowRequestIds,
        collectedPackageIds,
        notFoundPackageIds,
      };
    });

    // Notify each picked-up passenger that their trip is now in progress
    const tripStartedUserIds = await this.passengerUserIdsForRequests(
      result.pickedUpRequestIds,
    );
    await this.emitPassengerNotifications({
      userIds: tripStartedUserIds,
      type: PassengerNotificationType.TRIP_STARTED,
      titleEn: 'Trip started',
      titleAr: 'بدأت رحلتك',
      bodyEn: "You're on your way to your destination.",
      bodyAr: 'أنت الآن في طريقك إلى وجهتك.',
      payload: { tripId: trip.id, stopId: stop.id },
    });
    // Cancellation notice for no-shows
    const noShowUserIds = await this.passengerUserIdsForRequests(
      result.noShowRequestIds,
    );
    await this.emitPassengerNotifications({
      userIds: noShowUserIds,
      type: PassengerNotificationType.TRIP_CANCELLED,
      titleEn: 'Trip cancelled — no-show',
      titleAr: 'تم إلغاء الرحلة — لم تتواجد',
      bodyEn: 'The driver marked you as a no-show and your trip was cancelled.',
      bodyAr: 'سجل السائق عدم تواجدك وتم إلغاء رحلتك.',
      payload: { tripId: trip.id, stopId: stop.id },
    });
    // Package senders: collected vs not-found
    const collectedSenderIds = await this.senderUserIdsForPackages(
      result.collectedPackageIds,
    );
    await this.emitPassengerNotifications({
      userIds: collectedSenderIds,
      type: PassengerNotificationType.PACKAGE_PICKED_UP,
      titleEn: 'Package picked up',
      titleAr: 'تم استلام الطرد',
      bodyEn: 'The driver has picked up your package.',
      bodyAr: 'استلم السائق طردك وبدأ رحلة التوصيل.',
      payload: { tripId: trip.id, stopId: stop.id },
    });
    const notFoundSenderIds = await this.senderUserIdsForPackages(
      result.notFoundPackageIds,
    );
    await this.emitPassengerNotifications({
      userIds: notFoundSenderIds,
      type: PassengerNotificationType.PACKAGE_CANCELLED,
      titleEn: 'Package not collected',
      titleAr: 'لم يتم استلام الطرد',
      bodyEn: 'The driver could not collect your package and the delivery was cancelled.',
      bodyAr: 'تعذر على السائق استلام طردك وتم إلغاء الإرسال.',
      payload: { tripId: trip.id, stopId: stop.id },
    });

    return result.state;
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
      where: {
        stop: { id: stop.id },
        role: StopPassengerRole.ALIGHTING,
        status: StopPassengerStatus.PENDING,
      },
      relations: ['tripRequest'],
    });
    const delivering = await this.stopPackagesRepo.find({
      where: {
        stop: { id: stop.id },
        role: StopPackageRole.DELIVERING,
        status: StopPackageStatus.PENDING,
      },
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

    const deliveredEntries = new Map(
      (dto.packagesDelivered ?? []).map((e) => [e.id, e]),
    );
    const deliveredSet = new Set(deliveredEntries.keys());
    const failures = dto.deliveryFailures ?? [];
    const failedIds = new Set(failures.map((f) => f.id));
    this.validateAllResolved(
      delivering.map((p) => p.id),
      deliveredSet,
      failedIds,
      'package',
    );

    const result = await this.dataSource.transaction(async (mgr) => {
      const now = new Date();
      let cashAddedAtStop = 0;
      let cashAddedTotal = 0;
      const droppedOffRequestIds: number[] = [];
      const deliveredPackageIds: number[] = [];
      const failedPackageIds: number[] = [];

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
        droppedOffRequestIds.push(link.tripRequest.id);
      }

      for (const link of delivering) {
        const delivered = deliveredSet.has(link.id);
        if (delivered) {
          const entry = deliveredEntries.get(link.id)!;
          // §6.5 — the recipient-held code must match. Wrong code =
          // wrong recipient; the driver must not hand the parcel over.
          const expected = link.packageDelivery.deliveryCode;
          if (expected && entry.deliveryCode !== expected) {
            throw new BadRequestException(
              `Wrong delivery code for package stop item #${link.id}`,
            );
          }
          link.status = StopPackageStatus.DELIVERED;
          // No cash here — the sender paid at pickup (§6.1).
          await mgr.update(
            PackageDelivery,
            { id: link.packageDelivery.id },
            {
              status: PackageStatus.DELIVERED,
              deliveredPhotoUrl: (entry.photoUrl ?? null) as string,
            },
          );
          deliveredPackageIds.push(link.packageDelivery.id);
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
          failedPackageIds.push(link.packageDelivery.id);
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
      return {
        state: await this.buildActiveState(refreshedTrip ?? trip),
        droppedOffRequestIds,
        deliveredPackageIds,
        failedPackageIds,
      };
    });

    // Notify passengers their trip is completed
    const droppedOffUserIds = await this.passengerUserIdsForRequests(
      result.droppedOffRequestIds,
    );
    await this.emitPassengerNotifications({
      userIds: droppedOffUserIds,
      type: PassengerNotificationType.TRIP_COMPLETED,
      titleEn: 'Trip completed',
      titleAr: 'اكتملت الرحلة',
      bodyEn: "You've arrived at your destination. Thanks for riding with Sarfees!",
      bodyAr: 'وصلت إلى وجهتك. شكرًا لاختيارك سرفيز!',
      payload: { tripId: trip.id, stopId: stop.id },
    });
    // Notify package senders: delivered vs failed
    const deliveredSenderIds = await this.senderUserIdsForPackages(
      result.deliveredPackageIds,
    );
    await this.emitPassengerNotifications({
      userIds: deliveredSenderIds,
      type: PassengerNotificationType.PACKAGE_DELIVERED,
      titleEn: 'Package delivered',
      titleAr: 'تم تسليم الطرد',
      bodyEn: 'Your package has been delivered to the recipient.',
      bodyAr: 'تم تسليم طردك إلى المستلم.',
      payload: { tripId: trip.id, stopId: stop.id },
    });
    const failedSenderIds = await this.senderUserIdsForPackages(
      result.failedPackageIds,
    );
    await this.emitPassengerNotifications({
      userIds: failedSenderIds,
      type: PassengerNotificationType.PACKAGE_CANCELLED,
      titleEn: 'Package delivery failed',
      titleAr: 'فشل تسليم الطرد',
      bodyEn: 'The driver was unable to deliver your package. Please contact support.',
      bodyAr: 'تعذر على السائق تسليم طردك. يُرجى التواصل مع الدعم.',
      payload: { tripId: trip.id, stopId: stop.id },
    });

    return result.state;
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

    const completion = await this.dataSource.transaction(async (mgr) => {
      const now = new Date();
      const totalCashCollected = Number(trip.totalCashCollected);
      const commissionRate = Number(trip.commissionRate);
      // Wallet model: commission is charged on the trip's TOTAL price
      // (what was booked), not on what the driver managed to collect.
      const commissionAmount =
        Math.round(Number(trip.totalCashExpected) * commissionRate * 100) /
        100;
      const netEarnings =
        Math.round((totalCashCollected - commissionAmount) * 100) / 100;

      trip.status = DriverTripStatus.COMPLETED;
      trip.completedAt = now;
      trip.commissionAmount = commissionAmount;
      trip.netEarnings = netEarnings;
      await mgr.save(trip);

      // Close the linked Stage-1 group too (master spec §11:
      // IN_PROGRESS → COMPLETED). Without this the group sat at
      // 'assigned' forever and cluttered the admin groups page.
      await mgr.query(
        `UPDATE trip_groups g SET status = 'completed', "completedAt" = $2
         WHERE g.id IN (
           SELECT DISTINCT "tripGroupId" FROM trip_offer_history
           WHERE "driverTripId" = $1 AND "tripGroupId" IS NOT NULL
         ) AND g.status NOT IN ('completed', 'cancelled')`,
        [trip.id, now],
      );

      // Driver returns to inactive (must re-activate for next session per spec)
      // and accumulates the platform's commission as outstanding balance.
      const driver = await mgr.findOne(Driver, { where: { id: driverId } });
      if (driver) {
        // Going-home auto-offline (master spec §9.6): if the driver was
        // in going-home mode and this trip's destination matches their
        // home city, they get locked offline until the configured day
        // boundary (default: local midnight).
        const goingHomeCompleted =
          driver.prefGoingHome &&
          driver.homeCity != null &&
          (driver.homeCity ?? '').toLowerCase() ===
            (trip.destinationCity ?? '').toLowerCase();
        if (goingHomeCompleted) {
          driver.goingHomeOfflineUntil = nextLocalMidnight();
        }

        driver.status = DriverStatus.INACTIVE;
        driver.totalTrips = (driver.totalTrips ?? 0) + 1;
        // Prepaid wallet model: the commission comes OUT of the wallet
        // (ledgered, row-locked) instead of piling onto the legacy
        // outstandingBalance debt. May push the wallet negative — the
        // matcher then withholds offers until the driver tops up.
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

      // Deduct the commission from the prepaid wallet — row-locked,
      // ledgered, inside this same transaction. Negative balances are
      // allowed here (the trip already ran); the matcher simply stops
      // offering until the driver tops up.
      let walletBalanceAfter = 0;
      if (commissionAmount > 0) {
        const walletResult = await this.walletsService.applyTransaction(mgr, {
          driverId,
          type: WalletTransactionType.COMMISSION,
          amount: -commissionAmount,
          driverTripId: trip.id,
          note: `Commission ${(commissionRate * 100).toFixed(1)}% of ${Number(trip.totalCashExpected).toFixed(2)} JD trip total`,
        });
        walletBalanceAfter = walletResult.newBalance;
      } else if (driver) {
        walletBalanceAfter = Number(driver.walletBalance);
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
        commissionDeducted: commissionAmount,
        netEarnings,
        walletBalance: walletBalanceAfter,
        outstandingBalance: driver ? Number(driver.outstandingBalance) : 0,
      };
    });

    // Post-commit: warn the driver if the deduction left the wallet
    // under the threshold (reads committed state; cooldown-deduped).
    const walletCfg = await this.walletConfig.getConfig();
    if (completion.walletBalance < Number(walletCfg.lowBalanceThresholdJod)) {
      const freshDriver = await this.driversRepo.findOne({
        where: { id: driverId },
      });
      if (freshDriver) {
        await this.walletsService.maybeNotifyLowBalance(freshDriver);
      }
    }

    return completion;
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

    const tripRequestIds = await this.collectLinkedTripRequestIds(trip.id);
    const packageIds = await this.collectLinkedPackageIds(trip.id);

    const txnResult = await this.dataSource.transaction(async (mgr) => {
      const now = new Date();
      trip.status = DriverTripStatus.CANCELLED;
      trip.cancelledAt = now;
      trip.cancellationReason = dto.notes
        ? `${dto.reason}: ${dto.notes}`
        : dto.reason;
      trip.cancellationZone = zone;
      await mgr.save(trip);

      // Sync linked passenger TripRequests to CANCELLED
      if (tripRequestIds.length) {
        await mgr
          .createQueryBuilder()
          .update(TripRequest)
          .set({ status: TripStatus.CANCELLED, statusUpdatedAt: now })
          .whereInIds(tripRequestIds)
          .execute();
      }
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

    // Notify affected passengers + package senders that the trip was cancelled
    const passengerUserIds =
      await this.passengerUserIdsForRequests(tripRequestIds);
    await this.emitPassengerNotifications({
      userIds: passengerUserIds,
      type: PassengerNotificationType.TRIP_CANCELLED,
      titleEn: 'Trip cancelled',
      titleAr: 'تم إلغاء الرحلة',
      bodyEn:
        'Your driver cancelled the trip. We will try to match you with another driver shortly.',
      bodyAr:
        'ألغى السائق رحلتك. سنحاول العثور على سائق آخر لك قريبًا.',
      payload: { tripId: trip.id, zone },
    });
    const senderUserIds = await this.senderUserIdsForPackages(packageIds);
    await this.emitPassengerNotifications({
      userIds: senderUserIds,
      type: PassengerNotificationType.PACKAGE_CANCELLED,
      titleEn: 'Package delivery cancelled',
      titleAr: 'تم إلغاء توصيل الطرد',
      bodyEn:
        'The driver cancelled the trip carrying your package. We will reassign it shortly.',
      bodyAr:
        'ألغى السائق الرحلة التي تحمل طردك. سنعيد تعيينه قريبًا.',
      payload: { tripId: trip.id, zone },
    });

    // Restart the cascade for the linked TripGroup so a new driver
    // gets offered the trip. Legacy trips (no offer_history row) are
    // a no-op.
    try {
      await this.assignmentService.handleDriverCancel(trip.id);
    } catch (err) {
      this.logger.warn(
        `AssignmentService.handleDriverCancel failed for trip #${trip.id}: ${err instanceof Error ? err.message : err}`,
      );
    }

    return txnResult;
  }

  /**
   * Ops-initiated full stop from the admin portal. Unlike a driver
   * cancel (which re-queues the group for another driver), an admin
   * cancel kills the trip outright: trip + linked requests + packages
   * + trip group all go CANCELLED, the driver is released back to
   * ACTIVE with **no penalty** (it wasn't their decision), and every
   * affected passenger/sender is notified.
   *
   * Same after-pickup guard as the driver flow — once someone is in
   * the car, ops resolves by phone, not by button.
   */
  async adminCancel(
    tripId: number,
    adminId: number,
    reason: string,
  ): Promise<{ tripId: number; cancelledRequestIds: number[] }> {
    const trip = await this.tripsRepo.findOne({
      where: { id: tripId },
      relations: ['driver'],
    });
    if (!trip) {
      throw new NotFoundException('Trip not found');
    }
    if (
      trip.status !== DriverTripStatus.ACCEPTED &&
      trip.status !== DriverTripStatus.IN_PROGRESS
    ) {
      throw new BadRequestException(
        `Only accepted or in-progress trips can be cancelled (this one is ${trip.status}).`,
      );
    }
    if (trip.status === DriverTripStatus.IN_PROGRESS) {
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
          'Passengers are already in the vehicle — resolve this trip with the driver directly instead of cancelling.',
        );
      }
    }

    const tripRequestIds = await this.collectLinkedTripRequestIds(trip.id);
    const packageIds = await this.collectLinkedPackageIds(trip.id);
    const driverId = trip.driver?.id ?? null;

    await this.dataSource.transaction(async (mgr) => {
      const now = new Date();
      trip.status = DriverTripStatus.CANCELLED;
      trip.cancelledAt = now;
      trip.cancellationReason = reason;
      trip.cancelledByAdminId = adminId;
      await mgr.save(trip);

      if (tripRequestIds.length) {
        await mgr
          .createQueryBuilder()
          .update(TripRequest)
          .set({
            status: TripStatus.CANCELLED,
            statusUpdatedAt: now,
            cancellationReason: reason,
            cancelledByAdminId: adminId,
          })
          .whereInIds(tripRequestIds)
          .execute();
      }
      if (packageIds.length) {
        await mgr
          .createQueryBuilder()
          .update(PackageDelivery)
          .set({ status: PackageStatus.CANCELLED })
          .whereInIds(packageIds)
          .execute();
      }

      // Kill the linked trip group too — admin cancel must NOT
      // restart the cascade (unlike a driver cancel).
      await mgr.query(
        `UPDATE trip_groups g SET status = 'cancelled'
         WHERE g.id IN (
           SELECT DISTINCT "tripGroupId" FROM trip_offer_history
           WHERE "driverTripId" = $1 AND "tripGroupId" IS NOT NULL
         ) AND g.status NOT IN ('completed', 'cancelled')`,
        [trip.id],
      );

      // Release the driver, no penalty — ops made this call.
      if (driverId) {
        await mgr.update(Driver, { id: driverId }, {
          status: DriverStatus.ACTIVE,
        });
      }
    });

    const passengerUserIds =
      await this.passengerUserIdsForRequests(tripRequestIds);
    await this.emitPassengerNotifications({
      userIds: passengerUserIds,
      type: PassengerNotificationType.TRIP_CANCELLED,
      titleEn: 'Trip cancelled by Sarfees',
      titleAr: 'قامت سرفيس بإلغاء الرحلة',
      bodyEn: 'Sarfees support cancelled your trip. Please book again or contact support.',
      bodyAr: 'ألغى فريق دعم سرفيس رحلتك. يرجى الحجز مرة أخرى أو التواصل مع الدعم.',
      payload: { tripId: trip.id, byAdmin: true },
    });
    const senderUserIds = await this.senderUserIdsForPackages(packageIds);
    await this.emitPassengerNotifications({
      userIds: senderUserIds,
      type: PassengerNotificationType.PACKAGE_CANCELLED,
      titleEn: 'Package delivery cancelled by Sarfees',
      titleAr: 'قامت سرفيس بإلغاء توصيل الطرد',
      bodyEn: 'Sarfees support cancelled the trip carrying your package. Please rebook or contact support.',
      bodyAr: 'ألغى فريق دعم سرفيس الرحلة التي تحمل طردك. يرجى إعادة الحجز أو التواصل مع الدعم.',
      payload: { tripId: trip.id, byAdmin: true },
    });

    this.logger.log(
      `Admin #${adminId} cancelled trip #${trip.id} (${tripRequestIds.length} requests, ${packageIds.length} packages): ${reason}`,
    );
    return { tripId: trip.id, cancelledRequestIds: tripRequestIds };
  }

  // ═════════════════════════════════════════════════════════════
  // Dev seeder — manufacture an OFFERED trip for testing
  // ═════════════════════════════════════════════════════════════

  async seedTrip(dto: SeedDriverTripDto): Promise<DriverTrip> {
    const driver = await this.driversRepo.findOne({
      where: { id: dto.driverId },
    });
    if (!driver) throw new NotFoundException('Driver not found');

    // Snapshot the platform commission % onto this trip. Editing the
    // wallet config later never rewrites already-created trips.
    const commissionFraction = await this.walletConfig.commissionFraction();

    if (
      dto.type === DriverTripType.WOMEN_ONLY &&
      driver.gender !== 'female' &&
      !dto.allowMaleForWomenOnly
    ) {
      throw new BadRequestException(
        'Cannot offer a women-only trip to a non-female driver',
      );
    }

    const tripRequestIds = dto.tripRequestIds ?? [];
    const tripRequests = tripRequestIds.length
      ? await this.tripRequestsRepo.find({
          where: { id: In(tripRequestIds) },
        })
      : [];
    if (tripRequests.length !== tripRequestIds.length) {
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
        commissionRate: dto.commissionRate ?? commissionFraction,
        offeredAt: now,
        offerExpiresAt: new Date(now.getTime() + offerSeconds * 1000),
      });
      const savedTrip = await mgr.save(trip);

      // Stop plan (master spec §6.3 ordering): package collection
      // first, then ONE pickup stop PER passenger at their own
      // requested location, then ONE dropoff stop PER passenger,
      // then package delivery last. Each passenger's cash is expected
      // at their own dropoff stop.
      let order = 0;

      if (packages.length) {
        const pkgPickup = await mgr.save(
          mgr.create(DriverTripStop, {
            trip: { id: savedTrip.id },
            order: order++,
            type: DriverTripStopType.PICKUP,
            city: dto.originCity,
            address: dto.pickupAddress,
            lat: dto.pickupLat,
            lng: dto.pickupLng,
            status: DriverTripStopStatus.PENDING,
            // §6.1 — the sender pays at pickup, so the package cash is
            // expected here, not at the delivery stop.
            cashExpected: totalPackageCash,
          }),
        );
        for (const pkg of packages) {
          await mgr.save(
            mgr.create(DriverTripStopPackage, {
              stop: { id: pkgPickup.id },
              packageDelivery: { id: pkg.id },
              role: StopPackageRole.COLLECTING,
              fee: Number(pkg.deliveryFee),
              status: StopPackageStatus.PENDING,
            }),
          );
        }
      }

      // Per-passenger pickups at each passenger's own point. Fall
      // back to the DTO's canonical pickup when a request predates
      // location capture (defensive; shouldn't happen in practice).
      for (const tr of tripRequests) {
        const stop = await mgr.save(
          mgr.create(DriverTripStop, {
            trip: { id: savedTrip.id },
            order: order++,
            type: DriverTripStopType.PICKUP,
            city: dto.originCity,
            address: dto.pickupAddress,
            lat: tr.departureLocation?.lat ?? dto.pickupLat,
            lng: tr.departureLocation?.lng ?? dto.pickupLng,
            status: DriverTripStopStatus.PENDING,
            cashExpected: 0,
          }),
        );
        await mgr.save(
          mgr.create(DriverTripStopPassenger, {
            stop: { id: stop.id },
            tripRequest: { id: tr.id },
            role: StopPassengerRole.BOARDING,
            fare: Number(tr.totalFare),
            status: StopPassengerStatus.PENDING,
          }),
        );
      }

      // Per-passenger dropoffs, same order — cash collected here.
      for (const tr of tripRequests) {
        const stop = await mgr.save(
          mgr.create(DriverTripStop, {
            trip: { id: savedTrip.id },
            order: order++,
            type: DriverTripStopType.DROPOFF,
            city: dto.destinationCity,
            address: dto.dropoffAddress,
            lat: tr.arrivalLocation?.lat ?? dto.dropoffLat,
            lng: tr.arrivalLocation?.lng ?? dto.dropoffLng,
            status: DriverTripStopStatus.PENDING,
            cashExpected: Number(tr.totalFare),
          }),
        );
        await mgr.save(
          mgr.create(DriverTripStopPassenger, {
            stop: { id: stop.id },
            tripRequest: { id: tr.id },
            role: StopPassengerRole.ALIGHTING,
            fare: Number(tr.totalFare),
            status: StopPassengerStatus.PENDING,
          }),
        );
      }

      if (packages.length) {
        const pkgDropoff = await mgr.save(
          mgr.create(DriverTripStop, {
            trip: { id: savedTrip.id },
            order: order++,
            type: DriverTripStopType.DROPOFF,
            city: dto.destinationCity,
            address: dto.dropoffAddress,
            lat: dto.dropoffLat,
            lng: dto.dropoffLng,
            status: DriverTripStopStatus.PENDING,
            // Cash already collected at pickup (§6.1).
            cashExpected: 0,
          }),
        );
        for (const pkg of packages) {
          await mgr.save(
            mgr.create(DriverTripStopPackage, {
              stop: { id: pkgDropoff.id },
              packageDelivery: { id: pkg.id },
              role: StopPackageRole.DELIVERING,
              fee: Number(pkg.deliveryFee),
              status: StopPackageStatus.PENDING,
            }),
          );
        }
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

  // ═════════════════════════════════════════════════════════════
  // Passenger notification helpers (best-effort, never throws)
  // ═════════════════════════════════════════════════════════════

  /**
   * Fan-out emit to the passenger inbox. Failures are swallowed so a
   * notification write error never aborts the parent lifecycle action.
   */
  private async emitPassengerNotifications(input: {
    userIds: number[];
    type: PassengerNotificationType;
    titleEn: string;
    titleAr: string;
    bodyEn: string;
    bodyAr: string;
    payload?: Record<string, unknown>;
  }): Promise<void> {
    for (const userId of input.userIds) {
      try {
        await this.passengerNotifications.emit({
          userId,
          type: input.type,
          titleEn: input.titleEn,
          titleAr: input.titleAr,
          bodyEn: input.bodyEn,
          bodyAr: input.bodyAr,
          payload: input.payload,
        });
      } catch (err) {
        // Best-effort: don't break the parent action if a notification fails
        console.warn(
          `[passenger-notif] emit failed for user ${userId}:`,
          err instanceof Error ? err.message : err,
        );
      }
    }
  }

  /** Resolve passenger user IDs for a set of TripRequest IDs. */
  private async passengerUserIdsForRequests(
    requestIds: number[],
  ): Promise<number[]> {
    if (!requestIds.length) return [];
    const rows = await this.tripRequestsRepo.find({
      where: { id: In(requestIds) },
      relations: ['passenger'],
    });
    return rows
      .map((r) => r.passenger?.id)
      .filter((id): id is number => typeof id === 'number');
  }

  /** Resolve sender user IDs for a set of PackageDelivery IDs. */
  private async senderUserIdsForPackages(
    packageIds: number[],
  ): Promise<number[]> {
    if (!packageIds.length) return [];
    const rows = await this.packagesRepo.find({
      where: { id: In(packageIds) },
      relations: ['sender'],
    });
    return rows
      .map((r) => r.sender?.id)
      .filter((id): id is number => typeof id === 'number');
  }

  /**
   * Run an aggregation query already scoped to a set of trip IDs and
   * return a `tripId → count` map. Used by the history endpoint to
   * batch passenger + package counts across the returned page (avoids
   * N+1 lookups on `/drivers/trips/history`).
   */
  private async countByTrip<T extends ObjectLiteral>(
    qb: SelectQueryBuilder<T>,
    tripIds: number[],
  ): Promise<Map<number, number>> {
    const result = new Map<number, number>();
    if (!tripIds.length) return result;
    const rows = await qb
      .select('stop.tripId', 'tripId')
      .addSelect('COUNT(*)', 'count')
      .groupBy('stop.tripId')
      .getRawMany<{ tripId: string | number; count: string }>();
    for (const row of rows) {
      result.set(Number(row.tripId), Number(row.count));
    }
    return result;
  }

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
