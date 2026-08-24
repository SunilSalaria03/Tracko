import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { PublicUser } from '../users/user.types';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { SignInDto } from './dto/signin.dto';
import { SignUpDto } from './dto/signup.dto';
import { GoogleAuthDto } from './dto/google-auth.dto';
import { SetPasswordDto } from './dto/set-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { VerifyResetCodeDto } from './dto/verify-reset-code.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  signUp(@Body() dto: SignUpDto): Promise<PublicUser> {
    return this.authService.signUp(dto);
  }

  @Post('signin')
  async signIn(
    @Body() dto: SignInDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<PublicUser> {
    const { user, token, refreshToken } = await this.authService.signIn(dto);
    this.setSessionCookies(response, token, refreshToken);
    return user;
  }

  @Post('google')
  async google(
    @Body() dto: GoogleAuthDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<PublicUser & { googleLinked: boolean }> {
    const { user, token, refreshToken, googleLinked } =
      await this.authService.signInWithGoogle(dto.accessToken);
    this.setSessionCookies(response, token, refreshToken);
    return { ...user, googleLinked };
  }

  @Post('google/dummy')
  async dummyGoogle(
    @Res({ passthrough: true }) response: Response,
  ): Promise<PublicUser & { googleLinked: boolean }> {
    const { user, token, refreshToken, googleLinked } =
      await this.authService.signInWithDummyGoogle();
    this.setSessionCookies(response, token, refreshToken);
    return { ...user, googleLinked };
  }

  @Post('forgot-password')
  requestPasswordReset(
    @Body() dto: ForgotPasswordDto,
  ): Promise<{ ok: true; devCode?: string }> {
    return this.authService.requestPasswordReset(dto);
  }

  @Post('verify-reset-code')
  verifyResetCode(
    @Body() dto: VerifyResetCodeDto,
  ): Promise<{ resetToken: string }> {
    return this.authService.verifyResetCode(dto);
  }

  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto): Promise<{ ok: true }> {
    return this.authService.resetPassword(dto);
  }

  @Post('set-password')
  @UseGuards(JwtAuthGuard)
  setPassword(
    @CurrentUser() user: PublicUser,
    @Body() dto: SetPasswordDto,
  ): Promise<PublicUser> {
    return this.authService.setPassword(user.id, dto);
  }

  @Post('refresh')
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ ok: true }> {
    const { token, refreshToken } = await this.authService.refreshSession(
      request.cookies?.[this.authService.getRefreshCookieName()] as
        | string
        | undefined,
    );
    this.setSessionCookies(response, token, refreshToken);
    return { ok: true };
  }

  @Post('logout')
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ ok: true }> {
    await this.authService.revokeRefreshToken(
      request.cookies?.[this.authService.getRefreshCookieName()] as
        | string
        | undefined,
    );
    response.clearCookie(this.authService.getCookieName(), {
      ...this.authService.getCookieOptions(),
      maxAge: 0,
    });
    response.clearCookie(this.authService.getRefreshCookieName(), {
      ...this.authService.getRefreshCookieOptions(),
      maxAge: 0,
    });
    return { ok: true };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: PublicUser): PublicUser {
    return user;
  }

  private setSessionCookies(
    response: Response,
    accessToken: string,
    refreshToken: string,
  ): void {
    response.cookie(
      this.authService.getCookieName(),
      accessToken,
      this.authService.getCookieOptions(),
    );
    response.cookie(
      this.authService.getRefreshCookieName(),
      refreshToken,
      this.authService.getRefreshCookieOptions(),
    );
  }
}
