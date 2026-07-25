import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { PackageDelivery } from '../../packages/entities/package-delivery.entity';
import { TripRequest } from '../../trips/entities/trip-request.entity';
import { TripGroup } from '../../grouping/entities/trip-group.entity';
import { PackageStatus } from '../../shared/enums/package-status.enum';
import { TripStatus } from '../../shared/enums/trip-status.enum';
import { TripGroupStatus } from '../../shared/enums/trip-group-status.enum';
import {
  AdminPackageRowDto,
  ListAdminPackagesQueryDto,
  ListAdminPackagesResponseDto,
} from './dto/list-admin-packages.dto';

const OPEN_STATUSES: PackageStatus[] = [
  PackageStatus.PENDING,
  PackageStatus.MATCHED,
  PackageStatus.PICKED_UP,
  PackageStatus.IN_TRANSIT,
];

@Injectable()
export class AdminPackagesService {
  private readonly logger = new Logger(AdminPackagesService.name);

  constructor(
    @InjectRepository(PackageDelivery)
    private readonly repo: Repository<PackageDelivery>,
    @InjectRepository(TripRequest)
    private readonly requestsRepo: Repository<TripRequest>,
    @InjectRepository(TripGroup)
    private readonly groupsRepo: Repository<TripGroup>,
  ) {}

  async list(
    query: ListAdminPackagesQueryDto,
  ): Promise<ListAdminPackagesResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.repo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.sender', 's')
      .leftJoinAndSelect('p.departureCity', 'dc')
      .leftJoinAndSelect('p.arrivalCity', 'ac')
      .leftJoinAndSelect('p.tripGroup', 'g')
      .orderBy('p.id', 'DESC');

    if (query.status) qb.where('p.status = :st', { st: query.status });

    const [rows, totalItems] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const openCount = await this.repo.count({
      where: { status: In(OPEN_STATUSES) },
    });

    return {
      data: rows.map((p) => this.toRow(p)),
      page,
      limit,
      totalItems,
      totalPages: Math.max(1, Math.ceil(totalItems / limit)),
      openCount,
    };
  }

  async detail(id: number): Promise<AdminPackageRowDto> {
    const p = await this.repo.findOne({
      where: { id },
      relations: ['sender', 'departureCity', 'arrivalCity', 'tripGroup'],
    });
    if (!p) throw new NotFoundException('Package delivery not found');
    return this.toRow(p);
  }

  /**
   * Ops cancel with audit trail. Terminal states rejected; PICKED_UP /
   * IN_TRANSIT blocked too — once the parcel is physically with the
   * driver, ops resolves by phone, not by button. If the delivery's
   * trip group has no other live members, the group is closed as well.
   */
  async cancel(
    id: number,
    adminId: number,
    reason: string,
  ): Promise<{ id: number; status: PackageStatus }> {
    const p = await this.repo.findOne({ where: { id }, relations: ['tripGroup'] });
    if (!p) throw new NotFoundException('Package delivery not found');

    if (
      p.status === PackageStatus.DELIVERED ||
      p.status === PackageStatus.CANCELLED
    ) {
      throw new BadRequestException(
        `Delivery is already ${p.status.toLowerCase()} — nothing to cancel.`,
      );
    }
    if (
      p.status === PackageStatus.PICKED_UP ||
      p.status === PackageStatus.IN_TRANSIT
    ) {
      throw new BadRequestException(
        'The parcel is already with the driver — resolve directly with the driver instead of cancelling.',
      );
    }

    p.status = PackageStatus.CANCELLED;
    p.cancellationReason = reason;
    p.cancelledByAdminId = adminId;
    await this.repo.save(p);

    // Close the group too when this was its last live member.
    const group = p.tripGroup;
    if (group && !['completed', 'cancelled'].includes(group.status)) {
      const liveRequests = await this.requestsRepo.count({
        where: {
          tripGroup: { id: group.id },
          status: In([
            TripStatus.PENDING,
            TripStatus.MATCHED,
            TripStatus.DRIVER_EN_ROUTE,
            TripStatus.ARRIVED_AT_PICKUP,
            TripStatus.TRIP_IN_PROGRESS,
            TripStatus.ARRIVING_AT_DROPOFF,
          ]),
        },
      });
      const livePackages = await this.repo.count({
        where: { tripGroup: { id: group.id }, status: In(OPEN_STATUSES) },
      });
      if (liveRequests === 0 && livePackages === 0) {
        await this.groupsRepo.update(group.id, {
          status: TripGroupStatus.CANCELLED,
        });
        this.logger.log(
          `Group #${group.id} closed — package #${id} was its last live member`,
        );
      }
    }

    this.logger.log(`Admin #${adminId} cancelled package #${id}: ${reason}`);
    return { id: p.id, status: p.status };
  }

  private toRow(p: PackageDelivery): AdminPackageRowDto {
    const sender = p.sender;
    const senderName = sender
      ? [sender.firstName, sender.lastName].filter(Boolean).join(' ').trim() ||
        `User #${sender.id}`
      : '—';
    return {
      id: p.id,
      status: p.status,
      senderName,
      senderPhone: sender
        ? `${sender.countryCode ?? ''} ${sender.phoneNumber ?? ''}`.trim()
        : '—',
      receiverName: p.receiverName,
      receiverPhone: p.receiverPhone,
      departureCity: p.departureCity?.nameEn ?? null,
      arrivalCity: p.arrivalCity?.nameEn ?? null,
      pickupLat: p.pickupLocation?.lat ?? 0,
      pickupLng: p.pickupLocation?.lng ?? 0,
      dropOffLat: p.dropOffLocation?.lat ?? 0,
      dropOffLng: p.dropOffLocation?.lng ?? 0,
      packageSize: p.packageSize,
      weightKg: p.weightKg != null ? Number(p.weightKg) : null,
      packageDescription: p.packageDescription ?? null,
      urgent: p.urgent,
      isImmediate: p.isImmediate,
      pickupDate: p.pickupDate ?? null,
      deliveryFee: Number(p.deliveryFee),
      tripGroupId: p.tripGroup?.id ?? null,
      cancellationReason: p.cancellationReason ?? null,
      createdAt: p.createdAt,
    };
  }
}
