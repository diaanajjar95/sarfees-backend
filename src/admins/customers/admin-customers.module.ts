import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { User } from '../../users/user.entity';
import { TripRequest } from '../../trips/entities/trip-request.entity';
import { Rating } from '../../ratings/entities/rating.entity';
import { AdminCustomersController } from './admin-customers.controller';
import { AdminCustomersService } from './admin-customers.service';

@Module({
  imports: [
    PassportModule,
    TypeOrmModule.forFeature([User, TripRequest, Rating]),
  ],
  controllers: [AdminCustomersController],
  providers: [AdminCustomersService],
})
export class AdminCustomersModule {}
