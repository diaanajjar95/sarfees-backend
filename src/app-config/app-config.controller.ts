import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AppConfigService } from './app-config.service';
import { MobileAppConfigService } from './mobile-app-config.service';
import { MobileApp } from './mobile-app-config.entity';
import { PlatformConfigService } from '../platform/platform-config.service';
import { InitQueryDto } from './dto/init-query.dto';

@ApiTags('App')
@Controller('app')
export class AppConfigController {
  constructor(
    private readonly appConfig: AppConfigService,
    private readonly mobileConfig: MobileAppConfigService,
    private readonly platformConfig: PlatformConfigService,
  ) {}

  @ApiOperation({
    summary: 'App initialization payload',
    description:
      'Returns the values the mobile app needs on launch: latest / minimum ' +
      'required versions per platform, force-update decision for this client, ' +
      'terms & privacy URLs, and feature/settings flags.',
  })
  @ApiResponse({ status: 200, description: 'App init payload' })
  @Get('init')
  async init(@Query() query: InitQueryDto) {
    const app = query.app ?? MobileApp.PASSENGER;
    const cfg = await this.mobileConfig.getConfig(app);
    const forceUpdate = this.appConfig.getForceUpdate(
      cfg,
      query.platform,
      query.currentVersion,
    );
    const links = this.appConfig.getAppLinks();
    const settings = this.appConfig.getSettings(cfg);
    const currentLanguage = this.appConfig.getCurrentLanguage();
    const legal = this.appConfig.getLegal();
    const currency = await this.platformConfig.currency();

    return {
      app,
      version: {
        latestVersion: forceUpdate.latestVersion,
        minVersion: forceUpdate.minVersion,
        storeUrl: forceUpdate.storeUrl,
        forceUpdate: forceUpdate.forceUpdate,
        updateAvailable: forceUpdate.updateAvailable,
      },
      maintenance: {
        active: cfg.maintenanceMode,
        messageEn: cfg.maintenanceMessageEn,
        messageAr: cfg.maintenanceMessageAr,
      },
      currency,
      links,
      settings,
      currentLanguage,
      legal,
    };
  }

  @ApiOperation({
    summary: 'Force-update check',
    description:
      'Lightweight endpoint that returns only the force-update decision. ' +
      'Use this from app resume / foreground events when you do not need ' +
      'the full init payload.',
  })
  @ApiResponse({ status: 200, description: 'Force-update decision' })
  @Get('force-update')
  async forceUpdate(@Query() query: InitQueryDto) {
    const cfg = await this.mobileConfig.getConfig(
      query.app ?? MobileApp.PASSENGER,
    );
    return this.appConfig.getForceUpdate(
      cfg,
      query.platform,
      query.currentVersion,
    );
  }
}
