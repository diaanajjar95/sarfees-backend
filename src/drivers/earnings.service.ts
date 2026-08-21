import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { I18nContext } from 'nestjs-i18n';
import { Driver } from './driver.entity';
import {
  tripCommission,
  DriverTrip,
} from '../driver-trips/entities/driver-trip.entity';
import { DriverTripStop } from '../driver-trips/entities/driver-trip-stop.entity';
import { DriverTripStatus } from '../shared/enums/driver-trip-status.enum';
import { StopPassengerRole, StopPassengerStatus } from '../shared/enums/stop-passenger-status.enum';
import { StopPackageRole, StopPackageStatus } from '../shared/enums/stop-package-status.enum';
import {
  EarningsBreakdownResponseDto,
  EarningsPeriod,
  EarningsQueryDto,
  EarningsResponseDto,
  EarningsSummaryDto,
  EarningsTripDto,
} from './dto/earnings.dto';

@Injectable()
export class EarningsService {
  constructor(
    @InjectRepository(Driver)
    private readonly driversRepo: Repository<Driver>,
    @InjectRepository(DriverTrip)
    private readonly tripsRepo: Repository<DriverTrip>,
    @InjectRepository(DriverTripStop)
    private readonly stopsRepo: Repository<DriverTripStop>,
  ) {}

  async list(
    driverId: number,
    query: EarningsQueryDto,
  ): Promise<EarningsResponseDto> {
    const driver = await this.driversRepo.findOne({ where: { id: driverId } });
    if (!driver) {
      throw new NotFoundException(
        I18nContext.current()?.t('driver.Not found'),
      );
    }

    const period = query.period ?? EarningsPeriod.WEEK;
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const { start, end } = this.periodRange(period);

    // Summary aggregates over the chosen period
    const periodTrips = await this.tripsRepo.find({
      where: {
        driver: { id: driverId },
        status: DriverTripStatus.COMPLETED,
        completedAt: Between(start, end),
      },
    });
    const summary = this.summarize(periodTrips, period);

    // Trip history list — all completed trips, paginated, most recent first
    const [allTrips, totalItems] = await this.tripsRepo.findAndCount({
      where: {
        driver: { id: driverId },
        status: DriverTripStatus.COMPLETED,
      },
      order: { completedAt: 'DESC' },
      skip,
      take: limit,
    });

    const trips = await Promise.all(
      allTrips.map((trip) => this.toTripRow(trip)),
    );
    const totalPages = Math.max(1, Math.ceil(totalItems / limit));

    return {
      summary,
      trips,
      outstandingBalance: Number(driver.outstandingBalance),
      page,
      limit,
      totalItems,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    };
  }

  async breakdown(
    driverId: number,
    tripId: number,
  ): Promise<EarningsBreakdownResponseDto> {
    const trip = await this.tripsRepo.findOne({
      where: { id: tripId },
      relations: ['driver'],
    });
    if (!trip || trip.driver?.id !== driverId) {
      throw new NotFoundException(
        I18nContext.current()?.t('driver-trip.Not found'),
      );
    }
    if (trip.status !== DriverTripStatus.COMPLETED) {
      throw new NotFoundException(
        I18nContext.current()?.t('driver-trip.Not completed'),
      );
    }

    const stops = await this.stopsRepo.find({
      where: { trip: { id: trip.id } },
      relations: [
        'passengers',
        'passengers.tripRequest',
        'passengers.tripRequest.passenger',
        'passengers.tripRequest.departureCity',
        'passengers.tripRequest.arrivalCity',
        'packages',
        'packages.packageDelivery',
        'packages.packageDelivery.sender',
      ],
      order: { order: 'ASC' },
    });

    const cashCollected = Number(trip.totalCashCollected);
    const commission = tripCommission(trip);
    const net = Math.round((cashCollected - commission) * 100) / 100;

    return {
      tripId: trip.id,
      route: `${trip.originCity} → ${trip.destinationCity}`,
      completedAt: trip.completedAt,
      stops: stops.map((s) => {
        const passengerRows = s.passengers
          .filter((p) => p.role === StopPassengerRole.ALIGHTING)
          .map((p) => ({
            name: this.firstNameInitial(p.tripRequest?.passenger),
            pickupCity:
              p.tripRequest?.departureCity?.nameEn ?? trip.originCity,
            dropoffCity:
              p.tripRequest?.arrivalCity?.nameEn ?? trip.destinationCity,
            fare: Number(p.fare),
            collected: p.cashCollected === true,
          }));
        const packageRows = s.packages
          .filter((p) => p.role === StopPackageRole.DELIVERING)
          .map((p) => ({
            reference: `PKG-${p.packageDelivery?.id}`,
            senderName: this.firstNameInitial(p.packageDelivery?.sender),
            fee: Number(p.fee),
            delivered: p.status === StopPackageStatus.DELIVERED,
          }));
        const cashAtStop =
          passengerRows.reduce((n, r) => n + (r.collected ? r.fare : 0), 0) +
          packageRows.reduce((n, r) => n + (r.delivered ? r.fee : 0), 0);
        return {
          order: s.order,
          type: s.type,
          city: s.city,
          cashAtStop,
          passengers: passengerRows,
          packages: packageRows,
        };
      }),
      subtotal: cashCollected,
      commission,
      netEarnings: net,
    };
  }

  // ─── Helpers ───────────────────────────────────────────────
  private periodRange(period: EarningsPeriod): { start: Date; end: Date } {
    const now = new Date();
    const end = now;
    const start = new Date(now);
    if (period === EarningsPeriod.TODAY) {
      start.setHours(0, 0, 0, 0);
    } else if (period === EarningsPeriod.WEEK) {
      start.setDate(start.getDate() - 7);
    } else {
      start.setMonth(start.getMonth() - 1);
    }
    return { start, end };
  }

  private summarize(
    trips: DriverTrip[],
    period: EarningsPeriod,
  ): EarningsSummaryDto {
    let cash = 0;
    let commission = 0;
    for (const t of trips) {
      const c = Number(t.totalCashCollected);
      const com = tripCommission(t);
      cash += c;
      commission += com;
    }
    cash = Math.round(cash * 100) / 100;
    commission = Math.round(commission * 100) / 100;
    return {
      period,
      totalCashCollected: cash,
      totalCommission: commission,
      netEarnings: Math.round((cash - commission) * 100) / 100,
      tripCount: trips.length,
    };
  }

  private async toTripRow(trip: DriverTrip): Promise<EarningsTripDto> {
    const stops = await this.stopsRepo.find({
      where: { trip: { id: trip.id } },
      relations: ['passengers', 'packages'],
    });
    const passengerCount = stops.reduce(
      (n, s) =>
        n +
        s.passengers.filter(
          (p) =>
            p.role === StopPassengerRole.ALIGHTING &&
            (p.status === StopPassengerStatus.DROPPED_OFF ||
              p.status === StopPassengerStatus.CASH_NOT_COLLECTED),
        ).length,
      0,
    );
    const packageCount = stops.reduce(
      (n, s) =>
        n +
        s.packages.filter(
          (p) =>
            p.role === StopPackageRole.DELIVERING &&
            p.status === StopPackageStatus.DELIVERED,
        ).length,
      0,
    );
    const cashCollected = Number(trip.totalCashCollected);
    const commission = tripCommission(trip);
    return {
      tripId: trip.id,
      route: `${trip.originCity} → ${trip.destinationCity}`,
      completedAt: trip.completedAt,
      passengerCount,
      packageCount,
      cashCollected,
      commission,
      netEarnings: Math.round((cashCollected - commission) * 100) / 100,
    };
  }

  private firstNameInitial(user?: { firstName?: string; lastName?: string }) {
    if (!user) return '';
    const first = user.firstName ?? '';
    const lastInitial = user.lastName ? `${user.lastName.charAt(0)}.` : '';
    return [first, lastInitial].filter(Boolean).join(' ');
  }
}
