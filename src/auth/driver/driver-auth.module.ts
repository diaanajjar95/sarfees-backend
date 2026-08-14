import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DriversModule } from '../../drivers/drivers.module';
import { DriverAuthController } from './driver-auth.controller';
import { DriverAuthService } from './driver-auth.service';
import { JwtDriverStrategy } from './strategies/jwt-driver.strategy';
import { JwtDriverRefreshStrategy } from './strategies/jwt-driver-refresh.strategy';

@Module({
  imports: [
    DriversModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_DRIVER_ACCESS_SECRET'),
        signOptions: { expiresIn: '24h' },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [DriverAuthController],
  providers: [DriverAuthService, JwtDriverStrategy, JwtDriverRefreshStrategy],
  exports: [DriverAuthService],
})
export class DriverAuthModule {}
