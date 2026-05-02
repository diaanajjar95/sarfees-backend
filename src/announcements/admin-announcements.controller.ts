import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
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
import { AnnouncementsService } from './announcements.service';
import {
  AnnouncementResponseDto,
  CreateAnnouncementDto,
  UpdateAnnouncementDto,
} from './dto/announcement.dto';
import { Roles } from '../shared/decorators/roles.decorator';
import { RolesGuard } from '../shared/guards/roles.guard';
import { AdminRole } from '../shared/enums/admin-role.enum';

@ApiTags('Admin — Announcements')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt-admin'), RolesGuard)
@Controller('admin/announcements')
export class AdminAnnouncementsController {
  constructor(private readonly service: AnnouncementsService) {}

  @ApiOperation({ summary: 'List all announcements (active + inactive)' })
  @ApiResponse({ status: 200, type: [AnnouncementResponseDto] })
  @Get()
  list(): Promise<AnnouncementResponseDto[]> {
    return this.service.listAll();
  }

  @ApiOperation({ summary: 'Create a new announcement' })
  @ApiResponse({ status: 201, type: AnnouncementResponseDto })
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.OPS_MANAGER)
  @Post()
  create(
    @Req() req: Request,
    @Body() dto: CreateAnnouncementDto,
  ): Promise<AnnouncementResponseDto> {
    const adminId = (req.user as { adminId: number }).adminId;
    return this.service.create(dto, adminId);
  }

  @ApiOperation({ summary: 'Update an announcement' })
  @ApiResponse({ status: 200, type: AnnouncementResponseDto })
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.OPS_MANAGER)
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAnnouncementDto,
  ): Promise<AnnouncementResponseDto> {
    return this.service.update(id, dto);
  }

  @ApiOperation({ summary: 'Delete an announcement' })
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.OPS_MANAGER)
  @HttpCode(HttpStatus.OK)
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
