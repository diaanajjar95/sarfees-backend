import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PackageDelivery } from '../packages/entities/package-delivery.entity';
import { PackageStatus } from '../shared/enums/package-status.enum';

/**
 * Anonymous receiver tracking — no auth, no map, no PII beyond what
 * the receiver already knows. The token is unguessable (96-bit hex)
 * and shared with the receiver over WhatsApp.
 */
@ApiTags('Public — Package Tracking')
@Controller('track')
export class TrackingController {
  constructor(
    @InjectRepository(PackageDelivery)
    private readonly packagesRepo: Repository<PackageDelivery>,
  ) {}

  @ApiOperation({ summary: 'Track a package by its anonymous token' })
  @Get(':token')
  async track(@Param('token') token: string) {
    const clean = token.replace(/[^a-f0-9]/gi, '');
    const pkg = clean
      ? await this.packagesRepo.findOne({
          where: { trackingToken: clean },
          relations: ['departureCity', 'arrivalCity'],
        })
      : null;
    if (!pkg) throw new NotFoundException('Unknown tracking code');

    const order: PackageStatus[] = [
      PackageStatus.PENDING,
      PackageStatus.MATCHED,
      PackageStatus.PICKED_UP,
      PackageStatus.DELIVERED,
    ];
    const reachedIdx =
      pkg.status === PackageStatus.CANCELLED
        ? -1
        : order.indexOf(
            pkg.status === PackageStatus.IN_TRANSIT
              ? PackageStatus.PICKED_UP
              : pkg.status,
          );

    return {
      status: pkg.status,
      packageSize: pkg.packageSize,
      from: pkg.departureCity?.nameEn ?? null,
      fromAr: pkg.departureCity?.nameAr ?? null,
      to: pkg.arrivalCity?.nameEn ?? null,
      toAr: pkg.arrivalCity?.nameAr ?? null,
      receiverName: pkg.receiverName,
      cancelled: pkg.status === PackageStatus.CANCELLED,
      updatedAt: pkg.updatedAt,
      steps: [
        { key: 'requested', labelEn: 'Requested', labelAr: 'تم الطلب', done: reachedIdx >= 0 },
        { key: 'driver_assigned', labelEn: 'Driver assigned', labelAr: 'تم تعيين سائق', done: reachedIdx >= 1 },
        { key: 'on_the_way', labelEn: 'On the way', labelAr: 'في الطريق', done: reachedIdx >= 2 },
        { key: 'delivered', labelEn: 'Delivered', labelAr: 'تم التسليم', done: reachedIdx >= 3 },
      ],
    };
  }
}
