"use client";

import { SetPasswordForm } from "@/components/settings/set-password-form";
import { useCurrentUser } from "@/lib/auth/use-current-user";

export default function SettingsPage() {
  const { data: user } = useCurrentUser();

  if (!user) {
    return null;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-muted-foreground">{user.email}</p>
      </div>

      <section className="rounded-xl border bg-card p-5">
        <h2 className="text-lg font-medium">Sign-in methods</h2>
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
          <li>
            Email and password:{" "}
            {user.hasPassword ? "enabled" : "not set"}
          </li>
          <li>
            Google: {user.hasGoogle ? "connected" : "not connected"}
          </li>
        </ul>
        {user.hasPassword && !user.hasGoogle ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Sign out, then use Continue with Google on the sign-in page with the
            same verified email. TRACKO will link Google to this account.
          </p>
        ) : null}
      </section>

      <section className="rounded-xl border bg-card p-5">
        <h2 className="text-lg font-medium">Password</h2>
        {user.hasGoogle && !user.hasPassword ? (
          <>
            <p className="mt-1 mb-4 text-sm text-muted-foreground">
              Add a password to this account so you can also sign in with email.
              Continue with Google will still work.
            </p>
            <SetPasswordForm />
          </>
        ) : user.hasPassword ? (
          <p className="mt-1 text-sm text-muted-foreground">
            Email and password sign-in is enabled
            {user.hasGoogle ? ", and you can also continue with Google" : ""}.
          </p>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">
            Sign in with Google, then set a password here to also use email.
          </p>
        )}
      </section>
    </div>
  );
}
