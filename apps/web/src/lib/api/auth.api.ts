import { apiFetch, parseJson } from "@/lib/api/client";
import type { PublicUser } from "@/lib/auth/types";

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
): Promise<PublicUser> {
  const response = await apiFetch("/api/auth/google", {
    method: "POST",
    body: JSON.stringify({ accessToken }),
  });

  return parseJson<PublicUser>(response);
}

export async function signInWithDummyGoogle(): Promise<PublicUser> {
  const response = await apiFetch("/api/auth/google/dummy", {
    method: "POST",
  });

  return parseJson<PublicUser>(response);
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
