import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class CreateDriverDto {
  @ApiProperty({ example: 'Mohammed Al-Rashid' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: '7700000001' })
  @IsString()
  @Matches(/^[0-9]{6,15}$/)
  phoneNumber: string;

  @ApiProperty({ example: '+962' })
  @IsString()
  @Matches(/^\+[1-9][0-9]{0,3}$/)
  countryCode: string;

  @ApiProperty({ enum: ['male', 'female'] })
  @IsString()
  @IsIn(['male', 'female'])
  gender: 'male' | 'female';

  @ApiProperty({ example: 'Amman' })
  @IsString()
  @IsNotEmpty()
  homeCity: string;

  @ApiPropertyOptional({ example: 'Toyota' })
  @IsOptional()
  @IsString()
  vehicleMake?: string;

  @ApiPropertyOptional({ example: 'Camry' })
  @IsOptional()
  @IsString()
  vehicleModel?: string;

  @ApiPropertyOptional({ example: 'White' })
  @IsOptional()
  @IsString()
  vehicleColor?: string;

  @ApiPropertyOptional({ example: 2022 })
  @IsOptional()
  @IsInt()
  @Min(1980)
  @Max(2100)
  vehicleYear?: number;

  @ApiPropertyOptional({ example: '12-34567' })
  @IsOptional()
  @IsString()
  plateNumber?: string;

  @ApiPropertyOptional({ example: 4, minimum: 1, maximum: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  passengerCapacity?: number;

  @ApiPropertyOptional({ enum: ['ar', 'en'], default: 'en' })
  @IsOptional()
  @IsString()
  @IsIn(['ar', 'en'])
  language?: 'ar' | 'en';
}
