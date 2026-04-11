import {
  IsBoolean,
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
}
