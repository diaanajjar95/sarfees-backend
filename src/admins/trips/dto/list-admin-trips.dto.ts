import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { DriverTripStatus } from '../../../shared/enums/driver-trip-status.enum';
import { DriverTripType } from '../../../shared/enums/driver-trip-type.enum';

export class ListAdminTripsQueryDto {
  @ApiPropertyOptional({ enum: DriverTripStatus })
  @IsOptional()
  @IsEnum(DriverTripStatus)
  status?: DriverTripStatus;

  @ApiPropertyOptional({ enum: DriverTripType })
  @IsOptional()
  @IsEnum(DriverTripType)
  type?: DriverTripType;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  driverId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  originCity?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  destinationCity?: string;

  @ApiPropertyOptional({ description: 'Filter trips with departureTime >= this date (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({ description: 'Filter trips with departureTime <= this date (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  toDate?: string;

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

export class AdminTripRowDto {
  @ApiProperty() id: number;
  @ApiProperty({ enum: DriverTripStatus }) status: DriverTripStatus;
  @ApiProperty({ enum: DriverTripType }) type: DriverTripType;
  @ApiProperty() originCity: string;
  @ApiProperty() destinationCity: string;
  @ApiProperty() departureTime: Date;
  @ApiProperty() driverId: number | null;
  @ApiProperty() driverName: string | null;
  @ApiProperty() totalCashExpected: number;
  @ApiProperty() totalCashCollected: number;
  @ApiProperty() netEarnings: number | null;
  @ApiProperty() acceptedAt: Date | null;
  @ApiProperty() startedAt: Date | null;
  @ApiProperty() completedAt: Date | null;
  @ApiProperty() cancelledAt: Date | null;
  @ApiProperty() cancellationZone: number | null;
}

export class ListAdminTripsResponseDto {
  @ApiProperty({ type: [AdminTripRowDto] }) data: AdminTripRowDto[];
  @ApiProperty() page: number;
  @ApiProperty() limit: number;
  @ApiProperty() totalItems: number;
  @ApiProperty() totalPages: number;
  @ApiProperty() hasNextPage: boolean;
  @ApiProperty() hasPreviousPage: boolean;
}
