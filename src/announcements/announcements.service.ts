import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, IsNull, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import { Announcement } from './announcement.entity';
import {
  AnnouncementResponseDto,
  CreateAnnouncementDto,
  UpdateAnnouncementDto,
} from './dto/announcement.dto';

@Injectable()
export class AnnouncementsService {
  constructor(
    @InjectRepository(Announcement)
    private readonly repo: Repository<Announcement>,
  ) {}

  /** Active announcements within their schedule window, highest priority first. */
  async listActive(): Promise<AnnouncementResponseDto[]> {
    const now = new Date();
    const rows = await this.repo
      .createQueryBuilder('a')
      .where('a.isActive = true')
      .andWhere(
        new Brackets((b) =>
          b.where('a.startsAt IS NULL').orWhere('a.startsAt <= :now', { now }),
        ),
      )
      .andWhere(
        new Brackets((b) =>
          b.where('a.endsAt IS NULL').orWhere('a.endsAt >= :now', { now }),
        ),
      )
      .orderBy('a.priority', 'DESC')
      .addOrderBy('a.createdAt', 'DESC')
      .getMany();
    void IsNull;
    void LessThanOrEqual;
    void MoreThanOrEqual;
    return rows.map(AnnouncementResponseDto.from);
  }

  async listAll(): Promise<AnnouncementResponseDto[]> {
    const rows = await this.repo.find({
      order: { priority: 'DESC', createdAt: 'DESC' },
    });
    return rows.map(AnnouncementResponseDto.from);
  }

  async create(
    dto: CreateAnnouncementDto,
    createdById: number,
  ): Promise<AnnouncementResponseDto> {
    const created = this.repo.create({
      title: dto.title,
      body: dto.body,
      ctaUrl: dto.ctaUrl,
      isActive: dto.isActive ?? true,
      startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
      endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined,
      priority: dto.priority ?? 0,
      createdBy: { id: createdById } as { id: number } as never,
    });
    const saved = await this.repo.save(created);
    return AnnouncementResponseDto.from(saved);
  }

  async update(
    id: number,
    dto: UpdateAnnouncementDto,
  ): Promise<AnnouncementResponseDto> {
    const existing = await this.repo.findOne({ where: { id } });
    if (!existing) throw new NotFoundException('Announcement not found');
    await this.repo.update(id, {
      ...dto,
      startsAt: dto.startsAt ? new Date(dto.startsAt) : existing.startsAt,
      endsAt: dto.endsAt ? new Date(dto.endsAt) : existing.endsAt,
    });
    const refreshed = await this.repo.findOne({ where: { id } });
    return AnnouncementResponseDto.from(refreshed as Announcement);
  }

  async remove(id: number): Promise<{ id: number }> {
    const existing = await this.repo.findOne({ where: { id } });
    if (!existing) throw new NotFoundException('Announcement not found');
    await this.repo.delete(id);
    return { id };
  }
}
