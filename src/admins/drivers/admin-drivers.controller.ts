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
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import type { Request } from 'express';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AdminDriversService } from './admin-drivers.service';
import { DriverDocumentsService } from '../../drivers/documents/driver-documents.service';
import { UploadDriverDocumentDto } from '../../drivers/documents/dto/upload-driver-document.dto';
import { CreateDriverDto } from './dto/create-driver.dto';
import { UpdateDriverDto } from './dto/update-driver.dto';
import { SuspendDriverDto } from './dto/suspend-driver.dto';
import {
  ListDriversQueryDto,
  ListDriversResponseDto,
} from './dto/list-drivers.dto';
import { AdminDriverDetailDto } from './dto/driver-detail.dto';
import { LiveMapResponseDto } from './dto/live-map.dto';
import { TripRouteDto } from './dto/trip-route.dto';
import { DriverProfileResponseDto } from '../../drivers/dto/driver-profile-response.dto';
import { Roles } from '../../shared/decorators/roles.decorator';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { AdminRole } from '../../shared/enums/admin-role.enum';

@ApiTags('Admin — Drivers')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt-admin'), RolesGuard)
@Controller('admin/drivers')
export class AdminDriversController {
  constructor(
    private readonly service: AdminDriversService,
    private readonly documents: DriverDocumentsService,
  ) {}

  @ApiOperation({
    summary: "List a driver's compliance documents",
  })
  @Get(':id/documents')
  listDocuments(@Param('id', ParseIntPipe) id: number) {
    return this.documents.list(id);
  }

  @ApiOperation({
    summary: 'Upload (or replace) a compliance document for a driver',
    description:
      'Registration flow — multipart with the file under `file`. Same ' +
      'replace-per-type rule as the driver-side upload, but admin ' +
      'uploads land VERIFIED with the acting admin as reviewer.',
  })
  @Post(':id/documents')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/driver-documents',
        filename: (req, file, cb) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, `${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  uploadDocument(
    @Req() req: Request,
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadDriverDocumentDto,
  ) {
    const adminId = (req.user as { adminId: number }).adminId;
    return this.documents.uploadByAdmin(id, file, dto, adminId);
  }

  @ApiOperation({
    summary: 'Live map — currently active drivers with location',
    description:
      'Small payload for the admin portal driver map. Returns ACTIVE + ON_TRIP drivers with a location snapshot. Poll every 30 s.',
  })
  @ApiResponse({ status: 200, type: LiveMapResponseDto })
  // Two-segment path so it never collides with :id (single-segment).
  @Get('live/map')
  liveMap(): Promise<LiveMapResponseDto> {
    return this.service.liveMap();
  }


  @ApiOperation({
    summary: 'Current-trip route for the admin map',
    description:
      "Returns the ordered stops of the driver's currently-active trip (ACCEPTED or IN_PROGRESS) plus the road-following polyline from OSRM when available.",
  })
  @ApiResponse({ status: 200, type: TripRouteDto })
  @Get(':id/route')
  tripRoute(@Param('id', ParseIntPipe) id: number): Promise<TripRouteDto> {
    return this.service.tripRoute(id);
  }

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

  @ApiOperation({
    summary: 'Suspend a driver (blocks login + activation)',
    description:
      'Optional body `{ category?, reason? }`. Both surface back to the ' +
      'driver via `home-summary.suspensionInfo`. `category` drives which ' +
      'suspended-card variant the mobile Home tab renders ' +
      '(documents / rating / payment / violation).',
  })
  @ApiResponse({ status: 200, type: DriverProfileResponseDto })
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.OPS_MANAGER)
  @HttpCode(HttpStatus.OK)
  @Post(':id/suspend')
  suspend(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SuspendDriverDto,
  ): Promise<DriverProfileResponseDto> {
    return this.service.suspend(id, dto.reason, dto.category);
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
