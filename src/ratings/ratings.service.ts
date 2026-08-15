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
import { DriverTripStatus } from '../shared/enums/driver-trip-status.enum';
import { TripStatus } from '../shared/enums/trip-status.enum';
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
    const rated = new Set(existing.map((r) => r.passengerId));

    return requests.map((r) => ({
      passengerId: r.passenger.id,
      name: `${r.passenger.firstName ?? ''} ${r.passenger.lastName ?? ''}`.trim(),
      alreadyRated: rated.has(r.passenger.id),
    }));
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
    tripRequestId: number;
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
        where: {
          tripRequest: { id: input.tripRequestId },
          raterType: input.raterType,
        },
      });
      if (existing) {
        throw new ConflictException(this.t('trips.Already rated'));
      }

      const rating = mgr.create(Rating, {
        tripRequestId: input.tripRequestId,
        tripRequest: { id: input.tripRequestId } as TripRequest,
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
