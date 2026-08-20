"use client";

import { DashboardPanel } from "@/components/dashboard/dashboard-panel";
import { Suspense } from "react";

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <p className="text-sm text-muted-foreground">Loading dashboard…</p>
      }
    >
      <DashboardPanel />
    </Suspense>
  );
}
