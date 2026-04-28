import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtDriverStrategy extends PassportStrategy(
  Strategy,
  'jwt-driver',
) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey:
        configService.get<string>('JWT_DRIVER_ACCESS_SECRET') ||
        'fallback_driver_access_secret',
    });
  }

  validate(payload: any) {
    return {
      driverId: payload.sub,
      phoneNumber: payload.phoneNumber,
      countryCode: payload.countryCode,
      gender: payload.gender,
      homeCity: payload.homeCity,
      status: payload.status,
      language: payload.language,
    };
  }
}
