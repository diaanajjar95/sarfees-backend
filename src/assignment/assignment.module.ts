import { Global, Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Driver } from '../drivers/driver.entity';
import { DriverTrip } from '../driver-trips/entities/driver-trip.entity';
import { DriverTripsModule } from '../driver-trips/driver-trips.module';
import { TripGroup } from '../grouping/entities/trip-group.entity';
import { VehicleClassCapacity } from '../matching-config/vehicle-class-capacity.entity';
import { DriverNotificationsModule } from '../notifications/driver-notifications.module';
import { PassengerNotificationsModule } from '../notifications/passenger/passenger-notifications.module';
import { PackageDelivery } from '../packages/entities/package-delivery.entity';
import { TripRequest } from '../trips/entities/trip-request.entity';
import { AssignmentService } from './assignment.service';
import { EscalationCase } from './entities/escalation-case.entity';
import { TripOfferHistory } from './entities/trip-offer-history.entity';
import { WalletsModule } from '../wallets/wallets.module';

/**
 * Global — MatchingSweeperService fires the cascade and
 * DriverTripsService (accept/decline hooks) notifies AssignmentService
 * synchronously. Making it global avoids importing the module in
 * both places.
 *
 * forwardRef on DriverTripsModule breaks the cycle: DriverTrips owns
 * seedTrip/accept/decline; Assignment calls seedTrip and needs to be
 * called back from accept/decline.
 */
@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([
      TripOfferHistory,
      EscalationCase,
      TripGroup,
      TripRequest,
      Driver,
      DriverTrip,
      PackageDelivery,
      VehicleClassCapacity,
    ]),
    forwardRef(() => DriverTripsModule),
    DriverNotificationsModule,
    PassengerNotificationsModule,
    WalletsModule,
  ],
  providers: [AssignmentService],
  exports: [AssignmentService, TypeOrmModule],
})
export class AssignmentModule {}
