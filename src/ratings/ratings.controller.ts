import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RatingsService } from './ratings.service';
import { RatePassengerDto, SubmitRatingDto } from './dto/rating.dto';

@ApiTags('Ratings')
@ApiBearerAuth()
@Controller()
export class RatingsController {
  constructor(private readonly ratings: RatingsService) {}

  // ─── Passenger side ───────────────────────────────────────────

  @ApiOperation({
    summary: 'Rate the driver for a completed trip (optional)',
    description:
      '5 levels: excellent / very_good / good / not_bad / bad. A `bad` ' +
      'rating requires a message. One rating per trip; 409 on repeat.',
  })
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.CREATED)
  @Post('trips/request/:id/rate')
  ratePassenger(
    @Req() req: Request,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SubmitRatingDto,
  ) {
    const userId = (req.user as { userId: number }).userId;
    return this.ratings.ratePassengerSide(userId, id, dto.level, dto.message);
  }

  @ApiOperation({ summary: "The passenger's own rating for a trip (or null)" })
  @UseGuards(AuthGuard('jwt'))
  @Get('trips/request/:id/rating')
  getPassengerRating(
    @Req() req: Request,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const userId = (req.user as { userId: number }).userId;
    return this.ratings.getPassengerRating(userId, id);
  }

  // ─── Driver side ──────────────────────────────────────────────

  @ApiOperation({
    summary: 'Passengers the driver can still rate on a completed trip',
  })
  @UseGuards(AuthGuard('jwt-driver'))
  @Get('drivers/trips/:id/ratables')
  ratables(@Req() req: Request, @Param('id', ParseIntPipe) id: number) {
    const driverId = (req.user as { driverId: number }).driverId;
    return this.ratings.listRatables(driverId, id);
  }

  @ApiOperation({
    summary: 'Rate a passenger after closing the trip (optional)',
    description:
      'Same 5 levels; `bad` requires a message. One rating per passenger ' +
      'per trip; 409 on repeat.',
  })
  @UseGuards(AuthGuard('jwt-driver'))
  @HttpCode(HttpStatus.CREATED)
  @Post('drivers/trips/:id/rate')
  rateDriver(
    @Req() req: Request,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RatePassengerDto,
  ) {
    const driverId = (req.user as { driverId: number }).driverId;
    return this.ratings.rateDriverSide(
      driverId,
      id,
      dto.passengerId,
      dto.level,
      dto.message,
    );
  }
}
