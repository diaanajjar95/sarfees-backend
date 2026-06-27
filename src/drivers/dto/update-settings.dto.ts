import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class NotificationPrefsDto {
  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  tripOffers?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  tripUpdates?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  earnings?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  announcements?: boolean;
}

export class UpdateSettingsDto {
  @ApiPropertyOptional({ enum: ['ar', 'en'] })
  @IsOptional()
  @IsString()
  @IsIn(['ar', 'en'])
  language?: 'ar' | 'en';

  @ApiPropertyOptional({ type: NotificationPrefsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => NotificationPrefsDto)
  notifications?: NotificationPrefsDto;
}
