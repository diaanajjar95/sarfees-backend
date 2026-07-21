/**
 * Package auto-match smoke (PR 5).
 *
 *   Scenario 1: Package joins an existing OPEN passenger group.
 *   Scenario 2: Trip-type filter — a driver with prefTripTypes=['shared']
 *     is excluded from cascading a group that carries packages.
 *   Scenario 3: Package weight over the SEDAN weight cap is rejected
 *     at grouping time — the package lands in its own solo group.
 *
 * Scoped cleanup by phone marker.
 */

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { AssignmentService } from '../src/assignment/assignment.service';
import { TripOfferHistory } from '../src/assignment/entities/trip-offer-history.entity';
import { EscalationCase } from '../src/assignment/entities/escalation-case.entity';
import { City } from '../src/cities/city.entity';
import { Driver } from '../src/drivers/driver.entity';
import { DriverTrip } from '../src/driver-trips/entities/driver-trip.entity';
import { TripGroup } from '../src/grouping/entities/trip-group.entity';
import { GroupingService } from '../src/grouping/grouping.service';
import { PackageDelivery } from '../src/packages/entities/package-delivery.entity';
import { DriverStatus } from '../src/shared/enums/driver-status.enum';
import { PackageSize } from '../src/shared/enums/package-size.enum';
import { PackageStatus } from '../src/shared/enums/package-status.enum';
import { TripGroupStatus } from '../src/shared/enums/trip-group-status.enum';
import { TripStatus } from '../src/shared/enums/trip-status.enum';
import { OfferResponse } from '../src/shared/enums/offer-response.enum';
import { VehicleClass } from '../src/shared/enums/vehicle-class.enum';
import { TripRequest } from '../src/trips/entities/trip-request.entity';
import { User } from '../src/users/user.entity';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  const ds = app.get(DataSource);
  const grouping = app.get(GroupingService);
  const assignment = app.get(AssignmentService);

  const cities = await ds.getRepository(City).find();
  const amman = cities.find((c) => c.nameEn === 'Amman')!;
  const irbid = cities.find((c) => c.nameEn === 'Irbid')!;
  const marker = `PKG_${Date.now()}`;

  const results: string[] = [];
  const fails: string[] = [];

  async function mkUser(gender: 'Male' | 'Female', tag: string) {
    return ds.getRepository(User).save(
      ds.getRepository(User).create({
        phoneNumber: `${marker}_U_${tag}`,
        firstName: tag,
        lastName: 'Pkg',
        gender,
        isProfileCompleted: true,
      } as unknown as User),
    );
  }
  async function mkDriver(
    tag: string,
    opts: {
      gender?: 'male' | 'female';
      prefTripTypes?: string[];
      vehicleClass?: VehicleClass | null;
    } = {},
  ) {
    return ds.getRepository(Driver).save(
      ds.getRepository(Driver).create({
        name: tag,
        phoneNumber: `${marker}_D_${tag}`,
        countryCode: '+962',
        status: DriverStatus.ACTIVE,
        gender: opts.gender ?? 'male',
        passengerCapacity: 4,
        prefTripTypes: opts.prefTripTypes ?? ['mixed'],
        vehicleClass: opts.vehicleClass ?? VehicleClass.SEDAN,
        prefLocationLat: 31.9539,
        prefLocationLng: 35.9106,
        homeCity: 'Amman',
      } as unknown as Driver),
    );
  }
  async function mkRequest(passenger: User, travelDate: Date) {
    return ds.getRepository(TripRequest).save(
      ds.getRepository(TripRequest).create({
        passenger: { id: passenger.id },
        departureCity: { id: amman.id },
        arrivalCity: { id: irbid.id },
        departureLocation: { lat: 31.951, lng: 35.91 },
        arrivalLocation: { lat: 32.5556, lng: 35.85 },
        travelDate,
        seatsCount: 1,
        isFemaleOnly: false,
        perSeatFare: '5.00' as unknown as number,
        totalFare: '5.00' as unknown as number,
        status: TripStatus.PENDING,
      } as unknown as TripRequest),
    );
  }
  async function mkPackage(
    sender: User,
    pickupDate: Date,
    size: PackageSize,
    weightKg: number,
  ) {
    return ds.getRepository(PackageDelivery).save(
      ds.getRepository(PackageDelivery).create({
        sender: { id: sender.id },
        departureCity: { id: amman.id },
        arrivalCity: { id: irbid.id },
        pickupLocation: { lat: 31.952, lng: 35.911 },
        dropOffLocation: { lat: 32.5556, lng: 35.85 },
        packageSize: size,
        weightKg: weightKg as unknown as string,
        receiverName: 'Recipient',
        receiverPhone: '0700000000',
        deliveryFee: '3.00' as unknown as number,
        termsAccepted: true,
        pickupDate,
        isImmediate: false,
        status: PackageStatus.PENDING,
        urgent: false,
      } as unknown as PackageDelivery),
    );
  }

  try {
    // ── Scenario 1: Package joins existing passenger group ─────────
    const u1 = await mkUser('Male', 'S1U1');
    const s1 = await mkUser('Male', 'S1S1'); // sender
    const dep1 = new Date(Date.now() + 60 * 60 * 1000);
    const r1 = await mkRequest(u1, dep1);
    const g1 = await grouping.attemptGroupingForTripRequest(r1.id);

    const p1 = await mkPackage(s1, dep1, PackageSize.SMALL, 2);
    const gPkg1 = await grouping.attemptGroupingForPackage(p1.id);
    if (gPkg1?.id !== g1?.id)
      fails.push(
        `Scenario 1: package landed in group #${gPkg1?.id}, expected same as passenger #${g1?.id}`,
      );
    else
      results.push(`Scenario 1: package joined passenger group #${g1?.id} ✓`);

    // ── Scenario 2: passengers-only driver skipped for mixed group ─
    const d1 = await mkDriver('S2D1', {
      prefTripTypes: ['shared'], // passengers-only, no packages
    });
    const d2 = await mkDriver('S2D2', {
      prefTripTypes: ['mixed'],
    });

    // Freeze g1 (which now has both passenger + package) and start cascade.
    await ds
      .getRepository(TripGroup)
      .update(g1!.id, { status: TripGroupStatus.FROZEN, frozenAt: new Date() });
    await assignment.startCascade(g1!.id);

    const offer = await ds.getRepository(TripOfferHistory).findOne({
      where: { tripGroup: { id: g1!.id }, response: OfferResponse.PENDING },
      relations: ['driver'],
    });
    if (!offer)
      fails.push('Scenario 2: no offer created — cascade should have picked d2');
    else if (offer.driver.id === d1.id)
      fails.push(
        `Scenario 2: cascade offered d1 (shared-only) — should have skipped it`,
      );
    else if (offer.driver.id === d2.id)
      results.push(
        `Scenario 2: shared-only driver skipped; mixed driver offered ✓`,
      );

    // ── Scenario 3: Weight cap forces new group ────────────────────
    const s3 = await mkUser('Male', 'S3S1');
    const dep3 = new Date(Date.now() + 90 * 60 * 1000);
    // Sedan weight cap is 50 kg. Two 30 kg packages together (60 kg) exceed it.
    const heavy1 = await mkPackage(s3, dep3, PackageSize.MEDIUM, 30);
    const heavy2 = await mkPackage(s3, dep3, PackageSize.MEDIUM, 30);

    const gHeavy1 = await grouping.attemptGroupingForPackage(heavy1.id);
    const gHeavy2 = await grouping.attemptGroupingForPackage(heavy2.id);
    if (gHeavy1?.id === gHeavy2?.id)
      fails.push(
        `Scenario 3: two heavy packages ended up in the same group (weight cap should have split them)`,
      );
    else
      results.push(
        `Scenario 3: over-weight package split into a new group ✓`,
      );

    console.log('\n--- PR 5 smoke results ---');
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
