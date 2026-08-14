import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { EscalationCase } from '../../assignment/entities/escalation-case.entity';
import { TripRequest } from '../../trips/entities/trip-request.entity';
import {
  EscalationItemDto,
  ListEscalationsQueryDto,
  ListEscalationsResponseDto,
} from './dto/list-escalations.dto';

/**
 * Ops read-only surface for escalations (master spec §9.7). Full
 * dashboard UI is a later PR; this ships the list endpoint + counts
 * so the on-call rota can watch the queue via a REST call.
 */
@Injectable()
export class AdminEscalationsService {
  constructor(
    @InjectRepository(EscalationCase)
    private readonly escalationsRepo: Repository<EscalationCase>,
    @InjectRepository(TripRequest)
    private readonly requestsRepo: Repository<TripRequest>,
  ) {}

  async list(
    query: ListEscalationsQueryDto,
  ): Promise<ListEscalationsResponseDto> {
    const filter = query.filter ?? 'open';
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: Record<string, unknown> = {};
    if (filter === 'open') where.resolvedAt = IsNull();
    if (filter === 'resolved') where.resolvedAt = Not(IsNull());

    const [rows, total] = await this.escalationsRepo.findAndCount({
      where,
      relations: ['tripGroup', 'tripGroup.originCity', 'tripGroup.destCity'],
      order: { id: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    // Batch fetch member counts per group so we don't N+1.
    const groupIds = rows.map((r) => r.tripGroup.id);
    const counts = groupIds.length
      ? await this.requestsRepo
          .createQueryBuilder('r')
          .select('r.tripGroupId', 'gid')
          .addSelect('COUNT(*)::int', 'n')
          .where('r.tripGroupId IN (:...ids)', { ids: groupIds })
          .groupBy('r.tripGroupId')
          .getRawMany<{ gid: number; n: number }>()
      : [];
    const countByGroup = new Map(counts.map((c) => [Number(c.gid), c.n]));

    const data: EscalationItemDto[] = rows.map((r) => ({
      id: r.id,
      tripGroupId: r.tripGroup.id,
      originCity: r.tripGroup.originCity?.nameEn ?? '',
      destinationCity: r.tripGroup.destCity?.nameEn ?? '',
      departureTime: r.tripGroup.departureTime.toISOString(),
      passengerCount: countByGroup.get(r.tripGroup.id) ?? 0,
      womenOnly: r.tripGroup.womenOnly,
      escalatedAt: r.escalatedAt.toISOString(),
      resolvedAt: r.resolvedAt?.toISOString() ?? null,
      resolutionNotes: r.resolutionNotes,
    }));

    return { data, total, page, limit };
  }
}
