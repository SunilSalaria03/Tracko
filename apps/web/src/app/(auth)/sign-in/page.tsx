import { SignInForm } from "@/components/auth/sign-in-form";
import { Suspense } from "react";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4 py-16 dark:bg-background">
      <Suspense>
        <SignInForm />
      </Suspense>
    </div>
  );
}
