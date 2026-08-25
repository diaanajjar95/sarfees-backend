import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, Matches } from 'class-validator';
import { MobileApp } from '../mobile-app-config.entity';

export enum MobilePlatform {
  IOS = 'ios',
  ANDROID = 'android',
}

export class InitQueryDto {
  @ApiPropertyOptional({
    description:
      'Which app is calling — versions and maintenance are controlled per app from the admin portal.',
    enum: MobileApp,
    default: MobileApp.PASSENGER,
  })
  @IsOptional()
  @IsEnum(MobileApp, { message: 'app must be one of: passenger, driver' })
  app?: MobileApp;

  @ApiPropertyOptional({
    description: 'Mobile platform making the request',
    enum: MobilePlatform,
    example: MobilePlatform.IOS,
  })
  @IsOptional()
  @IsEnum(MobilePlatform, { message: 'platform must be one of: ios, android' })
  platform?: MobilePlatform;

  @ApiPropertyOptional({
    description: 'Current installed app version (semver: MAJOR.MINOR.PATCH)',
    example: '1.0.3',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d+\.\d+\.\d+$/, {
    message: 'currentVersion must be in semver format (e.g. 1.0.3)',
  })
  currentVersion?: string;
}
