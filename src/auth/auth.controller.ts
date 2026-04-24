import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @ApiOperation({ summary: 'Send OTP to phone number' })
  @ApiResponse({ status: 201, description: 'OTP sent successfully' })
  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    return this.authService.sendOtp(loginDto.phoneNumber, loginDto.countryCode);
  }

  @ApiOperation({ summary: 'Verify OTP' })
  @ApiResponse({ status: 201, description: 'OTP verified successfully' })
  @Post('verify-otp')
  async verifyOtp(@Body() verifyOtpDto: VerifyOtpDto) {
    return this.authService.verifyOtp(
      verifyOtpDto.phoneNumber,
      verifyOtpDto.countryCode,
      verifyOtpDto.otp,
    );
  }

  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Logout user',
    description:
      'Invalidates the refresh token server-side. The currently-issued access token remains valid until its 15-minute TTL expires.',
  })
  @ApiResponse({ status: 200, description: 'Logged out successfully' })
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.OK)
  @Post('logout')
  async logout(@Req() req: Request) {
    if (req.user) {
      return this.authService.logout(req.user['userId']);
    }
    return { message: 'Logged out successfully' };
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({ status: 200, description: 'Tokens refreshed successfully' })
  @UseGuards(AuthGuard('jwt-refresh'))
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  async refreshTokens(@Req() req: Request) {
    const userId = req.user ? req.user['sub'] : null;
    const refreshToken = req.user ? req.user['refreshToken'] : null;
    return this.authService.refreshTokens(userId, refreshToken);
  }
}
