import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, In, Repository } from 'typeorm';
import { PackageDelivery } from './entities/package-delivery.entity';
import { PackageSize } from '../shared/enums/package-size.enum';
import { PackageStatus } from '../shared/enums/package-status.enum';
import { EstimatePackageDto, CreatePackageDeliveryDto } from './dto/create-package-delivery.dto';
import { PaginationQueryDto, PaginatedResponse } from '../shared/dto/pagination-query.dto';
import { I18nContext } from 'nestjs-i18n';
import { Logger } from '@nestjs/common';
import { GroupingService } from '../grouping/grouping.service';
import { MatchingConfigService } from '../matching-config/matching-config.service';
import { TripRequest } from '../trips/entities/trip-request.entity';
import { TripGroup } from '../grouping/entities/trip-group.entity';
import { TripStatus } from '../shared/enums/trip-status.enum';
import { TripGroupStatus } from '../shared/enums/trip-group-status.enum';
import { randomBytes, randomInt } from 'crypto';

/**
 * Sender-facing "active" statuses: anything not delivered or cancelled. Mirrors
 * PASSENGER_ACTIVE_STATUSES on the trips side so the mobile app can show a live
 * delivery card from the moment the request is created.
 */
const ACTIVE_PACKAGE_STATUSES = [
  PackageStatus.PENDING,
  PackageStatus.MATCHED,
  PackageStatus.PICKED_UP,
  PackageStatus.IN_TRANSIT,
];

@Injectable()
export class PackagesService {
  private readonly feeBySize: Record<PackageSize, number> = {
    [PackageSize.SMALL]: 5.0,
    [PackageSize.MEDIUM]: 10.0,
    [PackageSize.LARGE]: 18.0,
  };

  private readonly logger = new Logger(PackagesService.name);

  constructor(
    @InjectRepository(PackageDelivery)
    private packagesRepository: Repository<PackageDelivery>,
    @InjectRepository(TripRequest)
    private readonly tripRequestsRepository: Repository<TripRequest>,
    @InjectRepository(TripGroup)
    private readonly tripGroupsRepository: Repository<TripGroup>,
    private readonly groupingService: GroupingService,
    private readonly matchingConfigService: MatchingConfigService,
  ) {}

  /**
   * §6.4.1 — the prohibited list shown on the request screen next to
   * the legal attestation. Ops can override via
   * matching_config.prohibitedItemsListJson; this is the default.
   */
  private static readonly DEFAULT_PROHIBITED_ITEMS = {
    en: [
      'Weapons or ammunition of any kind',
      'Drugs or controlled substances',
      'Flammable, explosive or hazardous materials',
      'Cash, jewellery or valuables above 100 JD',
      'Perishable food (v1)',
      'Live animals',
      'Anything illegal to possess or transport in Jordan',
    ],
    ar: [
      'الأسلحة أو الذخيرة بجميع أنواعها',
      'المخدرات أو المواد الخاضعة للرقابة',
      'المواد القابلة للاشتعال أو المتفجرة أو الخطرة',
      'النقود أو المجوهرات أو المقتنيات الثمينة التي تزيد قيمتها عن 100 دينار',
      'الأطعمة القابلة للتلف (المرحلة الأولى)',
      'الحيوانات الحية',
      'أي شيء يحظر القانون حيازته أو نقله في الأردن',
    ],
  };

  async prohibitedItems(): Promise<{ en: string[]; ar: string[] }> {
    const cfg = await this.matchingConfigService.getConfig();
    const fromConfig = cfg.prohibitedItemsListJson as {
      en?: string[];
      ar?: string[];
    } | null;
    if (fromConfig?.en?.length && fromConfig?.ar?.length) {
      return { en: fromConfig.en, ar: fromConfig.ar };
    }
    return PackagesService.DEFAULT_PROHIBITED_ITEMS;
  }

  /**
   * §6.7 — sender-initiated cancel. Free before a driver is assigned;
   * a cancellation fee applies after assignment but before pickup;
   * once the parcel is with the driver the app can't cancel — the
   * ops-coordinated return flow takes over (contact support).
   */
  async cancelDelivery(
    userId: number,
    id: number,
  ): Promise<{ id: number; status: PackageStatus; cancellationFeeApplies: boolean }> {
    const pkg = await this.packagesRepository.findOne({
      where: { id },
      relations: ['sender', 'tripGroup'],
    });
    if (!pkg) {
      throw new NotFoundException(
        I18nContext.current()?.t('packages.Not found'),
      );
    }
    if (pkg.sender?.id !== userId) {
      throw new ForbiddenException(
        I18nContext.current()?.t('packages.Not yours'),
      );
    }
    if (
      pkg.status === PackageStatus.DELIVERED ||
      pkg.status === PackageStatus.CANCELLED
    ) {
      throw new BadRequestException(
        I18nContext.current()?.t('packages.Already closed'),
      );
    }
    if (
      pkg.status === PackageStatus.PICKED_UP ||
      pkg.status === PackageStatus.IN_TRANSIT
    ) {
      throw new BadRequestException(
        I18nContext.current()?.t('packages.With driver'),
      );
    }

    // PENDING = free; MATCHED = fee flag for the pricing engine (§6.7).
    const cancellationFeeApplies = pkg.status === PackageStatus.MATCHED;
    pkg.status = PackageStatus.CANCELLED;
    pkg.cancellationReason = cancellationFeeApplies
      ? 'Sender cancelled after driver assignment (cancellation fee applies)'
      : 'Sender cancelled before assignment';
    await this.packagesRepository.save(pkg);

    // Close the group when this was its last live member.
    const group = pkg.tripGroup;
    if (group && !['completed', 'cancelled'].includes(group.status)) {
      const liveRequests = await this.tripRequestsRepository.count({
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
      const livePackages = await this.packagesRepository.count({
        where: {
          tripGroup: { id: group.id },
          status: In(ACTIVE_PACKAGE_STATUSES),
        },
      });
      if (liveRequests === 0 && livePackages === 0) {
        await this.tripGroupsRepository.update(group.id, {
          status: TripGroupStatus.CANCELLED,
        });
      }
    }

    this.logger.log(
      `Sender #${userId} cancelled package #${id} (feeApplies=${cancellationFeeApplies})`,
    );
    return { id: pkg.id, status: pkg.status, cancellationFeeApplies };
  }

  estimateFee(dto: EstimatePackageDto) {
    if (dto.departureCityId === dto.arrivalCityId) {
      throw new BadRequestException(
        I18nContext.current()?.t('packages.Same city'),
      );
    }

    const deliveryFee = this.feeBySize[dto.packageSize];
    const i18n = I18nContext.current();

    return {
      packageSize: dto.packageSize,
      deliveryFee,
      estimatedDelivery: i18n?.t('packages.Estimated delivery'),
      conditions: i18n?.t('packages.Conditions'),
    };
  }

  async createDelivery(userId: number, dto: CreatePackageDeliveryDto, photoPath?: string) {
    if (dto.departureCityId === dto.arrivalCityId) {
      throw new BadRequestException(
        I18nContext.current()?.t('packages.Same city'),
      );
    }

    if (!dto.termsAccepted) {
      throw new ForbiddenException(
        I18nContext.current()?.t('packages.Terms required'),
      );
    }

    // Pickup scheduling — full parity with TripsService.createRequest
    // so package groups behave exactly like passenger groups: an OPEN
    // joining window, freeze at T-30, cascade to a driver.
    let pickupDate: Date;
    if (dto.isImmediate) {
      // "Now" = inside the configured now-window (15–30 min), same as
      // trips. Departing literally NOW would be born past T-30 with
      // zero grouping window and an instant (usually doomed) cascade.
      const cfg = await this.matchingConfigService.getConfig();
      const nowWindowMidMin =
        (cfg.nowWindowMinMinutes + cfg.nowWindowMaxMinutes) / 2;
      pickupDate = new Date(Date.now() + nowWindowMidMin * 60 * 1000);
    } else {
      if (!dto.pickupDate) {
        throw new BadRequestException(
          I18nContext.current()?.t('packages.Pickup date required'),
        );
      }
      pickupDate = new Date(dto.pickupDate);
      const now = new Date();
      if (pickupDate < now) {
        throw new BadRequestException(
          I18nContext.current()?.t('packages.Past date'),
        );
      }
      // T-30 runway, same rule as trips.
      const minLead = new Date(now.getTime() + 30 * 60 * 1000);
      if (pickupDate < minLead) {
        throw new BadRequestException(
          I18nContext.current()?.t('packages.Min 30 min ahead'),
        );
      }
      // Quarter-hour grid, same as the trip picker.
      if (
        pickupDate.getUTCMinutes() % 15 !== 0 ||
        pickupDate.getUTCSeconds() !== 0
      ) {
        throw new BadRequestException(
          I18nContext.current()?.t('packages.Quarter hour'),
        );
      }
      const thirtyDaysAhead = new Date();
      thirtyDaysAhead.setDate(thirtyDaysAhead.getDate() + 30);
      if (pickupDate > thirtyDaysAhead) {
        throw new BadRequestException(
          I18nContext.current()?.t('packages.Max 30 days'),
        );
      }
    }

    const estimate = this.estimateFee(dto);

    const deliveryData: DeepPartial<PackageDelivery> = {
      sender: { id: userId },
      departureCity: { id: dto.departureCityId },
      arrivalCity: { id: dto.arrivalCityId },
      pickupLocation: dto.pickupLocation,
      dropOffLocation: dto.dropOffLocation,
      packageSize: dto.packageSize,
      packageDescription: dto.packageDescription || undefined,
      packagePhotoUrl: photoPath || undefined,
      receiverName: dto.receiverName,
      receiverPhone: dto.receiverPhone,
      deliveryFee: estimate.deliveryFee,
      termsAccepted: dto.termsAccepted,
      // §6.5 — 4-digit delivery confirmation code. Goes to the
      // recipient (SMS mocked; the sender sees it in-app and relays).
      deliveryCode: String(randomInt(1000, 10000)),
      trackingToken: randomBytes(12).toString('hex'),
      pickupDate,
      isImmediate: dto.isImmediate,
      urgent: dto.urgent ?? false,
      weightKg:
        dto.weightKg != null ? (String(dto.weightKg) as unknown as string) : undefined,
      status: PackageStatus.PENDING,
    };

    const delivery = this.packagesRepository.create(deliveryData);

    const saved = await this.packagesRepository.save(delivery);

    // Stage-1 grouping (master spec §6.3). Failure MUST NOT block the
    // sender — the package stays PENDING and can be re-grouped on the
    // next sweeper tick (planned for PR 4).
    try {
      await this.groupingService.attemptGroupingForPackage(saved.id);
    } catch (err) {
      this.logger.warn(
        `Grouping failed for package #${saved.id}: ${err instanceof Error ? err.message : err}`,
      );
    }

    return saved;
  }

  async getUserPackages(
    userId: number,
    query: PaginationQueryDto,
  ): Promise<PaginatedResponse<PackageDelivery>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const [data, totalItems] = await this.packagesRepository.findAndCount({
      where: { sender: { id: userId } },
      relations: ['departureCity', 'arrivalCity'],
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    const totalPages = Math.ceil(totalItems / limit);

    return {
      data,
      meta: {
        page,
        limit,
        totalItems,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  /**
   * Returns the sender's most-recent live package — anything not delivered
   * or cancelled. 404 when the sender has no active delivery.
   */
  async getActivePackage(userId: number): Promise<PackageDelivery> {
    const delivery = await this.packagesRepository.findOne({
      where: {
        sender: { id: userId },
        status: In(ACTIVE_PACKAGE_STATUSES),
      },
      relations: ['departureCity', 'arrivalCity'],
      order: { createdAt: 'DESC' },
    });
    if (!delivery) {
      throw new NotFoundException(
        I18nContext.current()?.t('packages.No active package'),
      );
    }
    return delivery;
  }

  /**
   * Lightweight polling endpoint — mirrors GET /trips/:id/status for
   * package deliveries. Sender-scoped; includes the assigned driver
   * once the package's group has one.
   */
  async getPackageStatus(id: number, userId: number) {
    const delivery = await this.packagesRepository.findOne({
      where: { id, sender: { id: userId } },
      relations: ['tripGroup', 'tripGroup.assignedDriver'],
    });
    if (!delivery) {
      throw new NotFoundException(
        I18nContext.current()?.t('packages.Not found'),
      );
    }
    const driver = delivery.tripGroup?.assignedDriver ?? null;
    return {
      id: delivery.id,
      status: delivery.status,
      updatedAt: delivery.updatedAt,
      driver: driver
        ? {
            name: driver.name,
            phoneNumber: `${driver.countryCode ?? ''}${driver.phoneNumber}`,
            rating: Number(driver.rating),
          }
        : null,
      // Shown to the receiver at handoff; the driver must quote it back.
      deliveryCode: delivery.deliveryCode,
    };
  }

  async getPackageById(id: number, userId: number) {
    const delivery = await this.packagesRepository.findOne({
      where: { id, sender: { id: userId } },
      relations: ['departureCity', 'arrivalCity'],
    });

    if (!delivery) {
      throw new BadRequestException(
        I18nContext.current()?.t('packages.Not found'),
      );
    }

    return delivery;
  }
}
