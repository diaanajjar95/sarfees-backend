/**
 * Special-bookings smoke (PR 6): "now" / full-car / urgent packages.
 *
 *   Scenario 1: isImmediate=true shifts departureTime into the
 *     nowWindowMin..nowWindowMax range (default 15-30 min from now).
 *   Scenario 2: bookWholeCar=true births a FROZEN group with
 *     fullCar=true. A second compatible request MUST NOT join it.
 *   Scenario 3: PackageDelivery.urgent=true births a FROZEN solo
 *     group with urgent=true; a second package in the same corridor
 *     lands elsewhere (never joins urgent group).
 *   Scenario 4: Urgent group hits early-broadcast — after 3 declines,
 *     status transitions to BROADCASTING even with more drivers online.
 *
 * Scoped cleanup by phone marker.
 */

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { AssignmentService } from '../src/assignment/assignment.service';
import { EscalationCase } from '../src/assignment/entities/escalation-case.entity';
import { TripOfferHistory } from '../src/assignment/entities/trip-offer-history.entity';
import { City } from '../src/cities/city.entity';
import { Driver } from '../src/drivers/driver.entity';
import { DriverTrip } from '../src/driver-trips/entities/driver-trip.entity';
import { TripGroup } from '../src/grouping/entities/trip-group.entity';
import { GroupingService } from '../src/grouping/grouping.service';
import { PackageDelivery } from '../src/packages/entities/package-delivery.entity';
import { PackagesService } from '../src/packages/packages.service';
import { DriverStatus } from '../src/shared/enums/driver-status.enum';
import { PackageSize } from '../src/shared/enums/package-size.enum';
import { PackageStatus } from '../src/shared/enums/package-status.enum';
import { TripGroupStatus } from '../src/shared/enums/trip-group-status.enum';
import { TripStatus } from '../src/shared/enums/trip-status.enum';
import { OfferResponse } from '../src/shared/enums/offer-response.enum';
import { VehicleClass } from '../src/shared/enums/vehicle-class.enum';
import { TripRequest } from '../src/trips/entities/trip-request.entity';
import { TripsService } from '../src/trips/trips.service';
import { User } from '../src/users/user.entity';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  const ds = app.get(DataSource);
  const grouping = app.get(GroupingService);
  const assignment = app.get(AssignmentService);
  const tripsService = app.get(TripsService);
  const packagesService = app.get(PackagesService);

  const cities = await ds.getRepository(City).find();
  const amman = cities.find((c) => c.nameEn === 'Amman')!;
  const irbid = cities.find((c) => c.nameEn === 'Irbid')!;
  const marker = `SPECIAL_${Date.now()}`;

  const results: string[] = [];
  const fails: string[] = [];

  async function mkUser(gender: 'Male' | 'Female', tag: string) {
    return ds.getRepository(User).save(
      ds.getRepository(User).create({
        phoneNumber: `${marker}_U_${tag}`,
        firstName: tag,
        lastName: 'Special',
        gender,
        isProfileCompleted: true,
      } as unknown as User),
    );
  }
  async function mkDriver(tag: string) {
    return ds.getRepository(Driver).save(
      ds.getRepository(Driver).create({
        name: tag,
        phoneNumber: `${marker}_D_${tag}`,
        countryCode: '+962',
        status: DriverStatus.ACTIVE,
        gender: 'male',
        passengerCapacity: 4,
        prefTripTypes: ['mixed'],
        vehicleClass: VehicleClass.SEDAN,
        prefLocationLat: 31.9539,
        prefLocationLng: 35.9106,
        homeCity: 'Amman',
      } as unknown as Driver),
    );
  }

  try {
    // ── Scenario 1: "now" shifts departureTime into 15..30 min window ─
    const u1 = await mkUser('Male', 'S1');
    const before = Date.now();
    const t1 = await tripsService.createRequest(u1.id, 'Male', {
      departureCityId: amman.id,
      arrivalCityId: irbid.id,
      departureLocation: { lat: 31.951, lng: 35.91 },
      arrivalLocation: { lat: 32.5556, lng: 35.85 },
      isImmediate: true,
      seatsCount: 1,
    } as unknown as Parameters<typeof tripsService.createRequest>[2]);
    const t1Row = await ds
      .getRepository(TripRequest)
      .findOne({ where: { id: t1.id } });
    const shiftMs = t1Row!.travelDate.getTime() - before;
    if (shiftMs < 10 * 60 * 1000 || shiftMs > 35 * 60 * 1000)
      fails.push(
        `Scenario 1: expected departure in ~15-30 min, got ${Math.round(shiftMs / 60_000)} min`,
      );
    else
      results.push(
        `Scenario 1: "now" request shifted departure to +${Math.round(shiftMs / 60_000)} min ✓`,
      );

    // ── Scenario 2: full-car born FROZEN, no additions ─────────────
    const u2a = await mkUser('Male', 'S2A');
    const u2b = await mkUser('Male', 'S2B');
    const dep2 = new Date(Date.now() + 60 * 60 * 1000);
    const t2a = await tripsService.createRequest(u2a.id, 'Male', {
      departureCityId: amman.id,
      arrivalCityId: irbid.id,
      departureLocation: { lat: 31.951, lng: 35.91 },
      arrivalLocation: { lat: 32.5556, lng: 35.85 },
      isImmediate: false,
      travelDate: dep2.toISOString(),
      seatsCount: 2,
      bookWholeCar: true,
    } as unknown as Parameters<typeof tripsService.createRequest>[2]);
    const t2aRow = await ds
      .getRepository(TripRequest)
      .findOne({
        where: { id: t2a.id },
        relations: ['tripGroup'],
      });
    const g2 = t2aRow!.tripGroup;
    if (!g2 || !g2.fullCar || g2.status !== TripGroupStatus.FROZEN)
      fails.push(
        `Scenario 2: full-car group expected fullCar=true+FROZEN, got fullCar=${g2?.fullCar} status=${g2?.status}`,
      );
    else
      results.push(
        `Scenario 2: full-car group #${g2.id} born fullCar=true + FROZEN ✓`,
      );

    // A second request on the same corridor + time MUST NOT join it.
    const t2b = await tripsService.createRequest(u2b.id, 'Male', {
      departureCityId: amman.id,
      arrivalCityId: irbid.id,
      departureLocation: { lat: 31.952, lng: 35.911 },
      arrivalLocation: { lat: 32.5556, lng: 35.85 },
      isImmediate: false,
      travelDate: dep2.toISOString(),
      seatsCount: 1,
    } as unknown as Parameters<typeof tripsService.createRequest>[2]);
    const t2bRow = await ds
      .getRepository(TripRequest)
      .findOne({
        where: { id: t2b.id },
        relations: ['tripGroup'],
      });
    if (t2bRow?.tripGroup?.id === g2?.id)
      fails.push(
        `Scenario 2: second request joined full-car group — should have created its own`,
      );
    else
      results.push(
        `Scenario 2: second request landed in different group #${t2bRow?.tripGroup?.id} (fullCar guard held) ✓`,
      );

    // ── Scenario 3: urgent package born FROZEN + solo ──────────────
    const s3a = await mkUser('Male', 'S3A');
    const s3b = await mkUser('Male', 'S3B');
    const dep3 = new Date(Date.now() + 60 * 60 * 1000);
    const p3a = await packagesService.createDelivery(s3a.id, {
      departureCityId: amman.id,
      arrivalCityId: irbid.id,
      pickupLocation: { lat: 31.951, lng: 35.91 },
      dropOffLocation: { lat: 32.5556, lng: 35.85 },
      packageSize: PackageSize.SMALL,
      receiverName: 'R',
      receiverPhone: '0700000001',
      termsAccepted: true,
      isImmediate: false,
      pickupDate: dep3.toISOString(),
      urgent: true,
      weightKg: 2,
    } as unknown as Parameters<typeof packagesService.createDelivery>[1]);
    const p3aRow = await ds
      .getRepository(PackageDelivery)
      .findOne({
        where: { id: p3a.id },
        relations: ['tripGroup'],
      });
    const gUrg = p3aRow!.tripGroup;
    if (!gUrg || !gUrg.urgent || gUrg.status !== TripGroupStatus.FROZEN)
      fails.push(
        `Scenario 3: urgent group expected urgent=true+FROZEN, got urgent=${gUrg?.urgent} status=${gUrg?.status}`,
      );
    else
      results.push(
        `Scenario 3: urgent group #${gUrg.id} born urgent=true + FROZEN ✓`,
      );

    // A regular package on the same corridor MUST NOT join it.
    const p3b = await packagesService.createDelivery(s3b.id, {
      departureCityId: amman.id,
      arrivalCityId: irbid.id,
      pickupLocation: { lat: 31.952, lng: 35.911 },
      dropOffLocation: { lat: 32.5556, lng: 35.85 },
      packageSize: PackageSize.SMALL,
      receiverName: 'R',
      receiverPhone: '0700000002',
      termsAccepted: true,
      isImmediate: false,
      pickupDate: dep3.toISOString(),
      urgent: false,
      weightKg: 2,
    } as unknown as Parameters<typeof packagesService.createDelivery>[1]);
    const p3bRow = await ds
      .getRepository(PackageDelivery)
      .findOne({
        where: { id: p3b.id },
        relations: ['tripGroup'],
      });
    if (p3bRow?.tripGroup?.id === gUrg?.id)
      fails.push(
        `Scenario 3: regular package joined urgent solo group`,
      );
    else
      results.push(
        `Scenario 3: regular package landed in different group #${p3bRow?.tripGroup?.id} ✓`,
      );

    // ── Scenario 4: urgent early-broadcast after N declines ────────
    // Set up 5 drivers so the queue isn't naturally exhausted.
    const drivers = await Promise.all(
      ['S4D1', 'S4D2', 'S4D3', 'S4D4', 'S4D5'].map((t) => mkDriver(t)),
    );

    // Create urgent solo package group and manually run the cascade.
    const s4 = await mkUser('Male', 'S4');
    const p4 = await packagesService.createDelivery(s4.id, {
      departureCityId: amman.id,
      arrivalCityId: irbid.id,
      pickupLocation: { lat: 31.951, lng: 35.91 },
      dropOffLocation: { lat: 32.5556, lng: 35.85 },
      packageSize: PackageSize.SMALL,
      receiverName: 'R',
      receiverPhone: '0700000003',
      termsAccepted: true,
      isImmediate: false,
      pickupDate: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      urgent: true,
      weightKg: 2,
    } as unknown as Parameters<typeof packagesService.createDelivery>[1]);
    const p4Row = await ds
      .getRepository(PackageDelivery)
      .findOne({
        where: { id: p4.id },
        relations: ['tripGroup'],
      });
    const gUrg2 = p4Row!.tripGroup!;

    // Wait a tick so scheduleImmediateCascade fires the first offer.
    await new Promise((r) => setTimeout(r, 200));

    // Simulate 3 declines — each moves cascade to the next candidate.
    // On the 3rd decline the early-broadcast check should trip.
    for (let i = 0; i < 3; i++) {
      const openOffer = await ds
        .getRepository(TripOfferHistory)
        .findOne({
          where: {
            tripGroup: { id: gUrg2.id },
            response: OfferResponse.PENDING,
          },
          relations: ['driverTrip'],
          order: { id: 'DESC' },
        });
      if (!openOffer)
        throw new Error(
          `Scenario 4: no PENDING offer at decline round ${i}`,
        );
      await assignment.handleDecline(openOffer.driverTrip!.id);
    }
    const gUrg2After = await ds
      .getRepository(TripGroup)
      .findOne({ where: { id: gUrg2.id } });
    if (gUrg2After?.status !== TripGroupStatus.BROADCASTING)
      fails.push(
        `Scenario 4: expected BROADCASTING after 3 declines on urgent, got ${gUrg2After?.status}`,
      );
    else
      results.push(
        `Scenario 4: urgent group early-broadcasted after 3 declines ✓`,
      );

    console.log('\n--- PR 6 smoke results ---');
    results.forEach((r) => console.log(r));
    if (fails.length === 0) {
      console.log('\nALL CHECKS PASSED ✓');
    } else {
      console.log('\nFAILURES:');
      fails.forEach((f) => console.log(`  - ${f}`));
      process.exitCode = 1;
    }
  } finally {
    // Scoped cleanup.
    const users = await ds
      .getRepository(User)
      .createQueryBuilder('u')
      .where('u.phoneNumber LIKE :p', { p: `${marker}_%` })
      .getMany();
    const userIds = users.map((u) => u.id);
    const drivers = await ds
      .getRepository(Driver)
      .createQueryBuilder('d')
      .where('d.phoneNumber LIKE :p', { p: `${marker}_%` })
      .getMany();
    const driverIds = drivers.map((d) => d.id);

    const reqs = userIds.length
      ? await ds
          .getRepository(TripRequest)
          .createQueryBuilder('r')
          .where('r.passengerId IN (:...ids)', { ids: userIds })
          .getMany()
      : [];
    const pkgs = userIds.length
      ? await ds
          .getRepository(PackageDelivery)
          .createQueryBuilder('p')
          .where('p.senderId IN (:...ids)', { ids: userIds })
          .getMany()
      : [];
    const groupIds = Array.from(
      new Set([
        ...reqs
          .map(
            (r) =>
              (r as unknown as { tripGroupId?: number }).tripGroupId,
          )
          .filter(Boolean),
        ...pkgs
          .map(
            (p) =>
              (p as unknown as { tripGroupId?: number }).tripGroupId,
          )
          .filter(Boolean),
      ]),
    ) as number[];

    if (driverIds.length) {
      const dtRows = await ds
        .getRepository(DriverTrip)
        .createQueryBuilder('t')
        .where('t.driverId IN (:...ids)', { ids: driverIds })
        .getMany();
      for (const dt of dtRows) {
        await ds.query(
          'DELETE FROM trip_offer_history WHERE "driverTripId" = $1',
          [dt.id],
        );
        await ds.query(
          'DELETE FROM driver_trip_stop_passengers WHERE "stopId" IN (SELECT id FROM driver_trip_stops WHERE "tripId" = $1)',
          [dt.id],
        );
        await ds.query(
          'DELETE FROM driver_trip_stop_packages WHERE "stopId" IN (SELECT id FROM driver_trip_stops WHERE "tripId" = $1)',
          [dt.id],
        );
        await ds.query('DELETE FROM driver_trip_stops WHERE "tripId" = $1', [
          dt.id,
        ]);
        await ds.query(
          'DELETE FROM driver_trip_decline_logs WHERE "tripId" = $1',
          [dt.id],
        );
      }
      if (dtRows.length)
        await ds
          .getRepository(DriverTrip)
          .delete(dtRows.map((t) => t.id));
    }

    if (groupIds.length) {
      await ds
        .getRepository(EscalationCase)
        .createQueryBuilder()
        .delete()
        .where('tripGroupId IN (:...ids)', { ids: groupIds })
        .execute();
      await ds
        .getRepository(TripOfferHistory)
        .createQueryBuilder()
        .delete()
        .where('tripGroupId IN (:...ids)', { ids: groupIds })
        .execute();
    }

    if (reqs.length) {
      await ds
        .getRepository(TripRequest)
        .createQueryBuilder()
        .update()
        .set({ tripGroup: null as unknown as TripGroup })
        .whereInIds(reqs.map((r) => r.id))
        .execute();
      await ds.getRepository(TripRequest).delete(reqs.map((r) => r.id));
    }
    if (pkgs.length) {
      await ds
        .getRepository(PackageDelivery)
        .createQueryBuilder()
        .update()
        .set({ tripGroup: null as unknown as TripGroup })
        .whereInIds(pkgs.map((p) => p.id))
        .execute();
      await ds.getRepository(PackageDelivery).delete(pkgs.map((p) => p.id));
    }
    if (groupIds.length) await ds.getRepository(TripGroup).delete(groupIds);
    if (driverIds.length) {
      for (const did of driverIds) {
        await ds.query(
          'DELETE FROM driver_notifications WHERE "driverId" = $1',
          [did],
        );
      }
      await ds.getRepository(Driver).delete(driverIds);
    }
    if (userIds.length) {
      for (const uid of userIds) {
        await ds.query(
          'DELETE FROM passenger_notifications WHERE "userId" = $1',
          [uid],
        );
      }
      await ds.getRepository(User).delete(userIds);
    }

    await app.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
