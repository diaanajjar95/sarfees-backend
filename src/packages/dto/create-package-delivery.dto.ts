import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PackageSize } from '../../shared/enums/package-size.enum';

export class LocationDto {
  @ApiProperty({ example: 31.9539 })
  @IsNotEmpty()
  lat: number;

  @ApiProperty({ example: 35.9106 })
  @IsNotEmpty()
  lng: number;
}

export class EstimatePackageDto {
  @ApiProperty({ example: 1, description: 'ID of the departure city' })
  @IsInt()
  @IsNotEmpty()
  departureCityId: number;

  @ApiProperty({ example: 2, description: 'ID of the arrival city' })
  @IsInt()
  @IsNotEmpty()
  arrivalCityId: number;

  @ApiProperty({ enum: PackageSize, description: 'Package size category' })
  @IsEnum(PackageSize)
  @IsNotEmpty()
  packageSize: PackageSize;
}

export class CreatePackageDeliveryDto extends EstimatePackageDto {
  @ApiProperty({ description: 'Sender pickup location' })
  @IsObject()
  @IsNotEmpty()
  pickupLocation: LocationDto;

  @ApiProperty({ description: 'Receiver drop-off location' })
  @IsObject()
  @IsNotEmpty()
  dropOffLocation: LocationDto;

  @ApiPropertyOptional({ example: 'Box of electronics, handle with care', description: 'Package description' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  packageDescription?: string;

  @ApiProperty({ example: 'Ahmad Ali', description: 'Receiver full name' })
  @IsString()
  @IsNotEmpty()
  receiverName: string;

  @ApiProperty({ example: '+962791234567', description: 'Receiver phone number' })
  @IsString()
  @IsNotEmpty()
  receiverPhone: string;

  @ApiProperty({ example: true, description: 'Must accept package delivery terms' })
  @IsBoolean()
  @IsNotEmpty()
  termsAccepted: boolean;

  @ApiProperty({
    example: true,
    description:
      'true = pick up as soon as a driver matches; pickupDate is then ignored and set to now server-side.',
  })
  @IsBoolean()
  isImmediate: boolean;

  @ApiPropertyOptional({
    example: '2026-05-03T00:00:00Z',
    description:
      'ISO 8601 scheduled pickup time. Required when isImmediate is false. Must be in the future and within 30 days. Ignored (overwritten with `now` server-side) when isImmediate is true.',
  })
  @IsOptional()
  @IsDateString()
  pickupDate?: string;

  /**
   * Master spec §6.6 — URGENT deliveries skip grouping (solo trip),
   * driver search starts immediately, jumps to broadcast early. The
   * pricing multiplier is a separate concern handled by the pricing
   * service (out of matcher scope).
   */
  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  urgent?: boolean;

  @ApiPropertyOptional({
    example: 2.5,
    description: 'Weight in kg. Used with slot count for capacity checks (§6.2).',
  })
  @IsOptional()
  weightKg?: number;
}
