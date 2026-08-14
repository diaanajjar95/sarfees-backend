import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { Driver } from '../../drivers/driver.entity';
import { DriverTrip } from '../../driver-trips/entities/driver-trip.entity';
import { DriverTripStop } from '../../driver-trips/entities/driver-trip-stop.entity';
import { DriverTripDeclineLog } from '../../driver-trips/entities/driver-trip-decline-log.entity';
import { AdminDriversService } from './admin-drivers.service';
import { AdminDriversController } from './admin-drivers.controller';

@Module({
  imports: [
    PassportModule,
    TypeOrmModule.forFeature([
      Driver,
      DriverTrip,
      DriverTripStop,
      DriverTripDeclineLog,
    ]),
  ],
  controllers: [AdminDriversController],
  providers: [AdminDriversService],
})
export class AdminDriversModule {}
