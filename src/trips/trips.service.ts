import { BadRequestException, Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { TripRequest } from './entities/trip-request.entity';
import { Driver } from '../drivers/driver.entity';
import { DriverLocation } from './entities/driver-location.entity';
import { MatchingService } from '../matching/matching.service';
import { TripStatus } from '../shared/enums/trip-status.enum';
import { EstimateTripDto, CreateTripDto } from './dto/create-trip.dto';
import {
  UpdateTripStatusDto,
  UpdateDriverLocationDto,
  ActiveTripStatusResponseDto,
  DriverInfoDto,
  DriverLocationDto,
} from './dto/active-trip.dto';
import { I18nContext } from 'nestjs-i18n';
import { PaginationQueryDto, PaginatedResponse } from '../shared/dto/pagination-query.dto';

/** Statuses that count as "active" — trip is in progress or driver is on the way */
const ACTIVE_STATUSES = [
  TripStatus.MATCHED,
  TripStatus.DRIVER_EN_ROUTE,
  TripStatus.ARRIVED_AT_PICKUP,
  TripStatus.TRIP_IN_PROGRESS,
  TripStatus.ARRIVING_AT_DROPOFF,
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

    private readonly matchingService: MatchingService,
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
      const thirtyDaysAhead = new Date();
      thirtyDaysAhead.setDate(thirtyDaysAhead.getDate() + 30);
      if (travelDate > thirtyDaysAhead) {
        throw new BadRequestException(I18nContext.current()?.t('trips.Max 30 days'));
      }
    }

    const perSeatFare = 10.00; // Mocked flat rate
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

    const trip = this.tripsRepository.create({
      passenger: { id: userId },
      departureCity: { id: dto.departureCityId },
      arrivalCity: { id: dto.arrivalCityId },
      departureLocation: dto.departureLocation,
      arrivalLocation: dto.arrivalLocation,
      travelDate: dto.isImmediate ? new Date() : new Date(dto.travelDate as string),
      isImmediate: dto.isImmediate || false,
      seatsCount: dto.seatsCount,
      isFemaleOnly: dto.isFemaleOnly || false,
      perSeatFare: estimates.perSeatFare,
      totalFare: estimates.totalFare,
      status: TripStatus.PENDING,
    });

    const saved = await this.tripsRepository.save(trip);

    // Auto-match: try to find an active driver and offer the trip immediately.
    // Failure here MUST NOT roll back the passenger's request — we keep it as
    // PENDING so ops can assign manually from /admin/passenger-requests.
    try {
      const reloaded = await this.tripsRepository.findOne({
        where: { id: saved.id },
        relations: ['departureCity', 'arrivalCity'],
      });
      if (reloaded) {
        await this.matchingService.attemptMatch(reloaded);
      }
    } catch (err) {
      // Logged inside MatchingService; swallow here to keep createRequest's
      // public contract unchanged.
      void err;
    }

    return saved;
  }

  async getUserTrips(userId: number, query: PaginationQueryDto): Promise<PaginatedResponse<TripRequest>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const [data, totalItems] = await this.tripsRepository.findAndCount({
      where: { passenger: { id: userId } },
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

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
   * Get the passenger's currently active trip with driver info and location.
   * A passenger can only have one active trip at a time.
   */
  async getActiveTrip(userId: number): Promise<ActiveTripStatusResponseDto> {
    const trip = await this.tripsRepository.findOne({
      where: {
        passenger: { id: userId },
        status: In(ACTIVE_STATUSES),
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
