import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../users/user.entity';
import { TripRequest } from '../../trips/entities/trip-request.entity';
import { Rating } from '../../ratings/entities/rating.entity';
import { RaterType } from '../../shared/enums/rating.enum';
import { TripStatus } from '../../shared/enums/trip-status.enum';

@Injectable()
export class AdminCustomersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    @InjectRepository(TripRequest)
    private readonly requestsRepo: Repository<TripRequest>,
    @InjectRepository(Rating)
    private readonly ratingsRepo: Repository<Rating>,
  ) {}

  async list(page: number, limit: number, search?: string) {
    const qb = this.usersRepo
      .createQueryBuilder('u')
      .orderBy('u.id', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (search?.trim()) {
      const term = `%${search.trim()}%`;
      qb.where(
        "u.phoneNumber ILIKE :term OR CONCAT_WS(' ', u.firstName, u.lastName) ILIKE :term",
        { term },
      );
    }

    const [users, totalItems] = await qb.getManyAndCount();

    // One grouped query for per-customer trip counts on this page.
    const ids = users.map((u) => u.id);
    const counts = ids.length
      ? await this.requestsRepo
          .createQueryBuilder('r')
          .select('r.passengerId', 'passengerId')
          .addSelect('COUNT(*)', 'total')
          .addSelect(
            `COUNT(*) FILTER (WHERE r.status = :done)`,
            'completed',
          )
          .where('r.passengerId IN (:...ids)', { ids })
          .setParameter('done', TripStatus.COMPLETED)
          .groupBy('r.passengerId')
          .getRawMany<{ passengerId: number; total: string; completed: string }>()
      : [];
    const countByUser = new Map(
      counts.map((c) => [Number(c.passengerId), c]),
    );

    return {
      data: users.map((u) => ({
        id: u.id,
        name:
          `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || null,
        countryCode: u.countryCode,
        phoneNumber: u.phoneNumber,
        gender: u.gender,
        rating: Number(u.rating),
        ratingCount: u.ratingCount,
        totalTrips: Number(countByUser.get(u.id)?.total ?? 0),
        completedTrips: Number(countByUser.get(u.id)?.completed ?? 0),
        isProfileCompleted: u.isProfileCompleted,
        createdAt: u.createdAt,
      })),
      page,
      limit,
      totalItems,
      totalPages: Math.max(1, Math.ceil(totalItems / limit)),
    };
  }

  async detail(userId: number) {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Customer not found');

    const requests = await this.requestsRepo.find({
      where: { passenger: { id: userId } },
      relations: [
        'departureCity',
        'arrivalCity',
        'tripGroup',
        'tripGroup.assignedDriver',
      ],
      order: { id: 'DESC' },
      take: 50,
    });

    // Ratings in both directions, most recent first.
    const ratings = await this.ratingsRepo.find({
      where: { passenger: { id: userId } },
      relations: ['driver'],
      order: { id: 'DESC' },
      take: 50,
    });
    const received = ratings.filter((r) => r.raterType === RaterType.DRIVER);
    const given = ratings.filter((r) => r.raterType === RaterType.PASSENGER);

    const toRatingRow = (r: Rating) => ({
      id: r.id,
      tripRequestId: r.tripRequestId,
      packageDeliveryId: r.packageDeliveryId,
      driverName: r.driver?.name ?? null,
      level: r.level,
      value: r.value,
      comment: r.message,
      createdAt: r.createdAt,
    });

    return {
      id: user.id,
      name:
        `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || null,
      countryCode: user.countryCode,
      phoneNumber: user.phoneNumber,
      email: user.email,
      gender: user.gender,
      rating: Number(user.rating),
      ratingCount: user.ratingCount,
      isProfileCompleted: user.isProfileCompleted,
      createdAt: user.createdAt,
      trips: requests.map((r) => ({
        id: r.id,
        route: `${r.departureCity?.nameEn ?? '?'} → ${r.arrivalCity?.nameEn ?? '?'}`,
        status: r.status,
        travelDate: r.travelDate,
        seats: r.seatsCount,
        totalFare: Number(r.totalFare),
        driverName: r.tripGroup?.assignedDriver?.name ?? null,
        createdAt: r.createdAt,
      })),
      ratingsReceived: received.map(toRatingRow),
      ratingsGiven: given.map(toRatingRow),
    };
  }
}
