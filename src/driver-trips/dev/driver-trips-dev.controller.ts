import {
  Body,
  Controller,
  ForbiddenException,
  Post,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DriverTripsService } from '../driver-trips.service';
import { SeedDriverTripDto } from '../dto/seed-driver-trip.dto';

/**
 * Dev-only utility endpoint to manufacture an OFFERED DriverTrip from
 * existing TripRequest + PackageDelivery records, so the driver app's
 * trip lifecycle can be exercised without a real matching engine.
 *
 * Returns 403 unless NODE_ENV is anything other than 'production'.
 */
@ApiTags('Dev — Driver Trips')
@Controller('admin/dev/driver-trips')
export class DriverTripsDevController {
  constructor(
    private readonly tripsService: DriverTripsService,
    private readonly configService: ConfigService,
  ) {}

  @ApiOperation({
    summary:
      'Manufacture an OFFERED DriverTrip for testing (dev environment only)',
  })
  @ApiResponse({ status: 201, description: 'Offered trip created' })
  @Post()
  async seed(@Body() dto: SeedDriverTripDto) {
    const env = this.configService.get<string>('NODE_ENV') ?? 'development';
    if (env === 'production') {
      throw new ForbiddenException('Dev seeder disabled in production');
    }
    const trip = await this.tripsService.seedTrip(dto);
    return {
      tripId: trip.id,
      driverId: dto.driverId,
      status: trip.status,
      offerExpiresAt: trip.offerExpiresAt,
      message: `Seeded OFFERED trip #${trip.id}. Call GET /drivers/trips/${trip.id}/offer as the driver to view it.`,
    };
  }
}
