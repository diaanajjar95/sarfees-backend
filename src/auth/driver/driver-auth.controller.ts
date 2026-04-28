import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { DriverAuthService } from './driver-auth.service';
import { DriverRequestOtpDto } from './dto/request-otp.dto';
import { DriverVerifyOtpDto } from './dto/verify-otp.dto';

@ApiTags('Driver Auth')
@Controller('auth/driver')
export class DriverAuthController {
  constructor(private readonly driverAuthService: DriverAuthService) {}

  @ApiOperation({
    summary: 'Request OTP for a pre-approved driver phone number',
    description:
      'Returns 403 if the phone is not registered as a Sarfees driver. OTP TTL: 120 seconds. Rate limit: 3 requests per 10 minutes.',
  })
  @ApiResponse({ status: 201, description: 'OTP sent successfully' })
  @Post('request-otp')
  async requestOtp(@Body() dto: DriverRequestOtpDto) {
    return this.driverAuthService.requestOtp(dto.phoneNumber, dto.countryCode);
  }

  @ApiOperation({
    summary: 'Verify driver OTP',
    description:
      'Returns access + refresh tokens and the driver profile on success. Locks the account for 10 minutes after 3 failed attempts.',
  })
  @ApiResponse({
    status: 201,
    description: 'OTP verified — tokens and driver profile returned',
  })
  @Post('verify-otp')
  async verifyOtp(@Body() dto: DriverVerifyOtpDto) {
    return this.driverAuthService.verifyOtp(
      dto.phoneNumber,
      dto.countryCode,
      dto.otp,
    );
  }

  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Verify the current driver session',
    description:
      'Validates the access token and returns the driver profile. Used by the splash screen (S-01) to decide whether to route to Login or Home.',
  })
  @ApiResponse({ status: 200, description: 'Session is valid' })
  @UseGuards(AuthGuard('jwt-driver'))
  @Get('verify-session')
  async verifySession(@Req() req: Request) {
    const driverId = req.user ? (req.user as { driverId: number }).driverId : 0;
    return this.driverAuthService.verifySession(driverId);
  }

  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Refresh driver access token',
    description: 'Pass the refresh token as the Bearer token.',
  })
  @ApiResponse({ status: 200, description: 'Tokens refreshed successfully' })
  @UseGuards(AuthGuard('jwt-driver-refresh'))
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  async refresh(@Req() req: Request) {
    const driverId = req.user ? (req.user as { sub: number }).sub : 0;
    const refreshToken = req.user
      ? (req.user as { refreshToken: string }).refreshToken
      : '';
    return this.driverAuthService.refreshTokens(driverId, refreshToken);
  }

  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Logout driver',
    description:
      'Invalidates the refresh token server-side. The currently-issued access token remains valid until its 15-minute TTL expires.',
  })
  @ApiResponse({ status: 200, description: 'Logged out successfully' })
  @UseGuards(AuthGuard('jwt-driver'))
  @HttpCode(HttpStatus.OK)
  @Post('logout')
  async logout(@Req() req: Request) {
    const driverId = req.user ? (req.user as { driverId: number }).driverId : 0;
    return this.driverAuthService.logout(driverId);
  }
}
