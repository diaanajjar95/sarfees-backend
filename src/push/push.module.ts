import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { DeviceToken } from './entities/device-token.entity';
import { NotificationTopic } from './entities/notification-topic.entity';
import { PushService } from './push.service';
import { WhatsAppService } from './whatsapp.service';
import { PushController } from './push.controller';
import { AdminPushController } from './admin-push.controller';
import { TrackingController } from './tracking.controller';
import { PackageReceiverNotifier } from './package-receiver-notifier.service';
import { PackageDelivery } from '../packages/entities/package-delivery.entity';

/**
 * Global — both notification services (passenger + driver) and the
 * package flow piggyback pushes/WhatsApp onto their existing emits
 * without every module importing this one.
 */
@Global()
@Module({
  imports: [
    PassportModule,
    TypeOrmModule.forFeature([DeviceToken, NotificationTopic, PackageDelivery]),
  ],
  controllers: [PushController, AdminPushController, TrackingController],
  providers: [PushService, WhatsAppService, PackageReceiverNotifier],
  exports: [PushService, WhatsAppService, PackageReceiverNotifier],
})
export class PushModule {}
