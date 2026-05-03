import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AdminDriversService } from './admin-drivers.service';
import { CreateDriverDto } from './dto/create-driver.dto';
import { UpdateDriverDto } from './dto/update-driver.dto';
import {
  ListDriversQueryDto,
  ListDriversResponseDto,
} from './dto/list-drivers.dto';
import { AdminDriverDetailDto } from './dto/driver-detail.dto';
import { DriverProfileResponseDto } from '../../drivers/dto/driver-profile-response.dto';
import { Roles } from '../../shared/decorators/roles.decorator';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { AdminRole } from '../../shared/enums/admin-role.enum';

@ApiTags('Admin — Drivers')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt-admin'), RolesGuard)
@Controller('admin/drivers')
export class AdminDriversController {
  constructor(private readonly service: AdminDriversService) {}

  @ApiOperation({ summary: 'List drivers (paginated, filterable)' })
  @ApiResponse({ status: 200, type: ListDriversResponseDto })
  @Get()
  list(@Query() query: ListDriversQueryDto): Promise<ListDriversResponseDto> {
    return this.service.list(query);
  }

  @ApiOperation({ summary: 'Get driver detail incl. trip + decline history' })
  @ApiResponse({ status: 200, type: AdminDriverDetailDto })
  @Get(':id')
  detail(@Param('id', ParseIntPipe) id: number): Promise<AdminDriverDetailDto> {
    return this.service.detail(id);
  }

  @ApiOperation({ summary: 'Create a new driver (replaces SQL seed in prod)' })
  @ApiResponse({ status: 201, type: DriverProfileResponseDto })
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.OPS_MANAGER)
  @Post()
  create(@Body() dto: CreateDriverDto): Promise<DriverProfileResponseDto> {
    return this.service.create(dto);
  }

  @ApiOperation({ summary: 'Update driver profile or vehicle' })
  @ApiResponse({ status: 200, type: DriverProfileResponseDto })
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.OPS_MANAGER)
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDriverDto,
  ): Promise<DriverProfileResponseDto> {
    return this.service.update(id, dto);
  }

  @ApiOperation({ summary: 'Suspend a driver (blocks login + activation)' })
  @ApiResponse({ status: 200, type: DriverProfileResponseDto })
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.OPS_MANAGER)
  @HttpCode(HttpStatus.OK)
  @Post(':id/suspend')
  suspend(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<DriverProfileResponseDto> {
    return this.service.suspend(id);
  }

  @ApiOperation({ summary: 'Reinstate a suspended driver' })
  @ApiResponse({ status: 200, type: DriverProfileResponseDto })
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.OPS_MANAGER)
  @HttpCode(HttpStatus.OK)
  @Post(':id/reinstate')
  reinstate(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<DriverProfileResponseDto> {
    return this.service.reinstate(id);
  }
}
