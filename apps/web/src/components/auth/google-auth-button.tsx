"use client";

import { signInWithDummyGoogle, signInWithGoogle } from "@/lib/api/auth.api";
import { ApiError } from "@/lib/api/client";
import { currentUserQueryKey } from "@/lib/auth/types";
import { useGoogleLogin } from "@react-oauth/google";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";

function GoogleIcon() {
  return (
    <svg className="size-5" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function DummyGoogleAuthButton({
  label,
  onError,
}: {
  label: string;
  onError: (message: string) => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);

  async function handleDummyGoogle() {
    setPending(true);
    onError("");

    try {
      const user = await signInWithDummyGoogle();
      queryClient.setQueryData(currentUserQueryKey, user);
      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      onError(
        error instanceof ApiError
          ? error.message
          : "Unable to continue with dummy Google. Please try again.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => void handleDummyGoogle()}
        className="inline-flex h-11 w-full items-center justify-center gap-3 rounded-md border border-[#dadce0] bg-white text-[15px] font-medium text-[#3c4043] transition-colors hover:bg-[#f7f8f8] disabled:opacity-70 dark:border-border dark:bg-background dark:text-foreground dark:hover:bg-muted"
      >
        <GoogleIcon />
        {pending ? "Connecting..." : label}
      </button>
      <p className="text-center text-[12px] text-[#8a8a8a]">
        Local dummy Google account: dummy.google@tracko.local
      </p>
    </div>
  );
}

function EnabledGoogleAuthButton({
  label,
  onError,
}: {
  label: string;
  onError: (message: string) => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);

  const startGoogleLogin = useGoogleLogin({
    flow: "implicit",
    scope: "openid email profile",
    onSuccess: async (tokenResponse) => {
      setPending(true);
      onError("");

      try {
        const user = await signInWithGoogle(tokenResponse.access_token);
        queryClient.setQueryData(currentUserQueryKey, user);
        router.push("/dashboard");
        router.refresh();
      } catch (error) {
        onError(
          error instanceof ApiError
            ? error.message
            : "Unable to continue with Google. Please try again.",
        );
      } finally {
        setPending(false);
      }
    },
    onError: () => {
      onError("Google sign-in was cancelled or failed.");
    },
  });

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startGoogleLogin()}
      className="inline-flex h-11 w-full items-center justify-center gap-3 rounded-md border border-[#dadce0] bg-white text-[15px] font-medium text-[#3c4043] transition-colors hover:bg-[#f7f8f8] disabled:opacity-70 dark:border-border dark:bg-background dark:text-foreground dark:hover:bg-muted"
    >
      <GoogleIcon />
      {pending ? "Connecting..." : label}
    </button>
  );
}

export function GoogleAuthButton({
  label,
  onError,
}: {
  label: string;
  onError: (message: string) => void;
}) {
  if (!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID) {
    return <DummyGoogleAuthButton label={label} onError={onError} />;
  }

  return <EnabledGoogleAuthButton label={label} onError={onError} />;
}

export function AuthDivider({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <span className="h-px flex-1 bg-[#dadce0] dark:bg-border" />
      <span className="text-[13px] text-[#5f6368] dark:text-muted-foreground">
        {text}
      </span>
      <span className="h-px flex-1 bg-[#dadce0] dark:bg-border" />
    </div>
  );
}
