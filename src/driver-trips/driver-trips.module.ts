import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { DriverTrip } from './entities/driver-trip.entity';
import { DriverTripStop } from './entities/driver-trip-stop.entity';
import { DriverTripStopPassenger } from './entities/driver-trip-stop-passenger.entity';
import { DriverTripStopPackage } from './entities/driver-trip-stop-package.entity';
import { DriverTripDeclineLog } from './entities/driver-trip-decline-log.entity';
import { Driver } from '../drivers/driver.entity';
import { TripRequest } from '../trips/entities/trip-request.entity';
import { PackageDelivery } from '../packages/entities/package-delivery.entity';
import { DriverTripsService } from './driver-trips.service';
import { DriverTripsController } from './driver-trips.controller';
import { DriverTripsDevController } from './dev/driver-trips-dev.controller';
import { DriverNotificationsModule } from '../notifications/driver-notifications.module';

@Module({
  imports: [
    PassportModule,
    TypeOrmModule.forFeature([
      DriverTrip,
      DriverTripStop,
      DriverTripStopPassenger,
      DriverTripStopPackage,
      DriverTripDeclineLog,
      Driver,
      TripRequest,
      PackageDelivery,
    ]),
    DriverNotificationsModule,
  ],
  controllers: [DriverTripsController, DriverTripsDevController],
  providers: [DriverTripsService],
  exports: [DriverTripsService],
})
export class DriverTripsModule {}
