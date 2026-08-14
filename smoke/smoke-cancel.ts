/**
 * Cancellation + going-home smoke (PR 4).
 *
 *   Scenario 1: Passenger cancel from an OFFERING group — group
 *     empties and transitions to CANCELLED.
 *   Scenario 2: Driver cancels after accept — group returns to
 *     OFFERING and the next driver receives an offer.
 *   Scenario 3: Trip complete for going-home driver → auto-offline
 *     lock set. Re-activate attempt throws.
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
import { DriversService } from '../src/drivers/drivers.service';
import { DriverTrip } from '../src/driver-trips/entities/driver-trip.entity';
import { TripGroup } from '../src/grouping/entities/trip-group.entity';
import { GroupingService } from '../src/grouping/grouping.service';
import { DriverStatus } from '../src/shared/enums/driver-status.enum';
import { DriverTripStatus } from '../src/shared/enums/driver-trip-status.enum';
import { OfferResponse } from '../src/shared/enums/offer-response.enum';
import { TripGroupStatus } from '../src/shared/enums/trip-group-status.enum';
import { TripStatus } from '../src/shared/enums/trip-status.enum';
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
  const driversService = app.get(DriversService);

  const cities = await ds.getRepository(City).find();
  const amman = cities.find((c) => c.nameEn === 'Amman')!;
  const irbid = cities.find((c) => c.nameEn === 'Irbid')!;
  const marker = `CANCEL_${Date.now()}`;

  const results: string[] = [];
  const fails: string[] = [];

  async function mkUser(gender: 'Male' | 'Female', tag: string) {
    return ds.getRepository(User).save(
      ds.getRepository(User).create({
        phoneNumber: `${marker}_U_${tag}`,
        firstName: tag,
        lastName: 'Cancel',
        gender,
        isProfileCompleted: true,
      } as unknown as User),
    );
  }
  async function mkDriver(tag: string, gender: 'male' | 'female') {
    return ds.getRepository(Driver).save(
      ds.getRepository(Driver).create({
        name: tag,
        phoneNumber: `${marker}_D_${tag}`,
        countryCode: '+962',
        status: DriverStatus.ACTIVE,
        gender,
        passengerCapacity: 4,
        prefTripTypes: ['mixed'],
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

  try {
    // ── Scenario 1: Passenger cancel empties an OFFERING group ─────
    const u1 = await mkUser('Male', 'S1U1');
    const d1 = await mkDriver('S1D1', 'male');
    const dep1 = new Date(Date.now() + 5 * 60 * 1000);
    const r1 = await mkRequest(u1, dep1);
    const g1 = await grouping.attemptGroupingForTripRequest(r1.id);
    await ds
      .getRepository(TripGroup)
      .update(g1!.id, { status: TripGroupStatus.FROZEN, frozenAt: new Date() });
    await assignment.startCascade(g1!.id);

    await tripsService.updateTripStatus(r1.id, {
      status: TripStatus.CANCELLED,
    } as unknown as Parameters<typeof tripsService.updateTripStatus>[1]);

    const g1After = await ds
      .getRepository(TripGroup)
      .findOne({ where: { id: g1!.id } });
    if (g1After?.status !== TripGroupStatus.CANCELLED)
      fails.push(
        `Scenario 1: after passenger cancel, expected CANCELLED, got ${g1After?.status}`,
      );
    else results.push('Scenario 1: passenger cancel → group=CANCELLED ✓');

    // ── Scenario 2: Driver cancels post-accept → cascade restarts ───
    const u2 = await mkUser('Male', 'S2U1');
    const d2 = await mkDriver('S2D1', 'male');
    const d3 = await mkDriver('S2D2', 'male');
    // Deactivate d1 so it doesn't accidentally match S2.
    await ds
      .getRepository(Driver)
      .update(d1.id, { status: DriverStatus.INACTIVE });

    const dep2 = new Date(Date.now() + 5 * 60 * 1000);
    const r2 = await mkRequest(u2, dep2);
    const g2 = await grouping.attemptGroupingForTripRequest(r2.id);
    await ds
      .getRepository(TripGroup)
      .update(g2!.id, { status: TripGroupStatus.FROZEN, frozenAt: new Date() });
    await assignment.startCascade(g2!.id);

    // The first cascade offer goes to some driver. Accept it, then
    // simulate driver cancel.
    const offer1 = await ds.getRepository(TripOfferHistory).findOne({
      where: { tripGroup: { id: g2!.id }, response: OfferResponse.PENDING },
      relations: ['driver', 'driverTrip'],
    });
    if (!offer1) throw new Error('Scenario 2: no PENDING offer after cascade');
    await assignment.handleAcceptance(offer1.driverTrip!.id);

    // Now simulate the accepted driver cancelling.
    await assignment.handleDriverCancel(offer1.driverTrip!.id);

    // Group should be back in OFFERING with a new PENDING offer to
    // the OTHER driver.
    const g2After = await ds
      .getRepository(TripGroup)
      .findOne({ where: { id: g2!.id } });
    if (g2After?.status !== TripGroupStatus.OFFERING)
      fails.push(
        `Scenario 2: after driver cancel, expected OFFERING, got ${g2After?.status}`,
      );
    const newOffer = await ds
      .getRepository(TripOfferHistory)
      .findOne({
        where: { tripGroup: { id: g2!.id }, response: OfferResponse.PENDING },
        relations: ['driver'],
        order: { id: 'DESC' },
      });
    if (!newOffer)
      fails.push('Scenario 2: no new PENDING offer after driver cancel');
    else if (newOffer.driver.id === offer1.driver.id)
      fails.push('Scenario 2: cascade re-offered same driver');
    else
      results.push(
        `Scenario 2: driver cancel → cascade re-offered driver #${newOffer.driver.id} ✓`,
      );

    // The prior offer row should now be CANCEL_AFTER_ACCEPT.
    const oldOffer = await ds
      .getRepository(TripOfferHistory)
      .findOne({ where: { id: offer1.id } });
    if (oldOffer?.response !== OfferResponse.CANCEL_AFTER_ACCEPT)
      fails.push(
        `Scenario 2: old offer expected CANCEL_AFTER_ACCEPT, got ${oldOffer?.response}`,
      );

    // ── Scenario 3: Going-home auto-offline blocks re-activate ──────
    const d4 = await mkDriver('S3D1', 'male');
    // Simulate the driver having just come home from Irbid to Amman.
    // Set goingHomeOfflineUntil to tomorrow.
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await ds.getRepository(Driver).update(d4.id, {
      status: DriverStatus.INACTIVE,
      goingHomeOfflineUntil: tomorrow,
    });

    let threw = false;
    try {
      await driversService.activate(d4.id, {
        tripTypes: ['mixed'],
        goingHome: false,
        destinationCity: 'Irbid',
      } as unknown as Parameters<typeof driversService.activate>[1]);
    } catch (err) {
      threw = true;
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('went home for the day')) {
        fails.push(
          `Scenario 3: activate threw but wrong message: ${msg}`,
        );
      } else {
        results.push(
          'Scenario 3: going-home lock blocks re-activate ✓',
        );
      }
    }
    if (!threw)
      fails.push('Scenario 3: activate should have thrown ForbiddenException');

    console.log('\n--- PR 4 smoke results ---');
    results.forEach((r) => console.log(r));
    if (fails.length === 0) {
      console.log('\nALL CHECKS PASSED ✓');
    } else {
      console.log('\nFAILURES:');
      fails.forEach((f) => console.log(`  - ${f}`));
      process.exitCode = 1;
    }
  } finally {
    // Scoped cleanup — everything keyed on the marker phone prefix.
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
    const groupIds = Array.from(
      new Set(
        reqs
          .map(
            (r) =>
              (r as unknown as { tripGroupId?: number }).tripGroupId,
          )
          .filter(Boolean),
      ),
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
