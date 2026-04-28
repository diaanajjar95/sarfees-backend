import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { DriverNotification } from './driver-notification.entity';
import { DriverNotificationsService } from './driver-notifications.service';
import { DriverNotificationsController } from './driver-notifications.controller';

@Module({
  imports: [TypeOrmModule.forFeature([DriverNotification]), PassportModule],
  controllers: [DriverNotificationsController],
  providers: [DriverNotificationsService],
  exports: [DriverNotificationsService],
})
export class DriverNotificationsModule {}
