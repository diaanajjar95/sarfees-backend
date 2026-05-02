import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class UpdateDriverDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ enum: ['male', 'female'] })
  @IsOptional()
  @IsString()
  @IsIn(['male', 'female'])
  gender?: 'male' | 'female';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  homeCity?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() vehicleMake?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() vehicleModel?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() vehicleColor?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1980)
  @Max(2100)
  vehicleYear?: number;

  @ApiPropertyOptional() @IsOptional() @IsString() plateNumber?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  passengerCapacity?: number;

  @ApiPropertyOptional({ enum: ['ar', 'en'] })
  @IsOptional()
  @IsString()
  @IsIn(['ar', 'en'])
  language?: 'ar' | 'en';
}
