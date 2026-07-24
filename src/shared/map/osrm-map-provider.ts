import { Injectable, Logger } from '@nestjs/common';
import type {
  DistanceResult,
  LatLng,
  MapProvider,
} from './map-provider.interface';

/**
 * OSRM MapProvider — hits a self-hosted OSRM instance for real road
 * distance + duration. Perfect fit for a country-scoped app: prep
 * Jordan-only OSM data once, run the container next to Postgres,
 * pay zero per-request cost forever.
 *
 * Uses native fetch (Node 20+) with a 3-second AbortController
 * timeout per §16 "must feel instant". Returns null on any error so
 * the caller can fall back to Haversine.
 *
 * OSRM Table (matrix) endpoint accepts up to 100 coordinates by
 * default (compile-time limit); we defensively cap at 100 and let
 * callers chunk if they ever ask for more.
 */

const REQUEST_TIMEOUT_MS = 3000;
const MATRIX_MAX_COORDS = 100;

@Injectable()
export class OsrmMapProvider implements MapProvider {
  private readonly logger = new Logger(OsrmMapProvider.name);

  constructor(private readonly baseUrl: string) {}

  async distance(from: LatLng, to: LatLng): Promise<DistanceResult | null> {
    const coords = `${from.lng},${from.lat};${to.lng},${to.lat}`;
    const url = `${this.baseUrl}/route/v1/driving/${coords}?overview=false&alternatives=false&steps=false`;

    try {
      const res = await this.fetchWithTimeout(url);
      if (!res.ok) {
        this.logger.warn(
          `OSRM Route ${res.status} — returning null for fallback`,
        );
        return null;
      }
      const body = (await res.json()) as {
        code?: string;
        routes?: Array<{ distance?: number; duration?: number }>;
      };
      if (body.code !== 'Ok') {
        this.logger.warn(`OSRM Route code=${body.code} — returning null`);
        return null;
      }
      const route = body.routes?.[0];
      if (!route || route.distance == null || route.duration == null) {
        return null;
      }
      return {
        meters: route.distance,
        durationSeconds: Math.round(route.duration),
      };
    } catch (err) {
      this.logger.warn(
        `OSRM Route error: ${(err as Error).message} — returning null`,
      );
      return null;
    }
  }

  async matrix(
    origins: LatLng[],
    destinations: LatLng[],
  ): Promise<(DistanceResult | null)[][]> {
    const total = origins.length + destinations.length;
    if (total > MATRIX_MAX_COORDS) {
      this.logger.warn(
        `OSRM Table would need ${total} coords > cap ${MATRIX_MAX_COORDS} — returning null rows`,
      );
      return origins.map(() => destinations.map(() => null));
    }

    const coords = [...origins, ...destinations]
      .map((c) => `${c.lng},${c.lat}`)
      .join(';');
    const sources = origins.map((_, i) => i).join(';');
    const dests = destinations.map((_, i) => i + origins.length).join(';');

    const url =
      `${this.baseUrl}/table/v1/driving/${coords}` +
      `?sources=${sources}&destinations=${dests}` +
      `&annotations=distance,duration`;

    try {
      const res = await this.fetchWithTimeout(url);
      if (!res.ok) {
        this.logger.warn(
          `OSRM Table ${res.status} — returning null rows`,
        );
        return origins.map(() => destinations.map(() => null));
      }
      const body = (await res.json()) as {
        code?: string;
        distances?: (number | null)[][];
        durations?: (number | null)[][];
      };
      if (body.code !== 'Ok') {
        this.logger.warn(`OSRM Table code=${body.code} — returning null rows`);
        return origins.map(() => destinations.map(() => null));
      }
      const distances = body.distances ?? [];
      const durations = body.durations ?? [];
      return origins.map((_, i) =>
        destinations.map((_, j) => {
          const m = distances[i]?.[j];
          const d = durations[i]?.[j];
          if (m == null || d == null) return null;
          return { meters: m, durationSeconds: Math.round(d) };
        }),
      );
    } catch (err) {
      this.logger.warn(
        `OSRM Table error: ${(err as Error).message} — returning null rows`,
      );
      return origins.map(() => destinations.map(() => null));
    }
  }

  private async fetchWithTimeout(url: string): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      return await fetch(url, { signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }
}
