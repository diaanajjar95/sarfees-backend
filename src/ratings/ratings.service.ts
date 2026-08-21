import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { I18nContext } from 'nestjs-i18n';
import { Driver } from '../drivers/driver.entity';
import { User } from '../users/user.entity';
import { DriverTrip } from '../driver-trips/entities/driver-trip.entity';
import { TripRequest } from '../trips/entities/trip-request.entity';
import { PackageDelivery } from '../packages/entities/package-delivery.entity';
import { DriverTripStatus } from '../shared/enums/driver-trip-status.enum';
import { TripStatus } from '../shared/enums/trip-status.enum';
import { PackageStatus } from '../shared/enums/package-status.enum';
import {
  RATING_VALUE,
  RaterType,
  RatingLevel,
} from '../shared/enums/rating.enum';
import { Rating } from './entities/rating.entity';

const round2 = (n: number) => Math.round(n * 100) / 100;

@Injectable()
export class RatingsService {
  constructor(
    @InjectRepository(Rating)
    private readonly ratingsRepo: Repository<Rating>,
    @InjectRepository(TripRequest)
    private readonly requestsRepo: Repository<TripRequest>,
    @InjectRepository(DriverTrip)
    private readonly tripsRepo: Repository<DriverTrip>,
    @InjectRepository(PackageDelivery)
    private readonly packagesRepo: Repository<PackageDelivery>,
    private readonly dataSource: DataSource,
  ) {}

  private t(key: string): string {
    return I18nContext.current()?.t(key) ?? key.split('.').pop() ?? key;
  }

  private requireMessageIfBad(level: RatingLevel, message?: string): void {
    if (level === RatingLevel.BAD && !message?.trim()) {
      throw new BadRequestException(this.t('trips.Bad rating needs message'));
    }
  }

  // ─── Passenger rates the driver ───────────────────────────────

  async ratePassengerSide(
    userId: number,
    tripRequestId: number,
    level: RatingLevel,
    message?: string,
  ) {
    this.requireMessageIfBad(level, message);

    const request = await this.requestsRepo.findOne({
      where: { id: tripRequestId },
      relations: ['passenger', 'tripGroup', 'tripGroup.assignedDriver'],
    });
    if (!request) throw new NotFoundException(this.t('trips.Not found'));
    if (request.passenger?.id !== userId) {
      throw new ForbiddenException(this.t('trips.Not yours'));
    }
    if (request.status !== TripStatus.COMPLETED) {
      throw new BadRequestException(this.t('trips.Rate after completion'));
    }
    const driver = request.tripGroup?.assignedDriver;
    const driverTripId = request.tripGroup?.driverTripId;
    if (!driver || !driverTripId) {
      throw new BadRequestException(this.t('trips.Rate after completion'));
    }

    return this.saveRating({
      tripRequestId,
      driverTripId,
      raterType: RaterType.PASSENGER,
      driverId: driver.id,
      passengerId: userId,
      level,
      message,
    });
  }

  // ─── Package sender rates the driver ──────────────────────────

  async ratePackageSenderSide(
    userId: number,
    packageDeliveryId: number,
    level: RatingLevel,
    message?: string,
  ) {
    this.requireMessageIfBad(level, message);

    const pkg = await this.packagesRepo.findOne({
      where: { id: packageDeliveryId },
      relations: ['sender', 'tripGroup', 'tripGroup.assignedDriver'],
    });
    if (!pkg) throw new NotFoundException(this.t('trips.Not found'));
    if (pkg.sender?.id !== userId) {
      throw new ForbiddenException(this.t('trips.Not yours'));
    }
    if (pkg.status !== PackageStatus.DELIVERED) {
      throw new BadRequestException(this.t('trips.Rate after completion'));
    }
    const driver = pkg.tripGroup?.assignedDriver;
    const driverTripId = pkg.tripGroup?.driverTripId;
    if (!driver || !driverTripId) {
      throw new BadRequestException(this.t('trips.Rate after completion'));
    }

    return this.saveRating({
      packageDeliveryId,
      driverTripId,
      raterType: RaterType.PASSENGER,
      driverId: driver.id,
      passengerId: userId,
      level,
      message,
    });
  }

  /** The sender's own rating for a package delivery (or null). */
  async getSenderPackageRating(userId: number, packageDeliveryId: number) {
    const rating = await this.ratingsRepo.findOne({
      where: {
        packageDelivery: { id: packageDeliveryId },
        raterType: RaterType.PASSENGER,
        passenger: { id: userId },
      },
    });
    return rating
      ? {
          level: rating.level,
          value: rating.value,
          comment: rating.message,
          createdAt: rating.createdAt,
        }
      : null;
  }

  // ─── Driver rates a passenger ─────────────────────────────────

  async rateDriverSide(
    driverId: number,
    tripId: number,
    passengerUserId: number,
    level: RatingLevel,
    message?: string,
  ) {
    this.requireMessageIfBad(level, message);

    const trip = await this.tripsRepo.findOne({
      where: { id: tripId, driver: { id: driverId } },
    });
    if (!trip) throw new NotFoundException(this.t('trips.Not found'));
    if (trip.status !== DriverTripStatus.COMPLETED) {
      throw new BadRequestException(this.t('trips.Rate after completion'));
    }

    const request = await this.findServedRequest(tripId, passengerUserId);
    if (!request) {
      throw new NotFoundException(this.t('trips.Passenger not on trip'));
    }

    return this.saveRating({
      tripRequestId: request.id,
      driverTripId: tripId,
      raterType: RaterType.DRIVER,
      driverId,
      passengerId: passengerUserId,
      level,
      message,
    });
  }

  // ─── Driver rates a package sender ────────────────────────────

  async rateDriverSideForPackage(
    driverId: number,
    tripId: number,
    packageDeliveryId: number,
    level: RatingLevel,
    message?: string,
  ) {
    this.requireMessageIfBad(level, message);

    const trip = await this.tripsRepo.findOne({
      where: { id: tripId, driver: { id: driverId } },
    });
    if (!trip) throw new NotFoundException(this.t('trips.Not found'));
    if (trip.status !== DriverTripStatus.COMPLETED) {
      throw new BadRequestException(this.t('trips.Rate after completion'));
    }

    const pkg = await this.packagesRepo.findOne({
      where: { id: packageDeliveryId },
      relations: ['sender', 'tripGroup'],
    });
    if (
      !pkg ||
      pkg.tripGroup?.driverTripId !== tripId ||
      pkg.status !== PackageStatus.DELIVERED ||
      typeof pkg.sender?.id !== 'number'
    ) {
      throw new NotFoundException(this.t('trips.Passenger not on trip'));
    }

    return this.saveRating({
      packageDeliveryId,
      driverTripId: tripId,
      raterType: RaterType.DRIVER,
      driverId,
      passengerId: pkg.sender.id,
      level,
      message,
    });
  }

  /** Passengers on a completed trip the driver may still rate. */
  async listRatables(driverId: number, tripId: number) {
    const trip = await this.tripsRepo.findOne({
      where: { id: tripId, driver: { id: driverId } },
    });
    if (!trip) throw new NotFoundException(this.t('trips.Not found'));

    const requests = await this.servedRequests(tripId);
    const existing = await this.ratingsRepo.find({
      where: { driverTrip: { id: tripId }, raterType: RaterType.DRIVER },
    });
    const ratedPassengers = new Set(
      existing.filter((r) => r.tripRequestId != null).map((r) => r.passengerId),
    );
    const ratedPackages = new Set(
      existing
        .map((r) => r.packageDeliveryId)
        .filter((id): id is number => id != null),
    );

    // Delivered packages on this trip — their senders are ratable too.
    const packages = await this.packagesRepo
      .createQueryBuilder('p')
      .innerJoinAndSelect('p.sender', 's')
      .innerJoin('p.tripGroup', 'g')
      .where('g.driverTripId = :tripId', { tripId })
      .andWhere('p.status = :done', { done: PackageStatus.DELIVERED })
      .getMany();

    return [
      ...requests.map((r) => ({
        kind: 'passenger' as const,
        passengerId: r.passenger.id,
        packageDeliveryId: null as number | null,
        name: `${r.passenger.firstName ?? ''} ${r.passenger.lastName ?? ''}`.trim(),
        alreadyRated: ratedPassengers.has(r.passenger.id),
      })),
      ...packages.map((p) => ({
        kind: 'sender' as const,
        passengerId: p.sender.id,
        packageDeliveryId: p.id,
        name: `${p.sender.firstName ?? ''} ${p.sender.lastName ?? ''}`.trim(),
        alreadyRated: ratedPackages.has(p.id),
      })),
    ];
  }

  /** The passenger's own rating for a request (or null). */
  async getPassengerRating(userId: number, tripRequestId: number) {
    const rating = await this.ratingsRepo.findOne({
      where: {
        tripRequest: { id: tripRequestId },
        raterType: RaterType.PASSENGER,
        passenger: { id: userId },
      },
    });
    // Field is named `comment` in responses — the global envelope
    // interceptor lifts any top-level `message` key into the envelope.
    return rating
      ? {
          level: rating.level,
          value: rating.value,
          comment: rating.message,
          createdAt: rating.createdAt,
        }
      : null;
  }

  // ─── Internals ────────────────────────────────────────────────

  private async servedRequests(tripId: number): Promise<TripRequest[]> {
    // Served = the request completed inside this trip's group.
    return this.requestsRepo
      .createQueryBuilder('r')
      .innerJoinAndSelect('r.passenger', 'p')
      .innerJoin('r.tripGroup', 'g')
      .where('g.driverTripId = :tripId', { tripId })
      .andWhere('r.status = :done', { done: TripStatus.COMPLETED })
      .getMany();
  }

  private async findServedRequest(
    tripId: number,
    passengerUserId: number,
  ): Promise<TripRequest | null> {
    const rows = await this.servedRequests(tripId);
    return rows.find((r) => r.passenger.id === passengerUserId) ?? null;
  }

  private async saveRating(input: {
    tripRequestId?: number;
    packageDeliveryId?: number;
    driverTripId: number;
    raterType: RaterType;
    driverId: number;
    passengerId: number;
    level: RatingLevel;
    message?: string;
  }) {
    const value = RATING_VALUE[input.level];

    return this.dataSource.transaction(async (mgr) => {
      const existing = await mgr.findOne(Rating, {
        where: input.tripRequestId != null
          ? {
              tripRequest: { id: input.tripRequestId },
              raterType: input.raterType,
            }
          : {
              packageDelivery: { id: input.packageDeliveryId },
              raterType: input.raterType,
            },
      });
      if (existing) {
        throw new ConflictException(this.t('trips.Already rated'));
      }

      const rating = mgr.create(Rating, {
        tripRequestId: input.tripRequestId ?? null,
        tripRequest:
          input.tripRequestId != null
            ? ({ id: input.tripRequestId } as TripRequest)
            : null,
        packageDeliveryId: input.packageDeliveryId ?? null,
        packageDelivery:
          input.packageDeliveryId != null
            ? ({ id: input.packageDeliveryId } as PackageDelivery)
            : null,
        driverTrip: { id: input.driverTripId } as DriverTrip,
        raterType: input.raterType,
        driverId: input.driverId,
        driver: { id: input.driverId } as Driver,
        passengerId: input.passengerId,
        passenger: { id: input.passengerId } as User,
        level: input.level,
        value,
        message: input.message?.trim() || null,
      });
      const saved = await mgr.save(rating);

      // Update the ratee's running average under a row lock (NO KEY
      // UPDATE — same locking rationale as the wallet writes).
      if (input.raterType === RaterType.PASSENGER) {
        await this.bumpAverage(mgr, Driver, input.driverId, value);
      } else {
        await this.bumpAverage(mgr, User, input.passengerId, value);
      }

      return { id: saved.id, level: saved.level, value: saved.value };
    });
  }

  private async bumpAverage(
    mgr: EntityManager,
    entity: typeof Driver | typeof User,
    id: number,
    value: number,
  ): Promise<void> {
    const row = await mgr
      .createQueryBuilder(entity, 'e')
      .where('e.id = :id', { id })
      .setLock('pessimistic_partial_write')
      .getOne();
    if (!row) return;
    const typed = row as { rating: number; ratingCount: number };
    const count = Number(typed.ratingCount) || 0;
    // First real rating replaces the display default instead of
    // averaging against it.
    const next =
      count === 0
        ? value
        : round2((Number(typed.rating) * count + value) / (count + 1));
    await mgr.update(entity, { id }, { rating: next, ratingCount: count + 1 });
  }
}
