import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AdminEscalationsService } from './admin-escalations.service';
import {
  ListEscalationsQueryDto,
  ListEscalationsResponseDto,
} from './dto/list-escalations.dto';
import { AdminRole } from '../../shared/enums/admin-role.enum';
import { Roles } from '../../shared/decorators/roles.decorator';
import { RolesGuard } from '../../shared/guards/roles.guard';

@ApiTags('Admin — Escalations')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt-admin'), RolesGuard)
@Controller('admin/escalations')
export class AdminEscalationsController {
  constructor(private readonly service: AdminEscalationsService) {}

  @Get()
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.OPS_MANAGER)
  @ApiOperation({
    summary: 'List unresolved (or resolved) escalation cases',
    description:
      'Master spec §9.7 — the ops safety net. When a group runs out of cascade + broadcast candidates by departure, it lands here. Ops resolves manually via the trip-assign flow.',
  })
  @ApiResponse({ status: 200, type: ListEscalationsResponseDto })
  list(
    @Query() query: ListEscalationsQueryDto,
  ): Promise<ListEscalationsResponseDto> {
    return this.service.list(query);
  }
}
