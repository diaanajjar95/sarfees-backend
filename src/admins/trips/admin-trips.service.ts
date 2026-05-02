import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { I18nContext } from 'nestjs-i18n';
import { DriverTrip } from '../../driver-trips/entities/driver-trip.entity';
import { DriverTripStop } from '../../driver-trips/entities/driver-trip-stop.entity';
import { DriverTripDeclineLog } from '../../driver-trips/entities/driver-trip-decline-log.entity';
import { DriverTripStatus } from '../../shared/enums/driver-trip-status.enum';
import { DriverTripStopStatus } from '../../shared/enums/driver-trip-stop-status.enum';
import { DriverTripStopType } from '../../shared/enums/driver-trip-stop-type.enum';
import {
  AdminTripRowDto,
  ListAdminTripsQueryDto,
  ListAdminTripsResponseDto,
} from './dto/list-admin-trips.dto';
import {
  AdminTripDetailDto,
  LifecycleEventDto,
  TripDeclineRowDto,
} from './dto/admin-trip-detail.dto';
import { DriverTripsService } from '../../driver-trips/driver-trips.service';

@Injectable()
export class AdminTripsService {
  constructor(
    @InjectRepository(DriverTrip)
    private readonly tripsRepo: Repository<DriverTrip>,
    @InjectRepository(DriverTripStop)
    private readonly stopsRepo: Repository<DriverTripStop>,
    @InjectRepository(DriverTripDeclineLog)
    private readonly declineLogRepo: Repository<DriverTripDeclineLog>,
    private readonly driverTripsService: DriverTripsService,
  ) {}

  async list(query: ListAdminTripsQueryDto): Promise<ListAdminTripsResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const qb = this.tripsRepo
      .createQueryBuilder('t')
      .leftJoin('t.driver', 'd')
      .addSelect(['d.id', 'd.name'])
      .orderBy('t.departureTime', 'DESC');

    if (query.status) qb.andWhere('t.status = :s', { s: query.status });
    if (query.type) qb.andWhere('t.type = :tp', { tp: query.type });
    if (query.driverId) qb.andWhere('d.id = :did', { did: query.driverId });
    if (query.originCity)
      qb.andWhere('LOWER(t.originCity) = LOWER(:oc)', { oc: query.originCity });
    if (query.destinationCity)
      qb.andWhere('LOWER(t.destinationCity) = LOWER(:dc)', {
        dc: query.destinationCity,
      });
    if (query.fromDate)
      qb.andWhere('t.departureTime >= :fd', { fd: new Date(query.fromDate) });
    if (query.toDate)
      qb.andWhere('t.departureTime <= :td', { td: new Date(query.toDate) });

    const [rows, totalItems] = await qb
      .skip(skip)
      .take(limit)
      .getManyAndCount();
    const totalPages = Math.max(1, Math.ceil(totalItems / limit));

    const data: AdminTripRowDto[] = rows.map((t) => ({
      id: t.id,
      status: t.status,
      type: t.type,
      originCity: t.originCity,
      destinationCity: t.destinationCity,
      departureTime: t.departureTime,
      driverId: t.driver?.id ?? null,
      driverName: t.driver?.name ?? null,
      totalCashExpected: Number(t.totalCashExpected),
      totalCashCollected: Number(t.totalCashCollected),
      netEarnings: t.netEarnings != null ? Number(t.netEarnings) : null,
      acceptedAt: t.acceptedAt ?? null,
      startedAt: t.startedAt ?? null,
      completedAt: t.completedAt ?? null,
      cancelledAt: t.cancelledAt ?? null,
      cancellationZone: t.cancellationZone ?? null,
    }));

    return {
      data,
      page,
      limit,
      totalItems,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    };
  }

  /**
   * Admin trip detail: starts from the driver-side manifest and enriches it
   * with driver info, lifecycle timeline, decline log, cancellation context,
   * and pricing breakdown — everything ops needs to debug a single trip.
   */
  async detail(tripId: number): Promise<AdminTripDetailDto> {
    const trip = await this.tripsRepo.findOne({
      where: { id: tripId },
      relations: ['driver'],
    });
    if (!trip) {
      throw new NotFoundException(
        I18nContext.current()?.t('driver-trip.Not found'),
      );
    }
    if (!trip.driver) {
      throw new NotFoundException('Trip has no assigned driver');
    }

    const manifest = await this.driverTripsService.getManifest(
      trip.driver.id,
      tripId,
    );

    const stops = await this.stopsRepo.find({
      where: { trip: { id: tripId } },
      relations: ['passengers', 'packages'],
      order: { order: 'ASC' },
    });

    const declineRows = await this.declineLogRepo.find({
      where: { trip: { id: tripId } },
      order: { declinedAt: 'DESC' },
    });

    const lifecycle = this.buildLifecycle(trip, stops);

    const declineHistory: TripDeclineRowDto[] = declineRows.map((d) => ({
      id: d.id,
      reason: d.reason,
      autoDeclined: d.autoDeclined,
      notes: d.notes ?? null,
      declinedAt: d.declinedAt,
    }));

    const cancellation =
      trip.status === DriverTripStatus.CANCELLED && trip.cancelledAt
        ? {
            zone: trip.cancellationZone ?? 1,
            reason: trip.cancellationReason ?? '',
            cancelledAt: trip.cancelledAt,
          }
        : null;

    const cashCollected = Number(trip.totalCashCollected);
    const commissionRate = Number(trip.commissionRate);
    const commissionAmount =
      Math.round(cashCollected * commissionRate * 100) / 100;
    const netEarnings =
      trip.netEarnings != null
        ? Number(trip.netEarnings)
        : Math.round((cashCollected - commissionAmount) * 100) / 100;

    return {
      ...manifest,
      driver: {
        id: trip.driver.id,
        name: trip.driver.name ?? null,
        phone: `${trip.driver.countryCode ?? ''} ${trip.driver.phoneNumber ?? ''}`.trim(),
        rating: Number(trip.driver.rating),
        ratingCount: trip.driver.ratingCount,
        totalTrips: trip.driver.totalTrips,
      },
      lifecycle,
      declineHistory,
      cancellation,
      pricing: {
        totalCashExpected: Number(trip.totalCashExpected),
        totalCashCollected: cashCollected,
        commissionRate,
        commissionAmount,
        netEarnings,
      },
    };
  }

  // ─── Lifecycle assembly ────────────────────────────────────
  private buildLifecycle(
    trip: DriverTrip,
    stops: DriverTripStop[],
  ): LifecycleEventDto[] {
    const events: LifecycleEventDto[] = [];

    if (trip.offeredAt) {
      events.push({
        kind: 'offered',
        at: trip.offeredAt,
        label: 'Trip offered to driver',
        detail: trip.offerExpiresAt
          ? `Auto-expires at ${this.fmtTime(trip.offerExpiresAt)}`
          : null,
        stopOrder: null,
        stopCity: null,
      });
    }

    if (trip.status === DriverTripStatus.EXPIRED && trip.offerExpiresAt) {
      events.push({
        kind: 'offer_expired',
        at: trip.offerExpiresAt,
        label: 'Offer expired without response',
        detail: 'Driver did not accept or decline within the countdown window.',
        stopOrder: null,
        stopCity: null,
      });
    }

    if (trip.declinedAt) {
      events.push({
        kind: 'declined',
        at: trip.declinedAt,
        label: 'Driver declined the offer',
        detail: null,
        stopOrder: null,
        stopCity: null,
      });
    }

    if (trip.acceptedAt) {
      events.push({
        kind: 'accepted',
        at: trip.acceptedAt,
        label: 'Driver accepted the trip',
        detail: null,
        stopOrder: null,
        stopCity: null,
      });
    }

    if (trip.startedAt) {
      events.push({
        kind: 'started',
        at: trip.startedAt,
        label: 'Trip started',
        detail: 'Driver tapped Start Trip after reviewing the manifest.',
        stopOrder: null,
        stopCity: null,
      });
    }

    for (const stop of stops) {
      if (stop.arrivedAt) {
        events.push({
          kind: 'arrived_stop',
          at: stop.arrivedAt,
          label: `Arrived at stop ${stop.order + 1} (${stop.city})`,
          detail: stop.address ?? null,
          stopOrder: stop.order,
          stopCity: stop.city,
        });
      }
      if (stop.confirmedAt) {
        const isPickup =
          stop.type === DriverTripStopType.PICKUP ||
          stop.type === DriverTripStopType.PICKUP_DROPOFF;
        const isDropoff =
          stop.type === DriverTripStopType.DROPOFF ||
          stop.type === DriverTripStopType.PICKUP_DROPOFF;

        // For combined stops we emit two events; otherwise one.
        if (isPickup) {
          const pickedCount = stop.passengers.filter(
            (p) => p.role === 'boarding' && p.status === 'picked_up',
          ).length;
          const noShows = stop.passengers.filter(
            (p) => p.role === 'boarding' && p.status === 'no_show',
          ).length;
          const collected = stop.packages.filter(
            (p) => p.role === 'collecting' && p.status === 'collected',
          ).length;
          const notFound = stop.packages.filter(
            (p) => p.role === 'collecting' && p.status === 'not_found',
          ).length;
          events.push({
            kind: 'pickup_confirmed',
            at: stop.confirmedAt,
            label: `Pickup confirmed at stop ${stop.order + 1} (${stop.city})`,
            detail: this.summarizeTotals(
              [pickedCount, 'picked up'],
              [noShows, 'no-show'],
              [collected, 'package collected'],
              [notFound, 'package not found'],
            ),
            stopOrder: stop.order,
            stopCity: stop.city,
          });
        }
        if (isDropoff) {
          const dropped = stop.passengers.filter(
            (p) => p.role === 'alighting' && p.status === 'dropped_off',
          ).length;
          const cashUnpaid = stop.passengers.filter(
            (p) =>
              p.role === 'alighting' && p.status === 'cash_not_collected',
          ).length;
          const delivered = stop.packages.filter(
            (p) => p.role === 'delivering' && p.status === 'delivered',
          ).length;
          const failed = stop.packages.filter(
            (p) => p.role === 'delivering' && p.status === 'delivery_failed',
          ).length;
          events.push({
            kind: 'dropoff_confirmed',
            at: stop.confirmedAt,
            label: `Dropoff confirmed at stop ${stop.order + 1} (${stop.city})`,
            detail: this.summarizeTotals(
              [dropped, 'dropped off'],
              [cashUnpaid, 'cash unpaid'],
              [delivered, 'delivered'],
              [failed, 'delivery failed'],
            ),
            stopOrder: stop.order,
            stopCity: stop.city,
          });
        }
      }
    }

    if (trip.completedAt) {
      events.push({
        kind: 'completed',
        at: trip.completedAt,
        label: 'Trip completed',
        detail:
          trip.netEarnings != null
            ? `Net earnings ${Number(trip.netEarnings).toFixed(2)} JD`
            : null,
        stopOrder: null,
        stopCity: null,
      });
    }

    if (trip.cancelledAt) {
      const zone = trip.cancellationZone ?? 1;
      events.push({
        kind: 'cancelled',
        at: trip.cancelledAt,
        label: `Trip cancelled (zone ${zone})`,
        detail: trip.cancellationReason ?? null,
        stopOrder: null,
        stopCity: null,
      });
    }

    void DriverTripStopStatus; // referenced for completeness if logic is extended

    return events.sort((a, b) => a.at.getTime() - b.at.getTime());
  }

  private summarizeTotals(...pairs: [number, string][]): string | null {
    const parts = pairs
      .filter(([n]) => n > 0)
      .map(([n, label]) => `${n} ${label}`);
    return parts.length > 0 ? parts.join(' · ') : null;
  }

  private fmtTime(d: Date): string {
    return new Date(d).toISOString();
  }
}
