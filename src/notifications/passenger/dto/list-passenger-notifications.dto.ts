import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import {
  PassengerNotificationCategory,
  PassengerNotificationType,
} from '../../../shared/enums/passenger-notification-type.enum';

export class ListPassengerNotificationsQueryDto {
  @ApiPropertyOptional({
    enum: ['all', ...Object.values(PassengerNotificationCategory)],
    default: 'all',
  })
  @IsOptional()
  @IsEnum([
    'all',
    ...Object.values(PassengerNotificationCategory),
  ] as unknown as object)
  filter?: 'all' | PassengerNotificationCategory;

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

export class PassengerNotificationItemDto {
  @ApiProperty() id: number;
  @ApiProperty({ enum: PassengerNotificationType })
  type: PassengerNotificationType;
  @ApiProperty({ enum: PassengerNotificationCategory })
  category: PassengerNotificationCategory;
  /** Localized title (chosen by Accept-Language header, falls back to EN). */
  @ApiProperty() title: string;
  /** Localized body (chosen by Accept-Language header, falls back to EN). */
  @ApiProperty() body: string;
  @ApiProperty() read: boolean;
  @ApiProperty() createdAt: Date;
  @ApiPropertyOptional() payload: Record<string, unknown> | null;
}

export class ListPassengerNotificationsResponseDto {
  @ApiProperty({ type: [PassengerNotificationItemDto] })
  data: PassengerNotificationItemDto[];
  @ApiProperty() unreadCount: number;
  @ApiProperty() page: number;
  @ApiProperty() limit: number;
  @ApiProperty() totalItems: number;
  @ApiProperty() totalPages: number;
  @ApiProperty() hasNextPage: boolean;
  @ApiProperty() hasPreviousPage: boolean;
}
