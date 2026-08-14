import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VehicleClassCapacity } from '../matching-config/vehicle-class-capacity.entity';
import { PackageDelivery } from '../packages/entities/package-delivery.entity';
import { TripRequest } from '../trips/entities/trip-request.entity';
import { User } from '../users/user.entity';
import { TripGroup } from './entities/trip-group.entity';
import { GroupingService } from './grouping.service';

/**
 * Global — GroupingService is called from TripsService and
 * PackagesService. Marking global spares those modules from a
 * rippling import.
 */
@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([
      TripGroup,
      TripRequest,
      User,
      PackageDelivery,
      VehicleClassCapacity,
    ]),
  ],
  providers: [GroupingService],
  exports: [GroupingService, TypeOrmModule],
})
export class GroupingModule {}
