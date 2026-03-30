import { Body, Controller, Post, Get, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { TripsService } from './trips.service';
import { CreateTripDto, EstimateTripDto } from './dto/create-trip.dto';

@ApiTags('Trips')
@Controller('trips')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
export class TripsController {
  constructor(private readonly tripsService: TripsService) {}

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
  @ApiResponse({ status: 200, description: 'List of trips retrieved successfully' })
  @Get('my-trips')
  getUserTrips(@Req() req: any) {
    return this.tripsService.getUserTrips(req.user.userId);
  }
}
