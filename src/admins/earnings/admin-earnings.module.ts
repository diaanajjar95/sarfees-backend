import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { Driver } from '../../drivers/driver.entity';
import { DriverTrip } from '../../driver-trips/entities/driver-trip.entity';
import { AdminEarningsService } from './admin-earnings.service';
import { AdminEarningsController } from './admin-earnings.controller';

@Module({
  imports: [PassportModule, TypeOrmModule.forFeature([Driver, DriverTrip])],
  controllers: [AdminEarningsController],
  providers: [AdminEarningsService],
})
export class AdminEarningsModule {}
