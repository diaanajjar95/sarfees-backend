import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Driver } from '../driver.entity';
import { DriverStatus } from '../../shared/enums/driver-status.enum';

export class VehicleDto {
  @ApiPropertyOptional({ example: 'Toyota' }) make: string | null;
  @ApiPropertyOptional({ example: 'Camry' }) model: string | null;
  @ApiPropertyOptional({ example: 'White' }) color: string | null;
  @ApiPropertyOptional({ example: 2022 }) year: number | null;
  @ApiPropertyOptional({ example: '12-34567' }) plateNumber: string | null;
  @ApiProperty({ example: 4 }) passengerCapacity: number;
}

export class DriverPreferencesDto {
  @ApiPropertyOptional({ example: 'Amman' })
  destinationCity: string | null;

  @ApiProperty({
    example: ['mixed'],
    description: 'shared | women_only | packages_only | mixed',
  })
  tripTypes: string[];

  @ApiProperty({ example: false })
  goingHome: boolean;

  @ApiPropertyOptional({ example: 2 })
  minPassengers: number | null;

  @ApiPropertyOptional() activatedAt: Date | null;

  @ApiPropertyOptional({ example: 31.9539 }) locationLat: number | null;

  @ApiPropertyOptional({ example: 35.9106 }) locationLng: number | null;
}

/**
 * Full driver profile (S-04 home, S-16 profile, S-06 active preferences summary).
 */
export class DriverProfileResponseDto {
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
  @ApiProperty({ enum: DriverStatus }) status: DriverStatus;
  @ApiProperty({ enum: ['ar', 'en'] }) language: 'ar' | 'en';

  @ApiProperty({ type: VehicleDto }) vehicle: VehicleDto;

  @ApiProperty({ example: 4.85 }) rating: number;
  @ApiProperty({ example: 48 }) ratingCount: number;
  @ApiProperty({ example: 142 }) totalTrips: number;
  @ApiProperty({ example: 0 }) outstandingBalance: number;

  @ApiPropertyOptional({ type: DriverPreferencesDto })
  activePreferences: DriverPreferencesDto | null;

  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;

  static from(driver: Driver): DriverProfileResponseDto {
    const isActive = driver.status === DriverStatus.ACTIVE;
    return {
      id: driver.id,
      name: driver.name ?? null,
      phoneNumber: driver.phoneNumber,
      countryCode: driver.countryCode,
      gender: driver.gender ?? null,
      homeCity: driver.homeCity ?? null,
      profilePhotoUrl: driver.profilePhotoUrl ?? null,
      status: driver.status,
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
      outstandingBalance: Number(driver.outstandingBalance),
      activePreferences: isActive
        ? {
            destinationCity: driver.prefDestinationCity ?? null,
            tripTypes: driver.prefTripTypes ?? [],
            goingHome: driver.prefGoingHome,
            minPassengers: driver.prefMinPassengers ?? null,
            activatedAt: driver.prefActivatedAt ?? null,
            locationLat:
              driver.prefLocationLat != null
                ? Number(driver.prefLocationLat)
                : null,
            locationLng:
              driver.prefLocationLng != null
                ? Number(driver.prefLocationLng)
                : null,
          }
        : null,
      createdAt: driver.createdAt,
      updatedAt: driver.updatedAt,
    };
  }
}
