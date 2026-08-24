import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../../users/users.service';
import { AUTH_COOKIE_NAME } from '../auth.constants';

export type JwtPayload = {
  sub: string;
  email: string;
  role: string;
};

function extractAccessToken(request: Request): string | null {
  const fromCookie = request.cookies?.[AUTH_COOKIE_NAME];
  if (typeof fromCookie === 'string' && fromCookie.length > 0) {
    return fromCookie;
  }

  const header = request.headers.cookie;
  if (!header) {
    return null;
  }

  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === AUTH_COOKIE_NAME) {
      return decodeURIComponent(rest.join('='));
    }
  }

  return null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        extractAccessToken,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.usersService.findById(payload.sub);

    if (!user) {
      throw new UnauthorizedException();
    }

    return user;
  }
}
