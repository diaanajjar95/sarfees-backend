import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AdminsModule } from '../../admins/admins.module';
import { AdminAuthController } from './admin-auth.controller';
import { AdminAuthService } from './admin-auth.service';
import { JwtAdminStrategy } from './strategies/jwt-admin.strategy';
import { JwtAdminRefreshStrategy } from './strategies/jwt-admin-refresh.strategy';

@Module({
  imports: [
    AdminsModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_ADMIN_ACCESS_SECRET'),
        signOptions: { expiresIn: '24h' },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AdminAuthController],
  providers: [AdminAuthService, JwtAdminStrategy, JwtAdminRefreshStrategy],
  exports: [AdminAuthService],
})
export class AdminAuthModule {}
