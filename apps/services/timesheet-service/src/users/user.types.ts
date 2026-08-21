export type UserRole = 'ADMIN' | 'EMPLOYEE';
export type AuthProvider = 'LOCAL' | 'GOOGLE';

export type PublicUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  hasPassword: boolean;
  hasGoogle: boolean;
};

export type UserRecord = PublicUser & {
  passwordHash: string | null;
  googleId: string | null;
  authProvider: AuthProvider;
};

export type GoogleSignInResult = {
  user: PublicUser;
  token: string;
  googleLinked: boolean;
};

export function toPublicUser(user: UserRecord): PublicUser {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role: user.role,
    hasPassword: user.passwordHash != null,
    hasGoogle: user.googleId != null,
  };
}
