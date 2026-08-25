import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { AppConfigController } from './app-config.controller';
import { AdminAppConfigController } from './admin-app-config.controller';
import { AppConfigService } from './app-config.service';
import { MobileAppConfig } from './mobile-app-config.entity';
import { MobileAppConfigService } from './mobile-app-config.service';
import { PlatformModule } from '../platform/platform.module';

@Module({
  imports: [
    PassportModule,
    TypeOrmModule.forFeature([MobileAppConfig]),
    PlatformModule,
  ],
  controllers: [AppConfigController, AdminAppConfigController],
  providers: [AppConfigService, MobileAppConfigService],
  exports: [AppConfigService, MobileAppConfigService],
})
export class AppConfigModule {}
