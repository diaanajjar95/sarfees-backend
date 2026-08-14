/**
 * Mapbox integration smoke. Confirms the provider stack does what
 * the plan says:
 *
 *   1. MAP_PROVIDER=mapbox + valid token → CachedMapProvider(MapboxMapProvider)
 *   2. Amman ↔ Irbid distance uses real roads (~75 km) not straight
 *      lines (~66 km Haversine)
 *   3. Same-coords call twice → second is a cache hit (no HTTP)
 *   4. MAP_PROVIDER=mapbox + missing/invalid token → falls back to
 *      Haversine on boot (no crash)
 *
 * Prereqs before running:
 *   - Sign up at https://account.mapbox.com/ (free)
 *   - Copy your default public token from
 *     https://account.mapbox.com/access-tokens/ (starts with `pk.`)
 *   - Add to .env:
 *       MAP_PROVIDER=mapbox
 *       MAPBOX_ACCESS_TOKEN=pk.your.token.here
 *
 * Run:  npx ts-node --transpile-only smoke/smoke-mapbox.ts
 */

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import {
  MAP_PROVIDER,
  type MapProvider,
} from '../src/shared/map/map-provider.interface';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  const provider = app.get<MapProvider>(MAP_PROVIDER);

  // Amman center ↔ Irbid center. Real road distance ~75 km on the
  // Amman-Irbid highway; straight-line Haversine is ~66 km.
  const amman = { lat: 31.9539, lng: 35.9106 };
  const irbid = { lat: 32.5556, lng: 35.85 };

  console.log('\n--- Mapbox smoke ---');
  console.log(
    `Provider class chain: ${provider.constructor.name}${
      // Peek inner if wrapped by CachedMapProvider
      (provider as unknown as { inner?: { constructor: { name: string } } })
        .inner
        ? ` → ${(provider as unknown as { inner: { constructor: { name: string } } }).inner.constructor.name}`
        : ''
    }`,
  );

  const t0 = Date.now();
  const first = await provider.distance(amman, irbid);
  const t1 = Date.now();
  console.log(
    `First call: ${first ? `${(first.meters / 1000).toFixed(1)} km, ${Math.round(first.durationSeconds / 60)} min (${t1 - t0}ms)` : 'null (fallback path?)'}`,
  );

  const t2 = Date.now();
  const second = await provider.distance(amman, irbid);
  const t3 = Date.now();
  console.log(
    `Second call: ${second ? `${(second.meters / 1000).toFixed(1)} km, ${Math.round(second.durationSeconds / 60)} min (${t3 - t2}ms)` : 'null'}`,
  );

  console.log('\n--- Verdict ---');
  if (!first) {
    console.log(
      '✗ First call returned null. Check MAPBOX_ACCESS_TOKEN in .env, or watch server logs for "MAP_PROVIDER=mapbox but MAPBOX_ACCESS_TOKEN is empty".',
    );
  } else if (first.meters / 1000 > 70) {
    console.log(
      `✓ Road distance ${(first.meters / 1000).toFixed(1)} km — Mapbox is answering (Haversine straight-line would be ~66 km).`,
    );
  } else {
    console.log(
      `⚠ Distance ${(first.meters / 1000).toFixed(1)} km looks straight-line — you're probably on the Haversine fallback. Check MapModule boot log for "Using HaversineMapProvider" instead of "Using CachedMapProvider(MapboxMapProvider)".`,
    );
  }

  if (second && t3 - t2 < 10) {
    console.log(
      `✓ Second call resolved in ${t3 - t2}ms — cache hit.`,
    );
  } else if (second) {
    console.log(
      `⚠ Second call took ${t3 - t2}ms — cache may not be wired (expected <10ms).`,
    );
  }

  await app.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
