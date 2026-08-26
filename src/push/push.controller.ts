import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { PushService } from './push.service';
import { DeviceOwnerType } from './entities/device-token.entity';

class RegisterDeviceTokenDto {
  @ApiProperty({ description: 'FCM registration token from the device' })
  @IsString()
  @MinLength(10)
  @MaxLength(512)
  token: string;

  @ApiPropertyOptional({ enum: ['android', 'ios'] })
  @IsOptional()
  @IsIn(['android', 'ios'])
  platform?: string;

  @ApiPropertyOptional({
    description:
      'Stable per-install device id (ANDROID_ID / identifierForVendor). ' +
      'STRONGLY recommended — with it, a rotated FCM token replaces the ' +
      'old row instead of coexisting with it (fixes duplicate pushes).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  deviceId?: string;
}

class RemoveDeviceTokenDto {
  @ApiProperty()
  @IsString()
  @MaxLength(512)
  token: string;
}

/**
 * FCM device registration. The apps call this on login and on token
 * refresh; devices are auto-subscribed to their platform topic
 * (all_customers / all_drivers). Call the DELETE on logout.
 */
@ApiTags('Push — Device Tokens')
@ApiBearerAuth()
@Controller()
export class PushController {
  constructor(private readonly push: PushService) {}

  @ApiOperation({ summary: 'Register the passenger device for push' })
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.OK)
  @Post('users/device-token')
  registerPassenger(@Req() req: Request, @Body() dto: RegisterDeviceTokenDto) {
    const userId = (req.user as { userId: number }).userId;
    return this.push.registerToken(
      DeviceOwnerType.PASSENGER,
      userId,
      dto.token,
      dto.platform,
      dto.deviceId,
    );
  }

  @ApiOperation({ summary: 'Unregister a passenger device (logout)' })
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.OK)
  @Delete('users/device-token')
  async removePassenger(@Body() dto: RemoveDeviceTokenDto) {
    await this.push.removeToken(dto.token);
    return { removed: true };
  }

  @ApiOperation({ summary: 'Register the driver device for push' })
  @UseGuards(AuthGuard('jwt-driver'))
  @HttpCode(HttpStatus.OK)
  @Post('drivers/device-token')
  registerDriver(@Req() req: Request, @Body() dto: RegisterDeviceTokenDto) {
    const driverId = (req.user as { driverId: number }).driverId;
    return this.push.registerToken(
      DeviceOwnerType.DRIVER,
      driverId,
      dto.token,
      dto.platform,
      dto.deviceId,
    );
  }

  @ApiOperation({ summary: 'Unregister a driver device (logout)' })
  @UseGuards(AuthGuard('jwt-driver'))
  @HttpCode(HttpStatus.OK)
  @Delete('drivers/device-token')
  async removeDriver(@Body() dto: RemoveDeviceTokenDto) {
    await this.push.removeToken(dto.token);
    return { removed: true };
  }
}
