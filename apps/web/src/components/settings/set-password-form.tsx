"use client";

import { FormField } from "@/components/auth/form-field";
import {
  authInputClassName,
  authPrimaryButtonClassName,
} from "@/components/auth/auth-styles";
import { PasswordInput } from "@/components/auth/password-input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { setPassword } from "@/lib/api/auth.api";
import { ApiError } from "@/lib/api/client";
import { currentUserQueryKey } from "@/lib/auth/types";
import {
  setPasswordSchema,
  type SetPasswordValues,
} from "@/lib/validations/auth";
import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";

export function SetPasswordForm() {
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SetPasswordValues>({
    resolver: zodResolver(setPasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  async function onSubmit(values: SetPasswordValues) {
    setServerError(null);

    try {
      const user = await setPassword(values.password);
      queryClient.setQueryData(currentUserQueryKey, user);
    } catch (error) {
      setServerError(
        error instanceof ApiError
          ? error.message
          : "Unable to set a password. Please try again.",
      );
    }
  }

  return (
    <form className="max-w-md space-y-4" onSubmit={handleSubmit(onSubmit)}>
      {serverError ? (
        <Alert variant="destructive">
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      ) : null}

      <FormField
        label="Password"
        htmlFor="password"
        error={errors.password?.message}
      >
        <PasswordInput
          id="password"
          autoComplete="new-password"
          aria-invalid={!!errors.password}
          className={authInputClassName}
          {...register("password")}
        />
      </FormField>

      <FormField
        label="Confirm password"
        htmlFor="confirmPassword"
        error={errors.confirmPassword?.message}
      >
        <PasswordInput
          id="confirmPassword"
          autoComplete="new-password"
          aria-invalid={!!errors.confirmPassword}
          className={authInputClassName}
          {...register("confirmPassword")}
        />
      </FormField>

      <button
        type="submit"
        className={cn("mt-2", authPrimaryButtonClassName)}
        disabled={isSubmitting}
      >
        {isSubmitting ? "Saving..." : "Set password"}
      </button>
    </form>
  );
}
