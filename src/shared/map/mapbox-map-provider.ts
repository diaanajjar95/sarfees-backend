import { Injectable, Logger } from '@nestjs/common';
import type {
  DistanceResult,
  LatLng,
  MapProvider,
} from './map-provider.interface';

/**
 * Mapbox MapProvider — hits Directions API for distance() and
 * Matrix API for matrix(). Uses native fetch (Node 20+) with a
 * 3-second AbortController timeout per §16 "must feel instant".
 *
 * Returns null on any error (non-2xx, 429, missing token, network
 * blip, timeout). Callers fall back to Haversine.
 *
 * Matrix API caps at 25 coordinates per request; if we ever exceed
 * that we'd need to chunk here — matcher today never approaches it.
 */

const REQUEST_TIMEOUT_MS = 3000;
const MATRIX_MAX_COORDS = 25;

@Injectable()
export class MapboxMapProvider implements MapProvider {
  private readonly logger = new Logger(MapboxMapProvider.name);

  constructor(
    private readonly baseUrl: string,
    private readonly accessToken: string,
  ) {}

  async distance(from: LatLng, to: LatLng): Promise<DistanceResult | null> {
    if (!this.accessToken) {
      this.logger.warn('MAPBOX_ACCESS_TOKEN empty — returning null');
      return null;
    }
    const coords = `${from.lng},${from.lat};${to.lng},${to.lat}`;
    const url = `${this.baseUrl}/directions/v5/mapbox/driving/${coords}?access_token=${this.accessToken}&overview=false`;

    try {
      const res = await this.fetchWithTimeout(url);
      if (!res.ok) {
        this.logger.warn(
          `Mapbox Directions ${res.status} — returning null for fallback`,
        );
        return null;
      }
      const body = (await res.json()) as {
        routes?: Array<{ distance?: number; duration?: number }>;
      };
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
        `Mapbox Directions error: ${(err as Error).message} — returning null`,
      );
      return null;
    }
  }

  async matrix(
    origins: LatLng[],
    destinations: LatLng[],
  ): Promise<(DistanceResult | null)[][]> {
    if (!this.accessToken) {
      this.logger.warn('MAPBOX_ACCESS_TOKEN empty — returning null rows');
      return origins.map(() => destinations.map(() => null));
    }
    const totalCoords = origins.length + destinations.length;
    if (totalCoords > MATRIX_MAX_COORDS) {
      this.logger.warn(
        `Mapbox Matrix would need ${totalCoords} coords > cap ${MATRIX_MAX_COORDS} — returning null rows`,
      );
      return origins.map(() => destinations.map(() => null));
    }

    const coords = [...origins, ...destinations]
      .map((c) => `${c.lng},${c.lat}`)
      .join(';');
    const sourceIdxs = origins.map((_, i) => i).join(';');
    const destIdxs = destinations
      .map((_, i) => i + origins.length)
      .join(';');

    const url =
      `${this.baseUrl}/directions-matrix/v1/mapbox/driving/${coords}` +
      `?sources=${sourceIdxs}&destinations=${destIdxs}` +
      `&annotations=distance,duration&access_token=${this.accessToken}`;

    try {
      const res = await this.fetchWithTimeout(url);
      if (!res.ok) {
        this.logger.warn(`Mapbox Matrix ${res.status} — returning null rows`);
        return origins.map(() => destinations.map(() => null));
      }
      const body = (await res.json()) as {
        distances?: (number | null)[][];
        durations?: (number | null)[][];
      };
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
        `Mapbox Matrix error: ${(err as Error).message} — returning null rows`,
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
