import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function FormField({
  label,
  htmlFor,
  error,
  className,
  layout = "stacked",
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  className?: string;
  layout?: "stacked" | "horizontal";
  children: React.ReactNode;
}) {
  if (layout === "horizontal") {
    return (
      <div
        className={cn(
          "grid grid-cols-1 items-start gap-1.5 sm:grid-cols-[148px_minmax(0,1fr)] sm:items-center sm:gap-4",
          className,
        )}
      >
        <Label
          htmlFor={htmlFor}
          className="font-normal text-[15px] text-[#3d3d3d] sm:justify-end sm:text-right dark:text-foreground"
        >
          {label}
        </Label>
        <div className="min-w-0 space-y-1">
          {children}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
