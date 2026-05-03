import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Driver } from '../drivers/driver.entity';
import { DriverStatus } from '../shared/enums/driver-status.enum';
import { TripRequest } from '../trips/entities/trip-request.entity';
import { DriverTrip } from '../driver-trips/entities/driver-trip.entity';
import { DriverTripStatus } from '../shared/enums/driver-trip-status.enum';
import { DriverTripType } from '../shared/enums/driver-trip-type.enum';
import { DriverTripsService } from '../driver-trips/driver-trips.service';
import { SeedDriverTripDto } from '../driver-trips/dto/seed-driver-trip.dto';

interface MatchResult {
  matched: boolean;
  driverId?: number;
  driverTripId?: number;
  reason?: string;
}

@Injectable()
export class MatchingService {
  private readonly logger = new Logger(MatchingService.name);

  constructor(
    @InjectRepository(Driver)
    private readonly driversRepo: Repository<Driver>,
    @InjectRepository(DriverTrip)
    private readonly tripsRepo: Repository<DriverTrip>,
    private readonly driverTripsService: DriverTripsService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Try to match a freshly-created passenger TripRequest to an active driver
   * and create an OFFERED DriverTrip. Returns gracefully (logs only) if no
   * driver is eligible — ops can still assign manually from the admin portal.
   *
   * Set MATCHING_ENABLED=false to disable; useful for tests or while ops
   * prefers fully-manual assignment.
   */
  async attemptMatch(tripRequest: TripRequest): Promise<MatchResult> {
    if ((this.config.get<string>('MATCHING_ENABLED') ?? 'true') === 'false') {
      return { matched: false, reason: 'matching_disabled' };
    }

    // Idempotency guard: if this TripRequest already has a live DriverTrip
    // (offered/accepted/in_progress), don't double-fire. Prevents duplicates
    // from retries, hot-reloads, or re-invocation by ops scripts.
    const existing = await this.tripsRepo
      .createQueryBuilder('t')
      .innerJoin('t.stops', 's')
      .innerJoin('s.passengers', 'sp')
      .where('sp.tripRequestId = :rid', { rid: tripRequest.id })
      .andWhere('t.status IN (:...live)', {
        live: [
          DriverTripStatus.OFFERED,
          DriverTripStatus.ACCEPTED,
          DriverTripStatus.IN_PROGRESS,
        ],
      })
      .getOne();
    if (existing) {
      this.logger.log(
        `TripRequest #${tripRequest.id} already has live DriverTrip #${existing.id}; skipping match.`,
      );
      return {
        matched: false,
        reason: 'already_offered',
        driverTripId: existing.id,
      };
    }

    const desiredType = tripRequest.isFemaleOnly
      ? DriverTripType.WOMEN_ONLY
      : DriverTripType.SHARED;

    const eligibleDrivers = await this.findEligibleDrivers(
      tripRequest,
      desiredType,
    );

    if (eligibleDrivers.length === 0) {
      this.logger.log(
        `No eligible driver for TripRequest #${tripRequest.id} (type=${desiredType}). Leaving as PENDING.`,
      );
      return { matched: false, reason: 'no_eligible_driver' };
    }

    const driver = eligibleDrivers[0];

    const dto: SeedDriverTripDto = {
      driverId: driver.id,
      type: desiredType,
      originCity: tripRequest.departureCity?.nameEn ?? 'Unknown',
      destinationCity: tripRequest.arrivalCity?.nameEn ?? 'Unknown',
      departureTime: (tripRequest.travelDate ?? new Date()).toISOString(),
      pickupLat: tripRequest.departureLocation.lat,
      pickupLng: tripRequest.departureLocation.lng,
      dropoffLat: tripRequest.arrivalLocation.lat,
      dropoffLng: tripRequest.arrivalLocation.lng,
      tripRequestIds: [tripRequest.id],
      packageDeliveryIds: [],
    };

    try {
      const created = await this.driverTripsService.seedTrip(dto);
      this.logger.log(
        `Matched TripRequest #${tripRequest.id} → Driver #${driver.id} as DriverTrip #${created.id}`,
      );
      return {
        matched: true,
        driverId: driver.id,
        driverTripId: created.id,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Match attempt failed for TripRequest #${tripRequest.id}: ${message}`,
      );
      return { matched: false, reason: `seed_failed: ${message}` };
    }
  }

  // ─── Eligibility ───────────────────────────────────────────
  private async findEligibleDrivers(
    tripRequest: TripRequest,
    desiredType: DriverTripType,
  ): Promise<Driver[]> {
    // Drivers who currently hold an offer or are mid-trip are skipped.
    const busyRows = await this.tripsRepo
      .createQueryBuilder('t')
      .leftJoin('t.driver', 'd')
      .select('d.id', 'id')
      .where('t.status IN (:...s)', {
        s: [
          DriverTripStatus.OFFERED,
          DriverTripStatus.ACCEPTED,
          DriverTripStatus.IN_PROGRESS,
        ],
      })
      .getRawMany<{ id: number }>();
    const busyIds = new Set(busyRows.map((r) => r.id).filter(Boolean));

    const where: Record<string, unknown> = { status: DriverStatus.ACTIVE };
    if (desiredType === DriverTripType.WOMEN_ONLY) {
      where.gender = 'female';
    }

    const drivers = await this.driversRepo.find({ where });
    const destinationCity =
      tripRequest.arrivalCity?.nameEn?.toLowerCase() ?? '';

    const candidates = drivers
      .filter((d) => !busyIds.has(d.id))
      .filter((d) => this.driverAcceptsType(d, desiredType))
      .filter((d) => this.driverAcceptsDestination(d, destinationCity))
      .filter((d) => this.driverAcceptsPassengerCount(d, tripRequest.seatsCount))
      // Tie-break: highest rating first; if equal, more total trips first.
      .sort((a, b) => {
        const r = Number(b.rating) - Number(a.rating);
        if (r !== 0) return r;
        return (b.totalTrips ?? 0) - (a.totalTrips ?? 0);
      });

    return candidates;
  }

  private driverAcceptsType(d: Driver, desiredType: DriverTripType): boolean {
    const prefs = d.prefTripTypes ?? [];
    if (prefs.length === 0) return true; // No preference set → accept anything
    if (prefs.includes(DriverTripType.MIXED)) return true;
    return prefs.includes(desiredType);
  }

  private driverAcceptsDestination(d: Driver, destLower: string): boolean {
    if (!d.prefDestinationCity) return true; // "Any destination"
    return d.prefDestinationCity.toLowerCase() === destLower;
  }

  private driverAcceptsPassengerCount(d: Driver, seats: number): boolean {
    if (d.prefMinPassengers == null) return true;
    return seats >= d.prefMinPassengers;
  }

  // Keep In imported for potential future bulk lookups
  private _keepImports = In;
}
