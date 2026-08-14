import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EscalationCase } from '../../assignment/entities/escalation-case.entity';
import { TripRequest } from '../../trips/entities/trip-request.entity';
import { AdminEscalationsController } from './admin-escalations.controller';
import { AdminEscalationsService } from './admin-escalations.service';

@Module({
  imports: [TypeOrmModule.forFeature([EscalationCase, TripRequest])],
  controllers: [AdminEscalationsController],
  providers: [AdminEscalationsService],
})
export class AdminEscalationsModule {}
