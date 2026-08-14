/**
 * Grouping smoke — drives GroupingService directly (bypasses HTTP auth).
 *
 * Creates 4 requests around the same corridor + time and asserts:
 *   1. Two compatible males with overlapping departures land in the SAME group.
 *   2. A female-only request lands in a DIFFERENT group (§7 hard rule).
 *   3. A request departing 30 min later (out of tolerance) lands in a
 *      DIFFERENT group.
 *
 * Only cleans up rows it created (identified by phone marker).
 */

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { City } from '../src/cities/city.entity';
import { TripGroup } from '../src/grouping/entities/trip-group.entity';
import { GroupingService } from '../src/grouping/grouping.service';
import { TripStatus } from '../src/shared/enums/trip-status.enum';
import { TripRequest } from '../src/trips/entities/trip-request.entity';
import { User } from '../src/users/user.entity';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  const ds = app.get(DataSource);
  const grouping = app.get(GroupingService);

  const cities = await ds.getRepository(City).find();
  const amman = cities.find((c) => c.nameEn === 'Amman')!;
  const irbid = cities.find((c) => c.nameEn === 'Irbid')!;

  const now = new Date();
  const base = new Date(now.getTime() + 60 * 60 * 1000);
  const later = new Date(now.getTime() + 90 * 60 * 1000);

  const marker = `SMOKE_${now.getTime()}`;

  async function mkUser(gender: 'Male' | 'Female', tag: string) {
    const u = ds.getRepository(User).create({
      phoneNumber: `${marker}_${tag}`,
      firstName: tag,
      lastName: 'Smoke',
      gender,
      isProfileCompleted: true,
    } as unknown as User);
    return ds.getRepository(User).save(u);
  }

  async function mkRequest(
    passenger: User,
    travelDate: Date,
    isFemaleOnly: boolean,
    pickupLat: number,
    pickupLng: number,
  ) {
    const r = ds.getRepository(TripRequest).create({
      passenger: { id: passenger.id },
      departureCity: { id: amman.id },
      arrivalCity: { id: irbid.id },
      departureLocation: { lat: pickupLat, lng: pickupLng },
      arrivalLocation: { lat: 32.5556, lng: 35.85 },
      travelDate,
      seatsCount: 1,
      isFemaleOnly,
      perSeatFare: '5.00' as unknown as number,
      totalFare: '5.00' as unknown as number,
      status: TripStatus.PENDING,
    } as unknown as TripRequest);
    return ds.getRepository(TripRequest).save(r);
  }

  const results: string[] = [];
  const fails: string[] = [];

  try {
    const u1 = await mkUser('Male', 'M1');
    const r1 = await mkRequest(u1, base, false, 31.951, 35.91);
    const g1 = await grouping.attemptGroupingForTripRequest(r1.id);
    results.push(`Case 1 (male, T+60):        req=${r1.id}, group=${g1?.id}`);

    const u2 = await mkUser('Male', 'M2');
    const r2 = await mkRequest(u2, base, false, 31.955, 35.912);
    const g2 = await grouping.attemptGroupingForTripRequest(r2.id);
    results.push(`Case 2 (male, T+60):        req=${r2.id}, group=${g2?.id}`);
    if (g1?.id !== g2?.id) fails.push('Case 2 should share group with Case 1');

    const u3 = await mkUser('Female', 'F1');
    const r3 = await mkRequest(u3, base, true, 31.953, 35.911);
    const g3 = await grouping.attemptGroupingForTripRequest(r3.id);
    results.push(`Case 3 (female-only, T+60): req=${r3.id}, group=${g3?.id}`);
    if (g3?.id === g1?.id)
      fails.push('Case 3 (women-only) must NOT share group with Case 1 (mixed)');

    const u4 = await mkUser('Male', 'M3');
    const r4 = await mkRequest(u4, later, false, 31.952, 35.911);
    const g4 = await grouping.attemptGroupingForTripRequest(r4.id);
    results.push(`Case 4 (male, T+90 → OOT):  req=${r4.id}, group=${g4?.id}`);
    if (g4?.id === g1?.id)
      fails.push('Case 4 (out-of-tolerance) must NOT share group with Case 1');

    console.log('\n--- Grouping smoke results ---');
    results.forEach((r) => console.log(r));

    if (fails.length === 0) {
      console.log('\nALL CHECKS PASSED ✓');
    } else {
      console.log('\nFAILURES:');
      fails.forEach((f) => console.log(`  - ${f}`));
      process.exitCode = 1;
    }
  } finally {
    const users = await ds
      .getRepository(User)
      .createQueryBuilder('u')
      .where('u.phoneNumber LIKE :p', { p: `${marker}_%` })
      .getMany();
    const userIds = users.map((u) => u.id);
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
            (r) => (r as unknown as { tripGroupId?: number }).tripGroupId,
          )
          .filter(Boolean),
      ),
    ) as number[];
    if (reqs.length) await ds.getRepository(TripRequest).delete(reqs.map((r) => r.id));
    if (groupIds.length) await ds.getRepository(TripGroup).delete(groupIds);
    if (userIds.length) await ds.getRepository(User).delete(userIds);

    await app.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
