import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
import { TripGroup } from '../grouping/entities/trip-group.entity';
import { MatchingConfigService } from '../matching-config/matching-config.service';
import { TripGroupStatus } from '../shared/enums/trip-group-status.enum';

/**
 * Stage-1 sweeper (master spec §5.3). Every sweepIntervalSeconds:
 *   1. Freeze any OPEN group whose departure is within
 *      driverSearchLeadMinutes.
 *
 * PR 3 will hook this to fire the driver cascade the moment a group
 * hits FROZEN. For now we just log the transition — Stage 2 doesn't
 * exist yet, so a frozen group waits for the old MatchingService
 * shadow path to have already assigned a driver individually.
 *
 * Scheduling detail: we register the cron dynamically at module init
 * so the interval comes from matching_config rather than a
 * compile-time constant.
 */
@Injectable()
export class MatchingSweeperService implements OnModuleInit {
  private readonly logger = new Logger(MatchingSweeperService.name);
  private static readonly CRON_NAME = 'matching-sweeper';

  constructor(
    @InjectRepository(TripGroup)
    private readonly groupsRepo: Repository<TripGroup>,
    private readonly matchingConfigService: MatchingConfigService,
    private readonly scheduler: SchedulerRegistry,
  ) {}

  async onModuleInit(): Promise<void> {
    const cfg = await this.matchingConfigService.getConfig();
    const intervalMs = cfg.sweepIntervalSeconds * 1000;
    const job = new CronJob(`*/${cfg.sweepIntervalSeconds} * * * * *`, () => {
      void this.tick();
    });
    this.scheduler.addCronJob(MatchingSweeperService.CRON_NAME, job as never);
    job.start();
    this.logger.log(
      `Sweeper registered — tick every ${intervalMs / 1000}s`,
    );
  }

  async tick(): Promise<void> {
    try {
      const cfg = await this.matchingConfigService.getConfig();
      const freezeCutoff = new Date(
        Date.now() + cfg.driverSearchLeadMinutes * 60 * 1000,
      );
      const openGroups = await this.groupsRepo.find({
        where: {
          status: TripGroupStatus.OPEN,
          departureTime: LessThanOrEqual(freezeCutoff),
        },
        take: 200,
      });
      if (openGroups.length === 0) return;

      for (const group of openGroups) {
        group.status = TripGroupStatus.FROZEN;
        group.frozenAt = new Date();
      }
      await this.groupsRepo.save(openGroups);
      this.logger.log(
        `Froze ${openGroups.length} groups (departure ≤ ${freezeCutoff.toISOString()})`,
      );
      // PR 3 hook: fire cascade for each frozen group.
    } catch (err) {
      this.logger.error(
        `Sweep tick failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
