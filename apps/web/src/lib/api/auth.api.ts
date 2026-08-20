import { apiFetch, parseJson } from "@/lib/api/client";
import type { GoogleAuthResponse, PublicUser } from "@/lib/auth/types";

export type SignUpInput = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
};

export type SignInInput = {
  email: string;
  password: string;
};

export async function signUp(input: SignUpInput): Promise<PublicUser> {
  const response = await apiFetch("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify(input),
  });

  return parseJson<PublicUser>(response);
}

export async function signIn(input: SignInInput): Promise<PublicUser> {
  const response = await apiFetch("/api/auth/signin", {
    method: "POST",
    body: JSON.stringify(input),
  });

  return parseJson<PublicUser>(response);
}

export async function signInWithGoogle(
  accessToken: string,
): Promise<GoogleAuthResponse> {
  const response = await apiFetch("/api/auth/google", {
    method: "POST",
    body: JSON.stringify({ accessToken }),
  });

  return parseJson<GoogleAuthResponse>(response);
}

export async function signInWithDummyGoogle(): Promise<GoogleAuthResponse> {
  const response = await apiFetch("/api/auth/google/dummy", {
    method: "POST",
  });

  return parseJson<GoogleAuthResponse>(response);
}

export async function setPassword(password: string): Promise<PublicUser> {
  const response = await apiFetch("/api/auth/set-password", {
    method: "POST",
    body: JSON.stringify({ password }),
  });

  return parseJson<PublicUser>(response);
}

export async function requestPasswordReset(
  email: string,
): Promise<{ ok: true; devCode?: string }> {
  const response = await apiFetch("/api/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });

  return parseJson<{ ok: true; devCode?: string }>(response);
}

export async function verifyResetCode(
  email: string,
  code: string,
): Promise<{ resetToken: string }> {
  const response = await apiFetch("/api/auth/verify-reset-code", {
    method: "POST",
    body: JSON.stringify({ email, code }),
  });

  return parseJson<{ resetToken: string }>(response);
}

export async function resetPassword(
  resetToken: string,
  password: string,
): Promise<{ ok: true }> {
  const response = await apiFetch("/api/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ resetToken, password }),
  });

  return parseJson<{ ok: true }>(response);
}

export async function getCurrentUser(): Promise<PublicUser | null> {
  const response = await apiFetch("/api/auth/me");

  if (response.status === 401) {
    return null;
  }

  return parseJson<PublicUser>(response);
}

export async function signOut(): Promise<void> {
  const response = await apiFetch("/api/auth/logout", {
    method: "POST",
  });

  await parseJson<{ ok: true }>(response);
}
