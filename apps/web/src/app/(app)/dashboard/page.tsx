"use client";

import { useCurrentUser } from "@/lib/auth/use-current-user";

export default function DashboardPage() {
  const { data: user } = useCurrentUser();

  if (!user) {
    return null;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-3xl font-semibold tracking-tight">
        Welcome to TRACKO
      </h1>
      <p className="text-lg text-muted-foreground">
        Hi {user.firstName}, you&apos;re successfully signed in.
      </p>
    </div>
  );
}
