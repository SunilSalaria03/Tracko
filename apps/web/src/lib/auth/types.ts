export const AUTH_COOKIE_NAME = "tracko_token";
export const currentUserQueryKey = ["current-user"] as const;

export type PublicUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: "ADMIN" | "EMPLOYEE";
  hasPassword: boolean;
  hasGoogle: boolean;
};

export type GoogleAuthResponse = PublicUser & {
  googleLinked: boolean;
};
