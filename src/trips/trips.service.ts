import { BadRequestException, Injectable, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TripRequest } from './entities/trip-request.entity';
import { TripStatus } from '../shared/enums/trip-status.enum';
import { EstimateTripDto, CreateTripDto } from './dto/create-trip.dto';
import { I18nContext } from 'nestjs-i18n';

@Injectable()
export class TripsService {
  constructor(
    @InjectRepository(TripRequest)
    private tripsRepository: Repository<TripRequest>
  ) {}

  estimateFare(dto: EstimateTripDto) {
    if (dto.departureCityId === dto.arrivalCityId) {
      throw new BadRequestException(I18nContext.current()?.t('trips.Same city') || 'Departure and arrival cities cannot be the same');
    }
    
    if (!dto.isImmediate && dto.travelDate) {
      const travelDate = new Date(dto.travelDate);
      const now = new Date();
      if (travelDate < now) {
        throw new BadRequestException(I18nContext.current()?.t('trips.Past date') || 'Travel date cannot be in the past');
      }
      const thirtyDaysAhead = new Date();
      thirtyDaysAhead.setDate(thirtyDaysAhead.getDate() + 30);
      if (travelDate > thirtyDaysAhead) {
        throw new BadRequestException(I18nContext.current()?.t('trips.Max 30 days') || 'Travel date cannot be more than 30 days ahead');
      }
    }

    const perSeatFare = 10.00; // Mocked flat rate
    const totalFare = perSeatFare * dto.seatsCount;
    return {
      perSeatFare,
      totalFare,
      duration: '1h 30m',
      cancellationPolicy: 'Free cancellation up to 1 hour before departure.',
    };
  }

  async createRequest(userId: number, userGender: string, dto: CreateTripDto) {
    const estimates = this.estimateFare(dto); // Inherits date validation

    if (dto.isFemaleOnly && userGender !== 'Female') {
      throw new ForbiddenException(I18nContext.current()?.t('trips.Female only') || 'Female-only trips can only be requested by female passengers');
    }

    const trip = this.tripsRepository.create({
      passenger: { id: userId },
      departureCity: { id: dto.departureCityId },
      arrivalCity: { id: dto.arrivalCityId },
      departureLocation: dto.departureLocation,
      arrivalLocation: dto.arrivalLocation,
      travelDate: dto.isImmediate ? new Date() : new Date(dto.travelDate as string),
      isImmediate: dto.isImmediate || false,
      seatsCount: dto.seatsCount,
      isFemaleOnly: dto.isFemaleOnly || false,
      perSeatFare: estimates.perSeatFare,
      totalFare: estimates.totalFare,
      status: TripStatus.PENDING,
    });

    return this.tripsRepository.save(trip);
  }

  async getUserTrips(userId: number) {
    return this.tripsRepository.find({
      where: { passenger: { id: userId } },
      order: { createdAt: 'DESC' },
    });
  }
}

