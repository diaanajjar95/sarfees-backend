import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
import { AssignmentService } from '../assignment/assignment.service';
import { TripGroup } from '../grouping/entities/trip-group.entity';
import { MatchingConfigService } from '../matching-config/matching-config.service';
import { TripGroupStatus } from '../shared/enums/trip-group-status.enum';

/**
 * Two responsibilities on each tick (master spec §5.3 + §9.3):
 *   1. Freeze — OPEN groups whose departure is within
 *      driverSearchLeadMinutes flip to FROZEN, and each frozen group
 *      kicks off its Stage 2 cascade.
 *   2. Timeout expired offers — TripOfferHistory rows still PENDING
 *      past their expiresAt get treated as TIMEOUT and the next
 *      candidate in the queue gets an offer.
 *
 * The cron interval is DB-driven (matching_config.sweepIntervalSeconds)
 * so ops can dial it up or down via SQL without a redeploy.
 */
@Injectable()
export class MatchingSweeperService implements OnApplicationBootstrap {
  private readonly logger = new Logger(MatchingSweeperService.name);
  private static readonly CRON_NAME = 'matching-sweeper';

  constructor(
    @InjectRepository(TripGroup)
    private readonly groupsRepo: Repository<TripGroup>,
    private readonly matchingConfigService: MatchingConfigService,
    private readonly assignmentService: AssignmentService,
    private readonly scheduler: SchedulerRegistry,
  ) {}

  // Deliberately `onApplicationBootstrap` (not `onModuleInit`) —
  // MatchingConfigService seeds its singleton row in *its* bootstrap
  // hook, and Nest guarantees all onModuleInits complete before any
  // onApplicationBootstrap runs. Reading the config here means we're
  // always after the seed, even on a totally fresh DB.
  async onApplicationBootstrap(): Promise<void> {
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
      await this.freezeAndCascade();
      await this.cascadeBornFrozen();
      await this.assignmentService.timeoutExpiredOffers();
    } catch (err) {
      this.logger.error(
        `Sweep tick failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * Full-car (§8) groups are born FROZEN — they never sit in OPEN, so
   * the freezeAndCascade path above never touches them. Once their
   * departure gets close enough, this catch-all fires the cascade the
   * same way freezeAndCascade would for a naturally-frozen group.
   *
   * Urgent packages fire cascade at creation, not from the sweeper —
   * we skip them here (status transitions to OFFERING immediately).
   */
  private async cascadeBornFrozen(): Promise<void> {
    const cfg = await this.matchingConfigService.getConfig();
    const cutoff = new Date(
      Date.now() + cfg.driverSearchLeadMinutes * 60 * 1000,
    );
    const frozen = await this.groupsRepo.find({
      where: {
        status: TripGroupStatus.FROZEN,
        departureTime: LessThanOrEqual(cutoff),
      },
      take: 50,
    });
    for (const group of frozen) {
      try {
        await this.assignmentService.startCascade(group.id);
      } catch (err) {
        this.logger.error(
          `startCascade (born-frozen) failed for group #${group.id}: ${err instanceof Error ? err.message : err}`,
        );
      }
    }
  }

  private async freezeAndCascade(): Promise<void> {
    const cfg = await this.matchingConfigService.getConfig();
    const freezeCutoff = new Date(
      Date.now() + cfg.driverSearchLeadMinutes * 60 * 1000,
    );
    const openGroups = await this.groupsRepo.find({
      where: {
        status: TripGroupStatus.OPEN,
        departureTime: LessThanOrEqual(freezeCutoff),
      },
      take: 100,
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

    // Fire the cascade for each newly-frozen group. Failures are logged
    // but don't stop the sweep; the group stays FROZEN and the next tick
    // will retry via a startCascade on FROZEN.
    for (const group of openGroups) {
      try {
        await this.assignmentService.startCascade(group.id);
      } catch (err) {
        this.logger.error(
          `startCascade failed for group #${group.id}: ${err instanceof Error ? err.message : err}`,
        );
      }
    }
  }
}
