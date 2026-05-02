import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TripRequest } from '../../trips/entities/trip-request.entity';
import { TripStatus } from '../../shared/enums/trip-status.enum';
import {
  ListPassengerRequestsQueryDto,
  ListPassengerRequestsResponseDto,
  PassengerRequestRowDto,
} from './dto/list-passenger-requests.dto';

@Injectable()
export class AdminPassengerRequestsService {
  constructor(
    @InjectRepository(TripRequest)
    private readonly repo: Repository<TripRequest>,
  ) {}

  async list(
    query: ListPassengerRequestsQueryDto,
  ): Promise<ListPassengerRequestsResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const qb = this.repo
      .createQueryBuilder('t')
      .leftJoin('t.passenger', 'p')
      .leftJoin('t.departureCity', 'dc')
      .leftJoin('t.arrivalCity', 'ac')
      .leftJoin('t.driver', 'd')
      .addSelect([
        'p.id',
        'p.firstName',
        'p.lastName',
        'p.phoneNumber',
        'p.countryCode',
        'p.gender',
        'dc.id',
        'dc.nameEn',
        'ac.id',
        'ac.nameEn',
        'd.id',
        'd.name',
      ])
      .orderBy('t.createdAt', 'DESC');

    if (query.status) qb.andWhere('t.status = :s', { s: query.status });
    if (query.fromDate)
      qb.andWhere('t.createdAt >= :fd', { fd: new Date(query.fromDate) });
    if (query.toDate)
      qb.andWhere('t.createdAt <= :td', { td: new Date(query.toDate) });

    const [rows, totalItems] = await qb
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    const pendingCount = await this.repo.count({
      where: { status: TripStatus.PENDING },
    });

    const totalPages = Math.max(1, Math.ceil(totalItems / limit));

    return {
      data: rows.map((r) => this.toRow(r)),
      page,
      limit,
      totalItems,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
      pendingCount,
    };
  }

  async detail(id: number): Promise<PassengerRequestRowDto> {
    const r = await this.repo.findOne({
      where: { id },
      relations: ['passenger', 'departureCity', 'arrivalCity', 'driver'],
    });
    if (!r) throw new NotFoundException('Trip request not found');
    return this.toRow(r);
  }

  private toRow(t: TripRequest): PassengerRequestRowDto {
    const passenger = t.passenger;
    const fullName = passenger
      ? [passenger.firstName, passenger.lastName].filter(Boolean).join(' ').trim()
      : '';
    return {
      id: t.id,
      status: t.status,
      passengerName: fullName || `#${passenger?.id ?? '?'}`,
      passengerPhone: passenger
        ? `${passenger.countryCode ?? ''} ${passenger.phoneNumber ?? ''}`.trim()
        : '',
      passengerGender: passenger?.gender ?? null,
      departureCity: t.departureCity?.nameEn ?? null,
      arrivalCity: t.arrivalCity?.nameEn ?? null,
      departureLat: t.departureLocation?.lat ?? 0,
      departureLng: t.departureLocation?.lng ?? 0,
      arrivalLat: t.arrivalLocation?.lat ?? 0,
      arrivalLng: t.arrivalLocation?.lng ?? 0,
      travelDate: t.travelDate ?? null,
      isImmediate: t.isImmediate,
      seatsCount: t.seatsCount,
      isFemaleOnly: t.isFemaleOnly,
      perSeatFare: Number(t.perSeatFare),
      totalFare: Number(t.totalFare),
      driverId: t.driver?.id ?? null,
      driverName: t.driver?.name ?? null,
      createdAt: t.createdAt,
    };
  }
}
