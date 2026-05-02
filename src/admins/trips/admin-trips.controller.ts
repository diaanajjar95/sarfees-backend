import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
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
import { AdminTripsService } from './admin-trips.service';
import {
  ListAdminTripsQueryDto,
  ListAdminTripsResponseDto,
} from './dto/list-admin-trips.dto';
import { ManifestResponseDto } from '../../driver-trips/dto/manifest.dto';
import { Roles } from '../../shared/decorators/roles.decorator';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { AdminRole } from '../../shared/enums/admin-role.enum';
import { DriverTripsService } from '../../driver-trips/driver-trips.service';
import { SeedDriverTripDto } from '../../driver-trips/dto/seed-driver-trip.dto';
import { DriverTrip } from '../../driver-trips/entities/driver-trip.entity';

@ApiTags('Admin — Trips')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt-admin'), RolesGuard)
@Controller('admin/trips')
export class AdminTripsController {
  constructor(
    private readonly service: AdminTripsService,
    private readonly driverTripsService: DriverTripsService,
  ) {}

  @ApiOperation({ summary: 'List trips (filterable, paginated)' })
  @ApiResponse({ status: 200, type: ListAdminTripsResponseDto })
  @Get()
  list(
    @Query() query: ListAdminTripsQueryDto,
  ): Promise<ListAdminTripsResponseDto> {
    return this.service.list(query);
  }

  @ApiOperation({ summary: 'Get trip detail (full manifest)' })
  @ApiResponse({ status: 200, type: ManifestResponseDto })
  @Get(':id')
  detail(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ManifestResponseDto> {
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
    return {
      tripId: trip.id,
      driverId: dto.driverId,
      status: trip.status,
      offerExpiresAt: trip.offerExpiresAt,
    };
  }
}
