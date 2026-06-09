import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { I18nContext, I18nService } from 'nestjs-i18n';
import { DriversService } from '../../drivers/drivers.service';
import { Driver } from '../../drivers/driver.entity';
import { DriverResponseDto } from '../../drivers/dto/driver-response.dto';
import { DriverStatus } from '../../shared/enums/driver-status.enum';

const OTP_TTL_SECONDS = 120;
const OTP_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const OTP_RATE_LIMIT_MAX = 3;
const OTP_MAX_ATTEMPTS = 3;
const OTP_LOCKOUT_MS = 10 * 60 * 1000;

@Injectable()
export class DriverAuthService {
  constructor(
    private readonly driversService: DriversService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly i18n: I18nService,
  ) {}

  // 1. Request OTP — pre-approved phones only
  async requestOtp(phoneNumber: string, countryCode: string) {
    const driver = await this.driversService.findByPhone(
      phoneNumber,
      countryCode,
    );

    // Pre-approved gate: ops registers drivers externally; unknown phones are rejected.
    if (!driver) {
      throw new ForbiddenException(
        I18nContext.current()?.t('driver-auth.Not registered'),
      );
    }

    if (driver.status === DriverStatus.SUSPENDED) {
      throw new ForbiddenException(
        I18nContext.current()?.t('driver-auth.Account suspended'),
      );
    }

    const now = new Date();

    if (driver.otpLockedUntil && driver.otpLockedUntil > now) {
      throw new ForbiddenException(
        I18nContext.current()?.t('driver-auth.Account locked'),
      );
    }

    // Rate limit: max 3 requests per 10 minutes
    const windowStart = new Date(now.getTime() - OTP_RATE_LIMIT_WINDOW_MS);
    let nextRequestCount = 1;
    if (driver.otpLastRequestAt && driver.otpLastRequestAt > windowStart) {
      if (driver.otpRequestCount >= OTP_RATE_LIMIT_MAX) {
        throw new ForbiddenException(
          I18nContext.current()?.t('driver-auth.Too many requests'),
        );
      }
      nextRequestCount = driver.otpRequestCount + 1;
    }

    const otp = '1234'; // mocked — to be replaced with SMS provider
    const expiresAt = new Date(now.getTime() + OTP_TTL_SECONDS * 1000);

    await this.driversService.update(driver.id, {
      otp,
      otpExpiresAt: expiresAt,
      otpRequestCount: nextRequestCount,
      otpLastRequestAt: now,
      otpAttemptCount: 0,
    });

    return {
      otp_sent: true,
      expires_in: OTP_TTL_SECONDS,
      message: 'OTP sent (mock: use 1234)',
    };
  }

  // 2. Verify OTP
  async verifyOtp(phoneNumber: string, countryCode: string, otp: string) {
    const driver = await this.driversService.findByPhone(
      phoneNumber,
      countryCode,
    );
    if (!driver) {
      throw new UnauthorizedException(
        I18nContext.current()?.t('driver-auth.Not registered'),
      );
    }

    if (driver.status === DriverStatus.SUSPENDED) {
      throw new ForbiddenException(
        I18nContext.current()?.t('driver-auth.Account suspended'),
      );
    }

    const now = new Date();

    if (driver.otpLockedUntil && driver.otpLockedUntil > now) {
      throw new ForbiddenException(
        I18nContext.current()?.t('driver-auth.Account locked'),
      );
    }

    if (driver.otpExpiresAt && driver.otpExpiresAt < now) {
      throw new UnauthorizedException(
        I18nContext.current()?.t('driver-auth.OTP expired'),
      );
    }

    if (driver.otp !== otp) {
      const attempts = (driver.otpAttemptCount || 0) + 1;
      const updates: Partial<Driver> = { otpAttemptCount: attempts };
      let errorMessage = I18nContext.current()?.t(
        'driver-auth.Invalid OTP',
      ) as string;

      if (attempts >= OTP_MAX_ATTEMPTS) {
        updates.otpLockedUntil = new Date(now.getTime() + OTP_LOCKOUT_MS);
        errorMessage = I18nContext.current()?.t(
          'driver-auth.Locked for 10 minutes',
        ) as string;
      }

      await this.driversService.update(driver.id, updates);

      if (attempts >= OTP_MAX_ATTEMPTS) {
        throw new ForbiddenException(errorMessage);
      }
      throw new UnauthorizedException(errorMessage);
    }

    const updated = await this.driversService.update(driver.id, {
      otp: null as unknown as string,
      otpExpiresAt: null as unknown as Date,
      otpAttemptCount: 0,
      otpLockedUntil: null as unknown as Date,
      hasVerifiedOtpBefore: true,
    });

    const finalDriver = updated ?? driver;

    const tokens = await this.getTokens(finalDriver);
    await this.persistRefreshToken(finalDriver.id, tokens.refreshToken);

    return {
      ...tokens,
      driver: DriverResponseDto.from(finalDriver),
    };
  }

  // 3. Refresh tokens
  async refreshTokens(driverId: number, refreshToken: string) {
    const driver = await this.driversService.findById(driverId);
    if (!driver || !driver.refreshToken) {
      throw new ForbiddenException(
        I18nContext.current()?.t('driver-auth.Access Denied'),
      );
    }

    const matches = await bcrypt.compare(refreshToken, driver.refreshToken);
    if (!matches) {
      throw new ForbiddenException(
        I18nContext.current()?.t('driver-auth.Access Denied'),
      );
    }

    const tokens = await this.getTokens(driver);
    await this.persistRefreshToken(driver.id, tokens.refreshToken);
    return tokens;
  }

  private async getTokens(driver: Driver) {
    const payload = {
      sub: driver.id,
      phoneNumber: driver.phoneNumber,
      countryCode: driver.countryCode,
      gender: driver.gender,
      homeCity: driver.homeCity,
      status: driver.status,
      language: driver.language,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_DRIVER_ACCESS_SECRET'),
        expiresIn: '15m',
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_DRIVER_REFRESH_SECRET'),
        expiresIn: '7d',
      }),
    ]);

    return { accessToken, refreshToken };
  }

  private async persistRefreshToken(driverId: number, refreshToken: string) {
    const hash = await bcrypt.hash(refreshToken, 10);
    await this.driversService.update(driverId, { refreshToken: hash });
  }
}
