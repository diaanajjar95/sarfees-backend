import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, QueryFailedError, Repository } from 'typeorm';
import { DriverTripStop } from '../../driver-trips/entities/driver-trip-stop.entity';
import {
  MAP_PROVIDER,
  type MapProvider,
} from '../../shared/map/map-provider.interface';
import { TripRouteDto } from './dto/trip-route.dto';
import { I18nContext } from 'nestjs-i18n';
import { Driver } from '../../drivers/driver.entity';
import { DriverStatus } from '../../shared/enums/driver-status.enum';
import { DriverSuspensionCategory } from '../../shared/enums/driver-suspension-category.enum';
import { DriverTrip } from '../../driver-trips/entities/driver-trip.entity';
import { DriverTripDeclineLog } from '../../driver-trips/entities/driver-trip-decline-log.entity';
import { DriverTripStatus } from '../../shared/enums/driver-trip-status.enum';
import { DriverProfileResponseDto } from '../../drivers/dto/driver-profile-response.dto';
import { CreateDriverDto } from './dto/create-driver.dto';
import { UpdateDriverDto } from './dto/update-driver.dto';
import {
  ListDriversQueryDto,
  ListDriversResponseDto,
} from './dto/list-drivers.dto';
import {
  AdminDriverDetailDto,
  DriverDeclineLogRowDto,
  DriverTripHistoryRowDto,
} from './dto/driver-detail.dto';

@Injectable()
export class AdminDriversService {
  constructor(
    @InjectRepository(Driver)
    private readonly driversRepo: Repository<Driver>,
    @InjectRepository(DriverTrip)
    private readonly tripsRepo: Repository<DriverTrip>,
    @InjectRepository(DriverTripStop)
    private readonly stopsRepo: Repository<DriverTripStop>,
    @InjectRepository(DriverTripDeclineLog)
    private readonly declineLogRepo: Repository<DriverTripDeclineLog>,
    @Inject(MAP_PROVIDER) private readonly mapProvider: MapProvider,
  ) {}

  /**
   * Load a driver's currently-in-progress trip and return its stops
   * plus (if the map provider supports it) the road-following
   * polyline from OSRM. The admin map fetches this on marker click
   * to draw the trip line.
   *
   * Empty stops → returns empty response with meters/duration/geometry
   * null; the frontend handles that gracefully.
   */
  async tripRoute(driverId: number): Promise<TripRouteDto> {
    // "Current" = ACCEPTED (still en route to pickup) or IN_PROGRESS
    // (mid-trip). COMPLETED / CANCELLED / EXPIRED / DECLINED are not
    // "live" from the admin's perspective.
    const trip = await this.tripsRepo.findOne({
      where: {
        driver: { id: driverId },
        status: In([DriverTripStatus.ACCEPTED, DriverTripStatus.IN_PROGRESS]),
      },
      order: { id: 'DESC' },
    });
    if (!trip) {
      return {
        driverId,
        driverTripId: null,
        stops: [],
        meters: null,
        durationSeconds: null,
        geometry: null,
      };
    }
    const stops = await this.stopsRepo.find({
      where: { trip: { id: trip.id } },
      order: { order: 'ASC' },
    });

    const waypoints = stops.map((s) => ({
      lat: Number(s.lat),
      lng: Number(s.lng),
    }));

    // Only call route() if the provider supports it AND we have at
    // least 2 stops. Otherwise the client will draw straight lines
    // (or no line at all for 0/1 stop).
    let meters: number | null = null;
    let durationSeconds: number | null = null;
    let geometry: [number, number][] | null = null;
    if (waypoints.length >= 2 && typeof this.mapProvider.route === 'function') {
      const routed = await this.mapProvider.route(waypoints);
      if (routed) {
        meters = routed.meters;
        durationSeconds = routed.durationSeconds;
        geometry = routed.geometry;
      }
    }

    return {
      driverId,
      driverTripId: trip.id,
      stops: stops.map((s) => ({
        order: s.order,
        type: s.type,
        lat: Number(s.lat),
        lng: Number(s.lng),
        city: s.city ?? null,
        address: s.address ?? null,
      })),
      meters,
      durationSeconds,
      geometry,
    };
  }

  /**
   * Lean read used by the admin portal's live-driver map. Returns
   * only ACTIVE + ON_TRIP drivers that have a location snapshot on
   * file. Small payload (~50 bytes per driver) so ops can poll it
   * every 30 s without blowing up the API.
   */
  /**
   * One-call payload for the dispatch map: driver pins enriched with
   * heading / last GPS ping / wallet / current trip, demand pins
   * (groups still hunting for a driver), network KPIs, and the city
   * service circles. Raw SQL to keep it one round-trip per block.
   */
  async liveOverview() {
    const mgr = this.driversRepo.manager;

    const drivers: Array<Record<string, unknown>> = await mgr.query(`
      SELECT d.id, d.name, d."countryCode", d."phoneNumber", d.status,
             d."prefLocationLat" AS lat, d."prefLocationLng" AS lng,
             d.rating, d."walletBalance",
             loc.heading, loc."recordedAt" AS "lastPingAt",
             dt.id AS "currentTripId", dt.status AS "currentTripStatus"
      FROM drivers d
      LEFT JOIN LATERAL (
        SELECT heading, "recordedAt" FROM driver_locations l
        WHERE l."driverId" = d.id ORDER BY l."recordedAt" DESC LIMIT 1
      ) loc ON true
      LEFT JOIN LATERAL (
        SELECT id, status FROM driver_trips t
        WHERE t."driverId" = d.id AND t.status IN ('accepted','in_progress')
        ORDER BY t.id DESC LIMIT 1
      ) dt ON true
      WHERE d.status IN ('active','on_trip')
        AND d."prefLocationLat" IS NOT NULL
    `);

    const demand: Array<Record<string, unknown>> = await mgr.query(`
      SELECT g.id, g.status, g."departureTime", g."womenOnly",
             c."nameEn" AS "originCity",
             req.ids AS "requestIds", req.seats,
             COALESCE(pkg.count, 0)::int AS "packageCount",
             COALESCE(req.lat, pkg.lat) AS lat,
             COALESCE(req.lng, pkg.lng) AS lng
      FROM trip_groups g
      JOIN cities c ON c.id = g."originCityId"
      LEFT JOIN LATERAL (
        SELECT array_agg(r.id) AS ids,
               COALESCE(SUM(r."seatsCount"), 0)::int AS seats,
               (array_agg(r."departureLocation"))[1]->>'lat' AS lat,
               (array_agg(r."departureLocation"))[1]->>'lng' AS lng
        FROM trip_requests r
        WHERE r."tripGroupId" = g.id AND r.status NOT IN ('CANCELLED','COMPLETED')
      ) req ON true
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS count,
               (array_agg(p."pickupLocation"))[1]->>'lat' AS lat,
               (array_agg(p."pickupLocation"))[1]->>'lng' AS lng
        FROM package_deliveries p
        WHERE p."tripGroupId" = g.id AND p.status NOT IN ('CANCELLED','DELIVERED')
      ) pkg ON true
      WHERE g.status IN ('open','frozen','offering','unserved_escalation')
    `);

    const [kpiRow]: Array<Record<string, string>> = await mgr.query(`
      SELECT
        (SELECT COUNT(*) FROM drivers WHERE status = 'active')  AS "onlineDrivers",
        (SELECT COUNT(*) FROM drivers WHERE status = 'on_trip') AS "onTripDrivers",
        (SELECT COUNT(*) FROM trip_groups WHERE status IN ('open','frozen','offering')) AS "searchingGroups",
        (SELECT COUNT(*) FROM trip_groups WHERE status = 'unserved_escalation')         AS "escalatedGroups",
        (SELECT COUNT(*) FROM trip_requests WHERE status = 'PENDING')                   AS "pendingRequests"
    `);

    const cities: Array<Record<string, unknown>> = await mgr.query(`
      SELECT id, "nameEn", "centerLat", "centerLng",
             COALESCE("serviceRadiusMeters",
               (SELECT "defaultServiceRadiusMeters" FROM matching_config LIMIT 1),
               5000) AS "radiusMeters"
      FROM cities WHERE "centerLat" IS NOT NULL
    `);

    return {
      drivers: drivers.map((d) => ({
        id: Number(d.id),
        name: (d.name as string) ?? '',
        phone: `${(d.countryCode as string) ?? ''}${(d.phoneNumber as string) ?? ''}`,
        status: d.status,
        lat: Number(d.lat),
        lng: Number(d.lng),
        heading: d.heading != null ? Number(d.heading) : null,
        lastPingAt: d.lastPingAt ?? null,
        rating: Number(d.rating),
        walletBalance: Number(d.walletBalance),
        currentTripId: d.currentTripId != null ? Number(d.currentTripId) : null,
        currentTripStatus: d.currentTripStatus ?? null,
      })),
      demand: demand
        .filter((g) => g.lat != null && g.lng != null)
        .map((g) => ({
          groupId: Number(g.id),
          status: g.status,
          escalated: g.status === 'unserved_escalation',
          originCity: g.originCity,
          departureTime: g.departureTime,
          womenOnly: !!g.womenOnly,
          seats: Number(g.seats ?? 0),
          packageCount: Number(g.packageCount ?? 0),
          requestIds: (g.requestIds as number[] | null) ?? [],
          lat: Number(g.lat),
          lng: Number(g.lng),
        })),
      kpis: {
        onlineDrivers: Number(kpiRow.onlineDrivers),
        onTripDrivers: Number(kpiRow.onTripDrivers),
        searchingGroups: Number(kpiRow.searchingGroups),
        escalatedGroups: Number(kpiRow.escalatedGroups),
        pendingRequests: Number(kpiRow.pendingRequests),
      },
      cities: cities.map((c) => ({
        id: Number(c.id),
        name: c.nameEn,
        lat: Number(c.centerLat),
        lng: Number(c.centerLng),
        radiusMeters: Number(c.radiusMeters),
      })),
      generatedAt: new Date().toISOString(),
    };
  }

  async liveMap(): Promise<{
    drivers: Array<{
      id: number;
      name: string;
      countryCode: string | null;
      phoneNumber: string | null;
      status: DriverStatus;
      lat: number;
      lng: number;
      updatedAt: string;
    }>;
    generatedAt: string;
  }> {
    const rows = await this.driversRepo
      .createQueryBuilder('d')
      .select([
        'd.id',
        'd.name',
        'd.countryCode',
        'd.phoneNumber',
        'd.status',
        'd.prefLocationLat',
        'd.prefLocationLng',
        'd.updatedAt',
      ])
      .where('d.status IN (:...active)', {
        active: [DriverStatus.ACTIVE, DriverStatus.ON_TRIP],
      })
      .andWhere('d.prefLocationLat IS NOT NULL')
      .andWhere('d.prefLocationLng IS NOT NULL')
      .orderBy('d.updatedAt', 'DESC')
      .getMany();

    return {
      drivers: rows.map((d) => ({
        id: d.id,
        name: d.name ?? '',
        countryCode: d.countryCode ?? null,
        phoneNumber: d.phoneNumber ?? null,
        status: d.status,
        lat: Number(d.prefLocationLat),
        lng: Number(d.prefLocationLng),
        updatedAt: d.updatedAt.toISOString(),
      })),
      generatedAt: new Date().toISOString(),
    };
  }

  async list(query: ListDriversQueryDto): Promise<ListDriversResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const qb = this.driversRepo
      .createQueryBuilder('d')
      .orderBy('d.id', 'DESC');

    if (query.status) {
      qb.andWhere('d.status = :status', { status: query.status });
    }
    if (query.homeCity) {
      qb.andWhere('LOWER(d.homeCity) = LOWER(:city)', { city: query.homeCity });
    }
    if (query.q && query.q.trim().length > 0) {
      const pattern = `%${query.q.trim().toLowerCase()}%`;
      qb.andWhere(
        new Brackets((bb) => {
          bb.where('LOWER(d.name) LIKE :p', { p: pattern })
            .orWhere('d.phoneNumber LIKE :p', { p: pattern })
            .orWhere('LOWER(d.plateNumber) LIKE :p', { p: pattern });
        }),
      );
    }

    const [rows, totalItems] = await qb
      .skip(skip)
      .take(limit)
      .getManyAndCount();
    const totalPages = Math.max(1, Math.ceil(totalItems / limit));

    return {
      data: rows.map((d) => DriverProfileResponseDto.from(d)),
      page,
      limit,
      totalItems,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    };
  }

  async detail(id: number): Promise<AdminDriverDetailDto> {
    const driver = await this.driversRepo.findOne({ where: { id } });
    if (!driver) {
      throw new NotFoundException(
        I18nContext.current()?.t('driver.Not found'),
      );
    }

    const recentTrips = await this.tripsRepo.find({
      where: { driver: { id } },
      order: { id: 'DESC' },
      take: 50,
    });
    const completed = recentTrips.filter(
      (t) => t.status === DriverTripStatus.COMPLETED,
    ).length;
    const cancelled = recentTrips.filter(
      (t) => t.status === DriverTripStatus.CANCELLED,
    ).length;

    const tripHistory: DriverTripHistoryRowDto[] = recentTrips.map((t) => ({
      id: t.id,
      route: `${t.originCity} → ${t.destinationCity}`,
      type: t.type,
      status: t.status,
      departureTime: t.departureTime,
      completedAt: t.completedAt ?? null,
      totalCashCollected: Number(t.totalCashCollected),
      netEarnings: t.netEarnings != null ? Number(t.netEarnings) : null,
    }));

    const declineRows = await this.declineLogRepo.find({
      where: { driver: { id } },
      order: { id: 'DESC' },
      take: 50,
    });
    const declineLog: DriverDeclineLogRowDto[] = declineRows.map((r) => ({
      id: r.id,
      reason: r.reason,
      autoDeclined: r.autoDeclined,
      declinedAt: r.declinedAt,
    }));

    return {
      ...DriverProfileResponseDto.from(driver),
      completedTripCount: completed,
      cancelledTripCount: cancelled,
      tripHistory,
      declineLog,
    };
  }

  async create(dto: CreateDriverDto): Promise<DriverProfileResponseDto> {
    try {
      const created = this.driversRepo.create({
        name: dto.name,
        phoneNumber: dto.phoneNumber,
        countryCode: dto.countryCode,
        gender: dto.gender,
        homeCity: dto.homeCity,
        vehicleMake: dto.vehicleMake,
        vehicleModel: dto.vehicleModel,
        vehicleColor: dto.vehicleColor,
        vehicleYear: dto.vehicleYear,
        plateNumber: dto.plateNumber,
        passengerCapacity: dto.passengerCapacity ?? 4,
        language: dto.language ?? 'en',
        status: DriverStatus.INACTIVE,
      });
      const saved = await this.driversRepo.save(created);
      return DriverProfileResponseDto.from(saved);
    } catch (err) {
      if (
        err instanceof QueryFailedError &&
        (err as { code?: string }).code === '23505'
      ) {
        throw new ConflictException(
          I18nContext.current()?.t('admin.Phone already registered'),
        );
      }
      throw err;
    }
  }

  async update(
    id: number,
    dto: UpdateDriverDto,
  ): Promise<DriverProfileResponseDto> {
    const driver = await this.driversRepo.findOne({ where: { id } });
    if (!driver) {
      throw new NotFoundException(
        I18nContext.current()?.t('driver.Not found'),
      );
    }
    await this.driversRepo.update(id, dto);
    const updated = await this.driversRepo.findOne({ where: { id } });
    return DriverProfileResponseDto.from(updated as Driver);
  }

  async suspend(
    id: number,
    reason?: string,
    category?: DriverSuspensionCategory,
  ): Promise<DriverProfileResponseDto> {
    const driver = await this.driversRepo.findOne({ where: { id } });
    if (!driver) {
      throw new NotFoundException(
        I18nContext.current()?.t('driver.Not found'),
      );
    }
    if (driver.status === DriverStatus.ON_TRIP) {
      throw new BadRequestException(
        I18nContext.current()?.t('admin.Cannot suspend on trip'),
      );
    }
    await this.driversRepo.update(id, {
      status: DriverStatus.SUSPENDED,
      // Invalidate refresh token so the driver is logged out next request
      refreshToken: null as unknown as string,
      suspendedAt: new Date(),
      suspensionReason: (reason ?? null) as unknown as string,
      suspensionCategory: (category ?? null) as unknown as DriverSuspensionCategory,
    });
    const updated = await this.driversRepo.findOne({ where: { id } });
    return DriverProfileResponseDto.from(updated as Driver);
  }

  async reinstate(id: number): Promise<DriverProfileResponseDto> {
    const driver = await this.driversRepo.findOne({ where: { id } });
    if (!driver) {
      throw new NotFoundException(
        I18nContext.current()?.t('driver.Not found'),
      );
    }
    if (driver.status !== DriverStatus.SUSPENDED) {
      throw new BadRequestException(
        I18nContext.current()?.t('admin.Not suspended'),
      );
    }
    await this.driversRepo.update(id, {
      status: DriverStatus.INACTIVE,
      suspendedAt: null as unknown as Date,
      suspensionReason: null as unknown as string,
      suspensionCategory: null as unknown as DriverSuspensionCategory,
    });
    const updated = await this.driversRepo.findOne({ where: { id } });
    return DriverProfileResponseDto.from(updated as Driver);
  }
}
