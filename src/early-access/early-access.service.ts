import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  EarlyAccessRole,
  EarlyAccessSignup,
} from './entities/early-access-signup.entity';
import { CreateEarlyAccessSignupDto } from './dto/create-early-access-signup.dto';
import {
  ListEarlyAccessQueryDto,
  ListEarlyAccessResponseDto,
} from './dto/list-early-access.dto';

@Injectable()
export class EarlyAccessService {
  constructor(
    @InjectRepository(EarlyAccessSignup)
    private readonly repo: Repository<EarlyAccessSignup>,
  ) {}

  async create(dto: CreateEarlyAccessSignupDto): Promise<{ id: number }> {
    const row = await this.repo.save(
      this.repo.create({
        role: dto.role,
        route: dto.route?.trim() || null,
        frequency: dto.frequency ?? null,
        travelTime: dto.travelTime ?? null,
        fairPriceJod: dto.fairPriceJod ?? null,
        findMethod: dto.findMethod ?? null,
        pilotWilling: dto.pilotWilling ?? null,
        phone: dto.phone?.trim() || null,
        locale: dto.locale ?? null,
      }),
    );
    return { id: row.id };
  }

  async list(
    query: ListEarlyAccessQueryDto,
  ): Promise<ListEarlyAccessResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const [rows, totalItems] = await this.repo.findAndCount({
      where: query.role ? { role: query.role } : {},
      order: { id: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const [passengerCount, driverCount] = await Promise.all([
      this.repo.count({ where: { role: EarlyAccessRole.PASSENGER } }),
      this.repo.count({ where: { role: EarlyAccessRole.DRIVER } }),
    ]);

    return {
      data: rows.map((r) => ({
        ...r,
        fairPriceJod: r.fairPriceJod === null ? null : Number(r.fairPriceJod),
      })),
      page,
      limit,
      totalItems,
      totalPages: Math.max(1, Math.ceil(totalItems / limit)),
      passengerCount,
      driverCount,
    };
  }
}
