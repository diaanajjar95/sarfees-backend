import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MatchingConfig } from './matching-config.entity';

const SINGLETON_ID = 1;

/**
 * Wraps read access to the matching_config singleton and seeds the
 * one row on first boot from env vars. Ops edits via SQL survive
 * redeploys (subsequent boots leave the row alone).
 */
@Injectable()
export class MatchingConfigService implements OnApplicationBootstrap {
  private readonly logger = new Logger(MatchingConfigService.name);

  constructor(
    @InjectRepository(MatchingConfig)
    private readonly repo: Repository<MatchingConfig>,
    private readonly cfg: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const existing = await this.repo.findOne({ where: { id: SINGLETON_ID } });
    if (existing) return;

    const row = new MatchingConfig();
    row.id = SINGLETON_ID;
    row.defaultMaxGroupSize = this.envInt('MATCHING_MAX_GROUP_SIZE', 4);
    row.defaultServiceRadiusMeters = this.envInt(
      'MATCHING_SERVICE_RADIUS_METERS',
      5000,
    );
    row.detourBoundPercent = this.envInt('MATCHING_DETOUR_BOUND_PERCENT', 20);
    row.mixedPassengerMin = this.envInt('MATCHING_MIXED_PASSENGER_MIN', 2);
    row.mixedPassengerMax = this.envInt('MATCHING_MIXED_PASSENGER_MAX', 3);
    row.mixedPackageMin = this.envInt('MATCHING_MIXED_PACKAGE_MIN', 3);
    row.mixedPackageMax = this.envInt('MATCHING_MIXED_PACKAGE_MAX', 5);
    row.packagesOnlyPackageMin = this.envInt('MATCHING_PACKAGES_ONLY_MIN', 7);
    row.packagesOnlyPackageMax = this.envInt('MATCHING_PACKAGES_ONLY_MAX', 15);
    row.slotValueSmall = this.envInt('MATCHING_SLOT_S', 1);
    row.slotValueMedium = this.envInt('MATCHING_SLOT_M', 2);
    row.slotValueLarge = this.envInt('MATCHING_SLOT_L', 3);
    row.passengerWaitToleranceMinutes = this.envInt(
      'MATCHING_PASSENGER_WAIT_TOLERANCE_MIN',
      12,
    );
    row.packageWaitToleranceMinutes = this.envInt(
      'MATCHING_PACKAGE_WAIT_TOLERANCE_MIN',
      12,
    );
    row.handlingSecondsPerPackageStop = this.envInt(
      'MATCHING_HANDLING_SEC_PER_PACKAGE',
      300,
    );
    row.offerCountdownSeconds = this.envInt('MATCHING_OFFER_COUNTDOWN_SEC', 30);
    row.driverSearchLeadMinutes = this.envInt(
      'MATCHING_DRIVER_SEARCH_LEAD_MIN',
      30,
    );
    row.nowWindowMinMinutes = this.envInt('MATCHING_NOW_WINDOW_MIN_MIN', 15);
    row.nowWindowMaxMinutes = this.envInt('MATCHING_NOW_WINDOW_MAX_MIN', 30);
    row.sweepIntervalSeconds = this.envInt('MATCHING_SWEEP_INTERVAL_SEC', 30);
    row.urgentEarlyBroadcastDeclines = this.envInt(
      'MATCHING_URGENT_EARLY_BROADCAST_DECLINES',
      3,
    );
    row.broadcastTriggerDeclineCount = this.envInt(
      'MATCHING_BROADCAST_TRIGGER_DECLINE_COUNT',
      5,
    );
    row.declinePenaltyBase = this.envInt('MATCHING_DECLINE_PENALTY_BASE', 10);
    row.declinePenaltyDecayDays = this.envInt(
      'MATCHING_DECLINE_PENALTY_DECAY_DAYS',
      7,
    );
    row.driverCancelPenalty = this.envInt('MATCHING_DRIVER_CANCEL_PENALTY', 15);
    row.recipientGraceMinutes = this.envInt('MATCHING_RECIPIENT_GRACE_MIN', 10);
    row.senderNoShowGraceMinutes = this.envInt(
      'MATCHING_SENDER_NOSHOW_GRACE_MIN',
      7,
    );
    row.assignedDriverOfflineGraceMinutes = this.envInt(
      'MATCHING_ASSIGNED_DRIVER_OFFLINE_GRACE_MIN',
      5,
    );
    row.cancellationFeeAmountJod = String(
      this.envInt('MATCHING_CANCELLATION_FEE_JOD_CENTS', 200) / 100,
    );
    row.noShowFeeAmountJod = String(
      this.envInt('MATCHING_NO_SHOW_FEE_JOD_CENTS', 300) / 100,
    );
    row.returnRedeliveryFeeAmountJod = String(
      this.envInt('MATCHING_RETURN_REDELIVERY_FEE_JOD_CENTS', 500) / 100,
    );
    row.fullCarDiscountPercent = this.envInt(
      'MATCHING_FULL_CAR_DISCOUNT_PERCENT',
      10,
    );
    row.goingHomeDayBoundaryHourLocal = this.envInt(
      'MATCHING_GOING_HOME_DAY_BOUNDARY_HOUR',
      0,
    );
    row.prohibitedItemsListJson = null;
    row.mapProviderFallback =
      this.cfg.get<string>('MAP_PROVIDER_FALLBACK') ?? 'haversine';

    await this.repo.save(row);
    this.logger.log('Seeded matching_config singleton (id=1)');
  }

  async getConfig(): Promise<MatchingConfig> {
    const row = await this.repo.findOne({ where: { id: SINGLETON_ID } });
    if (!row) {
      throw new Error(
        'matching_config singleton missing — check onApplicationBootstrap seed',
      );
    }
    return row;
  }

  private envInt(key: string, fallback: number): number {
    const raw = this.cfg.get<string>(key);
    if (raw == null || raw === '') return fallback;
    const n = Number(raw);
    return Number.isFinite(n) ? n : fallback;
  }
}
