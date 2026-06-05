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
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { DriversService } from './drivers.service';
import { EarningsService } from './earnings.service';
import { ActivatePreferencesDto } from './dto/activate-preferences.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { DeactivateDto } from './dto/deactivate.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { DriverProfileResponseDto } from './dto/driver-profile-response.dto';
import { HomeSummaryResponseDto } from './dto/home-summary-response.dto';
import {
  EarningsBreakdownResponseDto,
  EarningsQueryDto,
  EarningsResponseDto,
} from './dto/earnings.dto';
import {
  LocationPingDto,
  LocationPingResponseDto,
} from './dto/location-ping.dto';

@ApiTags('Drivers')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt-driver'))
@Controller('drivers')
export class DriversController {
  constructor(
    private readonly driversService: DriversService,
    private readonly earningsService: EarningsService,
  ) {}

  @ApiOperation({ summary: 'Get current driver profile (S-04, S-16)' })
  @ApiResponse({ status: 200, type: DriverProfileResponseDto })
  @Get('profile')
  getProfile(@Req() req: Request): Promise<DriverProfileResponseDto> {
    return this.driversService.getProfile(this.driverId(req));
  }

  @ApiOperation({ summary: 'Get home-screen summary (S-04)' })
  @ApiResponse({ status: 200, type: HomeSummaryResponseDto })
  @Get('home-summary')
  getHomeSummary(@Req() req: Request): Promise<HomeSummaryResponseDto> {
    return this.driversService.getHomeSummary(this.driverId(req));
  }

  @ApiOperation({
    summary: 'Activate session with preferences (S-05)',
    description:
      'Sets the driver to ACTIVE and stores session preferences. Captures one-time GPS for trip matching.',
  })
  @ApiResponse({ status: 201, type: DriverProfileResponseDto })
  @Post('activate')
  activate(
    @Req() req: Request,
    @Body() dto: ActivatePreferencesDto,
  ): Promise<DriverProfileResponseDto> {
    return this.driversService.activate(this.driverId(req), dto);
  }

  @ApiOperation({
    summary: 'Deactivate session (S-06 Go Offline)',
    description: 'Marks driver INACTIVE and clears session preferences.',
  })
  @ApiResponse({ status: 200, type: DriverProfileResponseDto })
  @HttpCode(HttpStatus.OK)
  @Post('deactivate')
  deactivate(
    @Req() req: Request,
    @Body() _dto: DeactivateDto,
  ): Promise<DriverProfileResponseDto> {
    return this.driversService.deactivate(this.driverId(req));
  }

  @ApiOperation({
    summary: 'Update active session preferences (S-06 Edit Preferences)',
  })
  @ApiResponse({ status: 200, type: DriverProfileResponseDto })
  @Patch('preferences')
  updatePreferences(
    @Req() req: Request,
    @Body() dto: UpdatePreferencesDto,
  ): Promise<DriverProfileResponseDto> {
    return this.driversService.updatePreferences(this.driverId(req), dto);
  }

  // ─── S-17 Settings ─────────────────────────────────────────
  @ApiOperation({
    summary: 'Update settings — language, notification flags, fcm token (S-17)',
  })
  @ApiResponse({ status: 200, type: DriverProfileResponseDto })
  @Patch('settings')
  updateSettings(
    @Req() req: Request,
    @Body() dto: UpdateSettingsDto,
  ): Promise<DriverProfileResponseDto> {
    return this.driversService.updateSettings(this.driverId(req), dto);
  }

  // ─── Location ping (high-frequency) ────────────────────────
  @ApiOperation({
    summary: "Report the driver's current GPS location",
    description:
      'High-frequency endpoint for continuous location reporting while the ' +
      'driver is active. Side effects: appends a row to `driver_locations` ' +
      '(history) and updates the matcher snapshot on the driver row. ' +
      'Suspended drivers get 403. Recommended cadence: every 5–10 seconds.',
  })
  @ApiResponse({ status: 200, type: LocationPingResponseDto })
  @HttpCode(HttpStatus.OK)
  @Post('me/location')
  pingLocation(
    @Req() req: Request,
    @Body() dto: LocationPingDto,
  ): Promise<LocationPingResponseDto> {
    return this.driversService.pingLocation(this.driverId(req), dto);
  }

  // ─── S-15 Earnings ─────────────────────────────────────────
  @ApiOperation({
    summary: 'List driver earnings with period summary (S-15)',
    description:
      'Summary aggregates over the chosen period (today/week/month). Trips list is paginated and shows all completed trips most-recent first.',
  })
  @ApiResponse({ status: 200, type: EarningsResponseDto })
  @Get('earnings')
  listEarnings(
    @Req() req: Request,
    @Query() query: EarningsQueryDto,
  ): Promise<EarningsResponseDto> {
    return this.earningsService.list(this.driverId(req), query);
  }

  @ApiOperation({
    summary: 'Per-stop earnings breakdown for a completed trip (S-15)',
  })
  @ApiParam({ name: 'tripId', description: 'DriverTrip id' })
  @ApiResponse({ status: 200, type: EarningsBreakdownResponseDto })
  @Get('earnings/:tripId/breakdown')
  earningsBreakdown(
    @Req() req: Request,
    @Param('tripId', ParseIntPipe) tripId: number,
  ): Promise<EarningsBreakdownResponseDto> {
    return this.earningsService.breakdown(this.driverId(req), tripId);
  }

  private driverId(req: Request): number {
    return (req.user as { driverId: number }).driverId;
  }
}
