import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtAdminStrategy extends PassportStrategy(Strategy, 'jwt-admin') {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey:
        configService.get<string>('JWT_ADMIN_ACCESS_SECRET') ||
        'fallback_admin_access_secret',
    });
  }

  validate(payload: any) {
    return {
      adminId: payload.sub,
      email: payload.email,
      role: payload.role,
    };
  }
}
