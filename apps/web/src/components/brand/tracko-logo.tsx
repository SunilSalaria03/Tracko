import { cn } from "@/lib/utils";
import Link from "next/link";

export function TrackoLogo({
  className,
  href = "/sign-in",
}: {
  className?: string;
  href?: string;
}) {
  return (
    <Link
      href={href}
      className={cn("inline-flex items-center gap-2", className)}
    >
      <span className="flex h-5 items-end gap-[3px]" aria-hidden>
        <span className="h-3 w-[5px] rounded-[1px] bg-[#fa5d00]" />
        <span className="h-4 w-[5px] rounded-[1px] bg-[#fa5d00]" />
        <span className="h-[20px] w-[5px] rounded-[1px] bg-[#fa5d00]" />
      </span>
      <span className="text-[22px] font-semibold leading-none tracking-tight text-[#3d3d3d] dark:text-foreground">
        tracko
      </span>
    </Link>
  );
}
