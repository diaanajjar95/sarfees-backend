import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  DriverNotificationCategory,
  DriverNotificationType,
  NOTIFICATION_CATEGORY,
} from '../shared/enums/driver-notification-type.enum';
import { DriverNotification } from './driver-notification.entity';
import { Driver } from '../drivers/driver.entity';
import {
  ListNotificationsQueryDto,
  ListNotificationsResponseDto,
  NotificationItemDto,
} from './dto/list-notifications.dto';
import { MarkReadDto } from './dto/mark-read.dto';

interface CreateNotificationInput {
  driverId: number;
  type: DriverNotificationType;
  title: string;
  body: string;
  payload?: Record<string, unknown>;
}

@Injectable()
export class DriverNotificationsService {
  constructor(
    @InjectRepository(DriverNotification)
    private readonly notificationsRepo: Repository<DriverNotification>,
  ) {}

  // ─── Emission API (called from other services) ─────────────
  async emit(input: CreateNotificationInput): Promise<DriverNotification> {
    const entity = this.notificationsRepo.create({
      driver: { id: input.driverId } as Driver,
      type: input.type,
      title: input.title,
      body: input.body,
      payload: input.payload,
      read: false,
    });
    return this.notificationsRepo.save(entity);
  }

  // ─── Read API ──────────────────────────────────────────────
  async list(
    driverId: number,
    query: ListNotificationsQueryDto,
  ): Promise<ListNotificationsResponseDto> {
    const filter = query.filter ?? 'all';
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { driver: { id: driverId } };
    if (filter !== 'all') {
      where.type = In(this.typesForCategory(filter));
    }

    const [rows, totalItems] = await this.notificationsRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });
    const totalPages = Math.max(1, Math.ceil(totalItems / limit));

    const unreadCount = await this.notificationsRepo.count({
      where: { driver: { id: driverId }, read: false },
    });

    const data: NotificationItemDto[] = rows.map((n) => ({
      id: n.id,
      type: n.type,
      category: NOTIFICATION_CATEGORY[n.type],
      title: n.title,
      body: n.body,
      read: n.read,
      createdAt: n.createdAt,
      payload: (n.payload as Record<string, unknown> | null) ?? null,
    }));

    return {
      data,
      unreadCount,
      page,
      limit,
      totalItems,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    };
  }

  async markRead(
    driverId: number,
    dto: MarkReadDto,
  ): Promise<{ updated: number }> {
    if (dto.all) {
      const result = await this.notificationsRepo
        .createQueryBuilder()
        .update(DriverNotification)
        .set({ read: true })
        .where('driverId = :driverId AND read = false', { driverId })
        .execute();
      return { updated: result.affected ?? 0 };
    }

    if (!dto.notificationIds || dto.notificationIds.length === 0) {
      throw new BadRequestException(
        'Provide notificationIds[] or set all=true',
      );
    }

    const result = await this.notificationsRepo
      .createQueryBuilder()
      .update(DriverNotification)
      .set({ read: true })
      .where('driverId = :driverId AND id IN (:...ids)', {
        driverId,
        ids: dto.notificationIds,
      })
      .execute();
    return { updated: result.affected ?? 0 };
  }

  private typesForCategory(
    category: DriverNotificationCategory,
  ): DriverNotificationType[] {
    return Object.entries(NOTIFICATION_CATEGORY)
      .filter(([, c]) => c === category)
      .map(([t]) => t as DriverNotificationType);
  }
}
