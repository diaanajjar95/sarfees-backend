import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LastTripSummaryDto {
  @ApiProperty({ example: 'Irbid' }) origin: string;
  @ApiProperty({ example: 'Amman' }) destination: string;
  @ApiProperty() completedAt: Date;
  @ApiProperty({ example: 12.5 }) earnings: number;
}

/**
 * S-04 Home (Inactive) — top-of-screen summary.
 * Earnings + last trip wire up against real data once the trips/earnings
 * domain (S-13/S-15) lands; for now the service returns zeros.
 */
export class HomeSummaryResponseDto {
  @ApiProperty({ example: 18.5 }) todayEarnings: number;
  @ApiPropertyOptional({ type: LastTripSummaryDto })
  lastTrip: LastTripSummaryDto | null;
  @ApiProperty({ example: 0 }) outstandingBalance: number;
  @ApiProperty({
    example: [],
    description: 'Ops announcements (carousel on home screen). Empty for MVP.',
  })
  announcements: unknown[];
}
