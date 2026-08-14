import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TripGroup } from '../grouping/entities/trip-group.entity';
import { MatchingSweeperService } from './matching-sweeper.service';

/**
 * The matcher's only concern here is the sweeper cron that
 * (a) freezes OPEN groups whose departure is near and (b) hands
 * newly-frozen groups to AssignmentService to fire the cascade.
 * The old single-driver MatchingService was deleted in PR 3.
 */
@Module({
  imports: [TypeOrmModule.forFeature([TripGroup])],
  providers: [MatchingSweeperService],
})
export class MatchingModule {}
