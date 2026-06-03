import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  Min,
} from 'class-validator';
import { DriverTripStatus } from '../../shared/enums/driver-trip-status.enum';
import { DriverTripType } from '../../shared/enums/driver-trip-type.enum';

export class TripHistoryQueryDto {
  @ApiPropertyOptional({
    description:
      'Filter by status. Pass multiple times (?status=completed&status=cancelled). ' +
      'Defaults to all terminal statuses (completed, cancelled, expired, declined) ' +
      'so OFFERED / ACCEPTED / IN_PROGRESS — i.e. current work — never show in history.',
    enum: DriverTripStatus,
    isArray: true,
  })
  @IsOptional()
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  @IsArray()
  @ArrayUnique()
  @IsEnum(DriverTripStatus, { each: true })
  status?: DriverTripStatus[];

  @ApiPropertyOptional({
    description: 'ISO 8601 lower bound on `departureTime` (inclusive).',
    example: '2026-05-01T00:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({
    description: 'ISO 8601 upper bound on `departureTime` (inclusive).',
    example: '2026-05-31T23:59:59Z',
  })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}

export class TripHistoryItemDto {
  @ApiProperty() id: number;
  @ApiProperty({ enum: DriverTripStatus }) status: DriverTripStatus;
  @ApiProperty({ enum: DriverTripType }) type: DriverTripType;
  @ApiProperty() originCity: string;
  @ApiProperty() destinationCity: string;
  @ApiProperty() departureTime: Date;
  @ApiProperty({ type: 'number', nullable: true }) netEarnings: number | null;
  @ApiProperty() totalCashCollected: number;
  @ApiProperty({ type: 'string', format: 'date-time', nullable: true })
  acceptedAt: Date | null;
  @ApiProperty({ type: 'string', format: 'date-time', nullable: true })
  startedAt: Date | null;
  @ApiProperty({ type: 'string', format: 'date-time', nullable: true })
  completedAt: Date | null;
  @ApiProperty({ type: 'string', format: 'date-time', nullable: true })
  cancelledAt: Date | null;
  @ApiProperty({ type: 'integer', nullable: true })
  cancellationZone: number | null;
}

export class TripHistoryResponseDto {
  @ApiProperty({ type: [TripHistoryItemDto] })
  data: TripHistoryItemDto[];
  @ApiProperty() page: number;
  @ApiProperty() limit: number;
  @ApiProperty() totalItems: number;
  @ApiProperty() totalPages: number;
  @ApiProperty() hasNextPage: boolean;
  @ApiProperty() hasPreviousPage: boolean;
}
