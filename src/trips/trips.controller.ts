import { Body, Controller, Post, Get, Patch, Param, Query, Req, UseGuards, ParseIntPipe } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { TripsService } from './trips.service';
import { CreateTripDto, EstimateTripDto } from './dto/create-trip.dto';
import { UpdateTripStatusDto, UpdateDriverLocationDto } from './dto/active-trip.dto';
import { PaginationQueryDto } from '../shared/dto/pagination-query.dto';

@ApiTags('Trips')
@Controller('trips')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
export class TripsController {
  constructor(private readonly tripsService: TripsService) {}

  // ─── Existing endpoints ────────────────────────────────────

  @ApiOperation({ summary: 'Estimate trip price and duration' })
  @ApiResponse({ status: 200, description: 'Estimates calculated' })
  @Post('estimate')
  estimateFare(@Body() estimateTripDto: EstimateTripDto) {
    return this.tripsService.estimateFare(estimateTripDto);
  }

  @ApiOperation({ summary: 'Submit a new intercity trip request' })
  @ApiResponse({ status: 201, description: 'Trip request created and moved to pending matches' })
  @Post('request')
  createTripRequest(@Req() req: any, @Body() createTripDto: CreateTripDto) {
    const userId = req.user.userId;
    const userGender = req.user.gender;
    return this.tripsService.createRequest(userId, userGender, createTripDto);
  }

  @ApiOperation({ summary: 'Get all trip requests for the current user' })
  @ApiResponse({ status: 200, description: 'Paginated list of trips retrieved successfully' })
  @Get('my-trips')
  getUserTrips(@Req() req: any, @Query() query: PaginationQueryDto) {
    return this.tripsService.getUserTrips(req.user.userId, query);
  }

  // ─── Active Trip Status (SAR-30) ──────────────────────────

  @ApiOperation({ summary: 'Get the current active trip for the passenger' })
  @ApiResponse({ status: 200, description: 'Active trip status with driver info and location' })
  @ApiResponse({ status: 404, description: 'No active trip found' })
  @Get('active')
  getActiveTrip(@Req() req: any) {
    return this.tripsService.getActiveTrip(req.user.userId);
  }

  @ApiOperation({ summary: 'Get trip status by ID' })
  @ApiParam({ name: 'id', description: 'Trip request ID' })
  @ApiResponse({ status: 200, description: 'Trip status with driver info and location' })
  @ApiResponse({ status: 404, description: 'Trip not found' })
  @Get(':id/status')
  getTripStatus(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.tripsService.getTripStatus(id, req.user.userId);
  }

  @ApiOperation({ summary: 'Get latest driver location for a trip' })
  @ApiParam({ name: 'id', description: 'Trip request ID' })
  @ApiResponse({ status: 200, description: 'Latest driver GPS coordinates' })
  @ApiResponse({ status: 404, description: 'No driver location available' })
  @Get(':id/driver-location')
  getDriverLocation(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.tripsService.getDriverLocation(id, req.user.userId);
  }

  @ApiOperation({ summary: 'Update trip status (driver action)' })
  @ApiParam({ name: 'id', description: 'Trip request ID' })
  @ApiResponse({ status: 200, description: 'Trip status updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid status transition' })
  @Patch(':id/status')
  updateTripStatus(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateTripStatusDto) {
    return this.tripsService.updateTripStatus(id, dto);
  }

  @ApiOperation({ summary: 'Update driver location for a trip (called every 5-10s)' })
  @ApiParam({ name: 'id', description: 'Trip request ID' })
  @ApiResponse({ status: 200, description: 'Driver location recorded' })
  @Post(':id/driver-location')
  updateDriverLocation(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: any,
    @Body() dto: UpdateDriverLocationDto,
  ) {
    // In a real app, you'd resolve the driverId from req.user
    // For now, we pass it from the JWT payload
    const driverId = req.user.driverId || req.user.userId;
    return this.tripsService.updateDriverLocation(id, driverId, dto);
  }
}
