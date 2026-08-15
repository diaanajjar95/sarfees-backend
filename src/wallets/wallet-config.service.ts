import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WalletConfig } from './entities/wallet-config.entity';

/**
 * Seeds the wallet_config singleton from env on first boot; an
 * existing row is never overwritten (runtime edits from the admin
 * portal survive redeploys). Mirrors MatchingConfigService.
 */
@Injectable()
export class WalletConfigService implements OnApplicationBootstrap {
  constructor(
    @InjectRepository(WalletConfig)
    private readonly repo: Repository<WalletConfig>,
    private readonly cfg: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const existing = await this.repo.findOne({ where: { id: 1 } });
    if (existing) return;

    const row = this.repo.create({
      id: 1,
      commissionPercent: this.envNum('WALLET_COMMISSION_PERCENT', 15),
      lowBalanceThresholdJod: this.envNum(
        'WALLET_LOW_BALANCE_THRESHOLD_JOD',
        5,
      ),
      lowBalanceNotifyCooldownHours: this.envNum(
        'WALLET_LOW_BALANCE_NOTIFY_COOLDOWN_HOURS',
        24,
      ),
    });
    await this.repo.save(row);
  }

  async getConfig(): Promise<WalletConfig> {
    const row = await this.repo.findOne({ where: { id: 1 } });
    if (!row) throw new Error('wallet_config singleton missing');
    return row;
  }

  async update(patch: Partial<WalletConfig>): Promise<WalletConfig> {
    const row = await this.getConfig();
    Object.assign(row, patch);
    return this.repo.save(row);
  }

  /** Commission fraction (0–1) for stamping onto new trips. */
  async commissionFraction(): Promise<number> {
    const cfg = await this.getConfig();
    return Number(cfg.commissionPercent) / 100;
  }

  private envNum(key: string, fallback: number): number {
    const raw = this.cfg.get<string>(key);
    const n = raw !== undefined ? Number(raw) : NaN;
    return Number.isFinite(n) ? n : fallback;
  }
}
