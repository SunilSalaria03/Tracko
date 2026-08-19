import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { CookieOptions } from 'express';
import * as bcrypt from 'bcryptjs';
import { PublicUser, toPublicUser } from '../users/user.types';
import {
  AUTH_COOKIE_NAME,
  isUniqueViolation,
  parseDurationToMs,
} from './auth.constants';
import { AuthRepository } from './auth.repository';
import { SignInDto } from './dto/signin.dto';
import { SignUpDto } from './dto/signup.dto';
import { GoogleAuthClient, type GoogleProfile } from './google-auth.client';

@Injectable()
export class AuthService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly googleAuthClient: GoogleAuthClient,
  ) {}

  async signUp(dto: SignUpDto): Promise<PublicUser> {
    const existing = await this.authRepository.findByEmail(dto.email);

    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    try {
      return await this.authRepository.createUser({
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        passwordHash,
        googleId: null,
        authProvider: 'LOCAL',
        role: 'EMPLOYEE',
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          'An account with this email already exists',
        );
      }

      throw error;
    }
  }

  async signIn(dto: SignInDto): Promise<{ user: PublicUser; token: string }> {
    const user = await this.authRepository.findByEmail(dto.email);

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.passwordHash) {
      throw new UnauthorizedException(
        'This account uses Google sign-in. Continue with Google.',
      );
    }

    const passwordMatches = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );

    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const token = await this.createAccessToken(user);

    return { user: toPublicUser(user), token };
  }

  async signInWithGoogle(
    accessToken: string,
  ): Promise<{ user: PublicUser; token: string }> {
    const profile = await this.googleAuthClient.verifyAccessToken(accessToken);
    return this.completeGoogleSignIn(profile);
  }

  async signInWithDummyGoogle(): Promise<{ user: PublicUser; token: string }> {
    if (this.config.get<string>('NODE_ENV') === 'production') {
      throw new ForbiddenException('Dummy Google sign-in is disabled');
    }

    return this.completeGoogleSignIn({
      googleId: 'dummy-google-local',
      email: 'dummy.google@tracko.local',
      firstName: 'Dummy',
      lastName: 'Google',
    });
  }

  getCookieName(): string {
    return AUTH_COOKIE_NAME;
  }

  getCookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.config.get<string>('NODE_ENV') === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: parseDurationToMs(
        this.config.getOrThrow<string>('JWT_EXPIRES_IN'),
      ),
    };
  }

  private async completeGoogleSignIn(
    profile: GoogleProfile,
  ): Promise<{ user: PublicUser; token: string }> {
    let user =
      (await this.authRepository.findByGoogleId(profile.googleId)) ??
      (await this.authRepository.findByEmail(profile.email));

    if (user && user.googleId && user.googleId !== profile.googleId) {
      throw new UnauthorizedException('Google account could not be verified');
    }

    if (!user) {
      await this.authRepository.createUser({
        firstName: profile.firstName,
        lastName: profile.lastName,
        email: profile.email,
        passwordHash: null,
        googleId: profile.googleId,
        authProvider: 'GOOGLE',
        role: 'EMPLOYEE',
      });
      user = await this.authRepository.findByGoogleId(profile.googleId);
      if (!user) {
        throw new UnauthorizedException('Unable to create Google account');
      }
    } else if (!user.googleId) {
      await this.authRepository.linkGoogleId(user.id, profile.googleId);
    }

    const token = await this.createAccessToken(user);

    return { user: toPublicUser(user), token };
  }

  private createAccessToken(user: PublicUser): Promise<string> {
    return this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
  }
}
