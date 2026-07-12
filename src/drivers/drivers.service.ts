import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { And, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import { I18nContext } from 'nestjs-i18n';
import { Driver } from './driver.entity';
import { DriverStatus } from '../shared/enums/driver-status.enum';
import { DriverTrip } from '../driver-trips/entities/driver-trip.entity';
import { DriverTripStop } from '../driver-trips/entities/driver-trip-stop.entity';
import { DriverTripStopPassenger } from '../driver-trips/entities/driver-trip-stop-passenger.entity';
import { DriverTripStopPackage } from '../driver-trips/entities/driver-trip-stop-package.entity';
import { DriverTripStatus } from '../shared/enums/driver-trip-status.enum';
import {
  StopPassengerRole,
  StopPassengerStatus,
} from '../shared/enums/stop-passenger-status.enum';
import { StopPackageRole } from '../shared/enums/stop-package-status.enum';
import { DriverLocation } from '../trips/entities/driver-location.entity';
import { ActivatePreferencesDto } from './dto/activate-preferences.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { DriverProfileResponseDto } from './dto/driver-profile-response.dto';
import {
  CurrentStopDto,
  CurrentStopPackageDto,
  CurrentStopPassengerDto,
  CurrentTripDto,
  HomeSummaryResponseDto,
  LastSessionDto,
  OnBoardDto,
  PendingOfferDto,
  StopProgressItemDto,
  SuspensionInfoDto,
  UpNextStopDto,
} from './dto/home-summary-response.dto';
import {
  LocationPingDto,
  LocationPingResponseDto,
} from './dto/location-ping.dto';
import { AnnouncementsService } from '../announcements/announcements.service';

/** Average city speed used for ETA estimation in /drivers/home-summary. */
const ETA_AVG_KMH = 40;

@Injectable()
export class DriversService {
  constructor(
    @InjectRepository(Driver)
    private readonly driversRepository: Repository<Driver>,
    @InjectRepository(DriverTrip)
    private readonly driverTripsRepository: Repository<DriverTrip>,
    @InjectRepository(DriverTripStop)
    private readonly driverTripStopsRepository: Repository<DriverTripStop>,
    @InjectRepository(DriverTripStopPassenger)
    private readonly stopPassengersRepository: Repository<DriverTripStopPassenger>,
    @InjectRepository(DriverTripStopPackage)
    private readonly stopPackagesRepository: Repository<DriverTripStopPackage>,
    @InjectRepository(DriverLocation)
    private readonly driverLocationRepository: Repository<DriverLocation>,
    private readonly announcementsService: AnnouncementsService,
    private readonly configService: ConfigService,
  ) {}

  // ─── Lookups (used by auth slice) ──────────────────────────
  findByPhone(
    phoneNumber: string,
    countryCode: string,
  ): Promise<Driver | null> {
    return this.driversRepository.findOneBy({ phoneNumber, countryCode });
  }

  findById(id: number): Promise<Driver | null> {
    return this.driversRepository.findOneBy({ id });
  }

  async update(id: number, attrs: Partial<Driver>): Promise<Driver | null> {
    await this.driversRepository.update(id, attrs);
    return this.findById(id);
  }

  // ─── S-04 / S-16 Profile ───────────────────────────────────
  async getProfile(driverId: number): Promise<DriverProfileResponseDto> {
    const driver = await this.requireDriver(driverId);
    return DriverProfileResponseDto.from(driver);
  }

  // ─── S-04 Home Summary ─────────────────────────────────────
  async getHomeSummary(driverId: number): Promise<HomeSummaryResponseDto> {
    const driver = await this.requireDriver(driverId);

    // "Today" is evaluated in the Postgres session TZ — comparing
    // `DATE(t.completedAt)` against `CURRENT_DATE` keeps both sides on the
    // same clock. The previous JS `new Date()` approach silently missed
    // today's trips on hosts whose process TZ differed from the DB TZ.
    const todayTrips = await this.driverTripsRepository
      .createQueryBuilder('t')
      .where('t.driverId = :driverId', { driverId })
      .andWhere('t.status = :status', {
        status: DriverTripStatus.COMPLETED,
      })
      .andWhere('DATE(t."completedAt") = CURRENT_DATE')
      .getMany();

    // Aggregate today's totals — earnings, count, effective commission rate.
    const todayEarnings =
      Math.round(
        todayTrips.reduce((n, t) => n + (Number(t.netEarnings) || 0), 0) * 100,
      ) / 100;
    const tripsCompletedToday = todayTrips.length;
    const totalCashToday = todayTrips.reduce(
      (n, t) => n + (Number(t.totalCashCollected) || 0),
      0,
    );
    const totalCommissionToday = todayTrips.reduce(
      (n, t) =>
        n +
        (Number(t.totalCashCollected) || 0) * (Number(t.commissionRate) || 0),
      0,
    );
    // Effective commission % across today's cash. Falls back to the platform
    // default (15%) on a fresh day with no completed trips yet.
    const commissionPercentageToday =
      totalCashToday > 0
        ? Math.round((totalCommissionToday / totalCashToday) * 1000) / 10
        : 15;

    const lastCompleted = await this.driverTripsRepository.findOne({
      where: {
        driver: { id: driverId },
        status: DriverTripStatus.COMPLETED,
      },
      order: { completedAt: 'DESC' },
    });

    const announcements = await this.announcementsService.listActive();

    // Live session state — preferences + start time are only meaningful while
    // the driver is in an `active` / `on_trip` state. Surface `null` otherwise.
    const inSession =
      driver.status === DriverStatus.ACTIVE ||
      driver.status === DriverStatus.ON_TRIP;
    const activePreferences = inSession
      ? {
          destinationCity: driver.prefDestinationCity ?? null,
          tripTypes: driver.prefTripTypes ?? [],
          goingHome: driver.prefGoingHome,
          minPassengers: driver.prefMinPassengers ?? null,
          activatedAt: driver.prefActivatedAt ?? null,
          locationLat:
            driver.prefLocationLat != null
              ? Number(driver.prefLocationLat)
              : null,
          locationLng:
            driver.prefLocationLng != null
              ? Number(driver.prefLocationLng)
              : null,
        }
      : null;

    // Status-conditional blocks — at most one non-null at a time.
    // Each builder returns null when the driver's status doesn't match.
    const currentTrip =
      driver.status === DriverStatus.ON_TRIP
        ? await this.buildCurrentTrip(driver)
        : null;
    const pendingOffer =
      driver.status === DriverStatus.ACTIVE
        ? await this.buildPendingOffer(driver)
        : null;
    const lastSession =
      driver.status === DriverStatus.INACTIVE
        ? await this.buildLastSession(driver)
        : null;
    const suspensionInfo =
      driver.status === DriverStatus.SUSPENDED
        ? this.buildSuspensionInfo(driver)
        : null;

    return {
      status: driver.status,
      activePreferences,
      sessionStartedAt: inSession ? (driver.prefActivatedAt ?? null) : null,
      todayEarnings,
      tripsCompletedToday,
      commissionPercentageToday,
      lastTrip: lastCompleted
        ? {
            origin: lastCompleted.originCity,
            destination: lastCompleted.destinationCity,
            completedAt: lastCompleted.completedAt,
            earnings: Number(lastCompleted.netEarnings) || 0,
          }
        : null,
      outstandingBalance: Number(driver.outstandingBalance),
      announcements,
      currentTrip,
      pendingOffer,
      lastSession,
      suspensionInfo,
    };
  }

  // ─── on_trip block builder ─────────────────────────────────
  /**
   * Build the CurrentTripDto embedded in /drivers/home-summary when the
   * driver's status is ON_TRIP. Single-trip query — driver can only be on
   * one ACCEPTED/IN_PROGRESS trip at a time, enforced by the accept flow.
   *
   * Returns `null` when no active trip exists (treated as a soft state
   * mismatch — caller surfaces it as currentTrip:null rather than 500).
   */
  private async buildCurrentTrip(driver: Driver): Promise<CurrentTripDto | null> {
    const trip = await this.driverTripsRepository.findOne({
      where: [
        { driver: { id: driver.id }, status: DriverTripStatus.ACCEPTED },
        { driver: { id: driver.id }, status: DriverTripStatus.IN_PROGRESS },
      ],
      order: { acceptedAt: 'DESC' },
    });
    if (!trip) return null;

    // Pull every stop with its passenger/package join rows + the linked
    // TripRequest.passenger and PackageDelivery.sender for the driver-
    // facing name/phone fields.
    const stops = await this.driverTripStopsRepository.find({
      where: { trip: { id: trip.id } },
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

    const driverLat =
      driver.prefLocationLat != null ? Number(driver.prefLocationLat) : null;
    const driverLng =
      driver.prefLocationLng != null ? Number(driver.prefLocationLng) : null;

    const currentStopRow = stops.find((s) => s.order === trip.currentStopIndex);
    const upNextStopRow = stops.find(
      (s) => s.order === trip.currentStopIndex + 1,
    );

    const currentStop: CurrentStopDto | null = currentStopRow
      ? {
          id: currentStopRow.id,
          order: currentStopRow.order,
          type: currentStopRow.type,
          city: currentStopRow.city,
          address: currentStopRow.address ?? null,
          lat: Number(currentStopRow.lat),
          lng: Number(currentStopRow.lng),
          status: currentStopRow.status,
          cashAtStop: Number(currentStopRow.cashExpected),
          etaMinutes: this.etaMinutesTo(
            driverLat,
            driverLng,
            Number(currentStopRow.lat),
            Number(currentStopRow.lng),
          ),
          passengers: currentStopRow.passengers.map<CurrentStopPassengerDto>(
            (sp) => ({
              id: sp.tripRequest?.id ?? 0,
              name: this.fullName(sp.tripRequest?.passenger),
              phone: this.fullPhone(sp.tripRequest?.passenger),
              role: sp.role,
              fare: Number(sp.fare),
            }),
          ),
          packages: currentStopRow.packages.map<CurrentStopPackageDto>(
            (pk) => ({
              id: pk.packageDelivery?.id ?? 0,
              reference: `PKG-${pk.packageDelivery?.id ?? 0}`,
              contactName:
                pk.role === StopPackageRole.COLLECTING
                  ? this.fullName(pk.packageDelivery?.sender)
                  : (pk.packageDelivery?.receiverName ?? ''),
              contactPhone:
                pk.role === StopPackageRole.COLLECTING
                  ? this.fullPhone(pk.packageDelivery?.sender)
                  : (pk.packageDelivery?.receiverPhone ?? ''),
              role: pk.role,
              fee: Number(pk.fee),
            }),
          ),
        }
      : null;

    const stopsProgress: StopProgressItemDto[] = stops.map((s) => ({
      order: s.order,
      type: s.type,
      status: s.status,
    }));

    // "On board" = boarding passengers who have been picked up AND whose
    // corresponding alighting link hasn't been confirmed yet.
    // tripRequestId is the join key (one trip request → one boarding +
    // one alighting link).
    const boardingByRequest = new Map<
      number,
      { name: string; pickedUp: boolean }
    >();
    const droppedRequestIds = new Set<number>();
    for (const stop of stops) {
      for (const sp of stop.passengers) {
        const trId = sp.tripRequest?.id;
        if (!trId) continue;
        if (sp.role === StopPassengerRole.BOARDING) {
          const pickedUp = sp.status === StopPassengerStatus.PICKED_UP;
          boardingByRequest.set(trId, {
            name: this.fullName(sp.tripRequest?.passenger),
            pickedUp,
          });
        } else if (sp.role === StopPassengerRole.ALIGHTING) {
          if (
            sp.status === StopPassengerStatus.DROPPED_OFF ||
            sp.status === StopPassengerStatus.CASH_NOT_COLLECTED
          ) {
            droppedRequestIds.add(trId);
          }
        }
      }
    }
    const onBoardEntries = [...boardingByRequest.entries()]
      .filter(([trId, b]) => b.pickedUp && !droppedRequestIds.has(trId))
      .map(([trId, b]) => ({ id: trId, name: b.name }));
    const onBoard: OnBoardDto = {
      passengerCount: onBoardEntries.length,
      passengers: onBoardEntries,
    };

    const totalCashCollected = Number(trip.totalCashCollected);
    const commissionRate = Number(trip.commissionRate);
    const earnedSoFar = {
      totalCashCollected,
      commissionRate,
      netEarningsSoFar:
        Math.round(totalCashCollected * (1 - commissionRate) * 100) / 100,
    };

    const upNext: UpNextStopDto | null = upNextStopRow
      ? {
          order: upNextStopRow.order,
          type: upNextStopRow.type,
          city: upNextStopRow.city,
          address: upNextStopRow.address ?? null,
          cashAtStop: Number(upNextStopRow.cashExpected),
          etaMinutes: this.etaMinutesTo(
            driverLat,
            driverLng,
            Number(upNextStopRow.lat),
            Number(upNextStopRow.lng),
          ),
        }
      : null;

    return {
      id: trip.id,
      type: trip.type,
      status: trip.status,
      originCity: trip.originCity,
      destinationCity: trip.destinationCity,
      currentStopIndex: trip.currentStopIndex,
      totalStops: stops.length,
      currentStop,
      stopsProgress,
      onBoard,
      earnedSoFar,
      upNext,
    };
  }

  // ─── active block builder ──────────────────────────────────
  /**
   * Populated iff `status === 'active'` AND the matcher has dispatched
   * a `DriverTrip` in `OFFERED` state to this driver whose countdown
   * hasn't expired. Returns `null` when the driver is active-and-idle
   * (no offer waiting).
   *
   * A stale-but-still-in-the-table `OFFERED` row whose `offerExpiresAt`
   * has passed is treated as `null` here — the expire-if-needed cleanup
   * happens elsewhere and we shouldn't advertise an offer the mobile
   * client can't actually accept.
   */
  private async buildPendingOffer(
    driver: Driver,
  ): Promise<PendingOfferDto | null> {
    const now = new Date();
    const trip = await this.driverTripsRepository.findOne({
      where: {
        driver: { id: driver.id },
        status: DriverTripStatus.OFFERED,
        offerExpiresAt: MoreThanOrEqual(now),
      },
      order: { offeredAt: 'DESC' },
    });
    if (!trip) return null;
    return {
      tripId: trip.id,
      originCity: trip.originCity,
      destinationCity: trip.destinationCity,
      type: trip.type,
      offerExpiresAt: trip.offerExpiresAt,
      secondsRemaining: Math.max(
        0,
        Math.floor((trip.offerExpiresAt.getTime() - now.getTime()) / 1000),
      ),
    };
  }

  // ─── inactive block builder ────────────────────────────────
  /**
   * Populated iff `status === 'inactive'` AND the driver has a
   * complete activate → deactivate cycle recorded (i.e. both
   * `lastSessionStartedAt` and `lastSessionEndedAt` are set).
   *
   * Sums `netEarnings` and counts completed trips that fell between
   * the session boundaries.
   */
  private async buildLastSession(
    driver: Driver,
  ): Promise<LastSessionDto | null> {
    if (!driver.lastSessionStartedAt || !driver.lastSessionEndedAt) return null;
    const start = new Date(driver.lastSessionStartedAt);
    const end = new Date(driver.lastSessionEndedAt);
    if (end <= start) return null;

    const trips = await this.driverTripsRepository.find({
      where: {
        driver: { id: driver.id },
        status: DriverTripStatus.COMPLETED,
        completedAt: And(MoreThanOrEqual(start), LessThanOrEqual(end)),
      },
    });
    const earnings =
      Math.round(
        trips.reduce((n, t) => n + (Number(t.netEarnings) || 0), 0) * 100,
      ) / 100;
    const durationMinutes = Math.max(
      0,
      Math.round((end.getTime() - start.getTime()) / 60000),
    );
    return {
      startedAt: start,
      endedAt: end,
      durationMinutes,
      tripsCompleted: trips.length,
      earnings,
    };
  }

  // ─── suspended block builder ───────────────────────────────
  /**
   * Populated iff `status === 'suspended'`. Reads audit fields set by
   * the admin suspend endpoint plus the support contact info from env.
   *
   * `suspendedAt` may be `null` on drivers suspended before the audit
   * columns shipped — we default it to `updatedAt` in that case so the
   * mobile UI always has something to render.
   */
  private buildSuspensionInfo(driver: Driver): SuspensionInfoDto {
    return {
      suspendedAt: driver.suspendedAt ?? driver.updatedAt,
      reason: driver.suspensionReason ?? null,
      supportEmail:
        this.configService.get<string>('SUPPORT_EMAIL') ?? 'support@sarfees.com',
      supportPhone: this.configService.get<string>('SUPPORT_PHONE') ?? null,
    };
  }

  /**
   * Haversine distance × inverse avg-speed → integer minutes.
   * Returns `null` when the driver has no location snapshot.
   * Snaps to 0 within ~50m of the target (driver is "at the stop").
   */
  private etaMinutesTo(
    fromLat: number | null,
    fromLng: number | null,
    toLat: number,
    toLng: number,
  ): number | null {
    if (fromLat == null || fromLng == null) return null;
    const R_KM = 6371;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(toLat - fromLat);
    const dLng = toRad(toLng - fromLng);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(fromLat)) *
        Math.cos(toRad(toLat)) *
        Math.sin(dLng / 2) ** 2;
    const km = 2 * R_KM * Math.asin(Math.sqrt(a));
    if (km < 0.05) return 0;
    return Math.max(1, Math.round((km / ETA_AVG_KMH) * 60));
  }

  private fullName(user?: {
    firstName?: string | null;
    lastName?: string | null;
  }): string {
    if (!user) return '';
    return `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();
  }

  private fullPhone(user?: {
    countryCode?: string | null;
    phoneNumber?: string | null;
  }): string {
    if (!user) return '';
    return `${user.countryCode ?? ''}${user.phoneNumber ?? ''}`.trim();
  }

  // ─── S-05 Activate ─────────────────────────────────────────
  async activate(
    driverId: number,
    dto: ActivatePreferencesDto,
  ): Promise<DriverProfileResponseDto> {
    const driver = await this.requireDriver(driverId);

    if (driver.status === DriverStatus.ON_TRIP) {
      throw new BadRequestException(
        I18nContext.current()?.t('driver.Already on trip'),
      );
    }

    this.guardWomenOnly(driver, dto.tripTypes);

    const destinationCity = dto.goingHome
      ? this.requireHomeCity(driver)
      : (dto.destinationCity ?? null);

    // Location is optional on activate — drivers can also seed it via
    // POST /drivers/me/location before going active. When omitted, the
    // existing prefLocation* values (if any) are preserved.
    const now = new Date();
    const patch: Partial<Driver> = {
      status: DriverStatus.ACTIVE,
      prefDestinationCity: destinationCity as unknown as string,
      prefTripTypes: dto.tripTypes,
      prefGoingHome: dto.goingHome,
      prefMinPassengers:
        dto.minPassengers != null
          ? dto.minPassengers
          : (null as unknown as number),
      prefActivatedAt: now,
      // Session-audit bookmarks — populate on every fresh activation.
      // A new session erases the prior lastSessionEndedAt so the
      // inactive-block builder won't surface a stale summary while
      // the driver is mid-session.
      lastSessionStartedAt: now,
      lastSessionEndedAt: null as unknown as Date,
    };
    if (dto.currentLocationLat != null) {
      patch.prefLocationLat = dto.currentLocationLat;
    }
    if (dto.currentLocationLng != null) {
      patch.prefLocationLng = dto.currentLocationLng;
    }
    const updated = await this.update(driver.id, patch);

    return DriverProfileResponseDto.from(updated as Driver);
  }

  // ─── S-06 Deactivate ───────────────────────────────────────
  async deactivate(driverId: number): Promise<DriverProfileResponseDto> {
    const driver = await this.requireDriver(driverId);

    if (driver.status === DriverStatus.ON_TRIP) {
      throw new BadRequestException(
        I18nContext.current()?.t('driver.Cannot deactivate during trip'),
      );
    }

    const updated = await this.update(driver.id, {
      status: DriverStatus.INACTIVE,
      prefDestinationCity: null as unknown as string,
      prefTripTypes: null as unknown as string[],
      prefGoingHome: false,
      prefMinPassengers: null as unknown as number,
      prefActivatedAt: null as unknown as Date,
      prefLocationLat: null as unknown as number,
      prefLocationLng: null as unknown as number,
      // Stamp the session end. lastSessionStartedAt is preserved so the
      // home-summary lastSession block can compute duration + trips
      // between started/ended.
      lastSessionEndedAt: new Date(),
    });

    return DriverProfileResponseDto.from(updated as Driver);
  }

  // ─── S-06 Patch Preferences ────────────────────────────────
  async updatePreferences(
    driverId: number,
    dto: UpdatePreferencesDto,
  ): Promise<DriverProfileResponseDto> {
    const driver = await this.requireDriver(driverId);

    if (driver.status !== DriverStatus.ACTIVE) {
      throw new BadRequestException(
        I18nContext.current()?.t('driver.Not active'),
      );
    }

    if (dto.tripTypes) {
      this.guardWomenOnly(driver, dto.tripTypes);
    }

    const goingHome = dto.goingHome ?? driver.prefGoingHome;
    const patch: Partial<Driver> = {};

    if (dto.tripTypes !== undefined) patch.prefTripTypes = dto.tripTypes;
    if (dto.minPassengers !== undefined)
      patch.prefMinPassengers = dto.minPassengers;

    // Going-home toggle takes precedence: when enabled (or already on),
    // destinationCity is locked to the driver's home city. Otherwise honor
    // an explicit destinationCity update.
    if (dto.goingHome !== undefined) {
      patch.prefGoingHome = dto.goingHome;
      if (dto.goingHome) {
        patch.prefDestinationCity = this.requireHomeCity(driver);
      }
    }
    if (dto.destinationCity !== undefined && !goingHome) {
      patch.prefDestinationCity = dto.destinationCity;
    }

    const updated = await this.update(driver.id, patch);
    return DriverProfileResponseDto.from(updated as Driver);
  }

  // ─── S-17 Settings (language + notification flags) ─────────
  async updateSettings(
    driverId: number,
    dto: UpdateSettingsDto,
  ): Promise<DriverProfileResponseDto> {
    const driver = await this.requireDriver(driverId);

    const patch: Partial<Driver> = {};
    if (dto.language) patch.language = dto.language;
    if (dto.notifications) {
      const n = dto.notifications;
      if (n.tripOffers !== undefined) patch.notifyTripOffers = n.tripOffers;
      if (n.tripUpdates !== undefined) patch.notifyTripUpdates = n.tripUpdates;
      if (n.earnings !== undefined) patch.notifyEarnings = n.earnings;
      if (n.announcements !== undefined)
        patch.notifyAnnouncements = n.announcements;
    }

    const updated = Object.keys(patch).length
      ? await this.update(driver.id, patch)
      : driver;
    return DriverProfileResponseDto.from(updated as Driver);
  }

  // ─── FCM push-notification token (own endpoint, called on login + refresh) ─
  /**
   * Idempotent "set the current FCM token for this driver". Separate from
   * /drivers/settings because the mobile app fires this on every login and
   * every FirebaseMessaging token-refresh callback — keeping it off the
   * settings surface avoids racing those high-frequency writes against
   * language / notification-toggle changes.
   */
  async updateFcmToken(
    driverId: number,
    fcmToken: string,
  ): Promise<{ updated: boolean }> {
    const driver = await this.requireDriver(driverId);
    await this.update(driver.id, { fcmToken });
    return { updated: true };
  }

  // ─── Location ping (high-frequency, trip-agnostic) ─────────
  /**
   * Record a single GPS ping. Two side-effects:
   *   - Append a row to `driver_locations` (history).
   *   - Update `Driver.prefLocationLat/Lng` so the auto-matcher always
   *     reads the latest position without a join.
   *
   * Suspended drivers get 403 (same gate as everything else). Stale
   * pings from drivers whose status is not ACTIVE / ON_TRIP are still
   * accepted — clients may need to write the *initial* position before
   * calling /drivers/activate, and the history table is also useful
   * after a trip completes.
   */
  async pingLocation(
    driverId: number,
    dto: LocationPingDto,
  ): Promise<LocationPingResponseDto> {
    const driver = await this.requireDriver(driverId);

    const row = this.driverLocationRepository.create({
      driver: { id: driver.id } as Driver,
      trip: null,
      lat: dto.lat,
      lng: dto.lng,
    });
    const saved = await this.driverLocationRepository.save(row);

    // Update the matcher snapshot. Cast through unknown because TypeORM
    // partial updates treat decimal columns as strings; numbers are
    // fine at the driver — the column transformer handles conversion.
    await this.driversRepository.update(driver.id, {
      prefLocationLat: dto.lat as unknown as number,
      prefLocationLng: dto.lng as unknown as number,
    });

    return { id: saved.id, recordedAt: saved.recordedAt };
  }

  // ─── Helpers ───────────────────────────────────────────────
  private async requireDriver(driverId: number): Promise<Driver> {
    const driver = await this.findById(driverId);
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

  private guardWomenOnly(driver: Driver, tripTypes: string[]): void {
    if (tripTypes.includes('women_only') && driver.gender !== 'female') {
      throw new ForbiddenException(
        I18nContext.current()?.t('driver.Women-only restricted'),
      );
    }
  }

  private requireHomeCity(driver: Driver): string {
    if (!driver.homeCity) {
      throw new BadRequestException(
        I18nContext.current()?.t('driver.No home city'),
      );
    }
    return driver.homeCity;
  }
}
