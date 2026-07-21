import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

/**
 * PR 1 stub. Real grouping sweeper lands in PR 2:
 *   - re-attempt grouping for orphan PENDING requests
 *   - freeze groups whose departure is within driverSearchLeadMinutes
 *   - emit TripFrozen events
 *
 * For now we tick every 30 s so ops can confirm @nestjs/schedule
 * boots correctly. Delete this log once the real body lands.
 */
@Injectable()
export class MatchingSweeperService {
  private readonly logger = new Logger(MatchingSweeperService.name);
  private ticks = 0;

  @Cron(CronExpression.EVERY_30_SECONDS)
  handleTick(): void {
    this.ticks += 1;
    this.logger.debug(`sweep tick #${this.ticks}`);
  }
}
