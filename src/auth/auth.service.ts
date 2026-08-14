import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { User } from '../users/user.entity';
import { UserResponseDto } from '../users/dto/user-response.dto';
import { I18nContext, I18nService } from 'nestjs-i18n';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private readonly i18n: I18nService,
  ) {}

  // 1. Send OTP (login / signup entry point)
  async sendOtp(phoneNumber: string, countryCode: string) {
    let user = await this.usersService.findByPhone(phoneNumber, countryCode);
    if (!user) {
      user = await this.usersService.create(phoneNumber, countryCode);
    }

    const now = new Date();

    // Check if user is locked out
    if (user.otpLockedUntil && user.otpLockedUntil > now) {
      throw new ForbiddenException(
        I18nContext.current()?.t('auth.Account locked'),
      );
    }

    // Rate Limiting Logic: Max 3 requests per 10 minutes
    const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);

    if (user.otpLastRequestAt && user.otpLastRequestAt > tenMinutesAgo) {
      if (user.otpRequestCount >= 3) {
        throw new ForbiddenException(
          I18nContext.current()?.t('auth.Too many requests'),
        );
      }
    } else {
      // Reset counter if time window passed
      user.otpRequestCount = 0;
    }

    // Generate mocked OTP
    const otp = '1234';
    const expiresAt = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes expiry

    // Save to DB & Reset failure attempts on new OTP send (optional, but good UX)
    await this.usersService.update(user.id, {
      otp,
      otpExpiresAt: expiresAt,
      otpRequestCount: user.otpRequestCount + 1,
      otpLastRequestAt: now,
      otpAttemptCount: 0, // Reset attempts on new OTP
    });

    return { message: 'OTP sent (mock: use 1234)' };
  }

  // 2. Verify OTP & Login/Register
  async verifyOtp(phoneNumber: string, countryCode: string, otp: string) {
    const user = await this.usersService.findByPhone(phoneNumber, countryCode);
    if (!user) {
      throw new UnauthorizedException(
        I18nContext.current()?.t('auth.User not found'),
      );
    }

    // Check Lockout
    if (user.otpLockedUntil && user.otpLockedUntil > new Date()) {
      throw new ForbiddenException(
        I18nContext.current()?.t('auth.Account locked'),
      );
    }

    // Check Expiry
    if (user.otpExpiresAt && user.otpExpiresAt < new Date()) {
      throw new UnauthorizedException(
        I18nContext.current()?.t('auth.OTP expired'),
      );
    }

    // Check Validity
    if (user.otp !== otp) {
      const attempts = (user.otpAttemptCount || 0) + 1;
      const updates: Partial<User> = { otpAttemptCount: attempts };
      let errorMessage = I18nContext.current()?.t('auth.Invalid OTP') as string;

      if (attempts >= 5) {
        // Lock out for 15 minutes
        updates.otpLockedUntil = new Date(Date.now() + 15 * 60 * 1000);
        errorMessage = I18nContext.current()?.t(
          'auth.Locked for 15 minutes',
        ) as string;
      }

      await this.usersService.update(user.id, updates);

      if (attempts >= 5) {
        throw new ForbiddenException(errorMessage);
      }
      throw new UnauthorizedException(errorMessage);
    }

    // isNewUser = true only the very first time this phone verifies OTP
    const isNewUser = !user.hasVerifiedOtpBefore;

    // Success! Clear OTP data, lockout, and mark as verified
    const updatedUser = await this.usersService.update(user.id, {
      otp: null as unknown as string,
      otpExpiresAt: null as unknown as Date,
      otpAttemptCount: 0,
      otpLockedUntil: null as unknown as Date,
      hasVerifiedOtpBefore: true,
    });

    const finalUser = updatedUser ?? user;

    // Generate Tokens
    const tokens = await this.getTokens(finalUser);
    await this.updateRefreshToken(finalUser.id, tokens.refreshToken);

    const tripCount = await this.usersService.getTripCount(finalUser.id);

    return {
      ...tokens,
      isNewUser,
      user: UserResponseDto.from(finalUser, tripCount),
    };
  }

  // 3. Refresh Tokens
  async refreshTokens(userId: number, refreshToken: string) {
    const user = await this.usersService.findById(userId);
    if (!user || !user.refreshToken)
      throw new ForbiddenException(
        I18nContext.current()?.t('auth.Access Denied'),
      );

    const refreshTokenMatches = await bcrypt.compare(
      refreshToken,
      user.refreshToken,
    );
    if (!refreshTokenMatches)
      throw new ForbiddenException(
        I18nContext.current()?.t('auth.Access Denied'),
      );

    const tokens = await this.getTokens(user);
    await this.updateRefreshToken(user.id, tokens.refreshToken);

    return tokens;
  }

  async logout(userId: number) {
    // Clears the refresh token server-side so it can no longer be used.
    // NOTE: the currently-issued access token (15m TTL) remains valid until expiry.
    await this.usersService.update(userId, {
      refreshToken: null as unknown as string,
    });
    return { message: 'Logged out successfully' };
  }

  // Helper: Generate Access & Refresh Tokens
  async getTokens(user: User) {
    const payload = {
      sub: user.id,
      phoneNumber: user.phoneNumber,
      countryCode: user.countryCode,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      gender: user.gender,
      profilePhotoUrl: user.profilePhotoUrl,
      isProfileCompleted: user.isProfileCompleted,
    };

    // 24h access / 7d refresh across every role (business decision,
    // Jul 2026). Env-overridable without a redeploy.
    const accessTtl =
      this.configService.get<string>('JWT_ACCESS_EXPIRES_IN') ?? '24h';
    const refreshTtl =
      this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d';
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
        expiresIn: accessTtl as unknown as number,
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: refreshTtl as unknown as number,
      }),
    ]);

    return {
      accessToken,
      refreshToken,
    };
  }

  // Helper: Hash and store refresh token
  async updateRefreshToken(userId: number, refreshToken: string) {
    const hash = await bcrypt.hash(refreshToken, 10);
    await this.usersService.update(userId, { refreshToken: hash });
  }
}
