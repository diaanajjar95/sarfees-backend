import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { DriverTripCancelReason } from '../../shared/enums/driver-trip-cancel-reason.enum';

export class CancelTripDto {
  @ApiProperty({ enum: DriverTripCancelReason })
  @IsEnum(DriverTripCancelReason)
  reason: DriverTripCancelReason;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class CancelTripResponseDto {
  @ApiProperty() tripId: number;
  @ApiProperty({ enum: [1, 2], description: '1 = before start (no penalty), 2 = after start (soft penalty)' })
  zone: 1 | 2;
  @ApiProperty() softPenalty: boolean;
  @ApiProperty() driverStatusAfter: string;
  @ApiProperty() message: string;
}
