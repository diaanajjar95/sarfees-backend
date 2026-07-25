import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { EarlyAccessRole } from '../entities/early-access-signup.entity';

export class ListEarlyAccessQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ enum: EarlyAccessRole })
  @IsOptional()
  @IsIn(Object.values(EarlyAccessRole))
  role?: EarlyAccessRole;
}

export class EarlyAccessRowDto {
  @ApiProperty() id: number;
  @ApiProperty({ enum: EarlyAccessRole }) role: EarlyAccessRole;
  @ApiProperty({ nullable: true }) route: string | null;
  @ApiProperty({ nullable: true }) frequency: string | null;
  @ApiProperty({ nullable: true }) travelTime: string | null;
  @ApiProperty({ nullable: true }) fairPriceJod: number | null;
  @ApiProperty({ nullable: true }) findMethod: string | null;
  @ApiProperty({ nullable: true }) pilotWilling: string | null;
  @ApiProperty({ nullable: true }) phone: string | null;
  @ApiProperty({ nullable: true }) locale: string | null;
  @ApiProperty() createdAt: Date;
}

export class ListEarlyAccessResponseDto {
  @ApiProperty({ type: [EarlyAccessRowDto] })
  data: EarlyAccessRowDto[];

  @ApiProperty() page: number;
  @ApiProperty() limit: number;
  @ApiProperty() totalItems: number;
  @ApiProperty() totalPages: number;

  /** Totals per role, regardless of filter. */
  @ApiProperty() passengerCount: number;
  @ApiProperty() driverCount: number;
}
