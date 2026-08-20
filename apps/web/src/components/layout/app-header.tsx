"use client";

import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/layout/user-menu";
import { Button } from "@/components/ui/button";
import type { PublicUser } from "@/lib/auth/types";
import { Menu, X } from "lucide-react";

export function AppHeader({
  user,
  sidebarOpen,
  onToggleSidebar,
}: {
  user: PublicUser;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}) {
  return (
    <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b bg-background px-4">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="lg:hidden"
          aria-label={sidebarOpen ? "Close menu" : "Open menu"}
          aria-expanded={sidebarOpen}
          onClick={onToggleSidebar}
        >
          {sidebarOpen ? <X /> : <Menu />}
        </Button>
        <p className="text-sm font-semibold tracking-[0.2em]">TRACKO</p>
      </div>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <UserMenu user={user} />
      </div>
    </header>
  );
}
