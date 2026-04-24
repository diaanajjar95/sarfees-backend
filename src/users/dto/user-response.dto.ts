import { ApiProperty } from '@nestjs/swagger';
import { User } from '../user.entity';

/**
 * Safe, serializable user representation returned to clients.
 * Excludes all sensitive fields (otp, refreshToken, lockout counters, etc).
 */
export class UserResponseDto {
  @ApiProperty() id: number;
  @ApiProperty() phoneNumber: string;
  @ApiProperty() countryCode: string;
  @ApiProperty({ nullable: true }) firstName: string | null;
  @ApiProperty({ nullable: true }) lastName: string | null;
  @ApiProperty({ nullable: true, enum: ['Male', 'Female'] }) gender:
    | string
    | null;
  @ApiProperty({ nullable: true }) email: string | null;
  @ApiProperty({ nullable: true }) profilePhotoUrl: string | null;
  @ApiProperty() isProfileCompleted: boolean;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;

  static from(user: User): UserResponseDto {
    return {
      id: user.id,
      phoneNumber: user.phoneNumber,
      countryCode: user.countryCode,
      firstName: user.firstName ?? null,
      lastName: user.lastName ?? null,
      gender: user.gender ?? null,
      email: user.email ?? null,
      profilePhotoUrl: user.profilePhotoUrl ?? null,
      isProfileCompleted: user.isProfileCompleted,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
