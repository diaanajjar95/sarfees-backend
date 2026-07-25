import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PackageDelivery } from './entities/package-delivery.entity';
import { TripRequest } from '../trips/entities/trip-request.entity';
import { TripGroup } from '../grouping/entities/trip-group.entity';
import { PackagesController } from './packages.controller';
import { PackagesService } from './packages.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([PackageDelivery, TripRequest, TripGroup]),
  ],
  controllers: [PackagesController],
  providers: [PackagesService],
})
export class PackagesModule {}
