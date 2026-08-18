import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { PushService } from './push.service';
import { Roles } from '../shared/decorators/roles.decorator';
import { RolesGuard } from '../shared/guards/roles.guard';
import { AdminRole } from '../shared/enums/admin-role.enum';

class CreateTopicDto {
  @ApiProperty({ example: 'amman_promos' })
  @IsString()
  @MinLength(3)
  @MaxLength(64)
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message: 'Topic name: letters, digits, _ and - only',
  })
  name: string;

  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;
}

class BroadcastDto {
  @ApiProperty({ example: 'all_customers' })
  @IsString()
  @MaxLength(64)
  topic: string;

  @ApiProperty({ example: 'Weekend offer' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  title: string;

  @ApiProperty({ example: 'Trips to Irbid are 10% off this Friday.' })
  @IsString()
  @MinLength(2)
  @MaxLength(500)
  body: string;
}

@ApiTags('Admin — Push Topics')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt-admin'), RolesGuard)
@Controller('admin/notification-topics')
export class AdminPushController {
  constructor(private readonly push: PushService) {}

  @ApiOperation({ summary: 'List FCM topics (built-in + custom)' })
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.OPS_MANAGER, AdminRole.SUPPORT)
  @Get()
  list() {
    return this.push.listTopics();
  }

  @ApiOperation({ summary: 'Create a custom topic' })
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.OPS_MANAGER)
  @Post()
  create(@Body() dto: CreateTopicDto) {
    return this.push.createTopic(dto.name, dto.description);
  }

  @ApiOperation({
    summary: 'Broadcast a push to a topic',
    description:
      '400 with a clear message while Firebase credentials are not yet ' +
      'configured. The topic must exist in the topics list.',
  })
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.OPS_MANAGER)
  @HttpCode(HttpStatus.OK)
  @Post('broadcast')
  async broadcast(@Body() dto: BroadcastDto) {
    const topics = await this.push.listTopics();
    if (!topics.some((t) => t.name === dto.topic)) {
      throw new BadRequestException(`Unknown topic '${dto.topic}'`);
    }
    try {
      await this.push.sendToTopic(dto.topic, {
        title: dto.title,
        body: dto.body,
      });
    } catch (err) {
      throw new BadRequestException(
        err instanceof Error ? err.message : 'Broadcast failed',
      );
    }
    return { sent: true, topic: dto.topic };
  }
}
