import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { TripStatus } from '../../shared/enums/trip-status.enum';

// --- Response DTOs ---

export class DriverInfoDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'Ahmad' })
  firstName: string;

  @ApiProperty({ example: 'Khaled' })
  lastName: string;

  @ApiPropertyOptional({ example: '/uploads/profiles/driver.jpg' })
  profilePhotoUrl: string | null;

  @ApiProperty({ example: 'Toyota' })
  vehicleMake: string;

  @ApiProperty({ example: 'Camry' })
  vehicleModel: string;

  @ApiProperty({ example: 'White' })
  vehicleColor: string;

  @ApiProperty({ example: 2023 })
  vehicleYear: number;

  @ApiProperty({ example: '12-34567' })
  plateNumber: string;

  @ApiProperty({ example: 4.85 })
  rating: number;

  @ApiProperty({ example: 120 })
  totalTrips: number;
}

export class DriverLocationDto {
  @ApiProperty({ example: 31.9539 })
  lat: number;

  @ApiProperty({ example: 35.9106 })
  lng: number;

  @ApiPropertyOptional({ example: 180.5, description: 'Heading in degrees (0-360)' })
  heading: number | null;

  @ApiPropertyOptional({ example: 45.2, description: 'Speed in km/h' })
  speed: number | null;

  @ApiProperty({ description: 'When the location was last recorded' })
  recordedAt: Date;
}

export class ActiveTripStatusResponseDto {
  @ApiProperty({ example: 42 })
  tripId: number;

  @ApiProperty({ enum: TripStatus, example: TripStatus.DRIVER_EN_ROUTE })
  status: TripStatus;

  @ApiPropertyOptional({ example: '8 min' })
  etaToPickup: string | null;

  @ApiPropertyOptional({ example: '1h 25m' })
  etaToDestination: string | null;

  @ApiProperty()
  departureLocation: { lat: number; lng: number };

  @ApiProperty()
  arrivalLocation: { lat: number; lng: number };

  @ApiPropertyOptional({ type: DriverInfoDto })
  driver: DriverInfoDto | null;

  @ApiPropertyOptional({ type: DriverLocationDto })
  driverLocation: DriverLocationDto | null;

  @ApiProperty({ description: 'When the status last changed' })
  statusUpdatedAt: Date | null;

  @ApiProperty()
  createdAt: Date;
}

// --- Request DTOs ---

export class UpdateTripStatusDto {
  @ApiProperty({ enum: [TripStatus.DRIVER_EN_ROUTE, TripStatus.ARRIVED_AT_PICKUP, TripStatus.TRIP_IN_PROGRESS, TripStatus.ARRIVING_AT_DROPOFF, TripStatus.COMPLETED, TripStatus.CANCELLED] })
  @IsEnum(TripStatus)
  @IsNotEmpty()
  status: TripStatus;

  @ApiPropertyOptional({ example: '8 min' })
  @IsOptional()
  @IsString()
  etaToPickup?: string;

  @ApiPropertyOptional({ example: '1h 25m' })
  @IsOptional()
  @IsString()
  etaToDestination?: string;
}

export class UpdateDriverLocationDto {
  @ApiProperty({ example: 31.9539 })
  @IsNumber()
  @IsNotEmpty()
  lat: number;

  @ApiProperty({ example: 35.9106 })
  @IsNumber()
  @IsNotEmpty()
  lng: number;

  @ApiPropertyOptional({ example: 180.5, description: 'Heading in degrees' })
  @IsOptional()
  @IsNumber()
  heading?: number;

  @ApiPropertyOptional({ example: 45.2, description: 'Speed in km/h' })
  @IsOptional()
  @IsNumber()
  speed?: number;
}
