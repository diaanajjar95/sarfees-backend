import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TripsService } from './trips.service';
import { TripsController } from './trips.controller';
import { TripRequest } from './entities/trip-request.entity';

@Module({
  imports: [TypeOrmModule.forFeature([TripRequest])],
  controllers: [TripsController],
  providers: [TripsService],
})
export class TripsModule {}

