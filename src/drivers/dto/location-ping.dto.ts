import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, Max, Min } from 'class-validator';

/**
 * High-frequency location ping from the driver app while the driver is
 * active. Sent independently of trip lifecycle — used by the matcher
 * (latest snapshot on the driver row) and by passenger "where is my
 * driver?" views (history in driver_locations).
 *
 * Recommended cadence: every 5–10 seconds while active, paused while
 * inactive. The endpoint is intentionally fire-and-forget — clients
 * shouldn't wait on the response to send the next ping.
 *
 * Only `lat` / `lng` are accepted. The `driver_locations` table still
 * has nullable `heading` / `speed` / `accuracy` columns — they get
 * written as NULL going forward.
 */
export class LocationPingDto {
  @ApiProperty({ example: 31.9539, description: 'Latitude in WGS84.' })
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat: number;

  @ApiProperty({ example: 35.9106, description: 'Longitude in WGS84.' })
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng: number;
}

export class LocationPingResponseDto {
  @ApiProperty({ description: 'DB id of the recorded ping (for debugging).' })
  id: number;
  @ApiProperty({ description: 'Server-side timestamp.' })
  recordedAt: Date;
}
