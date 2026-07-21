import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MatchingConfig } from './matching-config.entity';
import { MatchingConfigService } from './matching-config.service';
import { VehicleClassCapacity } from './vehicle-class-capacity.entity';
import { VehicleClassCapacityService } from './vehicle-class-capacity.service';

/**
 * Global module — both services are read from many places
 * (grouping, assignment, cancellation handlers, admin endpoints)
 * so exposing them without repeated imports keeps the wiring
 * simple.
 */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([MatchingConfig, VehicleClassCapacity])],
  providers: [MatchingConfigService, VehicleClassCapacityService],
  exports: [MatchingConfigService, VehicleClassCapacityService],
})
export class MatchingConfigModule {}
