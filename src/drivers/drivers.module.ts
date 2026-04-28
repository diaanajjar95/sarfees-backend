import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { Driver } from './driver.entity';
import { DriversService } from './drivers.service';
import { EarningsService } from './earnings.service';
import { DriversController } from './drivers.controller';
import { DriverTrip } from '../driver-trips/entities/driver-trip.entity';
import { DriverTripStop } from '../driver-trips/entities/driver-trip-stop.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Driver, DriverTrip, DriverTripStop]),
    PassportModule,
  ],
  controllers: [DriversController],
  providers: [DriversService, EarningsService],
  exports: [DriversService, EarningsService],
})
export class DriversModule {}
