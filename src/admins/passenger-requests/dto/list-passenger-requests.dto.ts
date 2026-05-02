import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  Min,
} from 'class-validator';
import { TripStatus } from '../../../shared/enums/trip-status.enum';

export class ListPassengerRequestsQueryDto {
  @ApiPropertyOptional({ enum: TripStatus })
  @IsOptional()
  @IsEnum(TripStatus)
  status?: TripStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional()
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

export class PassengerRequestRowDto {
  @ApiProperty() id: number;
  @ApiProperty({ enum: TripStatus }) status: TripStatus;
  @ApiProperty() passengerName: string;
  @ApiProperty() passengerPhone: string;
  @ApiProperty() passengerGender: string | null;
  @ApiProperty() departureCity: string | null;
  @ApiProperty() arrivalCity: string | null;
  @ApiProperty() departureLat: number;
  @ApiProperty() departureLng: number;
  @ApiProperty() arrivalLat: number;
  @ApiProperty() arrivalLng: number;
  @ApiProperty() travelDate: Date | null;
  @ApiProperty() isImmediate: boolean;
  @ApiProperty() seatsCount: number;
  @ApiProperty() isFemaleOnly: boolean;
  @ApiProperty() perSeatFare: number;
  @ApiProperty() totalFare: number;
  @ApiProperty() driverId: number | null;
  @ApiProperty() driverName: string | null;
  @ApiProperty() createdAt: Date;
}

export class ListPassengerRequestsResponseDto {
  @ApiProperty({ type: [PassengerRequestRowDto] })
  data: PassengerRequestRowDto[];
  @ApiProperty() page: number;
  @ApiProperty() limit: number;
  @ApiProperty() totalItems: number;
  @ApiProperty() totalPages: number;
  @ApiProperty() hasNextPage: boolean;
  @ApiProperty() hasPreviousPage: boolean;
  @ApiProperty({
    description: 'Count of currently PENDING (unmatched) requests',
  })
  pendingCount: number;
}
