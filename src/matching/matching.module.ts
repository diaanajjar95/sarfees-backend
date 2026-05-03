import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Driver } from '../drivers/driver.entity';
import { DriverTrip } from '../driver-trips/entities/driver-trip.entity';
import { MatchingService } from './matching.service';
import { DriverTripsModule } from '../driver-trips/driver-trips.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Driver, DriverTrip]),
    DriverTripsModule,
  ],
  providers: [MatchingService],
  exports: [MatchingService],
})
export class MatchingModule {}
