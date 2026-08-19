import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/layout/user-menu";
import type { PublicUser } from "@/lib/auth/types";

export function AppHeader({ user }: { user: PublicUser }) {
  return (
    <header className="flex h-14 items-center justify-between border-b px-4">
      <p className="text-sm font-semibold tracking-[0.2em]">TRACKO</p>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <UserMenu user={user} />
      </div>
    </header>
  );
}
