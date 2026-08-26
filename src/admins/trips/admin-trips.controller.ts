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
import { AdminTripsService } from './admin-trips.service';
import { DriverNotificationsService } from '../../notifications/driver-notifications.service';
import { DriverNotificationType } from '../../shared/enums/driver-notification-type.enum';
import {
  ListAdminTripsQueryDto,
  ListAdminTripsResponseDto,
} from './dto/list-admin-trips.dto';
import { ManifestResponseDto } from '../../driver-trips/dto/manifest.dto';
import { AdminTripDetailDto } from './dto/admin-trip-detail.dto';
import { Roles } from '../../shared/decorators/roles.decorator';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { AdminRole } from '../../shared/enums/admin-role.enum';
import { DriverTripsService } from '../../driver-trips/driver-trips.service';
import { SeedDriverTripDto } from '../../driver-trips/dto/seed-driver-trip.dto';
import { DriverTrip } from '../../driver-trips/entities/driver-trip.entity';
import { AdminCancelDto } from '../shared/dto/admin-cancel.dto';

@ApiTags('Admin — Trips')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt-admin'), RolesGuard)
@Controller('admin/trips')
export class AdminTripsController {
  constructor(
    private readonly service: AdminTripsService,
    private readonly driverTripsService: DriverTripsService,
    private readonly driverNotifications: DriverNotificationsService,
  ) {}

  @ApiOperation({ summary: 'List trips (filterable, paginated)' })
  @ApiResponse({ status: 200, type: ListAdminTripsResponseDto })
  @Get()
  list(
    @Query() query: ListAdminTripsQueryDto,
  ): Promise<ListAdminTripsResponseDto> {
    return this.service.list(query);
  }

  @ApiOperation({
    summary: 'Get trip detail (manifest + lifecycle + decline log + pricing)',
  })
  @ApiResponse({ status: 200, type: AdminTripDetailDto })
  @Get(':id')
  detail(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<AdminTripDetailDto> {
    return this.service.detail(id);
  }

  @ApiOperation({
    summary: 'Manually assign a trip to a driver (productionised dev seeder)',
    description:
      'Creates an OFFERED DriverTrip from existing TripRequest + PackageDelivery rows. The dev endpoint at /admin/dev/driver-trips remains available locally.',
  })
  @ApiResponse({
    status: 201,
    description: 'Created DriverTrip in OFFERED state',
  })
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.OPS_MANAGER)
  @Post('manual-assign')
  async manualAssign(@Body() dto: SeedDriverTripDto): Promise<{
    tripId: number;
    driverId: number;
    status: string;
    offerExpiresAt: Date;
  }> {
    const trip: DriverTrip = await this.driverTripsService.seedTrip(dto);
    // Same type + payload contract as the cascade offer — the app's
    // offer screen (30 s countdown) handles both identically.
    await this.driverNotifications.emit({
      driverId: dto.driverId,
      type: DriverNotificationType.OFFER_RECEIVED,
      title: 'New trip offer',
      body: `${dto.originCity} → ${dto.destinationCity}`,
      payload: {
        driverTripId: trip.id,
        womenOnly: dto.type === 'women_only',
        broadcast: false,
        manual: true,
      },
    });
    return {
      tripId: trip.id,
      driverId: dto.driverId,
      status: trip.status,
      offerExpiresAt: trip.offerExpiresAt,
    };
  }

  @ApiOperation({
    summary: 'Cancel a trip (ops full stop, reason required)',
    description:
      'Kills the trip outright: trip + linked passenger requests + packages + trip group all go CANCELLED, the driver is released with no penalty, and everyone affected is notified. Blocked once any passenger has been picked up.',
  })
  @ApiResponse({ status: 200, description: 'Trip cancelled' })
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.OPS_MANAGER)
  @HttpCode(HttpStatus.OK)
  @Post(':id/cancel')
  cancel(
    @Req() req: Request,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AdminCancelDto,
  ): Promise<{ tripId: number; cancelledRequestIds: number[] }> {
    const adminId = (req.user as { adminId: number }).adminId;
    return this.driverTripsService.adminCancel(id, adminId, dto.reason);
  }
}
