import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AdminTripGroupsService } from './admin-trip-groups.service';
import {
  ListTripGroupsQueryDto,
  ListTripGroupsResponseDto,
} from './dto/list-trip-groups.dto';
import { RolesGuard } from '../../shared/guards/roles.guard';

@ApiTags('Admin — Trip Groups')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt-admin'), RolesGuard)
@Controller('admin/trip-groups')
export class AdminTripGroupsController {
  constructor(private readonly service: AdminTripGroupsService) {}

  @ApiOperation({
    summary: 'List trip groups (default: not yet assigned to a driver)',
    description:
      'Stage-1 grouping output. Default filter shows every group still waiting for a driver (open / frozen / offering / broadcasting / unserved_escalation), soonest departure first, with members embedded. Driver search fires at departureTime - 30 min (driverSearchAt).',
  })
  @ApiResponse({ status: 200, type: ListTripGroupsResponseDto })
  @Get()
  list(
    @Query() query: ListTripGroupsQueryDto,
  ): Promise<ListTripGroupsResponseDto> {
    return this.service.list(query);
  }
}
