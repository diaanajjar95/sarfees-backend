import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export enum EarningsPeriod {
  TODAY = 'today',
  WEEK = 'week',
  MONTH = 'month',
}

export class EarningsQueryDto {
  @ApiPropertyOptional({ enum: EarningsPeriod, default: EarningsPeriod.WEEK })
  @IsOptional()
  @IsEnum(EarningsPeriod)
  period?: EarningsPeriod;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 10, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}

export class EarningsSummaryDto {
  @ApiProperty({ enum: EarningsPeriod }) period: EarningsPeriod;
  @ApiProperty() totalCashCollected: number;
  @ApiProperty() totalCommission: number;
  @ApiProperty() netEarnings: number;
  @ApiProperty() tripCount: number;
}

export class EarningsTripDto {
  @ApiProperty() tripId: number;
  @ApiProperty() route: string;
  @ApiProperty() completedAt: Date;
  @ApiProperty() passengerCount: number;
  @ApiProperty() packageCount: number;
  @ApiProperty() cashCollected: number;
  @ApiProperty() commission: number;
  @ApiProperty() netEarnings: number;
}

export class EarningsResponseDto {
  @ApiProperty({ type: EarningsSummaryDto })
  summary: EarningsSummaryDto;
  @ApiProperty({ type: [EarningsTripDto] })
  trips: EarningsTripDto[];
  @ApiProperty() outstandingBalance: number;
  @ApiProperty() page: number;
  @ApiProperty() limit: number;
  @ApiProperty() totalItems: number;
  @ApiProperty() totalPages: number;
  @ApiProperty() hasNextPage: boolean;
  @ApiProperty() hasPreviousPage: boolean;
}

export class EarningsBreakdownPassengerDto {
  @ApiProperty() name: string;
  @ApiProperty() pickupCity: string;
  @ApiProperty() dropoffCity: string;
  @ApiProperty() fare: number;
  @ApiProperty() collected: boolean;
}

export class EarningsBreakdownPackageDto {
  @ApiProperty() reference: string;
  @ApiProperty() senderName: string;
  @ApiProperty() fee: number;
  @ApiProperty() delivered: boolean;
}

export class EarningsBreakdownStopDto {
  @ApiProperty() order: number;
  @ApiProperty() type: string;
  @ApiProperty() city: string;
  @ApiProperty() cashAtStop: number;
  @ApiProperty({ type: [EarningsBreakdownPassengerDto] })
  passengers: EarningsBreakdownPassengerDto[];
  @ApiProperty({ type: [EarningsBreakdownPackageDto] })
  packages: EarningsBreakdownPackageDto[];
}

export class EarningsBreakdownResponseDto {
  @ApiProperty() tripId: number;
  @ApiProperty() route: string;
  @ApiProperty() completedAt: Date;
  @ApiProperty({ type: [EarningsBreakdownStopDto] })
  stops: EarningsBreakdownStopDto[];
  @ApiProperty() subtotal: number;
  @ApiProperty() commission: number;
  @ApiProperty() netEarnings: number;
}
