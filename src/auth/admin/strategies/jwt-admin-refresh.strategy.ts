import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtAdminRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-admin-refresh',
) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey:
        configService.get<string>('JWT_ADMIN_REFRESH_SECRET') ||
        'fallback_admin_refresh_secret',
      passReqToCallback: true,
    });
  }

  validate(req: Request, payload: any) {
    const authHeader = req.get('Authorization');
    const refreshToken = authHeader
      ? authHeader.replace('Bearer', '').trim()
      : null;
    return { ...payload, refreshToken };
  }
}
