import { apiFetch, parseJson } from "@/lib/api/client";

export type TimesheetTaskOption = {
  id: string;
  name: string;
};

export type TimesheetProjectOption = {
  id: string;
  name: string;
  color: string;
  tasks: TimesheetTaskOption[];
};

export type TimesheetOptions = {
  projects: TimesheetProjectOption[];
};

export type TimesheetEntry = {
  id: string;
  userId: string;
  projectId: string;
  projectName: string;
  projectColor: string;
  taskId: string;
  taskName: string;
  entryDate: string;
  hours: number;
  description: string;
  createdAt: string;
  updatedAt: string;
};

export type TimesheetEntriesPage = {
  items: TimesheetEntry[];
  total: number;
  totalHours: number;
  page: number;
  pageSize: number;
};

export const timesheetOptionsQueryKey = ["timesheet", "options"] as const;
export const timesheetEntriesQueryKey = (input: {
  from: string;
  to: string;
  search?: string;
  page?: number;
  pageSize?: number;
}) =>
  [
    "timesheet",
    "entries",
    input.from,
    input.to,
    input.search ?? "",
    input.page ?? null,
    input.pageSize ?? null,
  ] as const;

export async function getTimesheetOptions(): Promise<TimesheetOptions> {
  const response = await apiFetch("/api/timesheet/options");
  return parseJson<TimesheetOptions>(response);
}

export async function listTimesheetEntries(input: {
  from: string;
  to: string;
  search?: string;
  page?: number;
  pageSize?: number;
}): Promise<TimesheetEntriesPage> {
  const params = new URLSearchParams({
    from: input.from,
    to: input.to,
  });
  if (input.search?.trim()) {
    params.set("search", input.search.trim());
  }
  if (input.page !== undefined) {
    params.set("page", String(input.page));
  }
  if (input.pageSize !== undefined) {
    params.set("pageSize", String(input.pageSize));
  }
  const response = await apiFetch(`/api/timesheet/entries?${params.toString()}`);
  return parseJson<TimesheetEntriesPage>(response);
}

export async function getTimesheetEntry(id: string): Promise<TimesheetEntry> {
  const response = await apiFetch(`/api/timesheet/entries/${id}`);
  return parseJson<TimesheetEntry>(response);
}

export async function createTimesheetEntry(input: {
  projectId: string;
  taskId: string;
  entryDate: string;
  hours: number;
  description: string;
}): Promise<TimesheetEntry> {
  const response = await apiFetch("/api/timesheet/entries", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return parseJson<TimesheetEntry>(response);
}

export async function updateTimesheetEntry(
  id: string,
  input: {
    projectId?: string;
    taskId?: string;
    entryDate?: string;
    description?: string;
  },
): Promise<TimesheetEntry> {
  const response = await apiFetch(`/api/timesheet/entries/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return parseJson<TimesheetEntry>(response);
}

export async function deleteTimesheetEntry(
  id: string,
): Promise<{ ok: true }> {
  const response = await apiFetch(`/api/timesheet/entries/${id}`, {
    method: "DELETE",
  });
  return parseJson<{ ok: true }>(response);
}
