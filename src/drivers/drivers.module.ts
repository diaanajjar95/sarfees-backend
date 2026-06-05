import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { Driver } from './driver.entity';
import { DriversService } from './drivers.service';
import { EarningsService } from './earnings.service';
import { DriversController } from './drivers.controller';
import { DriverTrip } from '../driver-trips/entities/driver-trip.entity';
import { DriverTripStop } from '../driver-trips/entities/driver-trip-stop.entity';
import { DriverLocation } from '../trips/entities/driver-location.entity';
import { AnnouncementsModule } from '../announcements/announcements.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Driver,
      DriverTrip,
      DriverTripStop,
      DriverLocation,
    ]),
    PassportModule,
    AnnouncementsModule,
  ],
  controllers: [DriversController],
  providers: [DriversService, EarningsService],
  exports: [DriversService, EarningsService],
})
export class DriversModule {}
