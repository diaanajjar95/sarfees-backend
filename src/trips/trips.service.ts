import { BadRequestException, Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';
import { TripRequest } from './entities/trip-request.entity';
import { Driver } from '../drivers/driver.entity';
import { DriverLocation } from './entities/driver-location.entity';
import { GroupingService } from '../grouping/grouping.service';
import { AssignmentService } from '../assignment/assignment.service';
import { MatchingConfigService } from '../matching-config/matching-config.service';
import { PackageDelivery } from '../packages/entities/package-delivery.entity';
import { PackageStatus } from '../shared/enums/package-status.enum';
import { TripStatus } from '../shared/enums/trip-status.enum';
import { ActiveTripType } from '../shared/enums/active-trip-type.enum';
import { EstimateTripDto, CreateTripDto } from './dto/create-trip.dto';
import {
  UpdateTripStatusDto,
  UpdateDriverLocationDto,
  ActiveTripStatusResponseDto,
  ActiveItemResponseDto,
  ActivePackageSummaryDto,
  DriverInfoDto,
  DriverLocationDto,
} from './dto/active-trip.dto';
import { I18nContext } from 'nestjs-i18n';
import { PaginationQueryDto, PaginatedResponse } from '../shared/dto/pagination-query.dto';

/**
 * Statuses where a driver has been assigned and is moving — used to gate
 * driver location pings. PENDING is excluded because there's no driver yet.
 */
const ACTIVE_STATUSES = [
  TripStatus.MATCHED,
  TripStatus.DRIVER_EN_ROUTE,
  TripStatus.ARRIVED_AT_PICKUP,
  TripStatus.TRIP_IN_PROGRESS,
  TripStatus.ARRIVING_AT_DROPOFF,
];

/**
 * Statuses the passenger should see on /trips/active. Includes PENDING so the
 * mobile app can show a "matching you with a driver" state immediately after
 * the request is created — matcher / manual ops assignment runs asynchronously.
 */
const PASSENGER_ACTIVE_STATUSES = [TripStatus.PENDING, ...ACTIVE_STATUSES];

/**
 * Sender-facing "active" package statuses — anything not delivered or cancelled.
 * Mirrors PASSENGER_ACTIVE_STATUSES so the mobile home screen sees an active
 * package the moment the request is created.
 */
const SENDER_ACTIVE_PACKAGE_STATUSES = [
  PackageStatus.PENDING,
  PackageStatus.MATCHED,
  PackageStatus.PICKED_UP,
  PackageStatus.IN_TRANSIT,
];

/** Valid status transition map — prevents invalid jumps */
const VALID_TRANSITIONS: Record<TripStatus, TripStatus[]> = {
  [TripStatus.PENDING]: [TripStatus.MATCHED, TripStatus.CANCELLED],
  [TripStatus.MATCHED]: [TripStatus.DRIVER_EN_ROUTE, TripStatus.CANCELLED],
  [TripStatus.DRIVER_EN_ROUTE]: [TripStatus.ARRIVED_AT_PICKUP, TripStatus.CANCELLED],
  [TripStatus.ARRIVED_AT_PICKUP]: [TripStatus.TRIP_IN_PROGRESS, TripStatus.CANCELLED],
  [TripStatus.TRIP_IN_PROGRESS]: [TripStatus.ARRIVING_AT_DROPOFF, TripStatus.CANCELLED],
  [TripStatus.ARRIVING_AT_DROPOFF]: [TripStatus.COMPLETED, TripStatus.CANCELLED],
  [TripStatus.COMPLETED]: [],
  [TripStatus.CANCELLED]: [],
};

@Injectable()
export class TripsService {
  constructor(
    @InjectRepository(TripRequest)
    private tripsRepository: Repository<TripRequest>,

    @InjectRepository(Driver)
    private driversRepository: Repository<Driver>,

    @InjectRepository(DriverLocation)
    private driverLocationRepository: Repository<DriverLocation>,

    @InjectRepository(PackageDelivery)
    private packagesRepository: Repository<PackageDelivery>,

    private readonly groupingService: GroupingService,
    private readonly assignmentService: AssignmentService,
    private readonly matchingConfigService: MatchingConfigService,
  ) {}

  // ─── Existing endpoints ────────────────────────────────────

  estimateFare(dto: EstimateTripDto) {
    if (dto.departureCityId === dto.arrivalCityId) {
      throw new BadRequestException(I18nContext.current()?.t('trips.Same city'));
    }

    if (!dto.isImmediate && dto.travelDate) {
      const travelDate = new Date(dto.travelDate);
      const now = new Date();
      if (travelDate < now) {
        throw new BadRequestException(I18nContext.current()?.t('trips.Past date'));
      }
      // Scheduled trips must leave the matcher its full T-30 runway:
      // the driver search fires at departure - 30 min, so anything
      // closer would freeze instantly with no grouping window.
      // Passengers who want to leave sooner should book a "now" trip
      // (isImmediate), where the server picks the departure itself.
      const minLead = new Date(now.getTime() + 30 * 60 * 1000);
      if (travelDate < minLead) {
        throw new BadRequestException(
          I18nContext.current()?.t('trips.Min 30 min ahead'),
        );
      }
      // The app's time picker only offers quarter-hour steps; enforce
      // it server-side too so all group departure times land on the
      // same grid (:00 / :15 / :30 / :45).
      if (
        travelDate.getUTCMinutes() % 15 !== 0 ||
        travelDate.getUTCSeconds() !== 0
      ) {
        throw new BadRequestException(
          I18nContext.current()?.t('trips.Quarter hour'),
        );
      }
      const thirtyDaysAhead = new Date();
      thirtyDaysAhead.setDate(thirtyDaysAhead.getDate() + 30);
      if (travelDate > thirtyDaysAhead) {
        throw new BadRequestException(I18nContext.current()?.t('trips.Max 30 days'));
      }
    }

    const perSeatFare = 5.0; // Flat rate per passenger seat (business decision, Jul 2026)
    const totalFare = perSeatFare * dto.seatsCount;
    return {
      perSeatFare,
      totalFare,
      duration: '1h 30m',
      cancellationPolicy: 'Free cancellation up to 1 hour before departure.',
    };
  }

  async createRequest(userId: number, userGender: string, dto: CreateTripDto) {
    const estimates = this.estimateFare(dto); // Inherits date validation

    if (dto.isFemaleOnly && userGender !== 'Female') {
      throw new ForbiddenException(I18nContext.current()?.t('trips.Female only'));
    }

    // One live request per passenger: block a new booking while any
    // earlier one is still pending or mid-trip. They must cancel (or
    // finish) the existing request first.
    const existing = await this.tripsRepository.findOne({
      where: {
        passenger: { id: userId },
        status: Not(In([TripStatus.COMPLETED, TripStatus.CANCELLED])),
      },
    });
    if (existing) {
      throw new BadRequestException(
        I18nContext.current()?.t('trips.Active request exists'),
      );
    }

    // Master spec §8 — "now" means "within the next 15-30 min", not
    // "leaving this exact instant". The passenger is told the actual
    // departure at request time; we pick the midpoint of the config
    // window so the group has a real T-30 for cascade to fire against.
    const cfg = await this.matchingConfigService.getConfig();
    const nowWindowMidMin =
      (cfg.nowWindowMinMinutes + cfg.nowWindowMaxMinutes) / 2;
    const travelDate = dto.isImmediate
      ? new Date(Date.now() + nowWindowMidMin * 60 * 1000)
      : new Date(dto.travelDate as string);

    const trip = this.tripsRepository.create({
      passenger: { id: userId },
      departureCity: { id: dto.departureCityId },
      arrivalCity: { id: dto.arrivalCityId },
      departureLocation: dto.departureLocation,
      arrivalLocation: dto.arrivalLocation,
      travelDate,
      isImmediate: dto.isImmediate || false,
      seatsCount: dto.seatsCount,
      isFemaleOnly: dto.isFemaleOnly || false,
      bookWholeCar: dto.bookWholeCar || false,
      perSeatFare: estimates.perSeatFare,
      totalFare: estimates.totalFare,
      status: TripStatus.PENDING,
    });

    const saved = await this.tripsRepository.save(trip);

    // Stage-1 grouping. Failure MUST NOT roll back the passenger's
    // request — it stays PENDING and the next sweeper tick will
    // retry via re-grouping (planned for PR 4).
    try {
      await this.groupingService.attemptGroupingForTripRequest(saved.id);
    } catch (err) {
      // Logged inside GroupingService.
      void err;
    }

    return saved;
  }

  async getUserTrips(userId: number, query: PaginationQueryDto): Promise<PaginatedResponse<TripRequest>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const [rows, totalItems] = await this.tripsRepository.findAndCount({
      where: { passenger: { id: userId } },
      relations: ['departureCity', 'arrivalCity'],
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    // Localize the city objects to { id, name } based on the Accept-Language
    // header (mirrors /cities). Falls back to English when no locale is set.
    const lang = I18nContext.current()?.lang || 'en';
    const localizeCity = (c: { id: number; nameEn: string; nameAr: string } | null | undefined) =>
      c ? { id: c.id, name: lang === 'ar' ? c.nameAr : c.nameEn } : null;

    const data = rows.map((t) => ({
      ...t,
      departureCity: localizeCity(t.departureCity),
      arrivalCity: localizeCity(t.arrivalCity),
    })) as unknown as TripRequest[];

    const totalPages = Math.ceil(totalItems / limit);

    return {
      data,
      meta: {
        page,
        limit,
        totalItems,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  // ─── Active Trip Status (SAR-30) ──────────────────────────

  /**
   * Mobile home-screen card: returns whichever is more recent — the user's
   * latest active trip or their latest active package — wrapped in a
   * `{ type, trip, package }` discriminator so the client can branch.
   *
   * Returns 404 if the user has neither.
   */
  async getActiveItem(userId: number): Promise<ActiveItemResponseDto> {
    const [trip, pkg] = await Promise.all([
      this.tripsRepository.findOne({
        where: {
          passenger: { id: userId },
          status: In(PASSENGER_ACTIVE_STATUSES),
        },
        relations: ['driver', 'departureCity', 'arrivalCity'],
        order: { createdAt: 'DESC' },
      }),
      this.packagesRepository.findOne({
        where: {
          sender: { id: userId },
          status: In(SENDER_ACTIVE_PACKAGE_STATUSES),
        },
        relations: ['departureCity', 'arrivalCity'],
        order: { createdAt: 'DESC' },
      }),
    ]);

    // Pick whichever was created last; tie-break to trip so the mobile app's
    // "most useful" view (a real ride) wins over a queued package.
    const tripWins =
      trip &&
      (!pkg || trip.createdAt.getTime() >= pkg.createdAt.getTime());
    const packageWins =
      pkg && (!trip || pkg.createdAt.getTime() > trip.createdAt.getTime());

    if (tripWins) {
      return {
        type: 'trip',
        tripType: trip.isFemaleOnly
          ? ActiveTripType.WOMEN_ONLY
          : ActiveTripType.SHARED,
        trip: await this.buildActiveTripResponse(trip),
        package: null,
      };
    }
    if (packageWins) {
      return {
        type: 'package',
        tripType: ActiveTripType.SEND_PACKAGE,
        trip: null,
        package: this.toActivePackageSummary(pkg),
      };
    }

    throw new NotFoundException(
      I18nContext.current()?.t('trips.No active trip'),
    );
  }

  private toActivePackageSummary(p: PackageDelivery): ActivePackageSummaryDto {
    return {
      id: p.id,
      status: p.status,
      departureCity: p.departureCity?.nameEn ?? null,
      arrivalCity: p.arrivalCity?.nameEn ?? null,
      pickupLocation: p.pickupLocation,
      dropOffLocation: p.dropOffLocation,
      packageSize: p.packageSize,
      packageDescription: p.packageDescription ?? null,
      packagePhotoUrl: p.packagePhotoUrl ?? null,
      receiverName: p.receiverName,
      receiverPhone: p.receiverPhone,
      deliveryFee: Number(p.deliveryFee),
      isImmediate: p.isImmediate,
      pickupDate: p.pickupDate ?? null,
      createdAt: p.createdAt,
    };
  }

  private async buildActiveTripResponse(
    trip: TripRequest,
  ): Promise<ActiveTripStatusResponseDto> {
    let driverLocation: DriverLocationDto | null = null;
    if (trip.driver) {
      const latestLocation = await this.driverLocationRepository.findOne({
        where: { trip: { id: trip.id }, driver: { id: trip.driver.id } },
        order: { recordedAt: 'DESC' },
      });
      if (latestLocation) {
        driverLocation = {
          lat: Number(latestLocation.lat),
          lng: Number(latestLocation.lng),
          heading: latestLocation.heading ? Number(latestLocation.heading) : null,
          speed: latestLocation.speed ? Number(latestLocation.speed) : null,
          recordedAt: latestLocation.recordedAt,
        };
      }
    }
    return {
      tripId: trip.id,
      status: trip.status,
      etaToPickup: trip.etaToPickup || null,
      etaToDestination: trip.etaToDestination || null,
      departureLocation: trip.departureLocation,
      arrivalLocation: trip.arrivalLocation,
      driver: trip.driver ? this.mapDriverInfo(trip.driver) : null,
      driverLocation,
      statusUpdatedAt: trip.statusUpdatedAt || null,
      createdAt: trip.createdAt,
    };
  }

  /**
   * Get the passenger's currently active trip with driver info and location.
   * A passenger can only have one active trip at a time.
   */
  async getActiveTrip(userId: number): Promise<ActiveTripStatusResponseDto> {
    const trip = await this.tripsRepository.findOne({
      where: {
        passenger: { id: userId },
        status: In(PASSENGER_ACTIVE_STATUSES),
      },
      relations: ['driver', 'departureCity', 'arrivalCity'],
      order: { createdAt: 'DESC' },
    });

    if (!trip) {
      throw new NotFoundException(I18nContext.current()?.t('trips.No active trip'));
    }

    // Fetch latest driver location if driver is assigned
    let driverLocation: DriverLocationDto | null = null;
    if (trip.driver) {
      const latestLocation = await this.driverLocationRepository.findOne({
        where: { trip: { id: trip.id }, driver: { id: trip.driver.id } },
        order: { recordedAt: 'DESC' },
      });

      if (latestLocation) {
        driverLocation = {
          lat: Number(latestLocation.lat),
          lng: Number(latestLocation.lng),
          heading: latestLocation.heading ? Number(latestLocation.heading) : null,
          speed: latestLocation.speed ? Number(latestLocation.speed) : null,
          recordedAt: latestLocation.recordedAt,
        };
      }
    }

    return {
      tripId: trip.id,
      status: trip.status,
      etaToPickup: trip.etaToPickup || null,
      etaToDestination: trip.etaToDestination || null,
      departureLocation: trip.departureLocation,
      arrivalLocation: trip.arrivalLocation,
      driver: trip.driver ? this.mapDriverInfo(trip.driver) : null,
      driverLocation,
      statusUpdatedAt: trip.statusUpdatedAt || null,
      createdAt: trip.createdAt,
    };
  }

  /**
   * Get a specific trip's status by ID (passenger must own the trip).
   */
  async getTripStatus(tripId: number, userId: number): Promise<ActiveTripStatusResponseDto> {
    const trip = await this.tripsRepository.findOne({
      where: { id: tripId, passenger: { id: userId } },
      relations: ['driver', 'departureCity', 'arrivalCity'],
    });

    if (!trip) {
      throw new NotFoundException(I18nContext.current()?.t('trips.Trip not found'));
    }

    let driverLocation: DriverLocationDto | null = null;
    if (trip.driver) {
      const latestLocation = await this.driverLocationRepository.findOne({
        where: { trip: { id: trip.id }, driver: { id: trip.driver.id } },
        order: { recordedAt: 'DESC' },
      });

      if (latestLocation) {
        driverLocation = {
          lat: Number(latestLocation.lat),
          lng: Number(latestLocation.lng),
          heading: latestLocation.heading ? Number(latestLocation.heading) : null,
          speed: latestLocation.speed ? Number(latestLocation.speed) : null,
          recordedAt: latestLocation.recordedAt,
        };
      }
    }

    return {
      tripId: trip.id,
      status: trip.status,
      etaToPickup: trip.etaToPickup || null,
      etaToDestination: trip.etaToDestination || null,
      departureLocation: trip.departureLocation,
      arrivalLocation: trip.arrivalLocation,
      driver: trip.driver ? this.mapDriverInfo(trip.driver) : null,
      driverLocation,
      statusUpdatedAt: trip.statusUpdatedAt || null,
      createdAt: trip.createdAt,
    };
  }

  /**
   * Update trip status (driver-side action). Validates transition rules.
   */
  async updateTripStatus(tripId: number, dto: UpdateTripStatusDto): Promise<{ message: string; status: TripStatus }> {
    const trip = await this.tripsRepository.findOne({
      where: { id: tripId },
    });

    if (!trip) {
      throw new NotFoundException(I18nContext.current()?.t('trips.Trip not found'));
    }

    const allowedNext = VALID_TRANSITIONS[trip.status];
    if (!allowedNext || !allowedNext.includes(dto.status)) {
      throw new BadRequestException(
        I18nContext.current()?.t('trips.Invalid transition') ||
        `Cannot transition from ${trip.status} to ${dto.status}`,
      );
    }

    trip.status = dto.status;
    trip.statusUpdatedAt = new Date();

    if (dto.etaToPickup !== undefined) {
      trip.etaToPickup = dto.etaToPickup;
    }
    if (dto.etaToDestination !== undefined) {
      trip.etaToDestination = dto.etaToDestination;
    }

    await this.tripsRepository.save(trip);

    // Feed the Stage-1 matcher when a passenger cancels so their
    // group can update (§10). Failure MUST NOT flip the status back
    // — the request is already CANCELLED at the DB.
    if (dto.status === TripStatus.CANCELLED) {
      try {
        await this.assignmentService.handlePassengerCancel(tripId);
      } catch (err) {
        void err;
      }
    }

    return {
      message: I18nContext.current()?.t('trips.Status updated') || 'Trip status updated',
      status: trip.status,
    };
  }

  /**
   * Record the driver's current location for a trip.
   * Called every 5-10 seconds by the driver's app.
   */
  async updateDriverLocation(tripId: number, driverId: number, dto: UpdateDriverLocationDto): Promise<DriverLocationDto> {
    const trip = await this.tripsRepository.findOne({
      where: { id: tripId, driver: { id: driverId } },
    });

    if (!trip) {
      throw new NotFoundException(I18nContext.current()?.t('trips.Trip not found'));
    }

    // Only allow location updates for active trips
    if (!ACTIVE_STATUSES.includes(trip.status)) {
      throw new BadRequestException(
        I18nContext.current()?.t('trips.Trip not active') ||
        'Location updates are only allowed for active trips',
      );
    }

    const location = this.driverLocationRepository.create({
      driver: { id: driverId },
      trip: { id: tripId },
      lat: dto.lat,
      lng: dto.lng,
      heading: dto.heading,
      speed: dto.speed,
    });

    const saved = await this.driverLocationRepository.save(location);

    return {
      lat: Number(saved.lat),
      lng: Number(saved.lng),
      heading: saved.heading ? Number(saved.heading) : null,
      speed: saved.speed ? Number(saved.speed) : null,
      recordedAt: saved.recordedAt,
    };
  }

  /**
   * Get the latest driver location for a specific trip.
   * Used by the passenger's app for polling every 5-10s.
   */
  async getDriverLocation(tripId: number, userId: number): Promise<DriverLocationDto> {
    const trip = await this.tripsRepository.findOne({
      where: { id: tripId, passenger: { id: userId } },
      relations: ['driver'],
    });

    if (!trip) {
      throw new NotFoundException(I18nContext.current()?.t('trips.Trip not found'));
    }

    if (!trip.driver) {
      throw new NotFoundException(
        I18nContext.current()?.t('trips.No driver assigned') ||
        'No driver has been assigned to this trip yet',
      );
    }

    const latestLocation = await this.driverLocationRepository.findOne({
      where: { trip: { id: tripId }, driver: { id: trip.driver.id } },
      order: { recordedAt: 'DESC' },
    });

    if (!latestLocation) {
      throw new NotFoundException(
        I18nContext.current()?.t('trips.No driver location') ||
        'Driver location is not available yet',
      );
    }

    return {
      lat: Number(latestLocation.lat),
      lng: Number(latestLocation.lng),
      heading: latestLocation.heading ? Number(latestLocation.heading) : null,
      speed: latestLocation.speed ? Number(latestLocation.speed) : null,
      recordedAt: latestLocation.recordedAt,
    };
  }

  // ─── Helpers ───────────────────────────────────────────────

  private mapDriverInfo(driver: Driver): DriverInfoDto {
    const [firstName, ...rest] = (driver.name ?? '').trim().split(/\s+/);
    const lastName = rest.join(' ');
    return {
      id: driver.id,
      firstName: firstName || '',
      lastName: lastName || '',
      profilePhotoUrl: driver.profilePhotoUrl || null,
      phoneNumber: `${driver.countryCode ?? ''}${driver.phoneNumber}`,
      vehicleMake: driver.vehicleMake,
      vehicleModel: driver.vehicleModel,
      vehicleColor: driver.vehicleColor,
      vehicleYear: driver.vehicleYear,
      plateNumber: driver.plateNumber,
      rating: Number(driver.rating),
      totalTrips: driver.totalTrips,
    };
  }
}
