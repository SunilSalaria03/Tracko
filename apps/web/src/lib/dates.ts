/** Local calendar date helpers (YYYY-MM-DD). */

export function toIsoDate(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseIsoDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function addDays(date: Date, amount: number): Date {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + amount);
  return next;
}

/** Monday-start week containing `date`. */
export function startOfWeek(date: Date): Date {
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(date, diff);
}

export function getWeekRange(anchorDate: string = toIsoDate()): {
  from: string;
  to: string;
} {
  const start = startOfWeek(parseIsoDate(anchorDate));
  return {
    from: toIsoDate(start),
    to: toIsoDate(addDays(start, 6)),
  };
}

export function getMonthRange(anchorDate: string = toIsoDate()): {
  from: string;
  to: string;
} {
  const date = parseIsoDate(anchorDate);
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return { from: toIsoDate(start), to: toIsoDate(end) };
}

export function getPreviousWeekRange(anchorDate: string = toIsoDate()): {
  from: string;
  to: string;
} {
  const thisWeekStart = startOfWeek(parseIsoDate(anchorDate));
  const previousWeekStart = addDays(thisWeekStart, -7);
  return {
    from: toIsoDate(previousWeekStart),
    to: toIsoDate(addDays(previousWeekStart, 6)),
  };
}

export function getPreviousMonthRange(anchorDate: string = toIsoDate()): {
  from: string;
  to: string;
} {
  const date = parseIsoDate(anchorDate);
  const start = new Date(date.getFullYear(), date.getMonth() - 1, 1);
  const end = new Date(date.getFullYear(), date.getMonth(), 0);
  return { from: toIsoDate(start), to: toIsoDate(end) };
}

export function formatClock(hours: number): string {
  const safeHours = Number.isFinite(hours) ? Math.max(0, hours) : 0;
  const totalMinutes = Math.round(safeHours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

export function formatLongDate(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(parseIsoDate(value));
}

export function formatShortDate(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(parseIsoDate(value));
}

export function formatMonthYear(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
  }).format(parseIsoDate(value));
}
