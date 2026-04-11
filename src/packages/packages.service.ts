import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, Repository } from 'typeorm';
import { PackageDelivery } from './entities/package-delivery.entity';
import { PackageSize } from '../shared/enums/package-size.enum';
import { PackageStatus } from '../shared/enums/package-status.enum';
import { EstimatePackageDto, CreatePackageDeliveryDto } from './dto/create-package-delivery.dto';
import { PaginationQueryDto, PaginatedResponse } from '../shared/dto/pagination-query.dto';
import { I18nContext } from 'nestjs-i18n';

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
