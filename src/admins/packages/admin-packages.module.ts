import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { PackageDelivery } from '../../packages/entities/package-delivery.entity';
import { TripRequest } from '../../trips/entities/trip-request.entity';
import { TripGroup } from '../../grouping/entities/trip-group.entity';
import { AdminPackagesService } from './admin-packages.service';
import { AdminPackagesController } from './admin-packages.controller';

@Module({
  imports: [
    PassportModule,
    TypeOrmModule.forFeature([PackageDelivery, TripRequest, TripGroup]),
  ],
  controllers: [AdminPackagesController],
  providers: [AdminPackagesService],
})
export class AdminPackagesModule {}
