import { Injectable } from '@nestjs/common';
import type {
  DistanceResult,
  LatLng,
  MapProvider,
} from './map-provider.interface';
import { haversineMeters } from './haversine.util';

/**
 * Straight-line MapProvider. Always available, zero external cost,
 * no accuracy against road networks. Serves as:
 *   - the local-dev default (no Mapbox token needed)
 *   - the failure fallback when a paid provider returns null
 *
 * Duration is estimated as distance / avg-speed. Avg speed defaults
 * to 40 km/h — the same figure the previous DriversService.etaMinutesTo
 * helper used, so ETA outputs stay identical on migration.
 */

const AVG_KMH = 40;

@Injectable()
export class HaversineMapProvider implements MapProvider {
  async distance(from: LatLng, to: LatLng): Promise<DistanceResult | null> {
    const meters = haversineMeters(from.lat, from.lng, to.lat, to.lng);
    const durationSeconds = Math.round((meters / 1000 / AVG_KMH) * 3600);
    return { meters, durationSeconds };
  }

  async matrix(
    origins: LatLng[],
    destinations: LatLng[],
  ): Promise<(DistanceResult | null)[][]> {
    const rows: (DistanceResult | null)[][] = [];
    for (const origin of origins) {
      const row: (DistanceResult | null)[] = [];
      for (const dest of destinations) {
        row.push(await this.distance(origin, dest));
      }
      rows.push(row);
    }
    return rows;
  }
}
