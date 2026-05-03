import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { TripRequest } from '../../trips/entities/trip-request.entity';
import { AdminPassengerRequestsService } from './admin-passenger-requests.service';
import { AdminPassengerRequestsController } from './admin-passenger-requests.controller';

@Module({
  imports: [PassportModule, TypeOrmModule.forFeature([TripRequest])],
  controllers: [AdminPassengerRequestsController],
  providers: [AdminPassengerRequestsService],
})
export class AdminPassengerRequestsModule {}
