"use client";

import { AuthDivider, GoogleAuthButton } from "@/components/auth/google-auth-button";
import { FormField } from "@/components/auth/form-field";
import {
  authInputClassName,
  authLinkClassName,
  authPrimaryButtonClassName,
} from "@/components/auth/auth-styles";
import { PasswordInput } from "@/components/auth/password-input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { TrackoLogo } from "@/components/brand/tracko-logo";
import { signUp } from "@/lib/api/auth.api";
import { ApiError } from "@/lib/api/client";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { signUpSchema, type SignUpValues } from "@/lib/validations/auth";
import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

export function SignUpForm() {
  const router = useRouter();
  const { data: currentUser } = useCurrentUser();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      password: "",
    },
  });

  useEffect(() => {
    if (currentUser) {
      router.replace("/dashboard");
    }
  }, [currentUser, router]);

  async function onSubmit(values: SignUpValues) {
    setServerError(null);

    try {
      await signUp(values);
      router.push("/sign-in?registered=1");
    } catch (error) {
      setServerError(
        error instanceof ApiError
          ? error.message
          : "Unable to create your account. Please try again.",
      );
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[520px] flex-col">
      <TrackoLogo className="mb-10 self-start" />

      <h1 className="text-[32px] font-bold tracking-tight text-[#222] dark:text-foreground">
        Create your account
      </h1>
      <p className="mt-1 mb-8 text-[16px] text-[#6b6b6b] dark:text-muted-foreground">
        Start tracking your work and timesheets.
      </p>

      {serverError ? (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      ) : null}

      <GoogleAuthButton
        label="Sign up with Google"
        onError={setServerError}
      />

      <div className="my-5">
        <AuthDivider text="or with your email below" />
      </div>

      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>

        <FormField
          label="First name"
          htmlFor="firstName"
          error={errors.firstName?.message}
          layout="horizontal"
        >
          <Input
            id="firstName"
            autoComplete="given-name"
            aria-invalid={!!errors.firstName}
            className={authInputClassName}
            {...register("firstName")}
          />
        </FormField>

        <FormField
          label="Last name"
          htmlFor="lastName"
          error={errors.lastName?.message}
          layout="horizontal"
        >
          <Input
            id="lastName"
            autoComplete="family-name"
            aria-invalid={!!errors.lastName}
            className={authInputClassName}
            {...register("lastName")}
          />
        </FormField>

        <FormField
          label="Work email"
          htmlFor="email"
          error={errors.email?.message}
          layout="horizontal"
        >
          <Input
            id="email"
            type="email"
            autoComplete="email"
            aria-invalid={!!errors.email}
            className={authInputClassName}
            {...register("email")}
          />
        </FormField>

        <FormField
          label="Password"
          htmlFor="password"
          error={errors.password?.message}
          layout="horizontal"
        >
          <PasswordInput
            id="password"
            autoComplete="new-password"
            aria-invalid={!!errors.password}
            className={authInputClassName}
            {...register("password")}
          />
        </FormField>

        <button
          type="submit"
          className={cn("mt-2", authPrimaryButtonClassName)}
          disabled={isSubmitting}
        >
          {isSubmitting ? "Creating account..." : "Create my account"}
        </button>
      </form>

      <p className="mt-6 text-center text-[15px] text-[#3d3d3d] dark:text-muted-foreground">
        Already a TRACKO customer?{" "}
        <Link href="/sign-in" className={authLinkClassName}>
          Sign in
        </Link>
      </p>

      <p className="mt-8 text-center text-[13px] text-[#8a8a8a]">
        By creating an account, you agree to our{" "}
        <Link href="#" className={authLinkClassName}>
          Terms of service
        </Link>{" "}
        and{" "}
        <Link href="#" className={authLinkClassName}>
          Privacy policy
        </Link>
        .
      </p>
    </div>
  );
}
