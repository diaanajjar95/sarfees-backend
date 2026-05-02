import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { I18nContext } from 'nestjs-i18n';
import { DriverTrip } from '../../driver-trips/entities/driver-trip.entity';
import {
  AdminTripRowDto,
  ListAdminTripsQueryDto,
  ListAdminTripsResponseDto,
} from './dto/list-admin-trips.dto';
import { ManifestResponseDto } from '../../driver-trips/dto/manifest.dto';
import { DriverTripsService } from '../../driver-trips/driver-trips.service';

@Injectable()
export class AdminTripsService {
  constructor(
    @InjectRepository(DriverTrip)
    private readonly tripsRepo: Repository<DriverTrip>,
    private readonly driverTripsService: DriverTripsService,
  ) {}

  async list(query: ListAdminTripsQueryDto): Promise<ListAdminTripsResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const qb = this.tripsRepo
      .createQueryBuilder('t')
      .leftJoin('t.driver', 'd')
      .addSelect(['d.id', 'd.name'])
      .orderBy('t.departureTime', 'DESC');

    if (query.status) qb.andWhere('t.status = :s', { s: query.status });
    if (query.type) qb.andWhere('t.type = :tp', { tp: query.type });
    if (query.driverId) qb.andWhere('d.id = :did', { did: query.driverId });
    if (query.originCity)
      qb.andWhere('LOWER(t.originCity) = LOWER(:oc)', { oc: query.originCity });
    if (query.destinationCity)
      qb.andWhere('LOWER(t.destinationCity) = LOWER(:dc)', {
        dc: query.destinationCity,
      });
    if (query.fromDate)
      qb.andWhere('t.departureTime >= :fd', { fd: new Date(query.fromDate) });
    if (query.toDate)
      qb.andWhere('t.departureTime <= :td', { td: new Date(query.toDate) });

    const [rows, totalItems] = await qb
      .skip(skip)
      .take(limit)
      .getManyAndCount();
    const totalPages = Math.max(1, Math.ceil(totalItems / limit));

    const data: AdminTripRowDto[] = rows.map((t) => ({
      id: t.id,
      status: t.status,
      type: t.type,
      originCity: t.originCity,
      destinationCity: t.destinationCity,
      departureTime: t.departureTime,
      driverId: t.driver?.id ?? null,
      driverName: t.driver?.name ?? null,
      totalCashExpected: Number(t.totalCashExpected),
      totalCashCollected: Number(t.totalCashCollected),
      netEarnings: t.netEarnings != null ? Number(t.netEarnings) : null,
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

  /** Reuses the driver-side manifest builder so admins see the same data. */
  async detail(tripId: number): Promise<ManifestResponseDto> {
    const trip = await this.tripsRepo.findOne({ where: { id: tripId } });
    if (!trip) {
      throw new NotFoundException(
        I18nContext.current()?.t('driver-trip.Not found'),
      );
    }
    // The DriverTripsService.buildManifest helper isn't exported; the service
    // exposes getManifest(driverId, tripId) which validates ownership. To
    // sidestep that for admin reads we call its lower-level helper through
    // the existing public method by passing the trip's actual driver id.
    if (!trip['driver']) {
      // Driver might not be loaded — fetch once with relation.
      const withDriver = await this.tripsRepo.findOne({
        where: { id: tripId },
        relations: ['driver'],
      });
      if (!withDriver?.driver) {
        throw new NotFoundException('Trip has no assigned driver');
      }
      return this.driverTripsService.getManifest(withDriver.driver.id, tripId);
    }
    return this.driverTripsService.getManifest(trip['driver'].id as number, tripId);
  }
}
