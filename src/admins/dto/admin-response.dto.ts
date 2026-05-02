import { ApiProperty } from '@nestjs/swagger';
import { Admin } from '../admin.entity';
import { AdminRole } from '../../shared/enums/admin-role.enum';

export class AdminResponseDto {
  @ApiProperty() id: number;
  @ApiProperty() email: string;
  @ApiProperty({ nullable: true }) fullName: string | null;
  @ApiProperty({ enum: AdminRole }) role: AdminRole;
  @ApiProperty() isActive: boolean;
  @ApiProperty() mustChangePassword: boolean;
  @ApiProperty() lastLoginAt: Date | null;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;

  static from(admin: Admin): AdminResponseDto {
    return {
      id: admin.id,
      email: admin.email,
      fullName: admin.fullName ?? null,
      role: admin.role,
      isActive: admin.isActive,
      mustChangePassword: admin.mustChangePassword,
      lastLoginAt: admin.lastLoginAt ?? null,
      createdAt: admin.createdAt,
      updatedAt: admin.updatedAt,
    };
  }
}
