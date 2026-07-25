import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { I18nContext } from 'nestjs-i18n';
import { AdminsService } from '../../admins/admins.service';
import { Admin } from '../../admins/admin.entity';
import { AdminResponseDto } from '../../admins/dto/admin-response.dto';
import { AdminLoginDto } from './dto/admin-login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@Injectable()
export class AdminAuthService {
  constructor(
    private readonly adminsService: AdminsService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(dto: AdminLoginDto) {
    const admin = await this.adminsService.findByEmail(dto.email);
    if (!admin) {
      throw new UnauthorizedException(
        I18nContext.current()?.t('admin-auth.Invalid credentials'),
      );
    }
    if (!admin.isActive) {
      throw new ForbiddenException(
        I18nContext.current()?.t('admin-auth.Account disabled'),
      );
    }

    const ok = await bcrypt.compare(dto.password, admin.passwordHash);
    if (!ok) {
      throw new UnauthorizedException(
        I18nContext.current()?.t('admin-auth.Invalid credentials'),
      );
    }

    const tokens = await this.issueTokens(admin);
    await this.adminsService.update(admin.id, {
      refreshToken: await bcrypt.hash(tokens.refreshToken, 10),
      lastLoginAt: new Date(),
    });

    return {
      ...tokens,
      admin: AdminResponseDto.from(admin),
    };
  }

  async refreshTokens(adminId: number, refreshToken: string) {
    const admin = await this.adminsService.findById(adminId);
    if (!admin || !admin.refreshToken || !admin.isActive) {
      throw new ForbiddenException(
        I18nContext.current()?.t('admin-auth.Access denied'),
      );
    }
    const ok = await bcrypt.compare(refreshToken, admin.refreshToken);
    if (!ok) {
      throw new ForbiddenException(
        I18nContext.current()?.t('admin-auth.Access denied'),
      );
    }
    const tokens = await this.issueTokens(admin);
    await this.adminsService.update(admin.id, {
      refreshToken: await bcrypt.hash(tokens.refreshToken, 10),
    });
    return tokens;
  }

  async logout(adminId: number) {
    await this.adminsService.update(adminId, {
      refreshToken: null as unknown as string,
    });
    return { message: 'Logged out' };
  }

  async me(adminId: number) {
    const admin = await this.adminsService.findById(adminId);
    if (!admin) {
      throw new UnauthorizedException();
    }
    return AdminResponseDto.from(admin);
  }

  async changePassword(adminId: number, dto: ChangePasswordDto) {
    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException(
        I18nContext.current()?.t('admin-auth.Password must change'),
      );
    }
    const admin = await this.adminsService.findById(adminId);
    if (!admin) throw new UnauthorizedException();

    const ok = await bcrypt.compare(dto.currentPassword, admin.passwordHash);
    if (!ok) {
      throw new UnauthorizedException(
        I18nContext.current()?.t('admin-auth.Invalid credentials'),
      );
    }

    const updated = await this.adminsService.update(admin.id, {
      passwordHash: await bcrypt.hash(dto.newPassword, 10),
      mustChangePassword: false,
      // Force a re-login by invalidating the refresh token
      refreshToken: null as unknown as string,
    });
    return AdminResponseDto.from(updated);
  }

  private async issueTokens(admin: Admin) {
    const payload = {
      sub: admin.id,
      email: admin.email,
      role: admin.role,
    };
    // TTLs are env-configurable so dev can run a long-lived session without
    // re-authing every 30 minutes. Defaults are conservative for prod.
    const accessTtl =
      this.configService.get<string>('JWT_ADMIN_ACCESS_EXPIRES_IN') ?? '24h';
    const refreshTtl =
      this.configService.get<string>('JWT_ADMIN_REFRESH_EXPIRES_IN') ?? '7d';
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_ADMIN_ACCESS_SECRET'),
        // @nestjs/jwt's SignOptions types expiresIn as `ms.StringValue | number`,
        // a literal-string union enforced by the `ms` library. Our env value is a
        // plain runtime string ('30d', etc.) — cast to satisfy the compiler.
        expiresIn: accessTtl as unknown as number,
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_ADMIN_REFRESH_SECRET'),
        expiresIn: refreshTtl as unknown as number,
      }),
    ]);
    return { accessToken, refreshToken };
  }
}
