import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { EarningsPeriod } from '../../../drivers/dto/earnings.dto';

export class AdminEarningsQueryDto {
  @ApiPropertyOptional({ enum: EarningsPeriod, default: EarningsPeriod.WEEK })
  @IsOptional()
  @IsEnum(EarningsPeriod)
  period?: EarningsPeriod;
}

export class AdminEarningsKpiDto {
  @ApiProperty({ enum: EarningsPeriod }) period: EarningsPeriod;
  @ApiProperty() totalCashCollected: number;
  @ApiProperty() totalCommission: number;
  @ApiProperty() totalNetPaidToDrivers: number;
  @ApiProperty() tripCount: number;
  @ApiProperty() activeDrivers: number;
  @ApiProperty() outstandingTotal: number;
}

export class CityRollupRowDto {
  @ApiProperty() city: string;
  @ApiProperty() tripCount: number;
  @ApiProperty() cashCollected: number;
  @ApiProperty() commission: number;
}

export class AdminEarningsDashboardDto {
  @ApiProperty({ type: AdminEarningsKpiDto })
  kpi: AdminEarningsKpiDto;
  @ApiProperty({ type: [CityRollupRowDto] })
  byOriginCity: CityRollupRowDto[];
}

export class AdminBalanceQueryDto {
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

  @ApiPropertyOptional({
    enum: ['outstanding', 'all'],
    default: 'outstanding',
    description: '`outstanding` = only drivers with balance > 0 (default), `all` = every driver.',
  })
  @IsOptional()
  @IsString()
  @IsIn(['outstanding', 'all'])
  scope?: 'outstanding' | 'all';
}

export class DriverBalanceRowDto {
  @ApiProperty() driverId: number;
  @ApiProperty() driverName: string | null;
  @ApiProperty() phoneNumber: string;
  @ApiProperty() totalTrips: number;
  @ApiProperty() outstandingBalance: number;
}

export class DriverBalancesResponseDto {
  @ApiProperty({ type: [DriverBalanceRowDto] }) data: DriverBalanceRowDto[];
  @ApiProperty() page: number;
  @ApiProperty() limit: number;
  @ApiProperty() totalItems: number;
  @ApiProperty() totalPages: number;
  @ApiProperty() hasNextPage: boolean;
  @ApiProperty() hasPreviousPage: boolean;
  @ApiProperty() outstandingTotal: number;
}

export class SettleBalanceDto {
  @ApiProperty({
    example: 18.5,
    description:
      'Amount being settled. Must be > 0 and <= the driver outstanding balance.',
  })
  @IsNumber()
  amount: number;

  @ApiPropertyOptional({ example: 'Bank transfer ref #ABC123', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class SettleBalanceResponseDto {
  @ApiProperty() driverId: number;
  @ApiProperty() previousBalance: number;
  @ApiProperty() amountSettled: number;
  @ApiProperty() newBalance: number;
}
