import { Global, Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Driver } from '../drivers/driver.entity';
import { DriverTrip } from '../driver-trips/entities/driver-trip.entity';
import { DriverTripsModule } from '../driver-trips/driver-trips.module';
import { TripGroup } from '../grouping/entities/trip-group.entity';
import { DriverNotificationsModule } from '../notifications/driver-notifications.module';
import { PassengerNotificationsModule } from '../notifications/passenger/passenger-notifications.module';
import { TripRequest } from '../trips/entities/trip-request.entity';
import { AssignmentService } from './assignment.service';
import { EscalationCase } from './entities/escalation-case.entity';
import { TripOfferHistory } from './entities/trip-offer-history.entity';

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
    ]),
    forwardRef(() => DriverTripsModule),
    DriverNotificationsModule,
    PassengerNotificationsModule,
  ],
  providers: [AssignmentService],
  exports: [AssignmentService, TypeOrmModule],
})
export class AssignmentModule {}
