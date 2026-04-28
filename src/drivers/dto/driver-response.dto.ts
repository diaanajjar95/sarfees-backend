import { ApiProperty } from '@nestjs/swagger';
import { Driver } from '../driver.entity';
import { DriverStatus } from '../../shared/enums/driver-status.enum';

/**
 * Compact driver representation returned alongside auth tokens (S-03 verify-otp,
 * S-01 verify-session). Excludes sensitive auth state (otp, refreshToken, lockout
 * counters) and verbose profile/vehicle details — those live in DriverProfileResponseDto.
 */
export class DriverResponseDto {
  @ApiProperty() id: number;
  @ApiProperty({ nullable: true }) name: string | null;
  @ApiProperty() phoneNumber: string;
  @ApiProperty() countryCode: string;
  @ApiProperty({ nullable: true, enum: ['male', 'female'] }) gender:
    | 'male'
    | 'female'
    | null;
  @ApiProperty({ nullable: true }) homeCity: string | null;
  @ApiProperty({ enum: DriverStatus }) status: DriverStatus;
  @ApiProperty({ enum: ['ar', 'en'] }) language: 'ar' | 'en';
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
      status: driver.status,
      language: driver.language,
      createdAt: driver.createdAt,
      updatedAt: driver.updatedAt,
    };
  }
}
