"use client";

import { Check } from "lucide-react";

export function AuthNotice({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) {
  return (
    <div className="flex w-full max-w-[440px] items-center gap-2 rounded-sm border border-[#b7dfc1] bg-[#e7f4ea] px-4 py-3 text-sm text-[#1e4620] dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
      <Check className="size-4 shrink-0 text-[#188433] dark:text-emerald-400" />
      <p className="flex-1">{message}</p>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 text-[#2d6ec8] underline-offset-2 hover:underline"
      >
        Dismiss
      </button>
    </div>
  );
}
