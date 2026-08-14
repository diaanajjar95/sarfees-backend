import { ApiProperty } from '@nestjs/swagger';
import { DriverStatus } from '../../../shared/enums/driver-status.enum';

/**
 * One pin on the admin live-driver map. Deliberately lean — the map
 * polls this endpoint every 30 s per session, so we ship only what
 * the marker + popup actually need.
 */
export class LiveMapDriverDto {
  @ApiProperty({ example: 42 })
  id: number;

  @ApiProperty({ example: 'Ahmad K.' })
  name: string;

  @ApiProperty({ example: '+962', nullable: true })
  countryCode: string | null;

  @ApiProperty({ example: '791234567', nullable: true })
  phoneNumber: string | null;

  @ApiProperty({ enum: DriverStatus, example: DriverStatus.ACTIVE })
  status: DriverStatus;

  @ApiProperty({ example: 31.9539 })
  lat: number;

  @ApiProperty({ example: 35.9106 })
  lng: number;

  /**
   * Driver.updatedAt — bumped on any driver save, most notably on
   * location pings. Good enough as a "how fresh is this dot" signal
   * for the admin UI. ISO 8601.
   */
  @ApiProperty({ example: '2026-07-23T12:34:56.000Z' })
  updatedAt: string;
}

export class LiveMapResponseDto {
  @ApiProperty({ type: [LiveMapDriverDto] })
  drivers: LiveMapDriverDto[];

  @ApiProperty({ example: '2026-07-23T12:34:56.000Z' })
  generatedAt: string;
}
