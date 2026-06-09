import {
  Body,
  Controller,
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
}
