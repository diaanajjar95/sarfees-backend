import { Injectable, Logger } from '@nestjs/common';
import { LRUCache } from 'lru-cache';
import type {
  DistanceResult,
  LatLng,
  MapProvider,
} from './map-provider.interface';

/**
 * LRU wrapper around any MapProvider. Ships to satisfy master spec
 * §16 "caching strategy — grouping decisions must feel instant to
 * the requester".
 *
 * Key rounds lat/lng to 4 decimal places (~11 m resolution) so tiny
 * GPS jitter still hits cache. Nulls are NOT cached — a transient
 * upstream error shouldn't lock in "no distance available" for 24h.
 */

const COORD_PRECISION = 4;

const round = (n: number): number =>
  Math.round(n * 10 ** COORD_PRECISION) / 10 ** COORD_PRECISION;

const keyFor = (from: LatLng, to: LatLng): string =>
  `${round(from.lat)},${round(from.lng)}|${round(to.lat)},${round(to.lng)}`;

@Injectable()
export class CachedMapProvider implements MapProvider {
  private readonly logger = new Logger(CachedMapProvider.name);
  private readonly cache: LRUCache<string, DistanceResult>;

  constructor(
    private readonly inner: MapProvider,
    opts: { max: number; ttlHours: number },
  ) {
    this.cache = new LRUCache<string, DistanceResult>({
      max: opts.max,
      ttl: opts.ttlHours * 60 * 60 * 1000,
    });
    this.logger.log(
      `Cache configured: max=${opts.max} ttlHours=${opts.ttlHours}`,
    );
  }

  async distance(from: LatLng, to: LatLng): Promise<DistanceResult | null> {
    const key = keyFor(from, to);
    const hit = this.cache.get(key);
    if (hit) return hit;
    const miss = await this.inner.distance(from, to);
    if (miss !== null) this.cache.set(key, miss);
    return miss;
  }

  async matrix(
    origins: LatLng[],
    destinations: LatLng[],
  ): Promise<(DistanceResult | null)[][]> {
    const missOrigins: LatLng[] = [];
    const missOriginIdx: number[] = [];
    const cached: (DistanceResult | null)[][] = origins.map((from) =>
      destinations.map((to) => this.cache.get(keyFor(from, to)) ?? null),
    );
    for (let i = 0; i < origins.length; i++) {
      if (cached[i].some((c) => c === null)) {
        missOrigins.push(origins[i]);
        missOriginIdx.push(i);
      }
    }
    if (missOrigins.length === 0) return cached;

    const fresh = await this.inner.matrix(missOrigins, destinations);
    for (let mi = 0; mi < missOriginIdx.length; mi++) {
      const i = missOriginIdx[mi];
      for (let j = 0; j < destinations.length; j++) {
        if (cached[i][j] !== null) continue;
        const val = fresh[mi]?.[j] ?? null;
        cached[i][j] = val;
        if (val !== null)
          this.cache.set(keyFor(origins[i], destinations[j]), val);
      }
    }
    return cached;
  }
}
