import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { DriverTripType } from '../../shared/enums/driver-trip-type.enum';

/**
 * Dev-only payload to manufacture an OFFERED DriverTrip from existing
 * passenger TripRequest + PackageDelivery records. The seeder generates
 * exactly two stops — one pickup at the origin city, one dropoff at the
 * destination — and links every passenger/package to both.
 */
export class SeedDriverTripDto {
  @ApiProperty({ example: 1, description: 'Driver to assign the offer to' })
  @IsInt()
  driverId: number;

  @ApiProperty({ enum: DriverTripType })
  @IsEnum(DriverTripType)
  type: DriverTripType;

  @ApiProperty({ example: 'Irbid' })
  @IsString()
  originCity: string;

  @ApiProperty({ example: 'Amman' })
  @IsString()
  destinationCity: string;

  @ApiProperty({
    example: '2026-04-30T14:30:00Z',
    description: 'ISO 8601 scheduled departure time',
  })
  @IsDateString()
  departureTime: string;

  @ApiProperty({ example: 32.5556 })
  @IsNumber()
  @Min(-90)
  @Max(90)
  pickupLat: number;

  @ApiProperty({ example: 35.85 })
  @IsNumber()
  @Min(-180)
  @Max(180)
  pickupLng: number;

  @ApiProperty({ example: 31.9539 })
  @IsNumber()
  @Min(-90)
  @Max(90)
  dropoffLat: number;

  @ApiProperty({ example: 35.9106 })
  @IsNumber()
  @Min(-180)
  @Max(180)
  dropoffLng: number;

  @ApiPropertyOptional({ example: 'Irbid Bus Station' })
  @IsOptional()
  @IsString()
  pickupAddress?: string;

  @ApiPropertyOptional({ example: 'Abdali Boulevard, Amman' })
  @IsOptional()
  @IsString()
  dropoffAddress?: string;

  @ApiPropertyOptional({
    type: [Number],
    example: [1],
    description:
      'May be empty for packages-only trips — at least one request OR package must be provided.',
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @ArrayUnique()
  tripRequestIds?: number[];

  @ApiPropertyOptional({ type: [Number], example: [] })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @ArrayUnique()
  packageDeliveryIds?: number[];

  @ApiPropertyOptional({
    example: 0.15,
    description: 'Platform commission as a fraction. Default 0.15 (15%).',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  commissionRate?: number;

  @ApiPropertyOptional({
    example: 45,
    description: 'Offer countdown seconds. Default 45.',
  })
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(600)
  offerCountdownSeconds?: number;
}
