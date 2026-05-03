import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, QueryFailedError, Repository } from 'typeorm';
import { I18nContext } from 'nestjs-i18n';
import { Driver } from '../../drivers/driver.entity';
import { DriverStatus } from '../../shared/enums/driver-status.enum';
import { DriverTrip } from '../../driver-trips/entities/driver-trip.entity';
import { DriverTripDeclineLog } from '../../driver-trips/entities/driver-trip-decline-log.entity';
import { DriverTripStatus } from '../../shared/enums/driver-trip-status.enum';
import { DriverProfileResponseDto } from '../../drivers/dto/driver-profile-response.dto';
import { CreateDriverDto } from './dto/create-driver.dto';
import { UpdateDriverDto } from './dto/update-driver.dto';
import {
  ListDriversQueryDto,
  ListDriversResponseDto,
} from './dto/list-drivers.dto';
import {
  AdminDriverDetailDto,
  DriverDeclineLogRowDto,
  DriverTripHistoryRowDto,
} from './dto/driver-detail.dto';

@Injectable()
export class AdminDriversService {
  constructor(
    @InjectRepository(Driver)
    private readonly driversRepo: Repository<Driver>,
    @InjectRepository(DriverTrip)
    private readonly tripsRepo: Repository<DriverTrip>,
    @InjectRepository(DriverTripDeclineLog)
    private readonly declineLogRepo: Repository<DriverTripDeclineLog>,
  ) {}

  async list(query: ListDriversQueryDto): Promise<ListDriversResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const qb = this.driversRepo
      .createQueryBuilder('d')
      .orderBy('d.createdAt', 'DESC');

    if (query.status) {
      qb.andWhere('d.status = :status', { status: query.status });
    }
    if (query.homeCity) {
      qb.andWhere('LOWER(d.homeCity) = LOWER(:city)', { city: query.homeCity });
    }
    if (query.q && query.q.trim().length > 0) {
      const pattern = `%${query.q.trim().toLowerCase()}%`;
      qb.andWhere(
        new Brackets((bb) => {
          bb.where('LOWER(d.name) LIKE :p', { p: pattern })
            .orWhere('d.phoneNumber LIKE :p', { p: pattern })
            .orWhere('LOWER(d.plateNumber) LIKE :p', { p: pattern });
        }),
      );
    }

    const [rows, totalItems] = await qb
      .skip(skip)
      .take(limit)
      .getManyAndCount();
    const totalPages = Math.max(1, Math.ceil(totalItems / limit));

    return {
      data: rows.map((d) => DriverProfileResponseDto.from(d)),
      page,
      limit,
      totalItems,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    };
  }

  async detail(id: number): Promise<AdminDriverDetailDto> {
    const driver = await this.driversRepo.findOne({ where: { id } });
    if (!driver) {
      throw new NotFoundException(
        I18nContext.current()?.t('driver.Not found'),
      );
    }

    const recentTrips = await this.tripsRepo.find({
      where: { driver: { id } },
      order: { createdAt: 'DESC' },
      take: 50,
    });
    const completed = recentTrips.filter(
      (t) => t.status === DriverTripStatus.COMPLETED,
    ).length;
    const cancelled = recentTrips.filter(
      (t) => t.status === DriverTripStatus.CANCELLED,
    ).length;

    const tripHistory: DriverTripHistoryRowDto[] = recentTrips.map((t) => ({
      id: t.id,
      route: `${t.originCity} → ${t.destinationCity}`,
      type: t.type,
      status: t.status,
      departureTime: t.departureTime,
      completedAt: t.completedAt ?? null,
      totalCashCollected: Number(t.totalCashCollected),
      netEarnings: t.netEarnings != null ? Number(t.netEarnings) : null,
    }));

    const declineRows = await this.declineLogRepo.find({
      where: { driver: { id } },
      order: { declinedAt: 'DESC' },
      take: 50,
    });
    const declineLog: DriverDeclineLogRowDto[] = declineRows.map((r) => ({
      id: r.id,
      reason: r.reason,
      autoDeclined: r.autoDeclined,
      declinedAt: r.declinedAt,
    }));

    return {
      ...DriverProfileResponseDto.from(driver),
      completedTripCount: completed,
      cancelledTripCount: cancelled,
      tripHistory,
      declineLog,
    };
  }

  async create(dto: CreateDriverDto): Promise<DriverProfileResponseDto> {
    try {
      const created = this.driversRepo.create({
        name: dto.name,
        phoneNumber: dto.phoneNumber,
        countryCode: dto.countryCode,
        gender: dto.gender,
        homeCity: dto.homeCity,
        vehicleMake: dto.vehicleMake,
        vehicleModel: dto.vehicleModel,
        vehicleColor: dto.vehicleColor,
        vehicleYear: dto.vehicleYear,
        plateNumber: dto.plateNumber,
        passengerCapacity: dto.passengerCapacity ?? 4,
        language: dto.language ?? 'en',
        status: DriverStatus.INACTIVE,
      });
      const saved = await this.driversRepo.save(created);
      return DriverProfileResponseDto.from(saved);
    } catch (err) {
      if (
        err instanceof QueryFailedError &&
        (err as { code?: string }).code === '23505'
      ) {
        throw new ConflictException(
          I18nContext.current()?.t('admin.Phone already registered'),
        );
      }
      throw err;
    }
  }

  async update(
    id: number,
    dto: UpdateDriverDto,
  ): Promise<DriverProfileResponseDto> {
    const driver = await this.driversRepo.findOne({ where: { id } });
    if (!driver) {
      throw new NotFoundException(
        I18nContext.current()?.t('driver.Not found'),
      );
    }
    await this.driversRepo.update(id, dto);
    const updated = await this.driversRepo.findOne({ where: { id } });
    return DriverProfileResponseDto.from(updated as Driver);
  }

  async suspend(id: number): Promise<DriverProfileResponseDto> {
    const driver = await this.driversRepo.findOne({ where: { id } });
    if (!driver) {
      throw new NotFoundException(
        I18nContext.current()?.t('driver.Not found'),
      );
    }
    if (driver.status === DriverStatus.ON_TRIP) {
      throw new BadRequestException(
        I18nContext.current()?.t('admin.Cannot suspend on trip'),
      );
    }
    await this.driversRepo.update(id, {
      status: DriverStatus.SUSPENDED,
      // Invalidate refresh token so the driver is logged out next request
      refreshToken: null as unknown as string,
    });
    const updated = await this.driversRepo.findOne({ where: { id } });
    return DriverProfileResponseDto.from(updated as Driver);
  }

  async reinstate(id: number): Promise<DriverProfileResponseDto> {
    const driver = await this.driversRepo.findOne({ where: { id } });
    if (!driver) {
      throw new NotFoundException(
        I18nContext.current()?.t('driver.Not found'),
      );
    }
    if (driver.status !== DriverStatus.SUSPENDED) {
      throw new BadRequestException(
        I18nContext.current()?.t('admin.Not suspended'),
      );
    }
    await this.driversRepo.update(id, { status: DriverStatus.INACTIVE });
    const updated = await this.driversRepo.findOne({ where: { id } });
    return DriverProfileResponseDto.from(updated as Driver);
  }
}
