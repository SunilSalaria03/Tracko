"use client";

import { FormField } from "@/components/auth/form-field";
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
import {
  requestPasswordReset,
  resetPassword,
  verifyResetCode,
} from "@/lib/api/auth.api";
import { ApiError } from "@/lib/api/client";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import {
  forgotPasswordSchema,
  setPasswordSchema,
  verifyResetCodeSchema,
  type ForgotPasswordValues,
  type SetPasswordValues,
  type VerifyResetCodeValues,
} from "@/lib/validations/auth";
import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

type Step = "email" | "verify" | "password";

export function ForgotPasswordForm() {
  const router = useRouter();
  const { data: currentUser } = useCurrentUser();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const emailForm = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });
  const codeForm = useForm<VerifyResetCodeValues>({
    resolver: zodResolver(verifyResetCodeSchema),
    defaultValues: { code: "" },
  });
  const passwordForm = useForm<SetPasswordValues>({
    resolver: zodResolver(setPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  useEffect(() => {
    if (currentUser) {
      router.replace("/dashboard");
    }
  }, [currentUser, router]);

  async function onRequestCode(values: ForgotPasswordValues) {
    setServerError(null);

    try {
      const result = await requestPasswordReset(values.email);
      setEmail(values.email.trim().toLowerCase());
      setDevCode(result.devCode ?? null);
      codeForm.reset({ code: "" });
      setStep("verify");
    } catch (error) {
      setServerError(
        error instanceof ApiError
          ? error.message
          : "Unable to send a verification code. Please try again.",
      );
    }
  }

  async function onVerifyCode(values: VerifyResetCodeValues) {
    setServerError(null);

    try {
      const result = await verifyResetCode(email, values.code);
      setResetToken(result.resetToken);
      passwordForm.reset({ password: "", confirmPassword: "" });
      setStep("password");
    } catch (error) {
      setServerError(
        error instanceof ApiError
          ? error.message
          : "Unable to verify that code. Please try again.",
      );
    }
  }

  async function onCreatePassword(values: SetPasswordValues) {
    if (!resetToken) {
      setServerError("Start again from your email.");
      setStep("email");
      return;
    }

    setServerError(null);

    try {
      await resetPassword(resetToken, values.password);
      router.push("/sign-in?passwordSet=1");
    } catch (error) {
      setServerError(
        error instanceof ApiError
          ? error.message
          : "Unable to save your password. Please try again.",
      );
    }
  }

  const title =
    step === "email"
      ? "Forgot password"
      : step === "verify"
        ? "Verify your email"
        : "Create a password";

  const subtitle =
    step === "email"
      ? "Enter the email on your TRACKO account. We will send a 6-digit code."
      : step === "verify"
        ? `Enter the 6-digit code sent to ${email}.`
        : "Choose a password so you can also sign in with email.";

  return (
    <div className="flex w-full max-w-[440px] flex-col items-center">
      <TrackoLogo className="mb-8" />
      <h1 className="mb-2 text-center text-[32px] font-bold tracking-tight text-[#222] dark:text-foreground">
        {title}
      </h1>
      <p className="mb-6 text-center text-[15px] text-[#6b6b6b] dark:text-muted-foreground">
        {subtitle}
      </p>

      {devCode && step === "verify" ? (
        <div className="mb-5 w-full">
          <AuthNotice
            message={`Local development code: ${devCode}`}
            onDismiss={() => setDevCode(null)}
          />
        </div>
      ) : null}

      <div className="w-full rounded-lg border border-[#f0d5b8] bg-[#fdf4ea] p-8 dark:border-border dark:bg-card">
        {serverError ? (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        ) : null}

        {step === "email" ? (
          <form
            className="space-y-4"
            onSubmit={emailForm.handleSubmit(onRequestCode)}
          >
            <FormField
              label="Email"
              htmlFor="email"
              error={emailForm.formState.errors.email?.message}
            >
              <Input
                id="email"
                type="email"
                autoComplete="email"
                className={authInputClassName}
                aria-invalid={!!emailForm.formState.errors.email}
                {...emailForm.register("email")}
              />
            </FormField>
            <button
              type="submit"
              className={authPrimaryButtonClassName}
              disabled={emailForm.formState.isSubmitting}
            >
              {emailForm.formState.isSubmitting
                ? "Sending..."
                : "Send verification code"}
            </button>
          </form>
        ) : null}

        {step === "verify" ? (
          <form
            className="space-y-4"
            onSubmit={codeForm.handleSubmit(onVerifyCode)}
          >
            <FormField
              label="Verification code"
              htmlFor="code"
              error={codeForm.formState.errors.code?.message}
            >
              <Input
                id="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="000000"
                className={cn(authInputClassName, "tracking-[0.4em]")}
                aria-invalid={!!codeForm.formState.errors.code}
                {...codeForm.register("code")}
              />
            </FormField>
            <button
              type="submit"
              className={authPrimaryButtonClassName}
              disabled={codeForm.formState.isSubmitting}
            >
              {codeForm.formState.isSubmitting ? "Verifying..." : "Verify email"}
            </button>
            <button
              type="button"
              className="w-full text-center text-sm text-[#2d6ec8] hover:underline"
              onClick={() => {
                setServerError(null);
                setStep("email");
              }}
            >
              Use a different email
            </button>
          </form>
        ) : null}

        {step === "password" ? (
          <form
            className="space-y-4"
            onSubmit={passwordForm.handleSubmit(onCreatePassword)}
          >
            <FormField
              label="Password"
              htmlFor="password"
              error={passwordForm.formState.errors.password?.message}
            >
              <PasswordInput
                id="password"
                autoComplete="new-password"
                className={authInputClassName}
                aria-invalid={!!passwordForm.formState.errors.password}
                {...passwordForm.register("password")}
              />
            </FormField>
            <FormField
              label="Confirm password"
              htmlFor="confirmPassword"
              error={passwordForm.formState.errors.confirmPassword?.message}
            >
              <PasswordInput
                id="confirmPassword"
                autoComplete="new-password"
                className={authInputClassName}
                aria-invalid={!!passwordForm.formState.errors.confirmPassword}
                {...passwordForm.register("confirmPassword")}
              />
            </FormField>
            <button
              type="submit"
              className={authPrimaryButtonClassName}
              disabled={passwordForm.formState.isSubmitting}
            >
              {passwordForm.formState.isSubmitting
                ? "Saving..."
                : "Create password"}
            </button>
          </form>
        ) : null}
      </div>

      <p className="mt-6 text-[15px] text-[#3d3d3d] dark:text-muted-foreground">
        Remember your password?{" "}
        <Link href="/sign-in" className={authLinkClassName}>
          Sign in
        </Link>
      </p>
    </div>
  );
}
