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
import { PassengerNotificationsService } from './passenger-notifications.service';
import {
  ListPassengerNotificationsQueryDto,
  ListPassengerNotificationsResponseDto,
} from './dto/list-passenger-notifications.dto';
import { MarkPassengerReadDto } from './dto/mark-passenger-read.dto';

@ApiTags('Passenger Notifications')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('users/notifications')
export class PassengerNotificationsController {
  constructor(
    private readonly notificationsService: PassengerNotificationsService,
  ) {}

  @ApiOperation({
    summary: 'List passenger notifications',
    description:
      'Returns the current passenger\'s inbox. Title/body are localised based ' +
      'on the Accept-Language header (en or ar; falls back to en). Pass ' +
      '`filter=trips|packages|system` to scope the list.',
  })
  @ApiResponse({ status: 200, type: ListPassengerNotificationsResponseDto })
  @Get()
  list(
    @Req() req: Request,
    @Query() query: ListPassengerNotificationsQueryDto,
  ): Promise<ListPassengerNotificationsResponseDto> {
    return this.notificationsService.list(this.userId(req), query);
  }

  @ApiOperation({
    summary: 'Mark passenger notifications as read',
    description:
      'Pass `notificationIds: [..]` for specific items or `all: true` to mark ' +
      'every unread row as read.',
  })
  @ApiResponse({ status: 200, description: 'Updated count' })
  @HttpCode(HttpStatus.OK)
  @Post('mark-read')
  markRead(
    @Req() req: Request,
    @Body() dto: MarkPassengerReadDto,
  ): Promise<{ updated: number }> {
    return this.notificationsService.markRead(this.userId(req), dto);
  }

  private userId(req: Request): number {
    return (req.user as { userId: number }).userId;
  }
}
