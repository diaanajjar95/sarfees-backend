import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PackageDelivery } from './entities/package-delivery.entity';
import { PackagesController } from './packages.controller';
import { PackagesService } from './packages.service';

@Module({
  imports: [TypeOrmModule.forFeature([PackageDelivery])],
  controllers: [PackagesController],
  providers: [PackagesService],
})
export class PackagesModule {}
