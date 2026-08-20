"use client";

import { AuthDivider, GoogleAuthButton } from "@/components/auth/google-auth-button";
import { AuthLegalLinks } from "@/components/auth/auth-legal-links";
import { AuthNotice } from "@/components/auth/auth-notice";
import {
  authInputClassName,
  authLinkClassName,
  authPrimaryButtonClassName,
} from "@/components/auth/auth-styles";
import { PasswordInput } from "@/components/auth/password-input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { TrackoLogo } from "@/components/brand/tracko-logo";
import { signIn } from "@/lib/api/auth.api";
import { ApiError } from "@/lib/api/client";
import { currentUserQueryKey } from "@/lib/auth/types";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { signInSchema, type SignInValues } from "@/lib/validations/auth";
import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

export function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { data: currentUser } = useCurrentUser();
  const [notice, setNotice] = useState<string | null>(() => {
    if (searchParams.get("signedOut") === "1") {
      return "You have been signed out.";
    }
    if (searchParams.get("registered") === "1") {
      return "Account created. Please sign in.";
    }
    if (searchParams.get("passwordSet") === "1") {
      return "Password saved. Please sign in.";
    }
    return null;
  });
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  useEffect(() => {
    if (currentUser) {
      router.replace("/dashboard");
    }
  }, [currentUser, router]);

  async function onSubmit(values: SignInValues) {
    setServerError(null);

    try {
      const user = await signIn(values);
      queryClient.setQueryData(currentUserQueryKey, user);
      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      setServerError(
        error instanceof ApiError
          ? error.message
          : "Unable to sign in. Please try again.",
      );
    }
  }

  return (
    <div className="flex w-full max-w-[440px] flex-col items-center">
      <TrackoLogo className="mb-8" />
      <h1 className="mb-6 text-center text-[32px] font-bold tracking-tight text-[#222] dark:text-foreground">
        Sign in to TRACKO
      </h1>

      {notice ? (
        <div className="mb-5 w-full">
          <AuthNotice message={notice} onDismiss={() => setNotice(null)} />
        </div>
      ) : null}

      <div className="w-full rounded-lg border border-[#f0d5b8] bg-[#fdf4ea] p-8 dark:border-border dark:bg-card">
        {serverError ? (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        ) : null}

        <GoogleAuthButton
          label="Sign in with Google"
          onError={setServerError}
        />

        <AuthDivider text="or with your email below" />

        <form className="space-y-3" onSubmit={handleSubmit(onSubmit)}>

          <div>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="Email"
              aria-label="Email"
              aria-invalid={!!errors.email}
              className={authInputClassName}
              {...register("email")}
            />
            {errors.email ? (
              <p className="mt-1 text-sm text-destructive">
                {errors.email.message}
              </p>
            ) : null}
          </div>

          <div>
            <PasswordInput
              id="password"
              autoComplete="current-password"
              placeholder="Password"
              aria-label="Password"
              aria-invalid={!!errors.password}
              className={authInputClassName}
              {...register("password")}
            />
            {errors.password ? (
              <p className="mt-1 text-sm text-destructive">
                {errors.password.message}
              </p>
            ) : null}
          </div>

          <button
            type="submit"
            className={cn("mt-2", authPrimaryButtonClassName)}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="mt-4 text-center text-[13px]">
          <Link href="/forgot-password" className="text-[#8a8a8a] hover:underline">
            Forgot password?
          </Link>
        </p>
      </div>

      <p className="mt-6 text-[15px] text-[#3d3d3d] dark:text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link href="/sign-up" className={authLinkClassName}>
          Sign up for free
        </Link>
      </p>

      <div className="mt-10">
        <AuthLegalLinks />
      </div>
    </div>
  );
}
