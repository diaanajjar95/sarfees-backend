import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MobileApp, MobileAppConfig } from './mobile-app-config.entity';

export interface UpdateMobileAppConfigInput {
  maintenanceMode?: boolean;
  maintenanceMessageEn?: string | null;
  maintenanceMessageAr?: string | null;
  androidMinVersion?: string;
  androidLatestVersion?: string;
  androidStoreUrl?: string;
  iosMinVersion?: string;
  iosLatestVersion?: string;
  iosStoreUrl?: string;
}

/**
 * Seeds one row per app from the legacy env vars on first boot (both
 * apps start with the same values the env served before per-app
 * control existed). Existing rows are never overwritten.
 */
@Injectable()
export class MobileAppConfigService implements OnApplicationBootstrap {
  constructor(
    @InjectRepository(MobileAppConfig)
    private readonly repo: Repository<MobileAppConfig>,
    private readonly cfg: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    for (const app of Object.values(MobileApp)) {
      const existing = await this.repo.findOne({ where: { app } });
      if (existing) continue;
      await this.repo.save(
        this.repo.create({
          app,
          maintenanceMode:
            (this.cfg.get<string>('MAINTENANCE_MODE') ?? 'false') === 'true',
          maintenanceMessageEn:
            this.cfg.get<string>('MAINTENANCE_MESSAGE') ?? null,
          maintenanceMessageAr: null,
          androidMinVersion:
            this.cfg.get<string>('ANDROID_MIN_VERSION') ?? '1.0.0',
          androidLatestVersion:
            this.cfg.get<string>('ANDROID_LATEST_VERSION') ?? '1.0.0',
          androidStoreUrl:
            this.cfg.get<string>('ANDROID_STORE_URL') ??
            'https://play.google.com/store/apps/details?id=PLACEHOLDER',
          iosMinVersion: this.cfg.get<string>('IOS_MIN_VERSION') ?? '1.0.0',
          iosLatestVersion:
            this.cfg.get<string>('IOS_LATEST_VERSION') ?? '1.0.0',
          iosStoreUrl:
            this.cfg.get<string>('IOS_STORE_URL') ??
            'https://apps.apple.com/app/idPLACEHOLDER',
        }),
      );
    }
  }

  async getConfig(app: MobileApp): Promise<MobileAppConfig> {
    const row = await this.repo.findOne({ where: { app } });
    if (row) return row;
    await this.onApplicationBootstrap();
    return (await this.repo.findOne({ where: { app } }))!;
  }

  async getAll(): Promise<MobileAppConfig[]> {
    const rows = await this.repo.find();
    if (rows.length < Object.values(MobileApp).length) {
      await this.onApplicationBootstrap();
      return this.repo.find();
    }
    return rows;
  }

  async update(
    app: MobileApp,
    patch: UpdateMobileAppConfigInput,
  ): Promise<MobileAppConfig> {
    const row = await this.getConfig(app);
    Object.assign(row, patch);
    return this.repo.save(row);
  }
}
