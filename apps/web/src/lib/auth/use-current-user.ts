"use client";

import { getCurrentUser } from "@/lib/api/auth.api";
import { currentUserQueryKey } from "@/lib/auth/types";
import { useQuery } from "@tanstack/react-query";

export function useCurrentUser() {
  return useQuery({
    queryKey: currentUserQueryKey,
    queryFn: getCurrentUser,
    retry: false,
  });
}
