import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { PackageRefusalReason } from '../../shared/enums/stop-package-status.enum';

/** §6.4 — driver refusal right at pickup, with reason + optional photo. */
export class PackageRefusalEntryDto {
  @ApiProperty({ example: 201, description: 'stop_package row id' })
  @IsInt()
  id: number;

  @ApiProperty({
    enum: PackageRefusalReason,
    example: PackageRefusalReason.NOT_AS_DECLARED,
  })
  @IsEnum(PackageRefusalReason)
  reason: PackageRefusalReason;

  @ApiPropertyOptional({ description: 'Photo the driver took of the refused package' })
  @IsOptional()
  @IsString()
  photoUrl?: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class ConfirmPickupDto {
  @ApiProperty({
    description: 'IDs of stop_passenger rows the driver picked up',
    example: [101, 102],
    type: [Number],
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @ArrayUnique()
  passengersPickedUp?: number[];

  @ApiProperty({
    description: 'IDs of stop_passenger rows marked as no-show',
    example: [],
    type: [Number],
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @ArrayUnique()
  noShows?: number[];

  @ApiProperty({
    description:
      'IDs of stop_package rows the driver collected. Cash for these packages is collected here (§6.1 — sender pays at pickup).',
    example: [201],
    type: [Number],
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @ArrayUnique()
  packagesCollected?: number[];

  @ApiProperty({
    description:
      'IDs of stop_package rows where the sender/package was not found (sender no-show, §6.7)',
    example: [],
    type: [Number],
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @ArrayUnique()
  packagesNotFound?: number[];

  @ApiProperty({
    description:
      'Packages the driver REFUSED at pickup with a reason (§6.4). Sender is not charged; refusals never count against the driver.',
    type: [PackageRefusalEntryDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PackageRefusalEntryDto)
  packagesRefused?: PackageRefusalEntryDto[];
}
