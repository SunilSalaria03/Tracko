"use client";

import { signOut } from "@/lib/api/auth.api";
import { currentUserQueryKey, type PublicUser } from "@/lib/auth/types";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";

export function UserMenu({ user }: { user: PublicUser }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const initials = `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase();

  async function handleLogout() {
    try {
      await signOut();
    } finally {
      queryClient.setQueryData(currentUserQueryKey, null);
      await queryClient.invalidateQueries({ queryKey: currentUserQueryKey });
      router.push("/sign-in?signedOut=1");
      router.refresh();
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-muted">
        <Avatar size="sm">
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <span className="hidden text-sm font-medium sm:inline">
          {user.firstName}
        </span>
        <ChevronDown className="size-4 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        <DropdownMenuItem disabled>Profile</DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push("/settings")}>
          Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => void handleLogout()}>
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
