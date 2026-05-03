import { ApiProperty } from '@nestjs/swagger';
import { ArrayUnique, IsArray, IsInt, IsOptional } from 'class-validator';

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
    description: 'IDs of stop_package rows the driver collected',
    example: [201],
    type: [Number],
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @ArrayUnique()
  packagesCollected?: number[];

  @ApiProperty({
    description: 'IDs of stop_package rows marked as not-found at pickup',
    example: [],
    type: [Number],
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @ArrayUnique()
  packagesNotFound?: number[];
}
