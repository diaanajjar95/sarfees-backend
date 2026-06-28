import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AnnouncementResponseDto } from '../../announcements/dto/announcement.dto';
import { DriverStatus } from '../../shared/enums/driver-status.enum';
import { DriverPreferencesDto } from './driver-profile-response.dto';
import { DriverTripStatus } from '../../shared/enums/driver-trip-status.enum';
import { DriverTripStopStatus } from '../../shared/enums/driver-trip-stop-status.enum';
import { DriverTripStopType } from '../../shared/enums/driver-trip-stop-type.enum';
import { DriverTripType } from '../../shared/enums/driver-trip-type.enum';
import { StopPassengerRole } from '../../shared/enums/stop-passenger-status.enum';
import { StopPackageRole } from '../../shared/enums/stop-package-status.enum';

export class LastTripSummaryDto {
  @ApiProperty({ example: 'Irbid' }) origin: string;
  @ApiProperty({ example: 'Amman' }) destination: string;
  @ApiProperty() completedAt: Date;
  @ApiProperty({ example: 12.5 }) earnings: number;
}

// ─── on_trip block ──────────────────────────────────────────

export class CurrentStopPassengerDto {
  @ApiProperty({ description: 'TripRequest id (stable handle).' })
  id: number;
  @ApiProperty({ example: 'Ahmad Hamdan' }) name: string;
  @ApiProperty({ example: '+962799999001' }) phone: string;
  @ApiProperty({ enum: StopPassengerRole }) role: StopPassengerRole;
  @ApiProperty({ example: 8 }) fare: number;
}

export class CurrentStopPackageDto {
  @ApiProperty() id: number;
  @ApiProperty({ example: 'PKG-42' }) reference: string;
  /**
   * Driver-facing contact at this stop: the sender's name on a
   * `collecting` stop, the receiver's name on a `delivering` stop.
   */
  @ApiProperty({ example: 'Sara Al-Saidi' }) contactName: string;
  @ApiProperty({ example: '+962779999001' }) contactPhone: string;
  @ApiProperty({ enum: StopPackageRole }) role: StopPackageRole;
  @ApiProperty({ example: 5 }) fee: number;
}

export class CurrentStopDto {
  @ApiProperty() id: number;
  @ApiProperty({ description: '0-based stop order; matches `currentStopIndex`.' })
  order: number;
  @ApiProperty({ enum: DriverTripStopType }) type: DriverTripStopType;
  @ApiProperty({ example: 'Irbid' }) city: string;
  @ApiPropertyOptional({ example: 'Yarmouk University Gate' })
  address: string | null;
  @ApiProperty() lat: number;
  @ApiProperty() lng: number;
  @ApiProperty({ enum: DriverTripStopStatus }) status: DriverTripStopStatus;
  @ApiProperty({
    description: 'Sum of fares/fees expected to be collected at this stop.',
  })
  cashAtStop: number;
  @ApiPropertyOptional({
    description:
      'Estimated minutes from driver\'s last GPS snapshot to this stop ' +
      '(Haversine, 40 km/h). `null` if the driver has no location ping yet.',
    nullable: true,
  })
  etaMinutes: number | null;
  @ApiProperty({ type: [CurrentStopPassengerDto] })
  passengers: CurrentStopPassengerDto[];
  @ApiProperty({ type: [CurrentStopPackageDto] })
  packages: CurrentStopPackageDto[];
}

export class StopProgressItemDto {
  @ApiProperty() order: number;
  @ApiProperty({ enum: DriverTripStopType }) type: DriverTripStopType;
  @ApiProperty({ enum: DriverTripStopStatus }) status: DriverTripStopStatus;
}

export class OnBoardPassengerDto {
  @ApiProperty({ description: 'TripRequest id.' }) id: number;
  @ApiProperty({ example: 'Ahmad Hamdan' }) name: string;
}

export class OnBoardDto {
  @ApiProperty({ example: 3 }) passengerCount: number;
  @ApiProperty({ type: [OnBoardPassengerDto] })
  passengers: OnBoardPassengerDto[];
}

export class EarnedSoFarDto {
  @ApiProperty({ example: 11 }) totalCashCollected: number;
  @ApiProperty({ example: 0.15 }) commissionRate: number;
  @ApiProperty({ example: 9.35 }) netEarningsSoFar: number;
}

export class UpNextStopDto {
  @ApiProperty() order: number;
  @ApiProperty({ enum: DriverTripStopType }) type: DriverTripStopType;
  @ApiProperty() city: string;
  @ApiPropertyOptional() address: string | null;
  @ApiProperty() cashAtStop: number;
  @ApiPropertyOptional({ nullable: true }) etaMinutes: number | null;
}

export class CurrentTripDto {
  @ApiProperty() id: number;
  @ApiProperty({ enum: DriverTripType }) type: DriverTripType;
  @ApiProperty({ enum: DriverTripStatus }) status: DriverTripStatus;
  @ApiProperty() originCity: string;
  @ApiProperty() destinationCity: string;
  @ApiProperty({ description: '0-based.' }) currentStopIndex: number;
  @ApiProperty() totalStops: number;

  @ApiPropertyOptional({
    type: CurrentStopDto,
    description:
      'Stop the driver is heading to / currently at. `null` when ' +
      '`currentStopIndex` is past the last stop (trip awaiting `/complete`).',
  })
  currentStop: CurrentStopDto | null;

  @ApiProperty({
    type: [StopProgressItemDto],
    description: 'Every stop in order — drives the progress-dots strip.',
  })
  stopsProgress: StopProgressItemDto[];

  @ApiProperty({ type: OnBoardDto })
  onBoard: OnBoardDto;

  @ApiProperty({ type: EarnedSoFarDto })
  earnedSoFar: EarnedSoFarDto;

  @ApiPropertyOptional({
    type: UpNextStopDto,
    description: 'Stop after the current one. `null` on the last stop.',
  })
  upNext: UpNextStopDto | null;
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

  // ─── Status-conditional blocks (exactly one non-null at a time) ─
  @ApiPropertyOptional({
    type: CurrentTripDto,
    description:
      "Populated iff `status === 'on_trip'`. Carries everything the " +
      'mobile "Resume Trip" card renders so the Home tab can paint ' +
      'without a follow-up /trips/active or /manifest call.',
  })
  currentTrip: CurrentTripDto | null;
}
