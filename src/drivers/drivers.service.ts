import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { I18nContext } from 'nestjs-i18n';
import { Driver } from './driver.entity';
import { DriverStatus } from '../shared/enums/driver-status.enum';
import { DriverTrip } from '../driver-trips/entities/driver-trip.entity';
import { DriverTripStatus } from '../shared/enums/driver-trip-status.enum';
import { ActivatePreferencesDto } from './dto/activate-preferences.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { DriverProfileResponseDto } from './dto/driver-profile-response.dto';
import { HomeSummaryResponseDto } from './dto/home-summary-response.dto';

@Injectable()
export class DriversService {
  constructor(
    @InjectRepository(Driver)
    private readonly driversRepository: Repository<Driver>,
    @InjectRepository(DriverTrip)
    private readonly driverTripsRepository: Repository<DriverTrip>,
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

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayTrips = await this.driverTripsRepository.find({
      where: {
        driver: { id: driverId },
        status: DriverTripStatus.COMPLETED,
        completedAt: Between(todayStart, new Date()),
      },
    });
    const todayEarnings =
      Math.round(
        todayTrips.reduce(
          (n, t) => n + (Number(t.netEarnings) || 0),
          0,
        ) * 100,
      ) / 100;

    const lastCompleted = await this.driverTripsRepository.findOne({
      where: {
        driver: { id: driverId },
        status: DriverTripStatus.COMPLETED,
      },
      order: { completedAt: 'DESC' },
    });

    return {
      todayEarnings,
      lastTrip: lastCompleted
        ? {
            origin: lastCompleted.originCity,
            destination: lastCompleted.destinationCity,
            completedAt: lastCompleted.completedAt,
            earnings: Number(lastCompleted.netEarnings) || 0,
          }
        : null,
      outstandingBalance: Number(driver.outstandingBalance),
      announcements: [],
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

    const updated = await this.update(driver.id, {
      status: DriverStatus.ACTIVE,
      prefDestinationCity: destinationCity as unknown as string,
      prefTripTypes: dto.tripTypes,
      prefGoingHome: dto.goingHome,
      prefMinPassengers:
        dto.minPassengers != null
          ? dto.minPassengers
          : (null as unknown as number),
      prefActivatedAt: new Date(),
      prefLocationLat: dto.currentLocationLat,
      prefLocationLng: dto.currentLocationLng,
    });

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
    if (dto.fcmToken !== undefined) patch.fcmToken = dto.fcmToken;
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
