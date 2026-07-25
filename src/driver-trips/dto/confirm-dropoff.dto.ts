import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { DeliveryFailureReason } from '../../shared/enums/stop-package-status.enum';

export class PassengerDropoffEntryDto {
  @ApiProperty({ example: 101, description: 'stop_passenger row id' })
  @IsInt()
  id: number;

  @ApiProperty({ example: true })
  @IsBoolean()
  cashCollected: boolean;
}

export class PackageDeliveryFailureEntryDto {
  @ApiProperty({ example: 201, description: 'stop_package row id' })
  @IsInt()
  id: number;

  @ApiProperty({
    enum: DeliveryFailureReason,
    example: DeliveryFailureReason.RECEIVER_NOT_REACHABLE,
  })
  @IsEnum(DeliveryFailureReason)
  reason: DeliveryFailureReason;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

/** §6.5 — OTP + photo close the delivery in both directions. */
export class PackageDeliveredEntryDto {
  @ApiProperty({ example: 201, description: 'stop_package row id' })
  @IsInt()
  id: number;

  @ApiProperty({
    example: '4821',
    description: 'Delivery code the recipient tells the driver (§6.5)',
  })
  @IsString()
  deliveryCode: string;

  @ApiPropertyOptional({
    description: "Driver's photo of the handed-over package",
  })
  @IsOptional()
  @IsString()
  photoUrl?: string;
}

export class ConfirmDropoffDto {
  @ApiProperty({
    description: 'Passenger dropoffs with cash status. Each id must be a stop_passenger row.',
    type: [PassengerDropoffEntryDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PassengerDropoffEntryDto)
  passengersDroppedOff?: PassengerDropoffEntryDto[];

  @ApiProperty({
    description:
      'Packages successfully delivered — each needs the recipient-held delivery code (§6.5). Cash was already collected at pickup.',
    type: [PackageDeliveredEntryDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PackageDeliveredEntryDto)
  packagesDelivered?: PackageDeliveredEntryDto[];

  @ApiProperty({
    description: 'Packages that could not be delivered, with reason',
    type: [PackageDeliveryFailureEntryDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PackageDeliveryFailureEntryDto)
  deliveryFailures?: PackageDeliveryFailureEntryDto[];
}
