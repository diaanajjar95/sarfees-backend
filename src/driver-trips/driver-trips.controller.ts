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
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { DriverTripsService } from './driver-trips.service';
import { DeclineTripDto } from './dto/decline-trip.dto';
import { ConfirmPickupDto } from './dto/confirm-pickup.dto';
import { ConfirmDropoffDto } from './dto/confirm-dropoff.dto';
import { OfferResponseDto } from './dto/offer.dto';
import { ManifestResponseDto } from './dto/manifest.dto';
import { ActiveStateResponseDto } from './dto/active-state.dto';
import { TripCompletionResponseDto } from './dto/trip-completion.dto';
import { CancelTripDto, CancelTripResponseDto } from './dto/cancel-trip.dto';
import {
  TripHistoryQueryDto,
  TripHistoryResponseDto,
} from './dto/trip-history.dto';

@ApiTags('Driver Trips')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt-driver'))
@Controller('drivers/trips')
export class DriverTripsController {
  constructor(private readonly tripsService: DriverTripsService) {}

  // ─── Active trip resume (S-10 reopen) ──────────────────────
  @ApiOperation({
    summary: "Get the driver's currently active trip (resume on app reopen)",
  })
  @ApiResponse({ status: 200, type: ActiveStateResponseDto })
  @ApiResponse({ status: 404, description: 'No active trip' })
  @Get('active')
  getActiveTrip(@Req() req: Request) {
    return this.tripsService.getActiveTrip(this.driverId(req));
  }

  // ─── My Trips — history ────────────────────────────────────
  @ApiOperation({
    summary: "List the driver's past trips (My Trips screen)",
    description:
      'Paginated, sorted by `departureTime` DESC. Defaults to terminal ' +
      'statuses only (completed / cancelled / expired / declined) so ' +
      'ongoing work never shows up. Override via repeating `?status=` query ' +
      'parameters. Date range filters operate on `departureTime`.',
  })
  @ApiResponse({ status: 200, type: TripHistoryResponseDto })
  @Get('history')
  getHistory(
    @Req() req: Request,
    @Query() query: TripHistoryQueryDto,
  ): Promise<TripHistoryResponseDto> {
    return this.tripsService.getHistory(this.driverId(req), query);
  }

  // ─── S-07 Incoming Offer ───────────────────────────────────
  @ApiOperation({ summary: 'Get incoming trip offer details (S-07)' })
  @ApiParam({ name: 'id', description: 'DriverTrip id' })
  @ApiResponse({ status: 200, type: OfferResponseDto })
  @Get(':id/offer')
  getOffer(@Req() req: Request, @Param('id', ParseIntPipe) id: number) {
    return this.tripsService.getOffer(this.driverId(req), id);
  }

  @ApiOperation({
    summary: 'Accept the incoming trip offer (S-07 → S-08)',
    description:
      'Transitions OFFERED → ACCEPTED, returns the full manifest so the client can render S-09 immediately.',
  })
  @ApiResponse({ status: 200, type: ManifestResponseDto })
  @HttpCode(HttpStatus.OK)
  @Post(':id/accept')
  accept(@Req() req: Request, @Param('id', ParseIntPipe) id: number) {
    return this.tripsService.accept(this.driverId(req), id);
  }

  @ApiOperation({ summary: 'Decline the incoming trip offer (S-07)' })
  @ApiResponse({ status: 200, description: 'Decline recorded' })
  @HttpCode(HttpStatus.OK)
  @Post(':id/decline')
  decline(
    @Req() req: Request,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DeclineTripDto,
  ) {
    return this.tripsService.decline(this.driverId(req), id, dto);
  }

  // ─── S-09 Manifest + start ─────────────────────────────────
  @ApiOperation({ summary: 'Get full pre-trip manifest (S-09)' })
  @ApiResponse({ status: 200, type: ManifestResponseDto })
  @Get(':id/manifest')
  getManifest(@Req() req: Request, @Param('id', ParseIntPipe) id: number) {
    return this.tripsService.getManifest(this.driverId(req), id);
  }

  @ApiOperation({ summary: 'Start the trip (S-09 → S-10)' })
  @ApiResponse({ status: 200, type: ManifestResponseDto })
  @HttpCode(HttpStatus.OK)
  @Post(':id/start')
  start(@Req() req: Request, @Param('id', ParseIntPipe) id: number) {
    return this.tripsService.start(this.driverId(req), id);
  }

  // ─── S-10 Active state ─────────────────────────────────────
  @ApiOperation({ summary: 'Get current active state with next stop (S-10)' })
  @ApiResponse({ status: 200, type: ActiveStateResponseDto })
  @Get(':id/active-state')
  getActiveState(@Req() req: Request, @Param('id', ParseIntPipe) id: number) {
    return this.tripsService.getActiveState(this.driverId(req), id);
  }

  @ApiOperation({ summary: 'Mark arrival at the current stop (S-10)' })
  @ApiResponse({ status: 200, type: ActiveStateResponseDto })
  @HttpCode(HttpStatus.OK)
  @Post(':id/stops/:stopId/arrive')
  arrive(
    @Req() req: Request,
    @Param('id', ParseIntPipe) id: number,
    @Param('stopId', ParseIntPipe) stopId: number,
  ) {
    return this.tripsService.arriveAtStop(this.driverId(req), id, stopId);
  }

  // ─── S-11 Pickup confirm ───────────────────────────────────
  @ApiOperation({ summary: 'Confirm pickup at a pickup stop (S-11)' })
  @ApiResponse({ status: 200, type: ActiveStateResponseDto })
  @HttpCode(HttpStatus.OK)
  @Post(':id/stops/:stopId/confirm-pickup')
  confirmPickup(
    @Req() req: Request,
    @Param('id', ParseIntPipe) id: number,
    @Param('stopId', ParseIntPipe) stopId: number,
    @Body() dto: ConfirmPickupDto,
  ) {
    return this.tripsService.confirmPickup(
      this.driverId(req),
      id,
      stopId,
      dto,
    );
  }

  // ─── S-12 Dropoff confirm ──────────────────────────────────
  @ApiOperation({
    summary: 'Confirm dropoff with cash collection at a dropoff stop (S-12)',
  })
  @ApiResponse({ status: 200, type: ActiveStateResponseDto })
  @HttpCode(HttpStatus.OK)
  @Post(':id/stops/:stopId/confirm-dropoff')
  confirmDropoff(
    @Req() req: Request,
    @Param('id', ParseIntPipe) id: number,
    @Param('stopId', ParseIntPipe) stopId: number,
    @Body() dto: ConfirmDropoffDto,
  ) {
    return this.tripsService.confirmDropoff(
      this.driverId(req),
      id,
      stopId,
      dto,
    );
  }

  // ─── S-13 Complete ─────────────────────────────────────────
  @ApiOperation({
    summary: 'Finalize trip and return earnings breakdown (S-13)',
  })
  @ApiResponse({ status: 200, type: TripCompletionResponseDto })
  @HttpCode(HttpStatus.OK)
  @Post(':id/complete')
  complete(@Req() req: Request, @Param('id', ParseIntPipe) id: number) {
    return this.tripsService.complete(this.driverId(req), id);
  }

  // ─── S-14 Cancellation (zones derived server-side) ──────────
  @ApiOperation({
    summary: 'Cancel an accepted trip (S-14)',
    description:
      'Zone is derived from current state: ACCEPTED = zone 1 (no penalty), IN_PROGRESS with no pickups = zone 2 (soft penalty). Mid-trip cancellation (after a pickup) is forbidden — contact support.',
  })
  @ApiResponse({ status: 200, type: CancelTripResponseDto })
  @ApiResponse({ status: 403, description: 'Cancellation blocked mid-trip' })
  @HttpCode(HttpStatus.OK)
  @Post(':id/cancel')
  cancel(
    @Req() req: Request,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CancelTripDto,
  ) {
    return this.tripsService.cancel(this.driverId(req), id, dto);
  }

  private driverId(req: Request): number {
    return (req.user as { driverId: number }).driverId;
  }
}
