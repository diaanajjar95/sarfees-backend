import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { I18nContext } from 'nestjs-i18n';
import { Driver } from './driver.entity';
import { DriverStatus } from '../shared/enums/driver-status.enum';
import { DriverTrip } from '../driver-trips/entities/driver-trip.entity';
import { DriverTripStatus } from '../shared/enums/driver-trip-status.enum';
import { DriverLocation } from '../trips/entities/driver-location.entity';
import { ActivatePreferencesDto } from './dto/activate-preferences.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { DriverProfileResponseDto } from './dto/driver-profile-response.dto';
import { HomeSummaryResponseDto } from './dto/home-summary-response.dto';
import {
  LocationPingDto,
  LocationPingResponseDto,
} from './dto/location-ping.dto';
import { AnnouncementsService } from '../announcements/announcements.service';

@Injectable()
export class DriversService {
  constructor(
    @InjectRepository(Driver)
    private readonly driversRepository: Repository<Driver>,
    @InjectRepository(DriverTrip)
    private readonly driverTripsRepository: Repository<DriverTrip>,
    @InjectRepository(DriverLocation)
    private readonly driverLocationRepository: Repository<DriverLocation>,
    private readonly announcementsService: AnnouncementsService,
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
    };
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
    const patch: Partial<Driver> = {
      status: DriverStatus.ACTIVE,
      prefDestinationCity: destinationCity as unknown as string,
      prefTripTypes: dto.tripTypes,
      prefGoingHome: dto.goingHome,
      prefMinPassengers:
        dto.minPassengers != null
          ? dto.minPassengers
          : (null as unknown as number),
      prefActivatedAt: new Date(),
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
