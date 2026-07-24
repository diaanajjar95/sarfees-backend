import { ApiProperty } from '@nestjs/swagger';

/**
 * Response for the admin map's "show route for on-trip driver"
 * click. Includes the ordered stops (so the frontend can draw pins
 * for each) and, when the configured MapProvider supports it, the
 * road-following geometry from OSRM.
 */

export class TripStopDto {
  @ApiProperty({ example: 0 }) order: number;
  @ApiProperty({ example: 'pickup' }) type: string;
  @ApiProperty({ example: 31.9539 }) lat: number;
  @ApiProperty({ example: 35.9106 }) lng: number;
  @ApiProperty({ example: 'Amman', nullable: true }) city: string | null;
  @ApiProperty({ nullable: true }) address: string | null;
}

export class TripRouteDto {
  @ApiProperty({ example: 42 }) driverId: number;
  @ApiProperty({ example: 12, nullable: true })
  driverTripId: number | null;
  @ApiProperty({ type: [TripStopDto] }) stops: TripStopDto[];

  /**
   * Total road distance across all legs, in meters. Null if the
   * provider couldn't produce geometry.
   */
  @ApiProperty({ example: 92500, nullable: true })
  meters: number | null;

  /** Same as above but seconds. */
  @ApiProperty({ example: 4180, nullable: true })
  durationSeconds: number | null;

  /**
   * [lng, lat] pairs following the road network. Null when the
   * configured MapProvider doesn't support geometry (e.g. Haversine).
   * When null, the client should draw straight lines between stops.
   */
  @ApiProperty({
    type: 'array',
    items: { type: 'array', items: { type: 'number' } },
    nullable: true,
  })
  geometry: [number, number][] | null;
}
