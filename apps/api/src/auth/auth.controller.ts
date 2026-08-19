import { Body, Controller, Get, Post, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import type { PublicUser } from '../users/user.types';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { SignInDto } from './dto/signin.dto';
import { SignUpDto } from './dto/signup.dto';
import { GoogleAuthDto } from './dto/google-auth.dto';
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
    const { user, token } = await this.authService.signIn(dto);

    response.cookie(
      this.authService.getCookieName(),
      token,
      this.authService.getCookieOptions(),
    );

    return user;
  }

  @Post('google')
  async google(
    @Body() dto: GoogleAuthDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<PublicUser> {
    const { user, token } = await this.authService.signInWithGoogle(
      dto.accessToken,
    );

    response.cookie(
      this.authService.getCookieName(),
      token,
      this.authService.getCookieOptions(),
    );

    return user;
  }

  @Post('google/dummy')
  async dummyGoogle(
    @Res({ passthrough: true }) response: Response,
  ): Promise<PublicUser> {
    const { user, token } = await this.authService.signInWithDummyGoogle();

    response.cookie(
      this.authService.getCookieName(),
      token,
      this.authService.getCookieOptions(),
    );

    return user;
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) response: Response): { ok: true } {
    response.clearCookie(this.authService.getCookieName(), {
      ...this.authService.getCookieOptions(),
      maxAge: 0,
    });

    return { ok: true };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: PublicUser): PublicUser {
    return user;
  }
}
