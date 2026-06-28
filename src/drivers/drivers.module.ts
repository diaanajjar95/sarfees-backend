import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { Driver } from './driver.entity';
import { DriversService } from './drivers.service';
import { EarningsService } from './earnings.service';
import { DriversController } from './drivers.controller';
import { DriverTrip } from '../driver-trips/entities/driver-trip.entity';
import { DriverTripStop } from '../driver-trips/entities/driver-trip-stop.entity';
import { DriverTripStopPassenger } from '../driver-trips/entities/driver-trip-stop-passenger.entity';
import { DriverTripStopPackage } from '../driver-trips/entities/driver-trip-stop-package.entity';
import { DriverLocation } from '../trips/entities/driver-location.entity';
import { TripRequest } from '../trips/entities/trip-request.entity';
import { PackageDelivery } from '../packages/entities/package-delivery.entity';
import { AnnouncementsModule } from '../announcements/announcements.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Driver,
      DriverTrip,
      DriverTripStop,
      DriverTripStopPassenger,
      DriverTripStopPackage,
      DriverLocation,
      TripRequest,
      PackageDelivery,
    ]),
    PassportModule,
    AnnouncementsModule,
  ],
  controllers: [DriversController],
  providers: [DriversService, EarningsService],
  exports: [DriversService, EarningsService],
})
export class DriversModule {}
