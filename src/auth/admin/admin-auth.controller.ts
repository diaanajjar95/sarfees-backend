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
import { AdminAuthService } from './admin-auth.service';
import { AdminLoginDto } from './dto/admin-login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@ApiTags('Admin Auth')
@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly authService: AdminAuthService) {}

  @ApiOperation({ summary: 'Admin login (email + password)' })
  @ApiResponse({ status: 200, description: 'Tokens + admin profile' })
  @HttpCode(HttpStatus.OK)
  @Post('login')
  login(@Body() dto: AdminLoginDto) {
    return this.authService.login(dto);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Refresh admin tokens' })
  @UseGuards(AuthGuard('jwt-admin-refresh'))
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  refresh(@Req() req: Request) {
    const adminId = (req.user as { sub: number }).sub;
    const refreshToken = (req.user as { refreshToken: string }).refreshToken;
    return this.authService.refreshTokens(adminId, refreshToken);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout — clears refresh token server-side' })
  @UseGuards(AuthGuard('jwt-admin'))
  @HttpCode(HttpStatus.OK)
  @Post('logout')
  logout(@Req() req: Request) {
    return this.authService.logout((req.user as { adminId: number }).adminId);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the currently authenticated admin' })
  @UseGuards(AuthGuard('jwt-admin'))
  @Get('me')
  me(@Req() req: Request) {
    return this.authService.me((req.user as { adminId: number }).adminId);
  }

  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Change own password (clears mustChangePassword flag)',
  })
  @UseGuards(AuthGuard('jwt-admin'))
  @HttpCode(HttpStatus.OK)
  @Post('change-password')
  changePassword(@Req() req: Request, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(
      (req.user as { adminId: number }).adminId,
      dto,
    );
  }
}
