"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  createTimesheetEntry,
  deleteTimesheetEntry,
  getTimesheetOptions,
  listTimesheetEntries,
  timesheetEntriesQueryKey,
  timesheetOptionsQueryKey,
  type TimesheetEntry,
  type TimesheetProjectOption,
  updateTimesheetEntry,
} from "@/lib/api/timesheet.api";
import { ApiError } from "@/lib/api/client";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type CalendarView = "day" | "week" | "month";

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const EMPTY_QUOTES = [
  {
    quote:
      "When the clock strikes two, three, and four, if the band slows down we'll yell for more.",
    author: "Bill Haley",
  },
  {
    quote: "Time is the wisest counselor of all.",
    author: "Pericles",
  },
  {
    quote: "Lost time is never found again.",
    author: "Benjamin Franklin",
  },
];

function parseViewParam(value: string | null): CalendarView | null {
  if (value === "day" || value === "week" || value === "month") {
    return value;
  }
  return null;
}

function parseDateParam(value: string | null): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  const date = parseIsoDate(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return toIsoDate(date);
}

export function TimesheetPanel() {
  const { data: user } = useCurrentUser();
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [view, setView] = useState<CalendarView>(
    () => parseViewParam(searchParams.get("view")) ?? "day",
  );
  const [anchorDate, setAnchorDate] = useState(
    () => parseDateParam(searchParams.get("date")) ?? toIsoDate(new Date()),
  );
  const [quickAdd, setQuickAdd] = useState("");
  const [entryDialog, setEntryDialog] = useState<TimesheetEntry | "new" | null>(
    null,
  );
  const [deleteTarget, setDeleteTarget] = useState<TimesheetEntry | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const nextView = parseViewParam(searchParams.get("view"));
    const nextDate = parseDateParam(searchParams.get("date"));
    const openNew = searchParams.get("new") === "1";

    if (nextView) {
      setView(nextView);
    }
    if (nextDate) {
      setAnchorDate(nextDate);
    }

    if (!openNew && !nextView && !nextDate) {
      return;
    }

    if (openNew) {
      const targetDate = nextDate ?? toIsoDate(new Date());
      if (targetDate > toIsoDate(new Date())) {
        setError("You cannot fill timesheet entries for future dates");
      } else {
        setError(null);
        setEntryDialog("new");
      }
    }

    if (openNew || nextView || nextDate) {
      router.replace("/timesheet", { scroll: false });
    }
  }, [searchParams, router]);

  const weekRange = useMemo(() => getRange(anchorDate, "week"), [anchorDate]);
  const monthRange = useMemo(() => getRange(anchorDate, "month"), [anchorDate]);
  const listRange = view === "month" ? monthRange : weekRange;

  const optionsQuery = useQuery({
    queryKey: timesheetOptionsQueryKey,
    queryFn: getTimesheetOptions,
    enabled: Boolean(user),
  });

  const entriesQuery = useQuery({
    queryKey: timesheetEntriesQueryKey({
      from: listRange.from,
      to: listRange.to,
    }),
    queryFn: () =>
      listTimesheetEntries({ from: listRange.from, to: listRange.to }),
    enabled: Boolean(user),
  });

  const upsertMutation = useMutation({
    mutationFn: async (input: {
      id?: string;
      projectId: string;
      taskId: string;
      entryDate: string;
      hours: number;
      description: string;
    }) => {
      const { id, ...payload } = input;
      if (id) {
        // Hours cannot be changed after an entry is created.
        const { hours: _hours, ...updatePayload } = payload;
        return updateTimesheetEntry(id, updatePayload);
      }
      return createTimesheetEntry(payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["timesheet"] });
      setEntryDialog(null);
      setQuickAdd("");
      setError(null);
    },
    onError: (err) => {
      setError(
        err instanceof ApiError
          ? err.message
          : "Unable to save the timesheet entry.",
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteTimesheetEntry,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["timesheet"] });
      setDeleteTarget(null);
      setError(null);
    },
    onError: (err) => {
      setError(
        err instanceof ApiError
          ? err.message
          : "Unable to delete the timesheet entry.",
      );
    },
  });

  const projects = useMemo(
    () => optionsQuery.data?.projects ?? [],
    [optionsQuery.data],
  );
  const entries = useMemo(
    () => entriesQuery.data?.items ?? [],
    [entriesQuery.data],
  );
  const groupedEntries = useMemo(() => groupEntries(entries), [entries]);
  const weekDays = useMemo(
    () => listVisibleDays(weekRange.from, weekRange.to),
    [weekRange.from, weekRange.to],
  );
  const monthCells = useMemo(() => buildMonthCells(anchorDate), [anchorDate]);
  const dayEntries = groupedEntries.get(anchorDate) ?? [];
  const weekTotal = sumHours(
    weekDays.flatMap((day) => groupedEntries.get(day) ?? []),
  );
  const todayIso = toIsoDate(new Date());
  const isToday = anchorDate === todayIso;
  const isFutureDay = anchorDate > todayIso;
  const emptyQuote = EMPTY_QUOTES[hashDate(anchorDate) % EMPTY_QUOTES.length];
  const openNewEntry = () => {
    if (isFutureDay) {
      setError("You cannot fill timesheet entries for future dates");
      return;
    }
    setError(null);
    setEntryDialog("new");
  };

  if (!user) {
    return null;
  }

  return (
    <div className="w-full min-w-0 max-w-full space-y-0">
      <div className="flex flex-col gap-4 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-[28px] font-semibold tracking-tight text-foreground">
          Timesheet
        </h1>
        <div className="inline-flex w-fit overflow-hidden rounded-md border border-border bg-card">
          {(
            [
              { id: "day", label: "Day" },
              { id: "week", label: "Week" },
              { id: "month", label: "Calendar" },
            ] as const
          ).map((mode) => (
            <button
              key={mode.id}
              type="button"
              onClick={() => setView(mode.id)}
              className={cn(
                "px-4 py-1.5 text-sm font-medium transition",
                view === mode.id
                  ? "bg-[#fae6d8] text-[#8a3b12] dark:bg-[#fa5d00]/25 dark:text-[#ffb080]"
                  : "bg-card text-muted-foreground hover:bg-muted",
              )}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <div className="pt-4">
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      ) : null}

      <div className="pt-5">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            aria-label="Add time entry"
            disabled={isFutureDay}
            onClick={openNewEntry}
            className={cn(
              "flex size-9 items-center justify-center rounded-md text-white shadow-sm transition",
              isFutureDay
                ? "cursor-not-allowed bg-[#188433]/50"
                : "bg-[#188433] hover:bg-[#14732c]",
            )}
          >
            <Plus className="size-5" />
          </button>

          <button
            type="button"
            aria-label="Previous period"
            onClick={() =>
              setAnchorDate(
                moveDate(anchorDate, view === "month" ? "month" : "day", -1),
              )
            }
            className="flex size-8 items-center justify-center rounded-md border border-border bg-card text-muted-foreground hover:bg-muted"
          >
            <ChevronLeft className="size-4" />
          </button>

          <button
            type="button"
            aria-label="Next period"
            onClick={() =>
              setAnchorDate(
                moveDate(anchorDate, view === "month" ? "month" : "day", 1),
              )
            }
            className="flex size-8 items-center justify-center rounded-md border border-border bg-card text-muted-foreground hover:bg-muted"
          >
            <ChevronRight className="size-4" />
          </button>

          <div className="flex items-center gap-2 text-[15px] font-medium text-foreground">
            <span>
              {isToday ? "Today " : ""}
              {formatHeaderDate(anchorDate, view)}
            </span>
            <CalendarDays className="size-4 text-muted-foreground" />
          </div>

          {!isToday ? (
            <button
              type="button"
              onClick={() => setAnchorDate(todayIso)}
              className="text-sm text-[#188433] hover:underline dark:text-[#3ecf6a]"
            >
              Return to today
            </button>
          ) : null}
        </div>

        {view !== "month" ? (
          <form
            className="mt-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (!quickAdd.trim()) {
                return;
              }
              openNewEntry();
            }}
          >
            <p className="mb-2 text-sm text-muted-foreground">
              What would you like to add to your timesheet?
            </p>
            <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 shadow-sm">
              <Input
                value={quickAdd}
                onChange={(event) => setQuickAdd(event.target.value)}
                placeholder="Try: 2 hours today on design work"
                disabled={isFutureDay}
                className="h-9 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
              />
              <button
                type="submit"
                aria-label="Open add entry"
                disabled={isFutureDay}
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full text-white transition",
                  isFutureDay
                    ? "cursor-not-allowed bg-[#fa5d00]/50"
                    : "bg-[#fa5d00] hover:bg-[#e05400]",
                )}
              >
                <ArrowRight className="size-4" />
              </button>
            </div>
          </form>
        ) : null}
      </div>

      {view !== "month" ? (
        <div className="mt-5 max-w-full overflow-x-auto overscroll-x-contain border-y border-border">
          <div className="flex min-w-[640px] items-stretch sm:min-w-0">
            {weekDays.map((day, index) => {
              const dayHours = sumHours(groupedEntries.get(day) ?? []);
              const selected = day === anchorDate;
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => {
                    setAnchorDate(day);
                    setView("day");
                  }}
                  className={cn(
                    "relative flex min-w-0 flex-1 flex-col items-start gap-1 px-3 py-3 text-left transition hover:bg-muted/60",
                    selected && "bg-card",
                  )}
                >
                  <span
                    className={cn(
                      "text-sm font-medium",
                      selected
                        ? "text-[#fa5d00]"
                        : "text-muted-foreground",
                    )}
                  >
                    {WEEKDAY_LABELS[index]}
                  </span>
                  <span className="inline-flex items-center gap-1 text-sm text-foreground">
                    <Clock3 className="size-3.5 text-muted-foreground" />
                    {formatClock(dayHours)}
                  </span>
                  {selected ? (
                    <span className="absolute inset-x-0 bottom-0 h-[3px] bg-[#fa5d00]" />
                  ) : null}
                </button>
              );
            })}
            <div className="flex w-[110px] shrink-0 flex-col justify-center border-l border-border px-3 py-3">
              <span className="text-xs text-muted-foreground">Week total</span>
              <span className="text-base font-semibold text-foreground">
                {formatClock(weekTotal)}
              </span>
            </div>
          </div>
        </div>
      ) : null}

      {view === "day" || view === "week" ? (
        <div className="min-h-[320px] bg-[#f6f1ea] dark:bg-muted/40">
          {dayEntries.length === 0 ? (
            <div className="flex min-h-[320px] items-center justify-center px-6 py-16">
              <blockquote className="max-w-xl text-center">
                <p className="text-[17px] leading-relaxed text-[#5c5348] dark:text-muted-foreground">
                  &ldquo;{emptyQuote.quote}&rdquo;
                </p>
                <footer className="mt-3 text-sm text-[#8a7f70] dark:text-muted-foreground/80">
                  — {emptyQuote.author}
                </footer>
              </blockquote>
            </div>
          ) : (
            <div className="min-w-0 overflow-x-hidden bg-card">
              {dayEntries.map((entry) => (
                <EntryRow
                  key={entry.id}
                  entry={entry}
                  onEdit={() => setEntryDialog(entry)}
                  onDelete={() => setDeleteTarget(entry)}
                />
              ))}
              <div className="flex items-center justify-end border-t border-border px-4 py-3 text-sm font-semibold text-foreground">
                Total: {formatClock(sumHours(dayEntries))}
              </div>
            </div>
          )}
        </div>
      ) : null}

      {view === "month" ? (
        <MonthCalendar
          cells={monthCells}
          groupedEntries={groupedEntries}
          anchorDate={anchorDate}
          onSelectDate={(date) => {
            setAnchorDate(date);
            setView("day");
          }}
        />
      ) : null}

      <div className="flex flex-col gap-3 border-t border-border bg-background py-4 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          className="inline-flex items-center justify-center gap-1 rounded-md border border-border bg-card px-3 py-2 text-sm text-muted-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isFutureDay}
          onClick={openNewEntry}
        >
          Copy from previous day
          <ChevronDown className="size-4" />
        </button>
        <button
          type="button"
          className="inline-flex items-center justify-center gap-1 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
        >
          Submit week for approval
          <ChevronDown className="size-4" />
        </button>
      </div>

      {entryDialog !== null ? (
        <EntryDialog
          key={
            entryDialog === "new"
              ? `new-${anchorDate}`
              : `edit-${entryDialog.id}`
          }
          entry={entryDialog === "new" ? null : entryDialog}
          defaultDate={
            entryDialog === "new"
              ? anchorDate > todayIso
                ? todayIso
                : anchorDate
              : anchorDate
          }
          maxDate={todayIso}
          defaultDescription={entryDialog === "new" ? quickAdd : ""}
          projects={projects}
          dayHours={(date, excludeId) =>
            sumHours(
              (groupedEntries.get(date) ?? []).filter(
                (item) => item.id !== excludeId,
              ),
            )
          }
          pending={upsertMutation.isPending}
          onClose={() => setEntryDialog(null)}
          onSave={(input) => upsertMutation.mutate(input)}
        />
      ) : null}

      {deleteTarget ? (
        <DeleteEntryDialog
          entry={deleteTarget}
          pending={deleteMutation.isPending}
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
        />
      ) : null}
    </div>
  );
}

function EntryRow({
  entry,
  onEdit,
  onDelete,
}: {
  entry: TimesheetEntry;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const notes = splitNotes(entry.description);

  return (
    <div className="flex min-w-0 flex-col gap-3 overflow-x-hidden border-b border-border px-4 py-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1 overflow-x-hidden">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className="mt-1 size-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: entry.projectColor }}
          />
          <div className="min-w-0 flex-1 overflow-x-hidden">
            <p className="truncate text-[15px] font-semibold text-foreground">
              {entry.projectName}
            </p>
            <p className="mt-0.5 truncate text-sm font-medium text-muted-foreground">
              {entry.taskName}
            </p>
            {notes.length > 0 ? (
              <div className="mt-2 max-h-40 min-w-0 overflow-x-hidden overflow-y-auto overscroll-contain pr-1">
                <ol className="list-decimal space-y-1 break-all pl-4 text-sm text-muted-foreground [overflow-wrap:anywhere]">
                  {notes.map((note) => (
                    <li key={note} className="min-w-0">
                      {note}
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 self-end sm:self-start">
        <span className="min-w-12 text-right text-base font-semibold text-foreground">
          {formatClock(entry.hours)}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onEdit}
        >
          <Pencil className="size-3.5" />
          Edit
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="text-destructive hover:text-destructive"
          onClick={onDelete}
          aria-label={`Delete ${entry.taskName}`}
        >
          <Trash2 />
        </Button>
      </div>
    </div>
  );
}

function MonthCalendar({
  cells,
  groupedEntries,
  anchorDate,
  onSelectDate,
}: {
  cells: Array<{ date: string; inMonth: boolean }>;
  groupedEntries: Map<string, TimesheetEntry[]>;
  anchorDate: string;
  onSelectDate: (date: string) => void;
}) {
  return (
    <div className="mt-5 w-full min-w-0 max-w-full overflow-hidden rounded-lg border border-border bg-card">
      {/* Always 7 columns so weekday headers stay aligned with day cells. */}
      <div className="grid grid-cols-7 border-b border-border bg-muted/50 text-center text-[11px] font-medium text-muted-foreground sm:text-xs">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="min-w-0 px-0.5 py-2 sm:px-2" title={label}>
            <span className="sm:hidden">{label.slice(0, 2)}</span>
            <span className="hidden sm:inline">{label}</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px bg-border">
        {cells.map((cell) => {
          const dayEntries = groupedEntries.get(cell.date) ?? [];
          const date = parseIsoDate(cell.date);
          const isSelected = cell.date === anchorDate;
          const isToday = cell.date === toIsoDate(new Date());

          return (
            <div
              key={cell.date}
              role="button"
              tabIndex={0}
              onClick={() => onSelectDate(cell.date)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelectDate(cell.date);
                }
              }}
              className={cn(
                "flex min-h-16 min-w-0 cursor-pointer flex-col overflow-hidden bg-card p-1.5 text-left transition hover:bg-muted/50 sm:min-h-24 sm:p-2.5 lg:min-h-28 lg:p-3",
                !cell.inMonth && "bg-muted/20 text-muted-foreground",
                isSelected && "ring-2 ring-inset ring-[#fa5d00]",
              )}
            >
              <div className="flex min-w-0 shrink-0 items-center justify-between gap-0.5">
                <span
                  className={cn(
                    "shrink-0 text-xs font-medium sm:text-sm",
                    isToday && "text-[#fa5d00]",
                  )}
                >
                  {date.getDate()}
                </span>
                {dayEntries.length > 0 ? (
                  <span className="hidden min-w-0 truncate text-[10px] font-semibold text-[#188433] dark:text-[#3ecf6a] sm:inline sm:text-xs">
                    {formatClock(sumHours(dayEntries))}
                  </span>
                ) : null}
              </div>
              {/* Cap visible chips at ~8 lines, then scroll inside the cell. */}
              <div className="mt-1 hidden min-w-0 max-h-[11rem] space-y-1 overflow-y-auto overscroll-contain sm:mt-2 sm:block">
                {dayEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className="truncate rounded px-1.5 py-0.5 text-[11px] leading-4"
                    title={entry.taskName}
                    style={{
                      backgroundColor: `${entry.projectColor}22`,
                      color: entry.projectColor,
                    }}
                  >
                    {entry.taskName}
                  </div>
                ))}
              </div>
              {dayEntries.length > 0 ? (
                <div className="mt-1 flex flex-wrap gap-0.5 sm:hidden">
                  {dayEntries.slice(0, 3).map((entry) => (
                    <span
                      key={entry.id}
                      className="size-1.5 rounded-full"
                      style={{ backgroundColor: entry.projectColor }}
                      aria-hidden
                    />
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EntryDialog({
  entry,
  defaultDate,
  maxDate,
  defaultDescription,
  projects,
  dayHours,
  pending,
  onClose,
  onSave,
}: {
  entry: TimesheetEntry | null;
  defaultDate: string;
  maxDate: string;
  defaultDescription: string;
  projects: TimesheetProjectOption[];
  dayHours: (date: string, excludeId?: string) => number;
  pending: boolean;
  onClose: () => void;
  onSave: (input: {
    id?: string;
    projectId: string;
    taskId: string;
    entryDate: string;
    hours: number;
    description: string;
  }) => void;
}) {
  const initialProjectId = entry?.projectId ?? projects[0]?.id ?? "";
  const initialTaskId =
    entry?.taskId ??
    projects.find((project) => project.id === initialProjectId)?.tasks[0]?.id ??
    "";
  const initialDate = (() => {
    const seed = entry?.entryDate ?? defaultDate;
    return seed > maxDate ? maxDate : seed;
  })();
  const [projectId, setProjectId] = useState(initialProjectId);
  const [taskId, setTaskId] = useState(initialTaskId);
  const [entryDate, setEntryDate] = useState(initialDate);
  const [time, setTime] = useState(entry ? formatClock(entry.hours) : "0:00");
  const [description, setDescription] = useState(
    entry?.description ?? defaultDescription,
  );
  const [formError, setFormError] = useState<string | null>(null);

  const projectsWithCurrent = useMemo(() => {
    if (!entry) {
      return projects;
    }

    const existing = projects.find((project) => project.id === entry.projectId);
    if (!existing) {
      return [
        {
          id: entry.projectId,
          name: entry.projectName,
          color: entry.projectColor,
          tasks: [{ id: entry.taskId, name: entry.taskName }],
        },
        ...projects,
      ];
    }

    if (existing.tasks.some((task) => task.id === entry.taskId)) {
      return projects;
    }

    return projects.map((project) =>
      project.id === entry.projectId
        ? {
            ...project,
            tasks: [
              { id: entry.taskId, name: entry.taskName },
              ...project.tasks,
            ],
          }
        : project,
    );
  }, [entry, projects]);

  const isEditing = entry !== null;
  const otherHoursOnDay = dayHours(entryDate, entry?.id);
  const remainingHours = Math.max(
    0,
    Math.round((24 - otherHoursOnDay) * 100) / 100,
  );

  const selectedProject =
    projectsWithCurrent.find((project) => project.id === projectId) ?? null;
  const taskOptions = useMemo(
    () => selectedProject?.tasks ?? [],
    [selectedProject],
  );

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) {
          onClose();
        }
      }}
    >
      <DialogContent className="flex max-h-[calc(100dvh-1.5rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="shrink-0 border-b border-border px-5 py-4">
          <DialogTitle className="pr-8 text-lg">
            {entry
              ? `Edit time entry for ${formatShortWeekday(entryDate)}`
              : `New time entry for ${formatShortWeekday(entryDate)}`}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Choose project, task type, notes, and time.
          </DialogDescription>
        </DialogHeader>

        <form
          className="flex min-h-0 min-w-0 flex-1 flex-col"
          onSubmit={(event) => {
            event.preventDefault();
            if (!projectId || !taskId || !entryDate) {
              setFormError("Select a project, task, and date.");
              return;
            }

            if (!description.trim()) {
              setFormError("Notes are required.");
              return;
            }

            if (entryDate > maxDate) {
              setFormError("You cannot fill timesheet entries for future dates");
              return;
            }

            const parsedHours = parseTimeInput(time);
            if (!isEditing) {
              if (parsedHours === null) {
                setFormError(
                  "Enter time as H:MM or decimal hours, for example 2:30 or 2.5.",
                );
                return;
              }
              if (parsedHours < 0.01 || parsedHours > 24) {
                setFormError("Time must be between 0:01 and 24:00.");
                return;
              }
              if (parsedHours > remainingHours) {
                setFormError(
                  remainingHours === 0
                    ? "This day already has 24 hours. You cannot add more time."
                    : `Total time for this day cannot exceed 24 hours. Only ${formatClock(remainingHours)} remaining.`,
                );
                return;
              }
            } else if (entry.hours > remainingHours) {
              setFormError(
                remainingHours === 0
                  ? "This day already has 24 hours. Choose another date."
                  : `Moving this entry would exceed 24 hours. Only ${formatClock(remainingHours)} remaining on this day.`,
              );
              return;
            }

            setFormError(null);
            onSave({
              id: entry?.id,
              projectId,
              taskId,
              entryDate,
              // Time is locked after create — only send hours for new entries.
              hours: isEditing ? entry.hours : parsedHours,
              description: description.trim(),
            });
          }}
        >
          <div className="min-h-0 min-w-0 space-y-4 overflow-y-auto overflow-x-hidden px-5 py-4">
            {formError ? (
              <Alert variant="destructive">
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="timesheet-project">Project</Label>
              <Select
                value={projectId || null}
                modal={false}
                items={projectsWithCurrent.map((project) => ({
                  value: project.id,
                  label: project.name,
                }))}
                onValueChange={(nextProjectId) => {
                  const nextId = nextProjectId ?? "";
                  const nextProject =
                    projectsWithCurrent.find(
                      (project) => project.id === nextId,
                    ) ?? null;
                  setProjectId(nextId);
                  setTaskId(nextProject?.tasks[0]?.id ?? "");
                }}
              >
                <SelectTrigger
                  id="timesheet-project"
                  className="h-10 w-full rounded-md bg-background dark:bg-card"
                >
                  <SelectValue placeholder="Select a project" />
                </SelectTrigger>
                <SelectContent>
                  {projectsWithCurrent.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="timesheet-task">Task type</Label>
              <Select
                value={taskId || null}
                modal={false}
                disabled={!selectedProject || taskOptions.length === 0}
                items={taskOptions.map((task) => ({
                  value: task.id,
                  label: task.name,
                }))}
                onValueChange={(nextTaskId) => setTaskId(nextTaskId ?? "")}
              >
                <SelectTrigger
                  id="timesheet-task"
                  className="h-10 w-full rounded-md bg-background dark:bg-card"
                >
                  <SelectValue placeholder="Select a task" />
                </SelectTrigger>
                <SelectContent>
                  {taskOptions.map((task) => (
                    <SelectItem key={task.id} value={task.id}>
                      {task.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid min-w-0 gap-4 sm:grid-cols-[minmax(0,1fr)_140px]">
              <div className="min-w-0 space-y-2">
                <Label htmlFor="timesheet-description">Notes</Label>
                <Textarea
                  id="timesheet-description"
                  placeholder="What did you work on?"
                  required
                  aria-required="true"
                  value={description}
                  onChange={(event) => {
                    setDescription(event.target.value);
                    setFormError(null);
                  }}
                  className="min-h-28 max-w-full resize-y overflow-x-hidden break-all rounded-md [field-sizing:fixed]"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="timesheet-hours">Time</Label>
                <input
                  id="timesheet-hours"
                  name="hours"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="0:00"
                  value={time}
                  readOnly={isEditing}
                  disabled={isEditing}
                  onChange={(event) => {
                    if (isEditing) {
                      return;
                    }
                    setTime(event.target.value);
                    setFormError(null);
                  }}
                  className={cn(
                    "h-28 w-full rounded-md border border-input px-2 text-center text-3xl font-semibold tracking-tight text-foreground outline-none",
                    isEditing
                      ? "cursor-not-allowed bg-muted text-muted-foreground"
                      : "bg-background focus-visible:border-[#188433] focus-visible:ring-2 focus-visible:ring-[#188433]/20 dark:bg-card",
                  )}
                />
                <p className="text-center text-xs text-muted-foreground">
                  {isEditing
                    ? "Time locked after save"
                    : remainingHours === 0
                      ? "24h already logged this day"
                      : `${formatClock(remainingHours)} remaining today`}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="timesheet-date">Date</Label>
              <Input
                id="timesheet-date"
                type="date"
                max={maxDate}
                value={entryDate}
                onChange={(event) => {
                  const nextDate = event.target.value;
                  setEntryDate(nextDate > maxDate ? maxDate : nextDate);
                  setFormError(null);
                }}
                className="h-10 rounded-md"
              />
              <p className="text-xs text-muted-foreground">
                Future dates are not allowed
              </p>
            </div>
          </div>

          <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-border bg-muted/40 px-5 py-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-[#188433] text-white hover:bg-[#14732c]"
              disabled={pending || !projectId || !taskId || !description.trim()}
            >
              {pending ? "Saving..." : entry ? "Save changes" : "Save entry"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteEntryDialog({
  entry,
  pending,
  onClose,
  onConfirm,
}: {
  entry: TimesheetEntry;
  pending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) {
          onClose();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete time entry?</DialogTitle>
          <DialogDescription>
            {`This removes ${entry.taskName} on ${formatShortDate(entry.entryDate)}.`}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onConfirm}
            disabled={pending}
          >
            {pending ? "Deleting..." : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function splitNotes(description: string): string[] {
  return description
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function groupEntries(entries: TimesheetEntry[]): Map<string, TimesheetEntry[]> {
  const grouped = new Map<string, TimesheetEntry[]>();
  for (const entry of entries) {
    const bucket = grouped.get(entry.entryDate) ?? [];
    bucket.push(entry);
    grouped.set(entry.entryDate, bucket);
  }
  return grouped;
}

function sumHours(entries: TimesheetEntry[]): number {
  return entries.reduce((total, entry) => total + entry.hours, 0);
}

function formatClock(hours: number): string {
  const safeHours = Number.isFinite(hours) ? Math.max(0, hours) : 0;
  const totalMinutes = Math.round(safeHours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

function parseTimeInput(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  // Accept H:MM (e.g. 2:30)
  const clockMatch = trimmed.match(/^(\d{1,2}):(\d{1,2})$/);
  if (clockMatch) {
    const hours = Number(clockMatch[1]);
    const minutes = Number(clockMatch[2]);
    if (
      !Number.isFinite(hours) ||
      !Number.isFinite(minutes) ||
      minutes < 0 ||
      minutes > 59 ||
      hours < 0
    ) {
      return null;
    }
    return hours + minutes / 60;
  }

  // Accept decimal hours (e.g. 2.5 or 2)
  const asNumber = Number(trimmed.replace(",", "."));
  if (!Number.isFinite(asNumber)) {
    return null;
  }
  return asNumber;
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseIsoDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function startOfWeek(date: Date): Date {
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(date, diff);
}

function addDays(date: Date, amount: number): Date {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + amount);
  return next;
}

function addMonths(date: Date, amount: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + amount, date.getDate());
}

function getRange(
  anchorDate: string,
  view: CalendarView,
): { from: string; to: string } {
  const date = parseIsoDate(anchorDate);

  if (view === "day") {
    return { from: anchorDate, to: anchorDate };
  }

  if (view === "week") {
    const start = startOfWeek(date);
    const end = addDays(start, 6);
    return { from: toIsoDate(start), to: toIsoDate(end) };
  }

  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return { from: toIsoDate(start), to: toIsoDate(end) };
}

function listVisibleDays(from: string, to: string): string[] {
  const start = parseIsoDate(from);
  const end = parseIsoDate(to);
  const dates: string[] = [];
  for (let current = start; current <= end; current = addDays(current, 1)) {
    dates.push(toIsoDate(current));
  }
  return dates;
}

function buildMonthCells(
  anchorDate: string,
): Array<{ date: string; inMonth: boolean }> {
  const date = parseIsoDate(anchorDate);
  const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
  const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  const gridStart = startOfWeek(monthStart);
  const endDay = monthEnd.getDay();
  const daysToSunday = endDay === 0 ? 0 : 7 - endDay;
  const gridEnd = addDays(monthEnd, daysToSunday);

  const cells: Array<{ date: string; inMonth: boolean }> = [];
  for (
    let current = gridStart;
    current <= gridEnd;
    current = addDays(current, 1)
  ) {
    cells.push({
      date: toIsoDate(current),
      inMonth: current.getMonth() === date.getMonth(),
    });
  }
  return cells;
}

function moveDate(
  anchorDate: string,
  view: CalendarView,
  direction: -1 | 1,
): string {
  const date = parseIsoDate(anchorDate);

  if (view === "day" || view === "week") {
    return toIsoDate(addDays(date, direction));
  }
  return toIsoDate(addMonths(date, direction));
}

function formatHeaderDate(value: string, view: CalendarView): string {
  if (view === "month") {
    return new Intl.DateTimeFormat("en-GB", {
      month: "long",
      year: "numeric",
    }).format(parseIsoDate(value));
  }

  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "short",
  }).format(parseIsoDate(value));
}

function formatShortDate(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
  }).format(parseIsoDate(value));
}

function formatShortWeekday(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "short",
  }).format(parseIsoDate(value));
}

function hashDate(value: string): number {
  return value.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
}
