import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AppConfigService } from './app-config.service';
import { InitQueryDto } from './dto/init-query.dto';

@ApiTags('App')
@Controller('app')
export class AppConfigController {
  constructor(private readonly appConfig: AppConfigService) {}

  @ApiOperation({
    summary: 'App initialization payload',
    description:
      'Returns the values the mobile app needs on launch: latest / minimum ' +
      'required versions per platform, force-update decision for this client, ' +
      'terms & privacy URLs, and feature/settings flags.',
  })
  @ApiResponse({ status: 200, description: 'App init payload' })
  @Get('init')
  init(@Query() query: InitQueryDto) {
    const forceUpdate = this.appConfig.getForceUpdate(
      query.platform,
      query.currentVersion,
    );
    const links = this.appConfig.getAppLinks();
    const settings = this.appConfig.getSettings();
    const currentLanguage = this.appConfig.getCurrentLanguage();
    const legal = this.appConfig.getLegal();

    return {
      version: {
        latestVersion: forceUpdate.latestVersion,
        minVersion: forceUpdate.minVersion,
        storeUrl: forceUpdate.storeUrl,
        forceUpdate: forceUpdate.forceUpdate,
        updateAvailable: forceUpdate.updateAvailable,
      },
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
  forceUpdate(@Query() query: InitQueryDto) {
    return this.appConfig.getForceUpdate(query.platform, query.currentVersion);
  }
}
