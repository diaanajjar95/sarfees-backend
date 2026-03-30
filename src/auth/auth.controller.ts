import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
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
    return this.authService.sendOtp(loginDto.phoneNumber);
  }

  @ApiOperation({ summary: 'Verify OTP' })
  @ApiResponse({ status: 201, description: 'OTP verified successfully' })
  @Post('verify-otp')
  async verifyOtp(@Body() verifyOtpDto: VerifyOtpDto) {
    return this.authService.verifyOtp(verifyOtpDto.phoneNumber, verifyOtpDto.otp);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout user' })
  @ApiResponse({ status: 200, description: 'Logged out successfully' })
  @UseGuards(AuthGuard('jwt'))
  @Get('logout')
  async logout(@Req() req: Request) {
    if (req.user) {
        this.authService.logout(req.user['userId']);
    }
    return { message: 'Logged out successfully' };
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({ status: 200, description: 'Tokens refreshed successfully' })
  @UseGuards(AuthGuard('jwt-refresh'))
  @Get('refresh')
  async refreshTokens(@Req() req: Request) {
    const userId = req.user ? req.user['sub'] : null;
    const refreshToken = req.user ? req.user['refreshToken'] : null;
    return this.authService.refreshTokens(userId, refreshToken);
  }
}

