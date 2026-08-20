"use client";

import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { Clock, FolderKanban, LayoutDashboard, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/timesheet", label: "Timesheet", icon: Clock },
  { href: "/projects", label: "Projects", icon: FolderKanban, adminOnly: true },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppSidebar({
  open,
  onNavigate,
}: {
  open: boolean;
  onNavigate: () => void;
}) {
  const pathname = usePathname();
  const { data: user } = useCurrentUser();

  return (
    <aside
      className={cn(
        "fixed top-14 bottom-0 left-0 z-40 w-56 border-r bg-background p-3 transition-transform duration-200 lg:static lg:z-0 lg:translate-x-0",
        open ? "translate-x-0" : "-translate-x-full",
      )}
    >
      <nav className="space-y-1">
        {items
          .filter((item) => !item.adminOnly || user?.role === "ADMIN")
          .map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-muted",
                active && "bg-muted font-medium",
              )}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
