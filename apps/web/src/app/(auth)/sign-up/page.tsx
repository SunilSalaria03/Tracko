import { SignUpForm } from "@/components/auth/sign-up-form";

export default function SignUpPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#fcf8f2] px-6 py-8 dark:bg-background">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 right-0 h-80 w-80 rounded-full bg-[#f8e6d4] blur-3xl dark:hidden"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-24 left-0 h-72 w-72 rounded-full bg-[#f6ead8] blur-3xl dark:hidden"
      />
      <div className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <SignUpForm />
      </div>
    </div>
  );
}
