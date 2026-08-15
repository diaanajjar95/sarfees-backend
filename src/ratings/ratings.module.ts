import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { Rating } from './entities/rating.entity';
import { TripRequest } from '../trips/entities/trip-request.entity';
import { DriverTrip } from '../driver-trips/entities/driver-trip.entity';
import { RatingsService } from './ratings.service';
import { RatingsController } from './ratings.controller';

@Module({
  imports: [
    PassportModule,
    TypeOrmModule.forFeature([Rating, TripRequest, DriverTrip]),
  ],
  controllers: [RatingsController],
  providers: [RatingsService],
  exports: [RatingsService],
})
export class RatingsModule {}
