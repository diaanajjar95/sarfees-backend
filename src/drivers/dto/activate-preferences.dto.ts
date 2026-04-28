import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export const TRIP_TYPES = [
  'shared',
  'women_only',
  'packages_only',
  'mixed',
] as const;
export type TripTypePreference = (typeof TRIP_TYPES)[number];

export class ActivatePreferencesDto {
  @ApiPropertyOptional({
    example: 'Amman',
    description:
      'Preferred destination city. Null/omitted = "Any Destination". Ignored when goingHome is true (server overrides with driver home city).',
  })
  @IsOptional()
  @IsString()
  destinationCity?: string;

  @ApiProperty({
    example: ['mixed'],
    enum: TRIP_TYPES,
    isArray: true,
    description: 'At least one trip type must be selected.',
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsIn(TRIP_TYPES, { each: true })
  tripTypes: TripTypePreference[];

  @ApiProperty({
    example: false,
    description:
      'When true, server forces destinationCity to driver home city.',
  })
  @IsBoolean()
  goingHome: boolean;

  @ApiPropertyOptional({
    example: 2,
    description: '1, 2, 3, or null/omitted for "Any".',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3)
  minPassengers?: number;

  @ApiProperty({ example: 31.9539 })
  @IsNumber()
  @Min(-90)
  @Max(90)
  currentLocationLat: number;

  @ApiProperty({ example: 35.9106 })
  @IsNumber()
  @Min(-180)
  @Max(180)
  currentLocationLng: number;
}
