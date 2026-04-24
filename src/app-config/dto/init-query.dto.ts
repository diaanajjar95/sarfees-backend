import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, Matches } from 'class-validator';

export enum MobilePlatform {
  IOS = 'ios',
  ANDROID = 'android',
}

export class InitQueryDto {
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
