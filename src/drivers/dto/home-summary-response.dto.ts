import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AnnouncementResponseDto } from '../../announcements/dto/announcement.dto';
import { DriverStatus } from '../../shared/enums/driver-status.enum';
import { DriverPreferencesDto } from './driver-profile-response.dto';

export class LastTripSummaryDto {
  @ApiProperty({ example: 'Irbid' }) origin: string;
  @ApiProperty({ example: 'Amman' }) destination: string;
  @ApiProperty() completedAt: Date;
  @ApiProperty({ example: 12.5 }) earnings: number;
}

/**
 * S-04 Home — single-roundtrip view of everything the driver Home tab
 * needs to render. Mixes persistent stats (today's totals, last trip,
 * announcements) with live session state (status, active preferences,
 * sessionStartedAt) so the mobile app doesn't have to compose two
 * calls every time it refreshes the Home tab.
 */
export class HomeSummaryResponseDto {
  // ─── Live session state ────────────────────────────────────
  @ApiProperty({
    enum: DriverStatus,
    description: 'Current driver status — `inactive` / `active` / `on_trip` / `suspended`.',
  })
  status: DriverStatus;

  @ApiPropertyOptional({
    type: DriverPreferencesDto,
    description:
      'Preferences the driver locked in when they last went `active`. ' +
      '`null` when the driver is inactive.',
  })
  activePreferences: DriverPreferencesDto | null;

  @ApiPropertyOptional({
    type: 'string',
    format: 'date-time',
    description:
      'When the current active session started (= `activePreferences.activatedAt`). ' +
      '`null` when the driver is inactive.',
  })
  sessionStartedAt: Date | null;

  // ─── Today's totals (calendar day, local 00:00 → now) ──────
  @ApiProperty({
    example: 18.5,
    description: "Sum of `netEarnings` for trips completed today.",
  })
  todayEarnings: number;

  @ApiProperty({
    example: 3,
    description: 'Number of trips completed today.',
  })
  tripsCompletedToday: number;

  @ApiProperty({
    example: 15.0,
    description:
      'Effective commission rate today as a percentage (0-100). Computed as ' +
      '`SUM(commissionAmount) / SUM(cashCollected) × 100` across today\'s ' +
      'completed trips. Falls back to the platform default (15%) if no trips ' +
      'completed today.',
  })
  commissionPercentageToday: number;

  // ─── Persistent ────────────────────────────────────────────
  @ApiPropertyOptional({ type: LastTripSummaryDto })
  lastTrip: LastTripSummaryDto | null;

  @ApiProperty({ example: 0 }) outstandingBalance: number;

  @ApiProperty({
    type: [AnnouncementResponseDto],
    description: 'Active ops announcements (highest priority first).',
  })
  announcements: AnnouncementResponseDto[];
}
