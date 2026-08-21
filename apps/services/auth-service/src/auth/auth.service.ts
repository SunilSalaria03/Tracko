import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { CookieOptions } from 'express';
import { createHash, randomBytes, randomInt } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { PublicUser, toPublicUser, type GoogleSignInResult } from '../users/user.types';
import {
  AUTH_COOKIE_NAME,
  EMAIL_ALREADY_REGISTERED_MESSAGE,
  INVALID_CREDENTIALS_MESSAGE,
  INVALID_RESET_CODE_MESSAGE,
  INVALID_RESET_TOKEN_MESSAGE,
  isUniqueViolation,
  parseDurationToMs,
} from './auth.constants';
import { AuthRepository } from './auth.repository';
import { SignInDto } from './dto/signin.dto';
import { SignUpDto } from './dto/signup.dto';
import { SetPasswordDto } from './dto/set-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { VerifyResetCodeDto } from './dto/verify-reset-code.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { GoogleAuthClient, type GoogleProfile } from './google-auth.client';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly authRepository: AuthRepository,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly googleAuthClient: GoogleAuthClient,
  ) {}

  async signUp(dto: SignUpDto): Promise<PublicUser> {
    const existing = await this.authRepository.findByEmail(dto.email);

    if (existing) {
      throw new ConflictException(EMAIL_ALREADY_REGISTERED_MESSAGE);
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
        throw new ConflictException(EMAIL_ALREADY_REGISTERED_MESSAGE);
      }

      throw error;
    }
  }

  async signIn(dto: SignInDto): Promise<{ user: PublicUser; token: string }> {
    const user = await this.authRepository.findByEmail(dto.email);

    if (!user?.passwordHash) {
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }

    const passwordMatches = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );

    if (!passwordMatches) {
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }

    const token = await this.createAccessToken(user);

    return { user: toPublicUser(user), token };
  }

  async signInWithGoogle(
    accessToken: string,
  ): Promise<GoogleSignInResult> {
    const profile = await this.googleAuthClient.verifyAccessToken(accessToken);
    return this.completeGoogleSignIn(profile);
  }

  async signInWithDummyGoogle(): Promise<GoogleSignInResult> {
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

  async setPassword(
    userId: string,
    dto: SetPasswordDto,
  ): Promise<PublicUser> {
    const user = await this.authRepository.findById(userId);

    if (!user) {
      throw new UnauthorizedException();
    }

    if (user.passwordHash) {
      throw new ConflictException('A password is already set for this account');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const updated = await this.authRepository.setPassword(userId, passwordHash);

    if (!updated) {
      throw new ConflictException('A password is already set for this account');
    }

    return toPublicUser(updated);
  }

  async requestPasswordReset(
    dto: ForgotPasswordDto,
  ): Promise<{ ok: true; devCode?: string }> {
    const user = await this.authRepository.findByEmail(dto.email);

    if (!user) {
      return { ok: true };
    }

    await this.authRepository.invalidateResetChallenges(user.email);

    const code = String(randomInt(100000, 1000000));
    const codeHash = await bcrypt.hash(code, 12);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await this.authRepository.createResetChallenge({
      email: user.email,
      codeHash,
      expiresAt,
    });

    this.logger.log(`Password reset code for ${user.email}: ${code}`);

    if (this.config.get<string>('NODE_ENV') === 'production') {
      return { ok: true };
    }

    return { ok: true, devCode: code };
  }

  async verifyResetCode(
    dto: VerifyResetCodeDto,
  ): Promise<{ resetToken: string }> {
    const challenge = await this.authRepository.findActiveResetChallenge(
      dto.email,
    );

    if (!challenge) {
      throw new UnauthorizedException(INVALID_RESET_CODE_MESSAGE);
    }

    const codeMatches = await bcrypt.compare(dto.code, challenge.codeHash);

    if (!codeMatches) {
      throw new UnauthorizedException(INVALID_RESET_CODE_MESSAGE);
    }

    const resetToken = randomBytes(32).toString('hex');
    await this.authRepository.markChallengeVerified(
      challenge.id,
      this.hashResetToken(resetToken),
    );

    return { resetToken };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ ok: true }> {
    const challenge = await this.authRepository.findVerifiedChallengeByTokenHash(
      this.hashResetToken(dto.resetToken),
    );

    if (!challenge) {
      throw new UnauthorizedException(INVALID_RESET_TOKEN_MESSAGE);
    }

    const user = await this.authRepository.findByEmail(challenge.email);

    if (!user) {
      throw new UnauthorizedException(INVALID_RESET_TOKEN_MESSAGE);
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    await this.authRepository.updatePassword(user.id, passwordHash);
    await this.authRepository.consumeChallenge(challenge.id);

    return { ok: true };
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
  ): Promise<GoogleSignInResult> {
    let user =
      (await this.authRepository.findByGoogleId(profile.googleId)) ??
      (await this.authRepository.findByEmail(profile.email));

    if (user && user.googleId && user.googleId !== profile.googleId) {
      throw new UnauthorizedException('Google account could not be verified');
    }

    let googleLinked = false;

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
      user = await this.authRepository.findById(user.id);
      if (!user) {
        throw new UnauthorizedException('Unable to link Google account');
      }
      googleLinked = true;
    }

    const token = await this.createAccessToken(user);

    return { user: toPublicUser(user), token, googleLinked };
  }

  private createAccessToken(user: PublicUser): Promise<string> {
    return this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
  }

  private hashResetToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
