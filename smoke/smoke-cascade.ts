/**
 * Cascade smoke — exercises AssignmentService end-to-end without HTTP.
 *
 *   Scenario 1: Group with 1 request + 2 online drivers.
 *     - Freeze the group manually (set departure to now)
 *     - Call sweeper tick → group goes FROZEN → OFFERING; first driver
 *       gets a TripOfferHistory row + a DriverTrip in OFFERED.
 *     - Simulate driver decline → offer moves to next driver.
 *     - Simulate driver accept → group ASSIGNED; other driver's offer
 *       (if any) SUPERSEDED.
 *
 *   Scenario 2: Group with 1 request + 0 online drivers → escalation.
 *     - After first sweep, cascade finds no candidates → BROADCASTING.
 *     - Broadcast round also empty → UNSERVED_ESCALATION + escalation
 *       row created.
 *
 * Cleans up its own rows on exit.
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
import { DriverStatus } from '../src/shared/enums/driver-status.enum';
import { OfferResponse } from '../src/shared/enums/offer-response.enum';
import { TripGroupStatus } from '../src/shared/enums/trip-group-status.enum';
import { TripStatus } from '../src/shared/enums/trip-status.enum';
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

  const marker = `CASCADE_${Date.now()}`;
  const results: string[] = [];
  const fails: string[] = [];

  async function mkUser(gender: 'Male' | 'Female', tag: string) {
    return ds.getRepository(User).save(
      ds.getRepository(User).create({
        phoneNumber: `${marker}_U_${tag}`,
        firstName: tag,
        lastName: 'Cascade',
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

  const createdUserIds: number[] = [];
  const createdDriverIds: number[] = [];

  try {
    // ─── Scenario 1: cascade → accept ────────────────────────
    const u1 = await mkUser('Male', 'S1U1');
    createdUserIds.push(u1.id);
    const d1 = await mkDriver('S1D1', 'male');
    const d2 = await mkDriver('S1D2', 'male');
    createdDriverIds.push(d1.id, d2.id);

    // Depart in 5 min so the sweeper freezes it immediately.
    const dep1 = new Date(Date.now() + 5 * 60 * 1000);
    const r1 = await mkRequest(u1, dep1);
    const g1 = await grouping.attemptGroupingForTripRequest(r1.id);
    if (!g1) throw new Error('Group not created');
    results.push(`Scenario 1: created group=${g1.id}, drivers=[${d1.id}, ${d2.id}]`);

    // Freeze + fire cascade manually (we don't want to wait for the
    // cron tick).
    await ds.getRepository(TripGroup).update(g1.id, {
      status: TripGroupStatus.FROZEN,
      frozenAt: new Date(),
    });
    await assignment.startCascade(g1.id);

    const offer1 = await ds.getRepository(TripOfferHistory).findOne({
      where: { tripGroup: { id: g1.id }, response: OfferResponse.PENDING },
      relations: ['driver', 'driverTrip'],
    });
    if (!offer1)
      fails.push('Scenario 1: no PENDING offer after startCascade');
    else
      results.push(
        `  → first offer to driver #${offer1.driver.id}, driverTrip #${offer1.driverTrip?.id}`,
      );

    // Simulate decline.
    if (offer1?.driverTrip) {
      await assignment.handleDecline(offer1.driverTrip.id);
    }
    const offer2 = await ds.getRepository(TripOfferHistory).findOne({
      where: { tripGroup: { id: g1.id }, response: OfferResponse.PENDING },
      relations: ['driver', 'driverTrip'],
      order: { id: 'DESC' },
    });
    if (!offer2)
      fails.push('Scenario 1: no PENDING offer after decline');
    else if (offer1 && offer2.driver.id === offer1.driver.id)
      fails.push('Scenario 1: second offer went to same driver');
    else
      results.push(
        `  → after decline, offer to driver #${offer2?.driver.id}`,
      );

    // Simulate accept.
    if (offer2?.driverTrip) {
      await assignment.handleAcceptance(offer2.driverTrip.id);
    }
    const g1Final = await ds.getRepository(TripGroup).findOne({
      where: { id: g1.id },
    });
    if (g1Final?.status !== TripGroupStatus.ASSIGNED)
      fails.push(
        `Scenario 1: after accept, group status=${g1Final?.status} (want ASSIGNED)`,
      );
    else results.push('  → after accept, group=ASSIGNED ✓');

    // ─── Scenario 2: no candidates → broadcast → escalation ─
    const u2 = await mkUser('Male', 'S2U1');
    createdUserIds.push(u2.id);
    // Deliberately NO drivers online for this run
    const dep2 = new Date(Date.now() + 5 * 60 * 1000);
    const r2 = await mkRequest(u2, dep2);
    // Deactivate S1 drivers so they don't accidentally match.
    await ds.getRepository(Driver).update(
      [d1.id, d2.id],
      { status: DriverStatus.INACTIVE },
    );
    const g2 = await grouping.attemptGroupingForTripRequest(r2.id);
    if (!g2) throw new Error('Group 2 not created');
    results.push(`Scenario 2: created group=${g2.id} (no eligible drivers)`);

    await ds.getRepository(TripGroup).update(g2.id, {
      status: TripGroupStatus.FROZEN,
      frozenAt: new Date(),
    });
    await assignment.startCascade(g2.id);

    const g2AfterCascade = await ds.getRepository(TripGroup).findOne({
      where: { id: g2.id },
    });
    results.push(
      `  → after cascade with no candidates, status=${g2AfterCascade?.status}`,
    );
    // Since we removed drivers before cascade, sendNextOffer should
    // find nobody → escalateOrBroadcast → BROADCASTING → escalate.
    if (g2AfterCascade?.status !== TripGroupStatus.UNSERVED_ESCALATION)
      fails.push(
        `Scenario 2: expected UNSERVED_ESCALATION, got ${g2AfterCascade?.status}`,
      );

    const esc = await ds.getRepository(EscalationCase).findOne({
      where: { tripGroup: { id: g2.id } },
    });
    if (!esc)
      fails.push('Scenario 2: expected escalation_case row, found none');
    else results.push(`  → escalation_case #${esc.id} created ✓`);

    console.log('\n--- Cascade smoke results ---');
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

    // Delete children first — order matters for FK integrity.
    if (groupIds.length) {
      await ds.getRepository(EscalationCase).delete({
        tripGroup: { id: groupIds[0] },
      });
      for (const gid of groupIds) {
        await ds.getRepository(EscalationCase).delete({ tripGroup: { id: gid } });
      }
    }

    if (groupIds.length) {
      const offers = await ds
        .getRepository(TripOfferHistory)
        .createQueryBuilder('o')
        .where('o.tripGroupId IN (:...ids)', { ids: groupIds })
        .getMany();
      if (offers.length)
        await ds
          .getRepository(TripOfferHistory)
          .delete(offers.map((o) => o.id));
    }

    if (reqs.length) {
      // Detach FK to groups on requests.
      await ds
        .getRepository(TripRequest)
        .createQueryBuilder()
        .update()
        .set({ tripGroup: null as unknown as TripGroup })
        .whereInIds(reqs.map((r) => r.id))
        .execute();

      // Find any DriverTrips created for our test drivers, then wipe
      // every table that FKs into them.
      const dtRows = driverIds.length
        ? await ds
            .getRepository(DriverTrip)
            .createQueryBuilder('t')
            .where('t.driverId IN (:...ids)', { ids: driverIds })
            .getMany()
        : [];

      // Extra offer_history rows keyed on driver_trip (belt & suspenders
      // — the group-id sweep above should already have gotten them).
      for (const dt of dtRows) {
        await ds.query(
          'DELETE FROM trip_offer_history WHERE "driverTripId" = $1',
          [dt.id],
        );
      }

      for (const dt of dtRows) {
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
      await ds.getRepository(TripRequest).delete(reqs.map((r) => r.id));
    }
    if (groupIds.length) await ds.getRepository(TripGroup).delete(groupIds);
    if (driverIds.length) {
      await ds.query(
        'DELETE FROM driver_notifications WHERE "driverId" IN (' +
          driverIds.map(() => '?').join(',').replace(/\?/g, '$1') +
          ')',
        driverIds,
      ).catch(() => {
        // fallback loop
      });
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
