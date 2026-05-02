import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { DriverStatus } from '../../../shared/enums/driver-status.enum';
import { DriverProfileResponseDto } from '../../../drivers/dto/driver-profile-response.dto';

export class ListDriversQueryDto {
  @ApiPropertyOptional({ description: 'Free-text search across name, phone, plate' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ enum: DriverStatus })
  @IsOptional()
  @IsEnum(DriverStatus)
  status?: DriverStatus;

  @ApiPropertyOptional({ description: 'Filter by home city' })
  @IsOptional()
  @IsString()
  homeCity?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}

export class ListDriversResponseDto {
  @ApiProperty({ type: [DriverProfileResponseDto] })
  data: DriverProfileResponseDto[];
  @ApiProperty() page: number;
  @ApiProperty() limit: number;
  @ApiProperty() totalItems: number;
  @ApiProperty() totalPages: number;
  @ApiProperty() hasNextPage: boolean;
  @ApiProperty() hasPreviousPage: boolean;
}
