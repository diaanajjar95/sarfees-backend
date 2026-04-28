import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtDriverRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-driver-refresh',
) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey:
        configService.get<string>('JWT_DRIVER_REFRESH_SECRET') ||
        'fallback_driver_refresh_secret',
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
