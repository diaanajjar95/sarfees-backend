import { Global, Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CachedMapProvider } from './cached-map-provider';
import { HaversineMapProvider } from './haversine-map-provider';
import { MAP_PROVIDER } from './map-provider.interface';
import type { MapProvider } from './map-provider.interface';
import { MapboxMapProvider } from './mapbox-map-provider';
import { OsrmMapProvider } from './osrm-map-provider';

const logger = new Logger('MapModule');

/**
 * Global map-provider module. One DI token, MAP_PROVIDER, is exported
 * everywhere. The concrete provider is selected at boot from the
 * MAP_PROVIDER env var:
 *   - `osrm`      → CachedMapProvider(OsrmMapProvider)   (self-hosted, free)
 *   - `mapbox`    → CachedMapProvider(MapboxMapProvider) (paid, road-accurate)
 *   - `haversine` → HaversineMapProvider                 (in-process, straight-line)
 *
 * Any misconfiguration (missing token/URL, invalid choice) logs an
 * error and falls back to Haversine so the app always boots.
 */

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: MAP_PROVIDER,
      inject: [ConfigService],
      useFactory: (cfg: ConfigService): MapProvider => {
        const choice = (cfg.get<string>('MAP_PROVIDER') ?? 'haversine')
          .trim()
          .toLowerCase();

        const cacheMax = Number(
          cfg.get<string>('MAP_CACHE_MAX_ENTRIES') ?? 10000,
        );
        const cacheTtlHours = Number(
          cfg.get<string>('MAP_CACHE_TTL_HOURS') ?? 24,
        );

        if (choice === 'mapbox') {
          const token = cfg.get<string>('MAPBOX_ACCESS_TOKEN') ?? '';
          if (!token) {
            logger.error(
              'MAP_PROVIDER=mapbox but MAPBOX_ACCESS_TOKEN is empty — falling back to Haversine. Set the token to enable road distances.',
            );
            return new HaversineMapProvider();
          }
          const baseUrl =
            cfg.get<string>('MAPBOX_BASE_URL') ?? 'https://api.mapbox.com';
          logger.log('Using CachedMapProvider(MapboxMapProvider)');
          return new CachedMapProvider(
            new MapboxMapProvider(baseUrl, token),
            { max: cacheMax, ttlHours: cacheTtlHours },
          );
        }

        if (choice === 'osrm') {
          const baseUrl = cfg.get<string>('OSRM_BASE_URL') ?? '';
          if (!baseUrl) {
            logger.error(
              'MAP_PROVIDER=osrm but OSRM_BASE_URL is empty — falling back to Haversine. Set to e.g. http://osrm:5000',
            );
            return new HaversineMapProvider();
          }
          logger.log(`Using CachedMapProvider(OsrmMapProvider) at ${baseUrl}`);
          return new CachedMapProvider(
            new OsrmMapProvider(baseUrl.replace(/\/$/, '')),
            { max: cacheMax, ttlHours: cacheTtlHours },
          );
        }

        if (choice !== 'haversine') {
          logger.warn(
            `MAP_PROVIDER=${choice} is not shipped yet — falling back to Haversine.`,
          );
        } else {
          logger.log('Using HaversineMapProvider');
        }
        return new HaversineMapProvider();
      },
    },
  ],
  exports: [MAP_PROVIDER],
})
export class MapModule {}
