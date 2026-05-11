import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { FaqItem } from '../faq-item.entity';

export class CreateFaqItemDto {
  @ApiProperty({
    example: 'trip-book',
    description:
      'Stable URL-safe slug. Lowercase letters, digits, and hyphens only. Used for analytics + mobile deep-link anchors.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'slug must be lowercase letters/digits separated by single hyphens',
  })
  slug: string;

  @ApiProperty({ example: 'Trips' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  categoryEn: string;

  @ApiProperty({ example: 'الرحلات' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  categoryAr: string;

  @ApiProperty({ example: 'How do I book an intercity trip?' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  questionEn: string;

  @ApiProperty({ example: 'كيف أحجز رحلة بين المدن؟' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  questionAr: string;

  @ApiProperty({ example: 'From the home screen, tap Book a Trip…' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  answerEn: string;

  @ApiProperty({ example: 'من الشاشة الرئيسية، اضغط احجز رحلة…' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  answerAr: string;

  @ApiPropertyOptional({
    example: 30,
    description: 'Sort order ASC. Defaults to 0. Use multiples of 10 to leave room to reorder.',
  })
  @IsOptional()
  @IsInt()
  displayOrder?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateFaqItemDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) categoryEn?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) categoryAr?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) questionEn?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) questionAr?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) answerEn?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) answerAr?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() displayOrder?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

export class AdminFaqItemDto {
  @ApiProperty() id: number;
  @ApiProperty() slug: string;
  @ApiProperty() categoryEn: string;
  @ApiProperty() categoryAr: string;
  @ApiProperty() questionEn: string;
  @ApiProperty() questionAr: string;
  @ApiProperty() answerEn: string;
  @ApiProperty() answerAr: string;
  @ApiProperty() displayOrder: number;
  @ApiProperty() isActive: boolean;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;

  static from(f: FaqItem): AdminFaqItemDto {
    return {
      id: f.id,
      slug: f.slug,
      categoryEn: f.categoryEn,
      categoryAr: f.categoryAr,
      questionEn: f.questionEn,
      questionAr: f.questionAr,
      answerEn: f.answerEn,
      answerAr: f.answerAr,
      displayOrder: f.displayOrder,
      isActive: f.isActive,
      createdAt: f.createdAt,
      updatedAt: f.updatedAt,
    };
  }
}
