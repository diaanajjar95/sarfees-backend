import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { TripGroup } from '../../grouping/entities/trip-group.entity';
import { TripRequest } from '../../trips/entities/trip-request.entity';
import { TripGroupStatus } from '../../shared/enums/trip-group-status.enum';
import {
  ListTripGroupsQueryDto,
  ListTripGroupsResponseDto,
  TripGroupRowDto,
} from './dto/list-trip-groups.dto';

/**
 * "Waiting for a driver" = every pre-assignment state, including the
 * escalated ones ops most urgently needs to see. Master spec §11.
 */
const UNASSIGNED_STATUSES: TripGroupStatus[] = [
  TripGroupStatus.OPEN,
  TripGroupStatus.FROZEN,
  TripGroupStatus.OFFERING,
  TripGroupStatus.BROADCASTING,
  TripGroupStatus.UNSERVED_ESCALATION,
];

const DRIVER_SEARCH_LEAD_MS = 30 * 60 * 1000;

@Injectable()
export class AdminTripGroupsService {
  constructor(
    @InjectRepository(TripGroup)
    private readonly groupsRepo: Repository<TripGroup>,
    @InjectRepository(TripRequest)
    private readonly requestsRepo: Repository<TripRequest>,
  ) {}

  async list(query: ListTripGroupsQueryDto): Promise<ListTripGroupsResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const statusFilter = query.status ?? 'unassigned';

    const qb = this.groupsRepo
      .createQueryBuilder('g')
      .leftJoinAndSelect('g.originCity', 'oc')
      .leftJoinAndSelect('g.destCity', 'dc');

    if (statusFilter === 'unassigned') {
      qb.where('g.status IN (:...sts)', { sts: UNASSIGNED_STATUSES });
    } else if (statusFilter !== 'all') {
      qb.where('g.status = :st', { st: statusFilter });
    }
    // Portal-wide convention: newest records first.
    qb.orderBy('g.id', 'DESC');

    const [rows, totalItems] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    // One query for all members of the page's groups.
    const groupIds = rows.map((g) => g.id);
    const members = groupIds.length
      ? await this.requestsRepo.find({
          where: { tripGroup: { id: In(groupIds) } },
          relations: ['tripGroup', 'passenger'],
          order: { id: 'ASC' },
        })
      : [];
    const byGroup = new Map<number, TripRequest[]>();
    for (const m of members) {
      const gid = m.tripGroup?.id;
      if (!gid) continue;
      if (!byGroup.has(gid)) byGroup.set(gid, []);
      byGroup.get(gid)!.push(m);
    }

    const data: TripGroupRowDto[] = rows.map((g) => {
      const reqs = byGroup.get(g.id) ?? [];
      return {
        id: g.id,
        status: g.status,
        originCity: g.originCity?.nameEn ?? '—',
        destCity: g.destCity?.nameEn ?? '—',
        departureTime: g.departureTime,
        driverSearchAt: new Date(
          g.departureTime.getTime() - DRIVER_SEARCH_LEAD_MS,
        ),
        frozenAt: g.frozenAt,
        womenOnly: g.womenOnly,
        fullCar: g.fullCar,
        urgent: g.urgent,
        totalSeats: reqs.reduce((sum, r) => sum + (r.seatsCount ?? 0), 0),
        memberCount: reqs.length,
        members: reqs.map((r) => ({
          requestId: r.id,
          passengerName:
            [r.passenger?.firstName, r.passenger?.lastName]
              .filter(Boolean)
              .join(' ') || `User #${r.passenger?.id ?? '?'}`,
          passengerPhone: r.passenger
            ? `${r.passenger.countryCode ?? ''} ${r.passenger.phoneNumber}`.trim()
            : '—',
          seatsCount: r.seatsCount,
          requestStatus: r.status,
        })),
        createdAt: g.createdAt,
      };
    });

    const unassignedCount = await this.groupsRepo.count({
      where: { status: In(UNASSIGNED_STATUSES) },
    });

    return {
      data,
      page,
      limit,
      totalItems,
      totalPages: Math.max(1, Math.ceil(totalItems / limit)),
      unassignedCount,
    };
  }
}
