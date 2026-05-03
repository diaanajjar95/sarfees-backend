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

  constructor(
    @InjectRepository(PackageDelivery)
    private packagesRepository: Repository<PackageDelivery>,
  ) {}

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

    // Pickup scheduling — mirrors TripsService.createRequest validation.
    let pickupDate: Date;
    if (dto.isImmediate) {
      pickupDate = new Date();
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
      pickupDate,
      isImmediate: dto.isImmediate,
      status: PackageStatus.PENDING,
    };

    const delivery = this.packagesRepository.create(deliveryData);

    return this.packagesRepository.save(delivery);
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
