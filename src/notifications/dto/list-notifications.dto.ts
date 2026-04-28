import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import {
  DriverNotificationCategory,
  DriverNotificationType,
} from '../../shared/enums/driver-notification-type.enum';

export class ListNotificationsQueryDto {
  @ApiPropertyOptional({
    enum: ['all', ...Object.values(DriverNotificationCategory)],
    default: 'all',
  })
  @IsOptional()
  @IsEnum(['all', ...Object.values(DriverNotificationCategory)] as unknown as object)
  filter?: 'all' | DriverNotificationCategory;

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

export class NotificationItemDto {
  @ApiProperty() id: number;
  @ApiProperty({ enum: DriverNotificationType }) type: DriverNotificationType;
  @ApiProperty({ enum: DriverNotificationCategory })
  category: DriverNotificationCategory;
  @ApiProperty() title: string;
  @ApiProperty() body: string;
  @ApiProperty() read: boolean;
  @ApiProperty() createdAt: Date;
  @ApiPropertyOptional() payload: Record<string, unknown> | null;
}

export class ListNotificationsResponseDto {
  @ApiProperty({ type: [NotificationItemDto] })
  data: NotificationItemDto[];
  @ApiProperty() unreadCount: number;
  @ApiProperty() page: number;
  @ApiProperty() limit: number;
  @ApiProperty() totalItems: number;
  @ApiProperty() totalPages: number;
  @ApiProperty() hasNextPage: boolean;
  @ApiProperty() hasPreviousPage: boolean;
}
