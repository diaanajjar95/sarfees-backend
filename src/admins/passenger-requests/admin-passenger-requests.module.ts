import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { AssignmentModule } from '../../assignment/assignment.module';
import { TripRequest } from '../../trips/entities/trip-request.entity';
import { AdminPassengerRequestsService } from './admin-passenger-requests.service';
import { AdminPassengerRequestsController } from './admin-passenger-requests.controller';

@Module({
  imports: [
    PassportModule,
    TypeOrmModule.forFeature([TripRequest]),
    // Ops cancel reuses the Stage-1 group bookkeeping.
    AssignmentModule,
  ],
  controllers: [AdminPassengerRequestsController],
  providers: [AdminPassengerRequestsService],
})
export class AdminPassengerRequestsModule {}
