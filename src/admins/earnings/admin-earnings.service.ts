import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, MoreThan, Repository } from 'typeorm';
import { Driver } from '../../drivers/driver.entity';
import { DriverStatus } from '../../shared/enums/driver-status.enum';
import { tripCommission, DriverTrip } from '../../driver-trips/entities/driver-trip.entity';
import { DriverTripStatus } from '../../shared/enums/driver-trip-status.enum';
import { EarningsPeriod } from '../../drivers/dto/earnings.dto';
import {
  AdminBalanceQueryDto,
  AdminEarningsDashboardDto,
  AdminEarningsQueryDto,
  CityRollupRowDto,
  DriverBalanceRowDto,
  DriverBalancesResponseDto,
  SettleBalanceDto,
  SettleBalanceResponseDto,
} from './dto/admin-earnings.dto';

@Injectable()
export class AdminEarningsService {
  constructor(
    @InjectRepository(Driver)
    private readonly driversRepo: Repository<Driver>,
    @InjectRepository(DriverTrip)
    private readonly tripsRepo: Repository<DriverTrip>,
  ) {}

  async dashboard(
    query: AdminEarningsQueryDto,
  ): Promise<AdminEarningsDashboardDto> {
    const period = query.period ?? EarningsPeriod.WEEK;
    const { start, end } = this.periodRange(period);

    const trips = await this.tripsRepo.find({
      where: {
        status: DriverTripStatus.COMPLETED,
        completedAt: Between(start, end),
      },
    });

    let cash = 0;
    let commission = 0;
    let net = 0;
    const byCity = new Map<string, CityRollupRowDto>();

    for (const t of trips) {
      const c = Number(t.totalCashCollected);
      const com = tripCommission(t);
      cash += c;
      commission += com;
      net += c - com;

      const city = t.originCity || 'Unknown';
      const row = byCity.get(city) ?? {
        city,
        tripCount: 0,
        cashCollected: 0,
        commission: 0,
      };
      row.tripCount += 1;
      row.cashCollected += c;
      row.commission += com;
      byCity.set(city, row);
    }

    cash = Math.round(cash * 100) / 100;
    commission = Math.round(commission * 100) / 100;
    net = Math.round(net * 100) / 100;

    const activeDrivers = await this.driversRepo.count({
      where: { status: DriverStatus.ACTIVE },
    });

    // Outstanding total across all drivers (sum of outstandingBalance column)
    const outstandingRow = await this.driversRepo
      .createQueryBuilder('d')
      .select('COALESCE(SUM(d.outstandingBalance), 0)', 'total')
      .getRawOne<{ total: string }>();
    const outstandingTotal =
      Math.round(Number(outstandingRow?.total ?? 0) * 100) / 100;

    return {
      kpi: {
        period,
        totalCashCollected: cash,
        totalCommission: commission,
        totalNetPaidToDrivers: net,
        tripCount: trips.length,
        activeDrivers,
        outstandingTotal,
      },
      byOriginCity: Array.from(byCity.values()).sort(
        (a, b) => b.cashCollected - a.cashCollected,
      ),
    };
  }

  async balances(
    query: AdminBalanceQueryDto,
  ): Promise<DriverBalancesResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const onlyOutstanding = (query.scope ?? 'outstanding') === 'outstanding';

    const where = onlyOutstanding ? { outstandingBalance: MoreThan(0) } : {};
    const [rows, totalItems] = await this.driversRepo.findAndCount({
      where,
      order: { outstandingBalance: 'DESC' },
      skip,
      take: limit,
    });

    const totalPages = Math.max(1, Math.ceil(totalItems / limit));

    const data: DriverBalanceRowDto[] = rows.map((d) => ({
      driverId: d.id,
      driverName: d.name ?? null,
      phoneNumber: `${d.countryCode} ${d.phoneNumber}`,
      totalTrips: d.totalTrips,
      outstandingBalance: Number(d.outstandingBalance),
    }));

    const outstandingRow = await this.driversRepo
      .createQueryBuilder('d')
      .select('COALESCE(SUM(d.outstandingBalance), 0)', 'total')
      .getRawOne<{ total: string }>();
    const outstandingTotal =
      Math.round(Number(outstandingRow?.total ?? 0) * 100) / 100;

    return {
      data,
      page,
      limit,
      totalItems,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
      outstandingTotal,
    };
  }

  async settle(
    driverId: number,
    dto: SettleBalanceDto,
  ): Promise<SettleBalanceResponseDto> {
    if (!(dto.amount > 0)) {
      throw new BadRequestException('amount must be > 0');
    }
    const driver = await this.driversRepo.findOne({ where: { id: driverId } });
    if (!driver) {
      throw new NotFoundException('Driver not found');
    }
    const previous = Number(driver.outstandingBalance);
    if (dto.amount > previous + 0.001) {
      throw new BadRequestException(
        'amount exceeds the driver outstanding balance',
      );
    }
    const next = Math.round((previous - dto.amount) * 100) / 100;
    await this.driversRepo.update(driverId, { outstandingBalance: next });

    void dto.notes; // notes are accepted now; an audit log entry will land in a future slice.

    return {
      driverId,
      previousBalance: previous,
      amountSettled: Math.round(dto.amount * 100) / 100,
      newBalance: next,
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
}
