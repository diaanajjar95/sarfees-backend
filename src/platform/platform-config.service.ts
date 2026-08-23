import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlatformConfig, PlatformCurrency } from './platform-config.entity';

export interface CurrencyInfo {
  code: PlatformCurrency;
  symbolEn: string;
  symbolAr: string;
  nameEn: string;
  nameAr: string;
  /** Decimal places the apps should render (SYP is whole-pound). */
  decimals: number;
}

export const CURRENCIES: Record<PlatformCurrency, CurrencyInfo> = {
  [PlatformCurrency.JOD]: {
    code: PlatformCurrency.JOD,
    symbolEn: 'JD',
    symbolAr: 'د.أ',
    nameEn: 'Jordanian Dinar',
    nameAr: 'دينار أردني',
    decimals: 2,
  },
  [PlatformCurrency.SYP]: {
    code: PlatformCurrency.SYP,
    symbolEn: 'SYP',
    symbolAr: 'ل.س',
    nameEn: 'Syrian Pound',
    nameAr: 'ليرة سورية',
    decimals: 0,
  },
};

/**
 * Seeds the platform_config singleton from env on first boot; an
 * existing row is never overwritten (portal edits survive redeploys).
 * Mirrors WalletConfigService/MatchingConfigService.
 */
@Injectable()
export class PlatformConfigService implements OnApplicationBootstrap {
  constructor(
    @InjectRepository(PlatformConfig)
    private readonly repo: Repository<PlatformConfig>,
    private readonly cfg: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const existing = await this.repo.findOne({ where: { id: 1 } });
    if (existing) return;
    const envCode = (
      this.cfg.get<string>('PLATFORM_CURRENCY') ?? 'JOD'
    ).toUpperCase();
    const currencyCode =
      envCode === PlatformCurrency.SYP
        ? PlatformCurrency.SYP
        : PlatformCurrency.JOD;
    await this.repo.save(this.repo.create({ id: 1, currencyCode }));
  }

  async getConfig(): Promise<PlatformConfig> {
    const row = await this.repo.findOne({ where: { id: 1 } });
    if (row) return row;
    // Boot-race safety: seed on demand.
    await this.onApplicationBootstrap();
    return (await this.repo.findOne({ where: { id: 1 } }))!;
  }

  async currency(): Promise<CurrencyInfo> {
    const config = await this.getConfig();
    return CURRENCIES[config.currencyCode];
  }

  async setCurrency(code: PlatformCurrency): Promise<CurrencyInfo> {
    const config = await this.getConfig();
    config.currencyCode = code;
    await this.repo.save(config);
    return CURRENCIES[code];
  }
}
