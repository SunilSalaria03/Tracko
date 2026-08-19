import { Injectable, UnauthorizedException } from '@nestjs/common';

export type GoogleProfile = {
  googleId: string;
  email: string;
  firstName: string;
  lastName: string;
};

type GoogleUserInfo = {
  sub?: string;
  email?: string;
  email_verified?: boolean | string;
  given_name?: string;
  family_name?: string;
};

@Injectable()
export class GoogleAuthClient {
  async verifyAccessToken(accessToken: string): Promise<GoogleProfile> {
    const response = await fetch(
      'https://www.googleapis.com/oauth2/v3/userinfo',
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    if (!response.ok) {
      throw new UnauthorizedException('Google account could not be verified');
    }

    const payload = (await response.json()) as GoogleUserInfo;
    const emailVerified =
      payload.email_verified === true || payload.email_verified === 'true';

    if (!payload.email || !emailVerified || !payload.sub) {
      throw new UnauthorizedException('Google account could not be verified');
    }

    const emailLocalPart = payload.email.split('@')[0] ?? 'User';

    return {
      googleId: payload.sub,
      email: payload.email.trim().toLowerCase(),
      firstName: payload.given_name?.trim() || emailLocalPart,
      lastName: payload.family_name?.trim() || 'User',
    };
  }
}
