import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { DriverTripDeclineReason } from '../../shared/enums/driver-trip-decline-reason.enum';

const MANUAL_REASONS = [
  DriverTripDeclineReason.ROUTE_UNSUITABLE,
  DriverTripDeclineReason.TOO_FEW_PASSENGERS,
  DriverTripDeclineReason.VEHICLE_ISSUE,
  DriverTripDeclineReason.PERSONAL_EMERGENCY,
  DriverTripDeclineReason.OTHER,
] as const;

export class DeclineTripDto {
  @ApiProperty({
    enum: MANUAL_REASONS,
    example: DriverTripDeclineReason.ROUTE_UNSUITABLE,
  })
  @IsEnum(MANUAL_REASONS, {
    message:
      'reason must be one of: route_unsuitable, too_few_passengers, vehicle_issue, personal_emergency, other',
  })
  reason: DriverTripDeclineReason;

  @ApiPropertyOptional({ example: 'Detour too long for my route', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
