import { z } from "zod";

/** Shared email rules for sign-up, sign-in, and password reset. */
export const EMAIL_MAX_LENGTH = 254;

const EMAIL_PATTERN =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export const emailSchema = z
  .string()
  .transform((value) => normalizeEmail(value))
  .pipe(
    z
      .string()
      .min(1, "Email is required")
      .max(EMAIL_MAX_LENGTH, `Email must be at most ${EMAIL_MAX_LENGTH} characters`)
      .refine((value) => !/\s/.test(value), {
        message: "Email cannot contain spaces",
      })
      .refine((value) => value.includes("@"), {
        message: "Email must include @",
      })
      .refine((value) => !value.includes(".."), {
        message: "Email cannot contain consecutive dots",
      })
      .refine((value) => {
        const [localPart] = value.split("@");
        return Boolean(localPart) && !localPart.startsWith(".") && !localPart.endsWith(".");
      }, {
        message: "Enter a valid email address",
      })
      .refine((value) => {
        const domain = value.split("@")[1] ?? "";
        return domain.includes(".") && !domain.startsWith(".") && !domain.endsWith(".");
      }, {
        message: "Email must include a valid domain",
      })
      .refine((value) => EMAIL_PATTERN.test(value), {
        message: "Enter a valid email address",
      }),
  );

export const signUpSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().min(1, "Last name is required"),
  email: emailSchema,
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[a-z]/, "Include a lowercase letter")
    .regex(/[A-Z]/, "Include an uppercase letter")
    .regex(/\d/, "Include a number")
    .regex(/[^A-Za-z0-9]/, "Include a special character"),
});

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
});

export type SignUpValues = z.infer<typeof signUpSchema>;
export type SignInValues = z.infer<typeof signInSchema>;

export const setPasswordSchema = z
  .object({
    password: signUpSchema.shape.password,
    confirmPassword: z.string().min(1, "Confirm your password"),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type SetPasswordValues = z.infer<typeof setPasswordSchema>;

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const verifyResetCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit code"),
});

export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;
export type VerifyResetCodeValues = z.infer<typeof verifyResetCodeSchema>;
