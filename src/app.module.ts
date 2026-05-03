import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { AcceptLanguageResolver, I18nModule } from 'nestjs-i18n';
import { TripsModule } from './trips/trips.module';
import { CitiesModule } from './cities/cities.module';
import { PackagesModule } from './packages/packages.module';
import { AppConfigModule } from './app-config/app-config.module';
import { DriversModule } from './drivers/drivers.module';
import { DriverAuthModule } from './auth/driver/driver-auth.module';
import { DriverTripsModule } from './driver-trips/driver-trips.module';
import { DriverNotificationsModule } from './notifications/driver-notifications.module';
import { AdminsModule } from './admins/admins.module';
import { AdminAuthModule } from './auth/admin/admin-auth.module';
import { AdminDriversModule } from './admins/drivers/admin-drivers.module';
import { AdminTripsModule } from './admins/trips/admin-trips.module';
import { AdminEarningsModule } from './admins/earnings/admin-earnings.module';
import { AdminPassengerRequestsModule } from './admins/passenger-requests/admin-passenger-requests.module';
import { AnnouncementsModule } from './announcements/announcements.module';
import * as path from 'path';
@Module({
  imports: [
    I18nModule.forRoot({
      fallbackLanguage: 'en',
      loaderOptions: {
        path: path.join(__dirname, '/i18n/'),
        watch: true,
      },
      resolvers: [AcceptLanguageResolver],
    }),
    ConfigModule.forRoot({
      isGlobal: true, // Make ConfigModule available globally
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        // Render-managed Postgres requires SSL. Enable it when DB_SSL=true,
        // or auto-detect when host is not localhost (covers cloud DBs in dev).
        const dbHost = configService.get<string>('DB_HOST') ?? 'localhost';
        const sslExplicit = configService.get<string>('DB_SSL');
        const useSsl =
          sslExplicit === 'true' ||
          (sslExplicit !== 'false' &&
            dbHost !== 'localhost' &&
            dbHost !== '127.0.0.1');
        return {
          type: 'postgres',
          host: dbHost,
          port: configService.get<number>('DB_PORT'),
          username: configService.get<string>('DB_USERNAME'),
          password: configService.get<string>('DB_PASSWORD'),
          database: configService.get<string>('DB_NAME'),
          entities: [__dirname + '/**/*.entity{.ts,.js}'],
          synchronize: true, // Auto-create tables (dev only)
          // Render's managed certs aren't in Node's CA bundle; skip strict
          // verification but still require encrypted transport.
          ssl: useSsl ? { rejectUnauthorized: false } : false,
        };
      },
      inject: [ConfigService],
    }),
    UsersModule,
    AuthModule,
    TripsModule,
    CitiesModule,
    PackagesModule,
    AppConfigModule,
    DriversModule,
    DriverAuthModule,
    DriverTripsModule,
    DriverNotificationsModule,
    AdminsModule,
    AdminAuthModule,
    AdminDriversModule,
    AdminTripsModule,
    AdminEarningsModule,
    AdminPassengerRequestsModule,
    AnnouncementsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
