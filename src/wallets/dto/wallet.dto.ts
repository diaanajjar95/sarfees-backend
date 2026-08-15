import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { TopupCardStatus } from '../../shared/enums/wallet.enum';

export class PageQueryDto {
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
}

export class CreateCardBatchDto {
  @ApiProperty({ example: 10, description: 'JD value of every card in the batch' })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(500)
  amount: number;

  @ApiProperty({ example: 50, maximum: 1000 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  count: number;
}

export class ListCardsQueryDto extends PageQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  batchId?: string;

  @ApiPropertyOptional({ enum: TopupCardStatus })
  @IsOptional()
  @IsIn(Object.values(TopupCardStatus))
  status?: TopupCardStatus;
}

export class LookupDriverDto {
  @ApiProperty({ example: '770000001' })
  @IsString()
  @Matches(/^[0-9]{7,15}$/, { message: 'driverPhone must be 7-15 digits' })
  driverPhone: string;

  @ApiPropertyOptional({ example: '+962', default: '+962' })
  @IsOptional()
  @IsString()
  @MaxLength(6)
  countryCode?: string;
}

export class RedeemCardDto extends LookupDriverDto {
  @ApiProperty({
    example: '1234-5678-9012',
    description: '12-digit card code; separators allowed',
  })
  @IsString()
  @MaxLength(20)
  code: string;
}

export class CreditWalletDto {
  @ApiProperty({ example: 10, minimum: 0.01 })
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  @Max(1000)
  amount: number;

  @ApiProperty({ enum: ['credit', 'refund'] })
  @IsIn(['credit', 'refund'])
  kind: 'credit' | 'refund';

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class UpdateWalletConfigDto {
  @ApiPropertyOptional({ example: 15, minimum: 0, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  commissionPercent?: number;

  @ApiPropertyOptional({ example: 5, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1000)
  lowBalanceThresholdJod?: number;

  @ApiPropertyOptional({ example: 24, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(168)
  lowBalanceNotifyCooldownHours?: number;
}
