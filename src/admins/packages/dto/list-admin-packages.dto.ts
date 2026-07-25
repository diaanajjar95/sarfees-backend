import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { PackageStatus } from '../../../shared/enums/package-status.enum';

export class ListAdminPackagesQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ enum: PackageStatus })
  @IsOptional()
  @IsIn(Object.values(PackageStatus))
  status?: PackageStatus;
}

export class AdminPackageRowDto {
  @ApiProperty() id: number;
  @ApiProperty({ enum: PackageStatus }) status: PackageStatus;
  @ApiProperty({ example: "Dia'a Najjar" }) senderName: string;
  @ApiProperty({ example: '+962 799557505' }) senderPhone: string;
  @ApiProperty({ example: 'Yousef R.' }) receiverName: string;
  @ApiProperty({ example: '+962 791234567' }) receiverPhone: string;
  @ApiProperty({ example: 'Amman', nullable: true }) departureCity: string | null;
  @ApiProperty({ example: 'Irbid', nullable: true }) arrivalCity: string | null;
  @ApiProperty() pickupLat: number;
  @ApiProperty() pickupLng: number;
  @ApiProperty() dropOffLat: number;
  @ApiProperty() dropOffLng: number;
  @ApiProperty({ example: 'MEDIUM' }) packageSize: string;
  @ApiProperty({ nullable: true }) weightKg: number | null;
  @ApiProperty({ nullable: true }) packageDescription: string | null;
  @ApiProperty() urgent: boolean;
  @ApiProperty() isImmediate: boolean;
  @ApiProperty({ nullable: true }) pickupDate: Date | null;
  @ApiProperty() deliveryFee: number;
  @ApiProperty({ nullable: true }) tripGroupId: number | null;
  @ApiProperty({ nullable: true }) cancellationReason: string | null;
  @ApiProperty() createdAt: Date;
}

export class ListAdminPackagesResponseDto {
  @ApiProperty({ type: [AdminPackageRowDto] })
  data: AdminPackageRowDto[];

  @ApiProperty() page: number;
  @ApiProperty() limit: number;
  @ApiProperty() totalItems: number;
  @ApiProperty() totalPages: number;

  /** Count of deliveries still in flight, regardless of filter. */
  @ApiProperty() openCount: number;
}
