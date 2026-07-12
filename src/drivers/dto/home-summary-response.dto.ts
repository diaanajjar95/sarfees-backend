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
import { DriverSuspensionCategory } from '../../shared/enums/driver-suspension-category.enum';
import { DriverDocumentType } from '../../shared/enums/driver-document-type.enum';

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

// ─── active block ───────────────────────────────────────────

export class PendingOfferDto {
  @ApiProperty({ description: 'DriverTrip id — deep-link into OfferScreen.' })
  tripId: number;
  @ApiProperty({ example: 'Irbid' }) originCity: string;
  @ApiProperty({ example: 'Amman' }) destinationCity: string;
  @ApiProperty({ enum: DriverTripType }) type: DriverTripType;
  @ApiProperty({ type: 'string', format: 'date-time' })
  offerExpiresAt: Date;
  @ApiProperty({
    example: 32,
    description: 'Seconds remaining before the offer auto-expires (server clock).',
  })
  secondsRemaining: number;
}

// ─── inactive block ─────────────────────────────────────────

export class LastSessionDto {
  @ApiProperty({ type: 'string', format: 'date-time' })
  startedAt: Date;
  @ApiProperty({ type: 'string', format: 'date-time' })
  endedAt: Date;
  @ApiProperty({ example: 275, description: 'Session duration in whole minutes.' })
  durationMinutes: number;
  @ApiProperty({ example: 4, description: 'Trips completed during this session.' })
  tripsCompleted: number;
  @ApiProperty({
    example: 32.5,
    description: 'Sum of `netEarnings` for trips completed during this session.',
  })
  earnings: number;
}

// ─── suspended block ────────────────────────────────────────

export class ExpiredDocumentDto {
  @ApiProperty({ enum: DriverDocumentType }) type: DriverDocumentType;
  @ApiProperty({ type: 'string', format: 'date-time' }) expiresAt: Date;
}

export class SuspensionDocumentsInfoDto {
  @ApiProperty({ type: [ExpiredDocumentDto] })
  expiredDocuments: ExpiredDocumentDto[];
}

export class SuspensionRatingInfoDto {
  @ApiProperty({ example: 3.9, description: "Driver's current lifetime rating." })
  current: number;
  @ApiProperty({ example: 4.0, description: 'Minimum rating configured by ops (env: DRIVER_MIN_RATING).' })
  minimum: number;
}

export class SuspensionPaymentInfoDto {
  @ApiProperty({ example: 18.5, description: 'Outstanding platform commission owed, in JOD.' })
  outstandingBalance: number;
}

export class SuspensionReviewInfoDto {
  @ApiProperty({
    example: 1,
    description: 'Env: DRIVER_REVIEW_MIN_DAYS. Lower bound on the review turnaround (business days).',
  })
  estimatedMinDays: number;
  @ApiProperty({
    example: 3,
    description: 'Env: DRIVER_REVIEW_MAX_DAYS. Upper bound.',
  })
  estimatedMaxDays: number;
  @ApiProperty({
    example: true,
    description: 'Whether the mobile "Submit Appeal" button should be enabled.',
  })
  appealAvailable: boolean;
}

export class SuspensionInfoDto {
  @ApiProperty({ type: 'string', format: 'date-time' })
  suspendedAt: Date;

  @ApiPropertyOptional({
    enum: DriverSuspensionCategory,
    description:
      'Which suspended-state card the mobile Home tab should render. ' +
      "`null` for legacy suspensions (mobile falls back to a generic card).",
  })
  category: DriverSuspensionCategory | null;

  @ApiProperty({ type: 'string', nullable: true, example: 'Vehicle registration expired' })
  reason: string | null;

  @ApiProperty({ example: 'support@sarfees.com' })
  supportEmail: string;
  @ApiPropertyOptional({ nullable: true, example: '+96265000000' })
  supportPhone: string | null;

  // Category-specific extras. Exactly one of these is non-null based on
  // `category`; all are null when category is null (legacy suspension).

  @ApiPropertyOptional({
    type: SuspensionDocumentsInfoDto,
    description: "Populated iff `category === 'documents'`.",
  })
  documentsInfo: SuspensionDocumentsInfoDto | null;

  @ApiPropertyOptional({
    type: SuspensionRatingInfoDto,
    description: "Populated iff `category === 'rating'`.",
  })
  ratingInfo: SuspensionRatingInfoDto | null;

  @ApiPropertyOptional({
    type: SuspensionPaymentInfoDto,
    description: "Populated iff `category === 'payment'`.",
  })
  paymentInfo: SuspensionPaymentInfoDto | null;

  @ApiPropertyOptional({
    type: SuspensionReviewInfoDto,
    description: "Populated iff `category === 'violation'`.",
  })
  reviewInfo: SuspensionReviewInfoDto | null;
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

  // ─── Status-conditional blocks (at most one non-null at a time) ─
  @ApiPropertyOptional({
    type: CurrentTripDto,
    description:
      "Populated iff `status === 'on_trip'`. Carries everything the " +
      'mobile "Resume Trip" card renders so the Home tab can paint ' +
      'without a follow-up /trips/active or /manifest call.',
  })
  currentTrip: CurrentTripDto | null;

  @ApiPropertyOptional({
    type: PendingOfferDto,
    description:
      "Populated iff `status === 'active'` AND the matcher has dispatched " +
      'a trip offer that has not yet expired / been accepted / been declined. ' +
      "`null` otherwise (driver is active and idle, or status isn't active).",
  })
  pendingOffer: PendingOfferDto | null;

  @ApiPropertyOptional({
    type: LastSessionDto,
    description:
      "Populated iff `status === 'inactive'` AND the driver has had at " +
      'least one full activate → deactivate cycle. Compact summary of ' +
      'that most-recent session so the Home tab has something to render ' +
      'besides the "Go online" CTA.',
  })
  lastSession: LastSessionDto | null;

  @ApiPropertyOptional({
    type: SuspensionInfoDto,
    description:
      "Populated iff `status === 'suspended'`. Includes the suspension " +
      "reason (if ops provided one) and the support contact fields the " +
      "mobile UI needs to render the 'Contact support' CTA.",
  })
  suspensionInfo: SuspensionInfoDto | null;
}
