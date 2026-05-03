import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';
import { Announcement } from '../announcement.entity';

export class CreateAnnouncementDto {
  @ApiProperty({ example: 'Peak hours bonus tonight' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @ApiProperty({ example: 'Drive between 7pm and 11pm to earn an extra 1 JD per trip.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  body: string;

  @ApiPropertyOptional({ example: 'https://sarfees.com/promo/peak' })
  @IsOptional()
  @IsUrl({ require_tld: false })
  ctaUrl?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  priority?: number;
}

export class UpdateAnnouncementDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) title?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) body?: string;
  @ApiPropertyOptional() @IsOptional() @IsUrl({ require_tld: false }) ctaUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsDateString() startsAt?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() endsAt?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() priority?: number;
}

export class AnnouncementResponseDto {
  @ApiProperty() id: number;
  @ApiProperty() title: string;
  @ApiProperty() body: string;
  @ApiPropertyOptional() ctaUrl: string | null;
  @ApiProperty() isActive: boolean;
  @ApiPropertyOptional() startsAt: Date | null;
  @ApiPropertyOptional() endsAt: Date | null;
  @ApiProperty() priority: number;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;

  static from(a: Announcement): AnnouncementResponseDto {
    return {
      id: a.id,
      title: a.title,
      body: a.body,
      ctaUrl: a.ctaUrl ?? null,
      isActive: a.isActive,
      startsAt: a.startsAt ?? null,
      endsAt: a.endsAt ?? null,
      priority: a.priority,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    };
  }
}
