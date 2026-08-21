import { apiFetch, parseJson } from "@/lib/api/client";

export type LeaveType = "SICK" | "CASUAL" | "UNPAID";
export type LeaveStatus = "PENDING" | "APPROVED" | "REJECTED";
export type DaySession = "FULL" | "FIRST_HALF" | "SECOND_HALF";

export type LeaveBalance = {
  casualBalance: number;
  sickBalance: number;
  availableCasual: number;
  availableSick: number;
  lastAccrualMonth: string;
};

export type LeaveRequest = {
  id: string;
  userId: string;
  employeeName: string;
  employeeEmail: string;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  startSession: DaySession;
  endSession: DaySession;
  days: number;
  requestedDays: number;
  reason: string;
  status: LeaveStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  daysEditReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export const leaveBalanceQueryKey = ["leave", "balance"] as const;
export const myLeaveRequestsQueryKey = ["leave", "requests", "me"] as const;
export const adminLeaveRequestsQueryKey = (status?: LeaveStatus) =>
  ["leave", "requests", "admin", status ?? "ALL"] as const;

export const daySessionLabel: Record<DaySession, string> = {
  FULL: "Full day",
  FIRST_HALF: "First half",
  SECOND_HALF: "Second half",
};

export function sessionDayValue(session: DaySession): number {
  return session === "FULL" ? 1 : 0.5;
}

export function getContinuousLeaveError(
  startDate: string,
  endDate: string,
  startSession: DaySession,
  endSession: DaySession,
): string | null {
  if (!startDate || !endDate || endDate < startDate) {
    return "End date must be on or after start date";
  }

  if (startDate === endDate) {
    if (startSession === "SECOND_HALF" && endSession === "FIRST_HALF") {
      return "Leave must be continuous: second half cannot come before first half on the same day";
    }
    if (startSession === "FULL" && endSession !== "FULL") {
      return "Leave must be continuous: use full day, or first/second half only";
    }
    if (endSession === "FULL" && startSession !== "FULL") {
      return "Leave must be continuous: use full day, or first/second half only";
    }
    if (
      startSession === "SECOND_HALF" &&
      endSession !== "SECOND_HALF"
    ) {
      return "Leave must be continuous: second half leave is a single half day";
    }
    return null;
  }

  if (startSession === "FIRST_HALF") {
    return "Leave must be continuous: multi-day leave cannot start with first half";
  }
  if (endSession === "SECOND_HALF") {
    return "Leave must be continuous: multi-day leave cannot end with second half";
  }
  if (startSession !== "FULL" && startSession !== "SECOND_HALF") {
    return "Leave must be continuous";
  }
  if (endSession !== "FULL" && endSession !== "FIRST_HALF") {
    return "Leave must be continuous";
  }

  return null;
}

export function calculateLeaveDays(
  startDate: string,
  endDate: string,
  startSession: DaySession,
  endSession: DaySession,
): number {
  if (getContinuousLeaveError(startDate, endDate, startSession, endSession)) {
    return 0;
  }

  if (startDate === endDate) {
    if (
      (startSession === "FIRST_HALF" && endSession === "FIRST_HALF") ||
      (startSession === "SECOND_HALF" && endSession === "SECOND_HALF")
    ) {
      return 0.5;
    }
    return 1;
  }

  const [sy, sm, sd] = startDate.split("-").map(Number);
  const [ey, em, ed] = endDate.split("-").map(Number);
  const start = new Date(sy, sm - 1, sd);
  const end = new Date(ey, em - 1, ed);
  const calendarDays =
    Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  const middleDays = Math.max(0, calendarDays - 2);

  return (
    Math.round(
      (sessionDayValue(startSession) +
        middleDays +
        sessionDayValue(endSession)) *
        100,
    ) / 100
  );
}

export function normalizeContinuousSessions(
  startDate: string,
  endDate: string,
  startSession: DaySession,
  endSession: DaySession,
): { startSession: DaySession; endSession: DaySession } {
  if (startDate === endDate) {
    if (startSession === "FULL" || endSession === "FULL") {
      return { startSession: "FULL", endSession: "FULL" };
    }
    if (startSession === "SECOND_HALF" && endSession === "FIRST_HALF") {
      return { startSession: "SECOND_HALF", endSession: "SECOND_HALF" };
    }
    if (startSession === "FIRST_HALF" && endSession === "SECOND_HALF") {
      return { startSession: "FIRST_HALF", endSession: "SECOND_HALF" };
    }
    return { startSession, endSession: startSession };
  }

  return {
    startSession: startSession === "SECOND_HALF" ? "SECOND_HALF" : "FULL",
    endSession: endSession === "FIRST_HALF" ? "FIRST_HALF" : "FULL",
  };
}

export async function getLeaveBalance(): Promise<LeaveBalance> {
  const response = await apiFetch("/api/leave/balance");
  return parseJson<LeaveBalance>(response);
}

export async function listMyLeaveRequests(): Promise<LeaveRequest[]> {
  const response = await apiFetch("/api/leave/requests/me");
  return parseJson<LeaveRequest[]>(response);
}

export async function listAdminLeaveRequests(
  status?: LeaveStatus,
): Promise<LeaveRequest[]> {
  const params = status ? `?status=${status}` : "";
  const response = await apiFetch(`/api/leave/requests${params}`);
  return parseJson<LeaveRequest[]>(response);
}

export async function applyLeave(input: {
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  startSession: DaySession;
  endSession: DaySession;
  reason: string;
}): Promise<LeaveRequest> {
  const response = await apiFetch("/api/leave/requests", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return parseJson<LeaveRequest>(response);
}

export async function reviewLeave(
  id: string,
  input: {
    status: "APPROVED" | "REJECTED";
    reviewNote?: string;
    approveNote?: string;
    approvedDays?: number;
    daysEditReason?: string;
  },
): Promise<LeaveRequest> {
  const response = await apiFetch(`/api/leave/requests/${id}/review`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return parseJson<LeaveRequest>(response);
}

export async function deleteMyLeave(id: string): Promise<{ ok: true }> {
  const response = await apiFetch(`/api/leave/requests/${id}`, {
    method: "DELETE",
  });
  return parseJson<{ ok: true }>(response);
}

export function canEmployeeDeleteLeave(
  request: LeaveRequest,
  today: string = toLocalIsoDate(),
): boolean {
  if (request.status !== "PENDING" && request.status !== "APPROVED") {
    return false;
  }
  return request.startDate >= today;
}

function toLocalIsoDate(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
