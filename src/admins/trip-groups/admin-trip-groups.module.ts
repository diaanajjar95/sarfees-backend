import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { TripGroup } from '../../grouping/entities/trip-group.entity';
import { TripRequest } from '../../trips/entities/trip-request.entity';
import { AdminTripGroupsService } from './admin-trip-groups.service';
import { AdminTripGroupsController } from './admin-trip-groups.controller';

@Module({
  imports: [
    PassportModule,
    TypeOrmModule.forFeature([TripGroup, TripRequest]),
  ],
  controllers: [AdminTripGroupsController],
  providers: [AdminTripGroupsService],
})
export class AdminTripGroupsModule {}
