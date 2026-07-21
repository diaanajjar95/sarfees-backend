import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Driver } from '../drivers/driver.entity';
import { DriverTrip } from '../driver-trips/entities/driver-trip.entity';
import { MatchingService } from './matching.service';
import { MatchingSweeperService } from './matching-sweeper.service';
import { DriverTripsModule } from '../driver-trips/driver-trips.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Driver, DriverTrip]),
    DriverTripsModule,
  ],
  providers: [MatchingService, MatchingSweeperService],
  exports: [MatchingService],
})
export class MatchingModule {}
