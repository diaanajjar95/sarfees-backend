import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Driver } from '../driver.entity';
import { VehicleDto } from './driver-profile-response.dto';

/**
 * Persistent driver profile returned with the auth tokens by
 * `POST /auth/driver/verify-otp`. Intended to be **cached on the device
 * after login** — it covers everything the home screen needs that
 * doesn't change between trips: identity, vehicle, lifetime stats.
 *
 * Deliberately **excludes** real-time state — `status`, active
 * preferences (`destinationCity`, `tripTypes`, `goingHome`,
 * `minPassengers`, `prefActivatedAt`, `prefLocation*`), and
 * `outstandingBalance`. Those come from `GET /drivers/home-summary` /
 * `GET /drivers/profile` which the app calls on every Home tab open.
 *
 * Also excludes sensitive auth state (otp, refreshToken, lockout
 * counters), which is never returned by any read endpoint.
 */
export class DriverResponseDto {
  @ApiProperty() id: number;
  @ApiPropertyOptional() name: string | null;
  @ApiProperty() phoneNumber: string;
  @ApiProperty() countryCode: string;
  @ApiPropertyOptional({ enum: ['male', 'female'] }) gender:
    | 'male'
    | 'female'
    | null;
  @ApiPropertyOptional() homeCity: string | null;
  @ApiPropertyOptional() profilePhotoUrl: string | null;
  @ApiProperty({ enum: ['ar', 'en'] }) language: 'ar' | 'en';

  @ApiProperty({ type: VehicleDto }) vehicle: VehicleDto;

  /** Lifetime rating — only ticks when a passenger rates the driver. */
  @ApiProperty({ example: 4.85 }) rating: number;
  @ApiProperty({ example: 48 }) ratingCount: number;
  @ApiProperty({ example: 142 }) totalTrips: number;

  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;

  static from(driver: Driver): DriverResponseDto {
    return {
      id: driver.id,
      name: driver.name ?? null,
      phoneNumber: driver.phoneNumber,
      countryCode: driver.countryCode,
      gender: driver.gender ?? null,
      homeCity: driver.homeCity ?? null,
      profilePhotoUrl: driver.profilePhotoUrl ?? null,
      language: driver.language,
      vehicle: {
        make: driver.vehicleMake ?? null,
        model: driver.vehicleModel ?? null,
        color: driver.vehicleColor ?? null,
        year: driver.vehicleYear ?? null,
        plateNumber: driver.plateNumber ?? null,
        passengerCapacity: driver.passengerCapacity,
      },
      rating: Number(driver.rating),
      ratingCount: driver.ratingCount,
      totalTrips: driver.totalTrips,
      createdAt: driver.createdAt,
      updatedAt: driver.updatedAt,
    };
  }
}
