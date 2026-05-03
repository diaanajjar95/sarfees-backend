import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ManifestResponseDto } from '../../../driver-trips/dto/manifest.dto';
import { DriverTripDeclineReason } from '../../../shared/enums/driver-trip-decline-reason.enum';

export type LifecycleEventKind =
  | 'offered'
  | 'offer_expired'
  | 'accepted'
  | 'declined'
  | 'started'
  | 'arrived_stop'
  | 'pickup_confirmed'
  | 'dropoff_confirmed'
  | 'completed'
  | 'cancelled';

export class LifecycleEventDto {
  @ApiProperty({ enum: ['offered', 'offer_expired', 'accepted', 'declined', 'started', 'arrived_stop', 'pickup_confirmed', 'dropoff_confirmed', 'completed', 'cancelled'] })
  kind: LifecycleEventKind;

  @ApiProperty({ description: 'When the event happened (ISO 8601)' })
  at: Date;

  @ApiProperty({ description: 'Human-readable headline for the event' })
  label: string;

  @ApiPropertyOptional({ description: 'Short context line shown under the headline' })
  detail: string | null;

  @ApiPropertyOptional({ description: 'For stop-related events, the stop order (0-based)' })
  stopOrder: number | null;

  @ApiPropertyOptional({ description: 'For stop-related events, the stop city' })
  stopCity: string | null;
}

export class AdminTripDriverInfoDto {
  @ApiProperty() id: number;
  @ApiPropertyOptional() name: string | null;
  @ApiProperty() phone: string;
  @ApiProperty() rating: number;
  @ApiProperty() ratingCount: number;
  @ApiProperty() totalTrips: number;
}

export class TripDeclineRowDto {
  @ApiProperty() id: number;
  @ApiProperty({ enum: DriverTripDeclineReason }) reason: DriverTripDeclineReason;
  @ApiProperty() autoDeclined: boolean;
  @ApiPropertyOptional() notes: string | null;
  @ApiProperty() declinedAt: Date;
}

export class TripCancellationDto {
  @ApiProperty({ enum: [1, 2] }) zone: number;
  @ApiProperty() reason: string;
  @ApiProperty() cancelledAt: Date;
}

export class TripPricingDto {
  @ApiProperty() totalCashExpected: number;
  @ApiProperty() totalCashCollected: number;
  @ApiProperty() commissionRate: number;
  @ApiProperty() commissionAmount: number;
  @ApiProperty() netEarnings: number;
}

/**
 * Admin-only enriched view of a trip — wraps the driver-facing manifest with
 * everything ops needs to debug a single trip end to end.
 */
export class AdminTripDetailDto extends ManifestResponseDto {
  @ApiPropertyOptional({ type: AdminTripDriverInfoDto })
  driver: AdminTripDriverInfoDto | null;

  @ApiProperty({ type: [LifecycleEventDto] })
  lifecycle: LifecycleEventDto[];

  @ApiProperty({ type: [TripDeclineRowDto] })
  declineHistory: TripDeclineRowDto[];

  @ApiPropertyOptional({ type: TripCancellationDto })
  cancellation: TripCancellationDto | null;

  @ApiProperty({ type: TripPricingDto })
  pricing: TripPricingDto;
}
