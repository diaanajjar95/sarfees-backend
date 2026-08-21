import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { Driver } from '../drivers/driver.entity';
import { DriverNotificationsModule } from '../notifications/driver-notifications.module';
import { TopupCard } from './entities/topup-card.entity';
import { WalletConfig } from './entities/wallet-config.entity';
import { WalletTransaction } from './entities/wallet-transaction.entity';
import { WalletConfigService } from './wallet-config.service';
import { WalletsService } from './wallets.service';
import { WalletsController } from './wallets.controller';
import { AdminWalletsController } from './admin-wallets.controller';
import { AdminCardsController } from './admin-cards.controller';

@Module({
  imports: [
    PassportModule,
    TypeOrmModule.forFeature([
      TopupCard,
      WalletTransaction,
      WalletConfig,
      Driver,
    ]),
    DriverNotificationsModule,
  ],
  controllers: [WalletsController, AdminWalletsController, AdminCardsController],
  providers: [WalletsService, WalletConfigService],
  exports: [WalletsService, WalletConfigService],
})
export class WalletsModule {}
