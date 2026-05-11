import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { I18nContext } from 'nestjs-i18n';
import {
  PASSENGER_NOTIFICATION_CATEGORY,
  PassengerNotificationCategory,
  PassengerNotificationType,
} from '../../shared/enums/passenger-notification-type.enum';
import { PassengerNotification } from './passenger-notification.entity';
import { User } from '../../users/user.entity';
import {
  ListPassengerNotificationsQueryDto,
  ListPassengerNotificationsResponseDto,
  PassengerNotificationItemDto,
} from './dto/list-passenger-notifications.dto';
import { MarkPassengerReadDto } from './dto/mark-passenger-read.dto';

interface CreatePassengerNotificationInput {
  userId: number;
  type: PassengerNotificationType;
  titleEn: string;
  titleAr: string;
  bodyEn: string;
  bodyAr: string;
  payload?: Record<string, unknown>;
}

@Injectable()
export class PassengerNotificationsService {
  constructor(
    @InjectRepository(PassengerNotification)
    private readonly notificationsRepo: Repository<PassengerNotification>,
  ) {}

  // ─── Emission API (called from trip / package services) ────
  async emit(
    input: CreatePassengerNotificationInput,
  ): Promise<PassengerNotification> {
    const entity = this.notificationsRepo.create({
      user: { id: input.userId } as User,
      type: input.type,
      titleEn: input.titleEn,
      titleAr: input.titleAr,
      bodyEn: input.bodyEn,
      bodyAr: input.bodyAr,
      payload: input.payload,
      read: false,
    });
    return this.notificationsRepo.save(entity);
  }

  // ─── Read API ──────────────────────────────────────────────
  async list(
    userId: number,
    query: ListPassengerNotificationsQueryDto,
  ): Promise<ListPassengerNotificationsResponseDto> {
    const filter = query.filter ?? 'all';
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { user: { id: userId } };
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
      where: { user: { id: userId }, read: false },
    });

    const lang =
      (I18nContext.current()?.lang ?? 'en') === 'ar' ? 'ar' : 'en';

    const data: PassengerNotificationItemDto[] = rows.map((n) => ({
      id: n.id,
      type: n.type,
      category: PASSENGER_NOTIFICATION_CATEGORY[n.type],
      title: lang === 'ar' ? n.titleAr : n.titleEn,
      body: lang === 'ar' ? n.bodyAr : n.bodyEn,
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
    userId: number,
    dto: MarkPassengerReadDto,
  ): Promise<{ updated: number }> {
    if (dto.all) {
      const result = await this.notificationsRepo
        .createQueryBuilder()
        .update(PassengerNotification)
        .set({ read: true })
        .where('userId = :userId AND read = false', { userId })
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
      .update(PassengerNotification)
      .set({ read: true })
      .where('userId = :userId AND id IN (:...ids)', {
        userId,
        ids: dto.notificationIds,
      })
      .execute();
    return { updated: result.affected ?? 0 };
  }

  private typesForCategory(
    category: PassengerNotificationCategory,
  ): PassengerNotificationType[] {
    return Object.entries(PASSENGER_NOTIFICATION_CATEGORY)
      .filter(([, c]) => c === category)
      .map(([t]) => t as PassengerNotificationType);
  }
}
