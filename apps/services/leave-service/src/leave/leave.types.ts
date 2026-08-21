export type LeaveType = 'SICK' | 'CASUAL' | 'UNPAID';
export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type DaySession = 'FULL' | 'FIRST_HALF' | 'SECOND_HALF';

export type LeaveBalance = {
  userId: string;
  casualBalance: number;
  sickBalance: number;
  lastAccrualMonth: string;
  updatedAt: string;
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
  /** Final / current days (may be edited by admin on approve). */
  days: number;
  /** Days the employee originally requested. */
  requestedDays: number;
  reason: string;
  status: LeaveStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  /** Admin note: required on reject; optional note on approve. */
  reviewNote: string | null;
  /** Required when admin changes days on approve. */
  daysEditReason: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Monthly accrual: 1.0 casual + 0.5 sick. */
export const CASUAL_ACCRUAL_PER_MONTH = 1;
export const SICK_ACCRUAL_PER_MONTH = 0.5;

/** Casual leave must be applied at least this many days before start. */
export const CASUAL_MIN_ADVANCE_DAYS = 10;

export function sessionDayValue(session: DaySession): number {
  return session === 'FULL' ? 1 : 0.5;
}

/**
 * Leave must be one continuous block (no gaps), including halves.
 *
 * Same day:
 * - Full day, first half only, second half only, or first→second (= full)
 *
 * Multi-day continuous block:
 * - Start: Full day or Second half (leave begins morning or afternoon)
 * - Middle days: always full
 * - End: Full day or First half (leave ends evening or noon)
 */
export function getContinuousLeaveError(
  startDate: string,
  endDate: string,
  startSession: DaySession,
  endSession: DaySession,
): string | null {
  if (!startDate || !endDate || endDate < startDate) {
    return 'End date must be on or after start date';
  }

  if (startDate === endDate) {
    if (startSession === 'SECOND_HALF' && endSession === 'FIRST_HALF') {
      return 'Leave must be continuous: second half cannot come before first half on the same day';
    }
    if (
      startSession === 'FULL' &&
      endSession !== 'FULL'
    ) {
      return 'Leave must be continuous: use full day, or first/second half only';
    }
    if (
      endSession === 'FULL' &&
      startSession !== 'FULL'
    ) {
      return 'Leave must be continuous: use full day, or first/second half only';
    }
    if (
      startSession === 'FIRST_HALF' &&
      endSession !== 'FIRST_HALF' &&
      endSession !== 'SECOND_HALF'
    ) {
      return 'Leave must be continuous';
    }
    if (
      startSession === 'SECOND_HALF' &&
      endSession !== 'SECOND_HALF'
    ) {
      return 'Leave must be continuous: second half leave is a single half day';
    }
    return null;
  }

  // Multi-day: no gaps — start morning/afternoon, then full middle days, end noon/evening.
  if (startSession === 'FIRST_HALF') {
    return 'Leave must be continuous: multi-day leave cannot start with first half (that leaves a gap in the afternoon)';
  }
  if (endSession === 'SECOND_HALF') {
    return 'Leave must be continuous: multi-day leave cannot end with second half (that leaves a gap in the morning)';
  }
  if (startSession !== 'FULL' && startSession !== 'SECOND_HALF') {
    return 'Leave must be continuous';
  }
  if (endSession !== 'FULL' && endSession !== 'FIRST_HALF') {
    return 'Leave must be continuous';
  }

  return null;
}

/**
 * Inclusive continuous leave days with half-day sessions.
 * Returns 0 when the range is invalid or non-continuous.
 */
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
      (startSession === 'FIRST_HALF' && endSession === 'FIRST_HALF') ||
      (startSession === 'SECOND_HALF' && endSession === 'SECOND_HALF')
    ) {
      return 0.5;
    }
    // FULL, or first half → second half (full continuous day)
    return 1;
  }

  const start = parseIsoDateLocal(startDate);
  const end = parseIsoDateLocal(endDate);
  const calendarDays =
    Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  const middleDays = Math.max(0, calendarDays - 2);

  return round2(
    sessionDayValue(startSession) + middleDays + sessionDayValue(endSession),
  );
}

/** Normalize sessions so a date range stays continuous. */
export function normalizeContinuousSessions(
  startDate: string,
  endDate: string,
  startSession: DaySession,
  endSession: DaySession,
): { startSession: DaySession; endSession: DaySession } {
  if (startDate === endDate) {
    if (startSession === 'FULL' || endSession === 'FULL') {
      return { startSession: 'FULL', endSession: 'FULL' };
    }
    if (startSession === 'SECOND_HALF' && endSession === 'FIRST_HALF') {
      return { startSession: 'SECOND_HALF', endSession: 'SECOND_HALF' };
    }
    if (startSession === 'FIRST_HALF' && endSession === 'SECOND_HALF') {
      return { startSession: 'FIRST_HALF', endSession: 'SECOND_HALF' };
    }
    return { startSession, endSession: startSession };
  }

  const nextStart: DaySession =
    startSession === 'SECOND_HALF' ? 'SECOND_HALF' : 'FULL';
  const nextEnd: DaySession =
    endSession === 'FIRST_HALF' ? 'FIRST_HALF' : 'FULL';
  return { startSession: nextStart, endSession: nextEnd };
}

function parseIsoDateLocal(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
