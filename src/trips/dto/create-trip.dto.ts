import { IsBoolean, IsDateString, IsInt, IsNotEmpty, IsObject, IsOptional, IsString, Max, Min, ValidateIf } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LocationDto {
  @ApiProperty({ example: 31.9539 })
  @IsNotEmpty()
  lat: number;

  @ApiProperty({ example: 35.9106 })
  @IsNotEmpty()
  lng: number;
}

export class EstimateTripDto {
  @ApiProperty({ example: 1, description: 'ID of the departure City' })
  @IsInt()
  @IsNotEmpty()
  departureCityId: number;

  @ApiProperty({ example: 2, description: 'ID of the arrival City' })
  @IsInt()
  @IsNotEmpty()
  arrivalCityId: number;

  @ApiProperty()
  @IsObject()
  @IsNotEmpty()
  departureLocation: LocationDto;

  @ApiProperty()
  @IsObject()
  @IsNotEmpty()
  arrivalLocation: LocationDto;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isImmediate?: boolean;

  @ApiProperty({ required: false, example: '2026-04-10T14:30:00Z' })
  @ValidateIf(o => !o.isImmediate)
  @IsDateString()
  travelDate?: string;

  @ApiProperty({ default: 1, minimum: 1, maximum: 4 })
  @IsInt()
  @Min(1)
  @Max(4)
  seatsCount: number;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  isFemaleOnly?: boolean;
}

export class CreateTripDto extends EstimateTripDto {}
