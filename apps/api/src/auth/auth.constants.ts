export const AUTH_COOKIE_NAME = 'tracko_token';

export const EMAIL_ALREADY_REGISTERED_MESSAGE =
  'This email is already associated with an account. Sign in to continue.';

export const INVALID_CREDENTIALS_MESSAGE =
  'Email or password is incorrect. You can also continue with Google.';

export const INVALID_RESET_CODE_MESSAGE =
  'That code is incorrect or has expired.';

export const INVALID_RESET_TOKEN_MESSAGE =
  'This reset session is invalid or has expired.';

export function parseDurationToMs(value: string): number {
  const match = /^(\d+)([smhd])$/.exec(value);

  if (!match) {
    return 15 * 60 * 1000;
  }

  const amount = Number(match[1]);
  const unit = match[2];
  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  return amount * (multipliers[unit] ?? 60 * 1000);
}

export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: string }).code === '23505'
  );
}
