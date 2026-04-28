import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { TRIP_TYPES, TripTypePreference } from './activate-preferences.dto';

/**
 * Partial update of session preferences while driver is already active (S-06).
 * Any field omitted is left unchanged.
 */
export class UpdatePreferencesDto {
  @ApiPropertyOptional({ example: 'Amman' })
  @IsOptional()
  @IsString()
  destinationCity?: string;

  @ApiPropertyOptional({
    example: ['mixed'],
    enum: TRIP_TYPES,
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsIn(TRIP_TYPES, { each: true })
  tripTypes?: TripTypePreference[];

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  goingHome?: boolean;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3)
  minPassengers?: number;
}
