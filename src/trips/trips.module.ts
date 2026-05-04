import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TripsService } from './trips.service';
import { TripsController } from './trips.controller';
import { TripRequest } from './entities/trip-request.entity';
import { Driver } from '../drivers/driver.entity';
import { DriverLocation } from './entities/driver-location.entity';
import { MatchingModule } from '../matching/matching.module';
import { PackageDelivery } from '../packages/entities/package-delivery.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([TripRequest, Driver, DriverLocation, PackageDelivery]),
    MatchingModule,
  ],
  controllers: [TripsController],
  providers: [TripsService],
})
export class TripsModule {}
