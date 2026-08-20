"use client";

import { AuthNotice } from "@/components/auth/auth-notice";
import { Input } from "@/components/ui/input";
import {
  listProjects,
  listTasks,
  projectsQueryKey,
  tasksQueryKey,
} from "@/lib/api/masters.api";
import {
  listTimesheetEntries,
  timesheetEntriesQueryKey,
  type TimesheetEntry,
} from "@/lib/api/timesheet.api";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import {
  formatClock,
  formatLongDate,
  formatMonthYear,
  formatShortDate,
  getMonthRange,
  getPreviousMonthRange,
  getPreviousWeekRange,
  getWeekRange,
  toIsoDate,
} from "@/lib/dates";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FolderKanban,
  History,
  ListTodo,
  Search,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 300;

export function DashboardPanel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: user } = useCurrentUser();
  const [notice, setNotice] = useState<string | null>(() =>
    searchParams.get("googleLinked") === "1"
      ? "Google is now linked to this account. You can sign in with email or Google."
      : null,
  );
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const todayIso = toIsoDate();
  const thisWeek = useMemo(() => getWeekRange(todayIso), [todayIso]);
  const lastWeek = useMemo(() => getPreviousWeekRange(todayIso), [todayIso]);
  const thisMonth = useMemo(() => getMonthRange(todayIso), [todayIso]);
  const lastMonth = useMemo(() => getPreviousMonthRange(todayIso), [todayIso]);

  const summaryFrom = lastMonth.from;
  const summaryTo = thisWeek.to > thisMonth.to ? thisWeek.to : thisMonth.to;

  const summaryQuery = useQuery({
    queryKey: timesheetEntriesQueryKey({
      from: summaryFrom,
      to: summaryTo,
    }),
    queryFn: () =>
      listTimesheetEntries({ from: summaryFrom, to: summaryTo }),
    enabled: Boolean(user),
  });

  const tableQueryInput = {
    from: thisMonth.from,
    to: thisMonth.to,
    search: debouncedSearch || undefined,
    page,
    pageSize: PAGE_SIZE,
  };

  const tableQuery = useQuery({
    queryKey: timesheetEntriesQueryKey(tableQueryInput),
    queryFn: () => listTimesheetEntries(tableQueryInput),
    enabled: Boolean(user),
    placeholderData: (previous) => previous,
  });

  const isAdmin = user?.role === "ADMIN";

  const projectsQuery = useQuery({
    queryKey: projectsQueryKey,
    queryFn: listProjects,
    enabled: Boolean(user) && isAdmin,
  });

  const tasksQuery = useQuery({
    queryKey: tasksQueryKey(),
    queryFn: () => listTasks(),
    enabled: Boolean(user) && isAdmin,
  });

  const summaryEntries = summaryQuery.data?.items ?? [];

  const sumInRange = (from: string, to: string) =>
    summaryEntries.reduce((total, entry) => {
      if (entry.entryDate >= from && entry.entryDate <= to) {
        return total + entry.hours;
      }
      return total;
    }, 0);

  const hoursThisWeek = sumInRange(thisWeek.from, thisWeek.to);
  const hoursLastWeek = sumInRange(lastWeek.from, lastWeek.to);
  const hoursThisMonth = sumInRange(thisMonth.from, thisMonth.to);
  const hoursLastMonth = sumInRange(lastMonth.from, lastMonth.to);
  const hoursToday = sumInRange(todayIso, todayIso);

  const pageEntries = tableQuery.data?.items ?? [];
  const totalRows = tableQuery.data?.total ?? 0;
  const filteredHours = tableQuery.data?.totalHours ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = totalRows === 0 ? 0 : (currentPage - 1) * PAGE_SIZE;

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const activeProjects =
    projectsQuery.data?.filter((project) => project.isActive).length ?? 0;
  const activeTasks =
    tasksQuery.data?.filter((task) => task.isActive).length ?? 0;

  if (!user) {
    return null;
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8">
      {notice ? (
        <AuthNotice
          message={notice}
          onDismiss={() => {
            setNotice(null);
            router.replace("/dashboard");
          }}
        />
      ) : null}

      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Hi {user.firstName}
        </h1>
        <p className="text-sm text-muted-foreground">
          {formatLongDate(todayIso)}
        </p>
        <p className="text-base text-foreground">
          {hoursToday > 0
            ? `You've logged ${formatClock(hoursToday)} today`
            : "No time logged today"}
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">
          Hours overview
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="This week"
            value={formatClock(hoursThisWeek)}
            loading={summaryQuery.isLoading}
            icon={<Clock3 className="size-5" />}
            tone="green"
          />
          <MetricCard
            label="Last week"
            value={formatClock(hoursLastWeek)}
            loading={summaryQuery.isLoading}
            icon={<History className="size-5" />}
            tone="orange"
          />
          <MetricCard
            label="This month"
            value={formatClock(hoursThisMonth)}
            loading={summaryQuery.isLoading}
            icon={<CalendarDays className="size-5" />}
            tone="blue"
          />
          <MetricCard
            label="Last month"
            value={formatClock(hoursLastMonth)}
            loading={summaryQuery.isLoading}
            icon={<CalendarRange className="size-5" />}
            tone="slate"
          />
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-sm font-medium text-muted-foreground">
            {formatMonthYear(todayIso)} entries
          </h2>
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search project, task, notes…"
              aria-label="Search month entries"
              className="h-9 pl-8"
            />
          </div>
        </div>

        {tableQuery.isLoading && !tableQuery.data ? (
          <p className="text-sm text-muted-foreground">Loading entries…</p>
        ) : totalRows === 0 && !debouncedSearch ? (
          <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-8 text-center">
            <p className="text-sm text-muted-foreground">
              No entries this month yet
            </p>
          </div>
        ) : totalRows === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-8 text-center">
            <p className="text-sm text-muted-foreground">
              No entries match “{debouncedSearch}”
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Date</th>
                    <th className="px-4 py-2.5 font-medium">Project</th>
                    <th className="px-4 py-2.5 font-medium">Task</th>
                    <th className="px-4 py-2.5 font-medium">Notes</th>
                    <th className="px-4 py-2.5 text-right font-medium">Hours</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {pageEntries.map((entry) => (
                    <MonthEntryRow key={entry.id} entry={entry} />
                  ))}
                </tbody>
                <tfoot className="border-t border-border bg-muted/30">
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-2.5 text-sm font-medium text-foreground"
                    >
                      {debouncedSearch
                        ? `Filtered total (${totalRows})`
                        : "Month total"}
                    </td>
                    <td className="px-4 py-2.5 text-right text-sm font-semibold text-foreground">
                      {formatClock(
                        debouncedSearch ? filteredHours : hoursThisMonth,
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="flex flex-col gap-2 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                Showing {pageStart + 1}–
                {Math.min(pageStart + PAGE_SIZE, totalRows)} of {totalRows}
                {tableQuery.isFetching ? " · Updating…" : ""}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={currentPage <= 1 || tableQuery.isFetching}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  className="inline-flex h-8 items-center gap-1 rounded-md border border-border bg-background px-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-50 hover:bg-muted"
                >
                  <ChevronLeft className="size-4" />
                  Prev
                </button>
                <span className="min-w-16 text-center text-sm text-muted-foreground">
                  {currentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={currentPage >= totalPages || tableQuery.isFetching}
                  onClick={() =>
                    setPage((current) => Math.min(totalPages, current + 1))
                  }
                  className="inline-flex h-8 items-center gap-1 rounded-md border border-border bg-background px-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-50 hover:bg-muted"
                >
                  Next
                  <ChevronRight className="size-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      {isAdmin ? (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            Admin overview
          </h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <MetricCard
              label="Active projects"
              value={String(activeProjects)}
              loading={projectsQuery.isLoading}
              icon={<FolderKanban className="size-5" />}
              tone="green"
            />
            <MetricCard
              label="Active tasks"
              value={String(activeTasks)}
              loading={tasksQuery.isLoading}
              icon={<ListTodo className="size-5" />}
              tone="blue"
            />
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    Week approvals
                  </p>
                  <p className="mt-2 text-lg font-semibold text-foreground">
                    Coming soon
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Submit week for approval is not wired yet.
                  </p>
                </div>
                <span className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <History className="size-5" />
                </span>
              </div>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}

const toneStyles = {
  green: {
    icon: "bg-[#188433]/12 text-[#188433] dark:bg-[#3ecf6a]/15 dark:text-[#3ecf6a]",
    value: "text-[#14732c] dark:text-[#3ecf6a]",
  },
  orange: {
    icon: "bg-[#fa5d00]/12 text-[#fa5d00] dark:bg-[#fa5d00]/20 dark:text-[#ffb080]",
    value: "text-[#c44a00] dark:text-[#ffb080]",
  },
  blue: {
    icon: "bg-sky-500/12 text-sky-700 dark:bg-sky-400/15 dark:text-sky-300",
    value: "text-sky-800 dark:text-sky-300",
  },
  slate: {
    icon: "bg-muted text-muted-foreground",
    value: "text-foreground",
  },
} as const;

function MetricCard({
  label,
  value,
  loading,
  icon,
  tone = "slate",
}: {
  label: string;
  value: string;
  loading?: boolean;
  icon?: React.ReactNode;
  tone?: keyof typeof toneStyles;
}) {
  const styles = toneStyles[tone];

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm transition hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          {loading ? (
            <p className="mt-2 text-sm text-muted-foreground">…</p>
          ) : (
            <p
              className={cn(
                "mt-2 truncate text-2xl font-semibold tracking-tight tabular-nums",
                styles.value,
              )}
              title={value}
            >
              {value}
            </p>
          )}
        </div>
        {icon ? (
          <span
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-lg",
              styles.icon,
            )}
          >
            {icon}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function MonthEntryRow({ entry }: { entry: TimesheetEntry }) {
  return (
    <tr className="hover:bg-muted/40">
      <td className="px-4 py-2.5 whitespace-nowrap">
        <Link
          href={`/timesheet?date=${entry.entryDate}&view=day`}
          className="font-medium text-foreground hover:underline"
        >
          {formatShortDate(entry.entryDate)}
        </Link>
      </td>
      <td className="px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="size-2 shrink-0 rounded-full"
            style={{ backgroundColor: entry.projectColor }}
          />
          <span className="truncate">{entry.projectName}</span>
        </div>
      </td>
      <td className="max-w-[10rem] truncate px-4 py-2.5 text-muted-foreground">
        {entry.taskName}
      </td>
      <td className="max-w-[16rem] truncate px-4 py-2.5 text-muted-foreground">
        {entry.description.trim() || "—"}
      </td>
      <td className="px-4 py-2.5 text-right font-semibold tabular-nums">
        {formatClock(entry.hours)}
      </td>
    </tr>
  );
}
