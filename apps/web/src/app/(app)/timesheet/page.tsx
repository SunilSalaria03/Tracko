import { TimesheetPanel } from "@/components/timesheet/timesheet-panel";
import { Suspense } from "react";

export default function TimesheetPage() {
  return (
    <Suspense
      fallback={
        <p className="text-sm text-muted-foreground">Loading timesheet…</p>
      }
    >
      <TimesheetPanel />
    </Suspense>
  );
}
