import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { DriverTrip } from '../../driver-trips/entities/driver-trip.entity';
import { AdminTripsService } from './admin-trips.service';
import { AdminTripsController } from './admin-trips.controller';
import { DriverTripsModule } from '../../driver-trips/driver-trips.module';

@Module({
  imports: [
    PassportModule,
    TypeOrmModule.forFeature([DriverTrip]),
    DriverTripsModule,
  ],
  controllers: [AdminTripsController],
  providers: [AdminTripsService],
})
export class AdminTripsModule {}
