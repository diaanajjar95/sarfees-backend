import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AdminPassengerRequestsService } from './admin-passenger-requests.service';
import {
  ListPassengerRequestsQueryDto,
  ListPassengerRequestsResponseDto,
  PassengerRequestRowDto,
} from './dto/list-passenger-requests.dto';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { AdminRole } from '../../shared/enums/admin-role.enum';
import { AdminCancelDto } from '../shared/dto/admin-cancel.dto';

@ApiTags('Admin — Passenger Requests')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt-admin'), RolesGuard)
@Controller('admin/passenger-requests')
export class AdminPassengerRequestsController {
  constructor(private readonly service: AdminPassengerRequestsService) {}

  @ApiOperation({
    summary: 'List passenger trip requests (paginated, filterable by status / date)',
  })
  @ApiResponse({ status: 200, type: ListPassengerRequestsResponseDto })
  @Get()
  list(
    @Query() query: ListPassengerRequestsQueryDto,
  ): Promise<ListPassengerRequestsResponseDto> {
    return this.service.list(query);
  }

  @ApiOperation({ summary: 'Get a passenger trip request detail' })
  @ApiResponse({ status: 200, type: PassengerRequestRowDto })
  @Get(':id')
  detail(@Param('id', ParseIntPipe) id: number): Promise<PassengerRequestRowDto> {
    return this.service.detail(id);
  }

  @ApiOperation({
    summary: 'Cancel a passenger request (ops, reason required)',
    description:
      'Marks the request CANCELLED with an audit trail (admin id + reason) and runs the same Stage-1 group bookkeeping as a passenger self-cancel.',
  })
  @ApiResponse({ status: 200, description: 'Request cancelled' })
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.OPS_MANAGER)
  @HttpCode(HttpStatus.OK)
  @Post(':id/cancel')
  cancel(
    @Req() req: Request,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AdminCancelDto,
  ): Promise<{ id: number; status: string }> {
    const adminId = (req.user as { adminId: number }).adminId;
    return this.service.cancel(id, adminId, dto.reason);
  }
}
