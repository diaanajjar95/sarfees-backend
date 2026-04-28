import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { DriverNotificationsService } from './driver-notifications.service';
import {
  ListNotificationsQueryDto,
  ListNotificationsResponseDto,
} from './dto/list-notifications.dto';
import { MarkReadDto } from './dto/mark-read.dto';

@ApiTags('Driver Notifications')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt-driver'))
@Controller('drivers/notifications')
export class DriverNotificationsController {
  constructor(
    private readonly notificationsService: DriverNotificationsService,
  ) {}

  @ApiOperation({ summary: 'List driver notifications (S-18)' })
  @ApiResponse({ status: 200, type: ListNotificationsResponseDto })
  @Get()
  list(
    @Req() req: Request,
    @Query() query: ListNotificationsQueryDto,
  ): Promise<ListNotificationsResponseDto> {
    return this.notificationsService.list(this.driverId(req), query);
  }

  @ApiOperation({
    summary: 'Mark notifications as read (S-18)',
    description: 'Pass `notificationIds: [..]` for specific items or `all: true` to mark all unread as read.',
  })
  @ApiResponse({ status: 200, description: 'Updated count' })
  @HttpCode(HttpStatus.OK)
  @Post('mark-read')
  markRead(
    @Req() req: Request,
    @Body() dto: MarkReadDto,
  ): Promise<{ updated: number }> {
    return this.notificationsService.markRead(this.driverId(req), dto);
  }

  private driverId(req: Request): number {
    return (req.user as { driverId: number }).driverId;
  }
}
