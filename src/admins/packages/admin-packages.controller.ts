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
import { AdminPackagesService } from './admin-packages.service';
import {
  AdminPackageRowDto,
  ListAdminPackagesQueryDto,
  ListAdminPackagesResponseDto,
} from './dto/list-admin-packages.dto';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { AdminRole } from '../../shared/enums/admin-role.enum';
import { AdminCancelDto } from '../shared/dto/admin-cancel.dto';

@ApiTags('Admin — Packages')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt-admin'), RolesGuard)
@Controller('admin/packages')
export class AdminPackagesController {
  constructor(private readonly service: AdminPackagesService) {}

  @ApiOperation({
    summary: 'List package deliveries (paginated, filterable by status)',
  })
  @ApiResponse({ status: 200, type: ListAdminPackagesResponseDto })
  @Get()
  list(
    @Query() query: ListAdminPackagesQueryDto,
  ): Promise<ListAdminPackagesResponseDto> {
    return this.service.list(query);
  }

  @ApiOperation({ summary: 'Get one package delivery' })
  @ApiResponse({ status: 200, type: AdminPackageRowDto })
  @Get(':id')
  detail(@Param('id', ParseIntPipe) id: number): Promise<AdminPackageRowDto> {
    return this.service.detail(id);
  }

  @ApiOperation({
    summary: 'Cancel a package delivery (ops, reason required)',
    description:
      'Marks the delivery CANCELLED with an audit trail (admin id + reason). Blocked once the parcel is with the driver. Closes the trip group too when this was its last live member.',
  })
  @ApiResponse({ status: 200, description: 'Delivery cancelled' })
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
