import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { EarlyAccessRole } from '../entities/early-access-signup.entity';

export class CreateEarlyAccessSignupDto {
  @ApiProperty({ enum: EarlyAccessRole, example: 'passenger' })
  @IsIn(Object.values(EarlyAccessRole))
  role: EarlyAccessRole;

  @ApiPropertyOptional({ example: 'Irbid – Amman', maxLength: 160 })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  route?: string;

  @ApiPropertyOptional({ enum: ['daily', 'weekly', 'few-times', 'rarely'] })
  @IsOptional()
  @IsIn(['daily', 'weekly', 'few-times', 'rarely'])
  frequency?: string;

  @ApiPropertyOptional({ enum: ['morning', 'midday', 'afternoon', 'evening'] })
  @IsOptional()
  @IsIn(['morning', 'midday', 'afternoon', 'evening'])
  travelTime?: string;

  @ApiPropertyOptional({ example: 3.5, minimum: 0, maximum: 999 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(999)
  fairPriceJod?: number;

  @ApiPropertyOptional({ enum: ['whatsapp', 'own-base', 'other'] })
  @IsOptional()
  @IsIn(['whatsapp', 'own-base', 'other'])
  findMethod?: string;

  @ApiPropertyOptional({ enum: ['yes', 'maybe', 'no'] })
  @IsOptional()
  @IsIn(['yes', 'maybe', 'no'])
  pilotWilling?: string;

  @ApiPropertyOptional({ example: '0790000001', maxLength: 30 })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional({ enum: ['en', 'ar'] })
  @IsOptional()
  @IsIn(['en', 'ar'])
  locale?: string;
}
