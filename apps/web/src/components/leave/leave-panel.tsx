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
import { ApiError } from "@/lib/api/client";
import {
  applyLeave,
  adminLeaveRequestsQueryKey,
  calculateLeaveDays,
  canEmployeeDeleteLeave,
  daySessionLabel,
  deleteMyLeave,
  getContinuousLeaveError,
  getLeaveBalance,
  leaveBalanceQueryKey,
  listAdminLeaveRequests,
  listMyLeaveRequests,
  myLeaveRequestsQueryKey,
  normalizeContinuousSessions,
  reviewLeave,
  type DaySession,
  type LeaveBalance,
  type LeaveRequest,
  type LeaveStatus,
  type LeaveType,
} from "@/lib/api/leave.api";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { addDays, toIsoDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  Check,
  HeartPulse,
  Info,
  Plus,
  Trash2,
  Umbrella,
  X,
} from "lucide-react";
import { useState } from "react";

const leaveTypeLabel: Record<LeaveType, string> = {
  SICK: "Sick leave",
  CASUAL: "Casual leave",
  UNPAID: "Unpaid leave",
};

type DurationPreset = "FULL" | "FIRST_HALF" | "SECOND_HALF" | "CUSTOM";

export function LeavePanel() {
  const { data: user } = useCurrentUser();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === "ADMIN";
  const [error, setError] = useState<string | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [applyOpen, setApplyOpen] = useState(false);
  const [policyOpen, setPolicyOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<LeaveRequest | null>(null);
  const [adminFilter, setAdminFilter] = useState<LeaveStatus | "ALL">("PENDING");
  const [reviewTarget, setReviewTarget] = useState<{
    request: LeaveRequest;
    mode: "APPROVE" | "REJECT";
  } | null>(null);

  const balanceQuery = useQuery({
    queryKey: leaveBalanceQueryKey,
    queryFn: getLeaveBalance,
    enabled: Boolean(user),
  });

  const myRequestsQuery = useQuery({
    queryKey: myLeaveRequestsQueryKey,
    queryFn: listMyLeaveRequests,
    enabled: Boolean(user),
  });

  const adminRequestsQuery = useQuery({
    queryKey: adminLeaveRequestsQueryKey(
      adminFilter === "ALL" ? undefined : adminFilter,
    ),
    queryFn: () =>
      listAdminLeaveRequests(
        adminFilter === "ALL" ? undefined : adminFilter,
      ),
    enabled: Boolean(user) && isAdmin,
  });

  const invalidateLeave = async () => {
    await queryClient.invalidateQueries({ queryKey: ["leave"] });
  };

  const applyMutation = useMutation({
    mutationFn: applyLeave,
    onSuccess: async () => {
      setApplyError(null);
      setApplyOpen(false);
      await invalidateLeave();
    },
    onError: (err) => {
      setApplyError(
        err instanceof ApiError ? err.message : "Unable to apply leave.",
      );
    },
  });

  const reviewMutation = useMutation({
    mutationFn: ({
      id,
      ...input
    }: {
      id: string;
      status: "APPROVED" | "REJECTED";
      reviewNote?: string;
      approveNote?: string;
      approvedDays?: number;
      daysEditReason?: string;
    }) => reviewLeave(id, input),
    onSuccess: async () => {
      setError(null);
      setReviewTarget(null);
      await invalidateLeave();
    },
    onError: (err) => {
      setError(
        err instanceof ApiError ? err.message : "Unable to review leave.",
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteMyLeave(id),
    onSuccess: async () => {
      setError(null);
      setDeleteTarget(null);
      await invalidateLeave();
    },
    onError: (err) => {
      setError(
        err instanceof ApiError ? err.message : "Unable to delete leave.",
      );
    },
  });

  if (!user) {
    return null;
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-tight">Leave</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setPolicyOpen(true)}
          >
            <Info className="size-4" />
            Policy
          </Button>
          <Button
            type="button"
            className="bg-[#188433] text-white hover:bg-[#14732c]"
            onClick={() => {
              setApplyError(null);
              setApplyOpen(true);
            }}
          >
            <Plus className="size-4" />
            Apply leave
          </Button>
        </div>
      </header>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-3">
        <BalanceCard
          label="Available casual"
          value={balanceQuery.data?.availableCasual}
          loading={balanceQuery.isLoading}
          icon={<Umbrella className="size-5" />}
          tone="green"
        />
        <BalanceCard
          label="Available sick"
          value={balanceQuery.data?.availableSick}
          loading={balanceQuery.isLoading}
          icon={<HeartPulse className="size-5" />}
          tone="orange"
        />
        <BalanceCard
          label="Unpaid"
          valueLabel="Unlimited"
          loading={false}
          icon={<CalendarDays className="size-5" />}
          tone="slate"
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">
          My requests
        </h2>
        <LeaveTable
          rows={myRequestsQuery.data ?? []}
          loading={myRequestsQuery.isLoading}
          empty="You have not applied for leave yet."
          onDelete={(request) => setDeleteTarget(request)}
          deleting={deleteMutation.isPending}
        />
      </section>

      {isAdmin ? (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-medium text-muted-foreground">
              Admin approvals
            </h2>
            <Select
              value={adminFilter}
              onValueChange={(value) => {
                if (
                  value === "ALL" ||
                  value === "PENDING" ||
                  value === "APPROVED" ||
                  value === "REJECTED"
                ) {
                  setAdminFilter(value);
                }
              }}
            >
              <SelectTrigger className="h-9 w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
                <SelectItem value="ALL">All</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <LeaveTable
            rows={adminRequestsQuery.data ?? []}
            loading={adminRequestsQuery.isLoading}
            empty="No leave requests in this filter."
            showEmployee
            onApprove={(request) =>
              setReviewTarget({ request, mode: "APPROVE" })
            }
            onReject={(request) =>
              setReviewTarget({ request, mode: "REJECT" })
            }
            reviewing={reviewMutation.isPending}
          />
        </section>
      ) : null}

      <LeavePolicyDialog open={policyOpen} onOpenChange={setPolicyOpen} />

      {deleteTarget ? (
        <DeleteLeaveDialog
          open
          request={deleteTarget}
          pending={deleteMutation.isPending}
          onOpenChange={(open) => {
            if (!open) {
              setDeleteTarget(null);
            }
          }}
          onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
        />
      ) : null}

      <ApplyLeaveDialog
        open={applyOpen}
        onOpenChange={(open) => {
          if (!open) {
            setApplyError(null);
          }
          setApplyOpen(open);
        }}
        balance={balanceQuery.data}
        pending={applyMutation.isPending}
        serverError={applyError}
        onClearServerError={() => setApplyError(null)}
        onSubmit={(payload) => {
          setApplyError(null);
          applyMutation.mutate(payload);
        }}
      />

      {reviewTarget ? (
        <ReviewLeaveDialog
          open
          mode={reviewTarget.mode}
          request={reviewTarget.request}
          pending={reviewMutation.isPending}
          onOpenChange={(open) => {
            if (!open) {
              setReviewTarget(null);
            }
          }}
          onConfirm={(payload) => {
            setError(null);
            reviewMutation.mutate({
              id: reviewTarget.request.id,
              ...payload,
            });
          }}
        />
      ) : null}
    </div>
  );
}

function LeavePolicyDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle>Leave policy</DialogTitle>
          <DialogDescription>
            Rules for earning, applying, and approving leave.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-5 py-4 text-sm">
          <PolicyBlock title="Monthly accrual">
            Earn <strong>1 casual</strong> + <strong>0.5 sick</strong> leave
            each month.
          </PolicyBlock>

          <PolicyBlock title="Leave types">
            <ul className="list-disc space-y-1 pl-4">
              <li>
                <strong>Casual</strong> — use available balance; apply at least{" "}
                <strong>10 days</strong> before start.
              </li>
              <li>
                <strong>Sick</strong> — use available balance; can start from
                today.
              </li>
              <li>
                <strong>Unpaid</strong> — unlimited; no balance check.
              </li>
            </ul>
          </PolicyBlock>

          <PolicyBlock title="Duration">
            Apply <strong>full day</strong>, <strong>first half</strong>, or{" "}
            <strong>second half</strong>. Multi-day leave must be continuous
            (no gaps). Custom start/end sessions are allowed when continuous
            (for example full day + next first half = 1.5 days).
          </PolicyBlock>

          <PolicyBlock title="Balance">
            Casual and sick applications cannot exceed available balance
            (pending requests also count against availability).
          </PolicyBlock>

          <PolicyBlock title="Approval">
            Every leave request needs <strong>admin approval</strong>. Admins
            may reduce approved days (with a reason). Rejection always requires
            a reason.
          </PolicyBlock>

          <PolicyBlock title="Cancel / delete">
            You can delete your own <strong>pending</strong> or{" "}
            <strong>approved</strong> leave if it is still upcoming (start date
            today or later). Deleting approved casual/sick leave restores your
            balance.
          </PolicyBlock>
        </div>

        <DialogFooter className="rounded-none">
          <Button type="button" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PolicyBlock({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <h3 className="font-medium text-foreground">{title}</h3>
      <div className="text-muted-foreground">{children}</div>
    </div>
  );
}

function DeleteLeaveDialog({
  open,
  onOpenChange,
  request,
  pending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: LeaveRequest;
  pending: boolean;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete leave?</DialogTitle>
          <DialogDescription>
            This removes your {request.status.toLowerCase()} leave for{" "}
            {formatLeaveRange(
              request.startDate,
              request.endDate,
              request.startSession,
              request.endSession,
            )}{" "}
            ({request.days} day
            {request.days === 1 ? "" : "s"}).
            {request.status === "APPROVED" && request.leaveType !== "UNPAID"
              ? " Your leave balance will be restored."
              : ""}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={pending}
            onClick={onConfirm}
          >
            <Trash2 className="size-3.5" />
            {pending ? "Deleting…" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ApplyLeaveDialog({
  open,
  onOpenChange,
  balance,
  pending,
  serverError,
  onClearServerError,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  balance?: LeaveBalance;
  pending: boolean;
  serverError: string | null;
  onClearServerError: () => void;
  onSubmit: (input: {
    leaveType: LeaveType;
    startDate: string;
    endDate: string;
    startSession: DaySession;
    endSession: DaySession;
    reason: string;
  }) => void;
}) {
  const today = toIsoDate();
  const minCasualDate = toIsoDate(addDays(new Date(), 10));
  const [leaveType, setLeaveType] = useState<LeaveType>("CASUAL");
  const [durationPreset, setDurationPreset] = useState<DurationPreset | null>(
    null,
  );
  const [startDate, setStartDate] = useState(minCasualDate);
  const [endDate, setEndDate] = useState(minCasualDate);
  const [startSession, setStartSession] = useState<DaySession>("FULL");
  const [endSession, setEndSession] = useState<DaySession>("FULL");
  const [reason, setReason] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const minStart = leaveType === "CASUAL" ? minCasualDate : today;
  const isHalfPreset =
    durationPreset === "FIRST_HALF" || durationPreset === "SECOND_HALF";
  const effectiveEndDate = isHalfPreset ? startDate : endDate;
  const effectiveEndSession = isHalfPreset ? startSession : endSession;
  const totalDays =
    durationPreset === null
      ? 0
      : calculateLeaveDays(
          startDate,
          effectiveEndDate,
          startSession,
          effectiveEndSession,
        );

  const availableBalance =
    leaveType === "CASUAL"
      ? (balance?.availableCasual ?? 0)
      : leaveType === "SICK"
        ? (balance?.availableSick ?? 0)
        : null;

  const exceedsBalance =
    availableBalance !== null && totalDays > availableBalance + 1e-9;

  const balanceError = exceedsBalance
    ? `Insufficient ${leaveType === "CASUAL" ? "casual" : "sick"} leave balance. You need ${totalDays} day(s) but only ${availableBalance} day(s) available.`
    : null;

  const continuityError =
    durationPreset === null
      ? null
      : getContinuousLeaveError(
          startDate,
          effectiveEndDate,
          startSession,
          effectiveEndSession,
        );

  const popupError =
    formError || serverError || continuityError || balanceError;

  const touchForm = () => {
    setFormError(null);
    onClearServerError();
  };

  const setContinuousRange = (
    nextStart: string,
    nextEnd: string,
    nextStartSession: DaySession,
    nextEndSession: DaySession,
  ) => {
    const normalized = normalizeContinuousSessions(
      nextStart,
      nextEnd,
      nextStartSession,
      nextEndSession,
    );
    setStartDate(nextStart);
    setEndDate(nextEnd);
    setStartSession(normalized.startSession);
    setEndSession(normalized.endSession);
  };

  const applyPreset = (preset: DurationPreset, date = startDate) => {
    touchForm();
    setDurationPreset(preset);
    if (preset === "FIRST_HALF") {
      setStartSession("FIRST_HALF");
      setEndSession("FIRST_HALF");
      setEndDate(date);
      setStartDate(date);
    } else if (preset === "SECOND_HALF") {
      setStartSession("SECOND_HALF");
      setEndSession("SECOND_HALF");
      setEndDate(date);
      setStartDate(date);
    } else if (preset === "FULL") {
      setStartSession("FULL");
      setEndSession("FULL");
    } else if (preset === "CUSTOM") {
      const normalized = normalizeContinuousSessions(
        startDate,
        endDate < startDate ? startDate : endDate,
        "FULL",
        "FULL",
      );
      setStartSession(normalized.startSession);
      setEndSession(normalized.endSession);
      if (endDate < startDate) {
        setEndDate(startDate);
      }
    }
  };

  const resetForm = (type: LeaveType = "CASUAL") => {
    const start = type === "CASUAL" ? minCasualDate : today;
    setLeaveType(type);
    setDurationPreset(null);
    setStartDate(start);
    setEndDate(start);
    setStartSession("FULL");
    setEndSession("FULL");
    setReason("");
    setFormError(null);
    onClearServerError();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          resetForm("CASUAL");
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle>Apply leave</DialogTitle>
        </DialogHeader>

        <form
          className="space-y-4 px-5 py-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!durationPreset) {
              setFormError("Please select a duration.");
              return;
            }
            if (continuityError) {
              setFormError(continuityError);
              return;
            }
            if (totalDays < 0.5) {
              setFormError("Please select a valid continuous leave range.");
              return;
            }
            if (exceedsBalance && balanceError) {
              setFormError(balanceError);
              return;
            }
            if (!reason.trim()) {
              setFormError("Reason is required.");
              return;
            }
            setFormError(null);
            onClearServerError();
            onSubmit({
              leaveType,
              startDate,
              endDate: effectiveEndDate,
              startSession,
              endSession: effectiveEndSession,
              reason: reason.trim(),
            });
          }}
        >
          {popupError ? (
            <Alert variant="destructive">
              <AlertDescription>{popupError}</AlertDescription>
            </Alert>
          ) : null}

          <div className="space-y-2">
            <Label>Leave type</Label>
            <Select
              value={leaveType}
              onValueChange={(value) => {
                if (
                  value === "SICK" ||
                  value === "CASUAL" ||
                  value === "UNPAID"
                ) {
                  touchForm();
                  const start = value === "CASUAL" ? minCasualDate : today;
                  setLeaveType(value);
                  setStartDate(start);
                  setEndDate((prev) => (prev < start ? start : prev));
                }
              }}
            >
              <SelectTrigger className="h-10 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CASUAL">Casual leave</SelectItem>
                <SelectItem value="SICK">Sick leave</SelectItem>
                <SelectItem value="UNPAID">Unpaid leave</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Duration</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(
                [
                  ["FULL", "Full day"],
                  ["FIRST_HALF", "First half"],
                  ["SECOND_HALF", "Second half"],
                  ["CUSTOM", "Custom"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={cn(
                    "rounded-lg border px-2 py-2 text-xs font-medium transition-colors",
                    durationPreset === value
                      ? "border-[#188433] bg-[#188433]/12 text-[#188433]"
                      : "border-border bg-card text-muted-foreground hover:bg-muted/50",
                  )}
                  onClick={() => applyPreset(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {durationPreset ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="apply-start">Start date</Label>
              <Input
                id="apply-start"
                type="date"
                min={minStart}
                value={startDate}
                onChange={(event) => {
                  touchForm();
                  const next = event.target.value;
                  if (isHalfPreset) {
                    setContinuousRange(next, next, startSession, endSession);
                    return;
                  }
                  const nextEnd = endDate < next ? next : endDate;
                  setContinuousRange(next, nextEnd, startSession, endSession);
                }}
                required
              />
            </div>
            {!isHalfPreset ? (
              <div className="space-y-2">
                <Label htmlFor="apply-end">End date</Label>
                <Input
                  id="apply-end"
                  type="date"
                  min={startDate}
                  value={endDate}
                  onChange={(event) => {
                    touchForm();
                    const next = event.target.value;
                    const nextEnd = next < startDate ? startDate : next;
                    setContinuousRange(
                      startDate,
                      nextEnd,
                      startSession,
                      endSession,
                    );
                  }}
                  required
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Session</Label>
                <div className="flex h-10 items-center rounded-lg border border-border bg-muted/40 px-3 text-sm">
                  {daySessionLabel[startSession]}
                </div>
              </div>
            )}
          </div>
          ) : null}

          {durationPreset === "CUSTOM" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Start session</Label>
                <Select
                  value={startSession}
                  onValueChange={(value) => {
                    if (
                      value === "FULL" ||
                      value === "FIRST_HALF" ||
                      value === "SECOND_HALF"
                    ) {
                      touchForm();
                      setContinuousRange(startDate, endDate, value, endSession);
                    }
                  }}
                >
                  <SelectTrigger className="h-10 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FULL">Full day</SelectItem>
                    {startDate === endDate ? (
                      <SelectItem value="FIRST_HALF">First half</SelectItem>
                    ) : null}
                    <SelectItem value="SECOND_HALF">Second half</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>End session</Label>
                <Select
                  value={endSession}
                  onValueChange={(value) => {
                    if (
                      value === "FULL" ||
                      value === "FIRST_HALF" ||
                      value === "SECOND_HALF"
                    ) {
                      touchForm();
                      setContinuousRange(
                        startDate,
                        endDate,
                        startSession,
                        value,
                      );
                    }
                  }}
                >
                  <SelectTrigger className="h-10 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FULL">Full day</SelectItem>
                    <SelectItem value="FIRST_HALF">First half</SelectItem>
                    {startDate === endDate ? (
                      <SelectItem value="SECOND_HALF">Second half</SelectItem>
                    ) : null}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : null}

          <div
            className={cn(
              "flex items-center justify-between rounded-xl border px-4 py-3",
              exceedsBalance
                ? "border-destructive/40 bg-destructive/10"
                : "border-[#188433]/25 bg-[#188433]/8",
            )}
          >
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Total days
              </p>
              <p className="text-sm text-muted-foreground">
                {durationPreset
                  ? formatLeaveRange(
                      startDate,
                      effectiveEndDate,
                      startSession,
                      effectiveEndSession,
                    )
                  : "—"}
              </p>
            </div>
            <p
              className={cn(
                "text-3xl font-semibold tabular-nums",
                exceedsBalance ? "text-destructive" : "text-[#188433]",
              )}
            >
              {totalDays}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="apply-reason">Reason</Label>
            <Textarea
              id="apply-reason"
              value={reason}
              onChange={(event) => {
                touchForm();
                setReason(event.target.value);
              }}
              required
              className="min-h-24"
              placeholder="Why do you need leave?"
            />
          </div>

          <DialogFooter className="mx-0 mb-0 rounded-none border-0 bg-transparent p-0 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-[#188433] text-white hover:bg-[#14732c]"
              disabled={
                pending || !durationPreset || totalDays < 0.5 || exceedsBalance
              }
            >
              {pending ? "Submitting…" : "Submit request"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function formatLeaveRange(
  startDate: string,
  endDate: string,
  startSession: DaySession,
  endSession: DaySession,
): string {
  if (!startDate || !endDate) {
    return "Select dates";
  }
  if (startDate === endDate) {
    if (
      startSession === endSession &&
      (startSession === "FIRST_HALF" || startSession === "SECOND_HALF")
    ) {
      return `${startDate} · ${daySessionLabel[startSession]}`;
    }
    if (startSession === "FULL" && endSession === "FULL") {
      return `${startDate} · Full day`;
    }
    return `${startDate} · ${daySessionLabel[startSession]} → ${daySessionLabel[endSession]}`;
  }
  return `${startDate} (${daySessionLabel[startSession]}) → ${endDate} (${daySessionLabel[endSession]})`;
}

function ReviewLeaveDialog({
  open,
  onOpenChange,
  mode,
  request,
  pending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "APPROVE" | "REJECT";
  request: LeaveRequest;
  pending: boolean;
  onConfirm: (input: {
    status: "APPROVED" | "REJECTED";
    reviewNote?: string;
    approveNote?: string;
    approvedDays?: number;
    daysEditReason?: string;
  }) => void;
}) {
  const [approvedDays, setApprovedDays] = useState(String(request.days));
  const [daysEditReason, setDaysEditReason] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [approveNote, setApproveNote] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const parsedDays = Number(approvedDays);
  const daysChanged =
    Number.isFinite(parsedDays) &&
    Math.abs(parsedDays - request.requestedDays) > 1e-9;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle>
            {mode === "APPROVE" ? "Confirm approval" : "Confirm rejection"}
          </DialogTitle>
          <DialogDescription>
            {request.employeeName} · {leaveTypeLabel[request.leaveType]} ·{" "}
            {formatLeaveRange(
              request.startDate,
              request.endDate,
              request.startSession,
              request.endSession,
            )}
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4 px-5 py-4"
          onSubmit={(event) => {
            event.preventDefault();
            setFormError(null);

            if (mode === "REJECT") {
              if (!rejectReason.trim()) {
                setFormError("Rejection reason is required.");
                return;
              }
              onConfirm({
                status: "REJECTED",
                reviewNote: rejectReason.trim(),
              });
              return;
            }

            if (!Number.isFinite(parsedDays) || parsedDays < 0.5) {
              setFormError("Approved days must be at least 0.5.");
              return;
            }
            if (parsedDays > request.requestedDays + 1e-9) {
              setFormError("Approved days cannot exceed requested days.");
              return;
            }
            if (daysChanged && !daysEditReason.trim()) {
              setFormError("Reason is required when changing days.");
              return;
            }

            onConfirm({
              status: "APPROVED",
              approvedDays: parsedDays,
              daysEditReason: daysChanged
                ? daysEditReason.trim()
                : undefined,
              approveNote: approveNote.trim() || undefined,
            });
          }}
        >
          {formError ? (
            <Alert variant="destructive">
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          ) : null}

          <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
            <p className="min-w-0 break-words [overflow-wrap:anywhere]">
              <span className="text-muted-foreground">Employee reason: </span>
              {request.reason || "—"}
            </p>
            <p className="mt-1">
              <span className="text-muted-foreground">Requested days: </span>
              <span className="font-medium tabular-nums">
                {request.requestedDays}
              </span>
            </p>
          </div>

          {mode === "APPROVE" ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="approved-days">Approved days</Label>
                <Input
                  id="approved-days"
                  type="number"
                  min={0.5}
                  max={request.requestedDays}
                  step={0.5}
                  value={approvedDays}
                  onChange={(event) => setApprovedDays(event.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  You can reduce days (not increase). Balance uses approved
                  days.
                </p>
              </div>

              {daysChanged ? (
                <div className="space-y-2">
                  <Label htmlFor="days-edit-reason">
                    Reason for changing days
                  </Label>
                  <Textarea
                    id="days-edit-reason"
                    value={daysEditReason}
                    onChange={(event) => setDaysEditReason(event.target.value)}
                    required
                    className="min-h-20"
                    placeholder="Why are you approving fewer days?"
                  />
                </div>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="approve-note">Note to employee (optional)</Label>
                <Textarea
                  id="approve-note"
                  value={approveNote}
                  onChange={(event) => setApproveNote(event.target.value)}
                  className="min-h-16"
                  placeholder="Optional message"
                />
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="reject-reason">Rejection reason</Label>
              <Textarea
                id="reject-reason"
                value={rejectReason}
                onChange={(event) => setRejectReason(event.target.value)}
                required
                className="min-h-24"
                placeholder="Explain why this leave is rejected"
              />
            </div>
          )}

          <DialogFooter className="mx-0 mb-0 rounded-none border-0 bg-transparent p-0 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            {mode === "APPROVE" ? (
              <Button
                type="submit"
                className="bg-[#188433] text-white hover:bg-[#14732c]"
                disabled={pending}
              >
                <Check className="size-3.5" />
                {pending ? "Approving…" : "Confirm approve"}
              </Button>
            ) : (
              <Button type="submit" variant="destructive" disabled={pending}>
                <X className="size-3.5" />
                {pending ? "Rejecting…" : "Confirm reject"}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function BalanceCard({
  label,
  value,
  valueLabel,
  loading,
  icon,
  tone,
}: {
  label: string;
  value?: number;
  valueLabel?: string;
  loading: boolean;
  icon: React.ReactNode;
  tone: "green" | "orange" | "slate";
}) {
  const tones = {
    green: "bg-[#188433]/12 text-[#188433] dark:text-[#3ecf6a]",
    orange: "bg-[#fa5d00]/12 text-[#fa5d00]",
    slate: "bg-muted text-muted-foreground",
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">
            {loading ? "…" : (valueLabel ?? String(value ?? 0))}
          </p>
        </div>
        <span
          className={cn(
            "flex size-10 items-center justify-center rounded-lg",
            tones[tone],
          )}
        >
          {icon}
        </span>
      </div>
    </div>
  );
}

function LeaveTable({
  rows,
  loading,
  empty,
  showEmployee,
  onApprove,
  onReject,
  onDelete,
  reviewing,
  deleting,
}: {
  rows: LeaveRequest[];
  loading: boolean;
  empty: string;
  showEmployee?: boolean;
  onApprove?: (request: LeaveRequest) => void;
  onReject?: (request: LeaveRequest) => void;
  onDelete?: (request: LeaveRequest) => void;
  reviewing?: boolean;
  deleting?: boolean;
}) {
  const showActions = Boolean(onApprove || onDelete);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
        {empty}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full min-w-[820px] text-left text-sm">
        <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
          <tr>
            {showEmployee ? (
              <th className="px-4 py-2.5 font-medium">Employee</th>
            ) : null}
            <th className="px-4 py-2.5 font-medium">Type</th>
            <th className="px-4 py-2.5 font-medium">Dates</th>
            <th className="px-4 py-2.5 font-medium">Days</th>
            <th className="px-4 py-2.5 font-medium">Reason</th>
            <th className="px-4 py-2.5 font-medium">Status / review</th>
            {showActions ? (
              <th className="px-4 py-2.5 font-medium">Actions</th>
            ) : null}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row) => (
            <tr key={row.id} className="align-top">
              {showEmployee ? (
                <td className="px-4 py-3">
                  <div className="font-medium">{row.employeeName}</div>
                  <div className="text-xs text-muted-foreground">
                    {row.employeeEmail}
                  </div>
                </td>
              ) : null}
              <td className="px-4 py-3">{leaveTypeLabel[row.leaveType]}</td>
              <td className="px-4 py-3">
                <div className="whitespace-nowrap">
                  {formatLeaveRange(
                    row.startDate,
                    row.endDate,
                    row.startSession,
                    row.endSession,
                  )}
                </div>
              </td>
              <td className="px-4 py-3">
                <DaysCell request={row} />
              </td>
              <td className="max-w-[12rem] px-4 py-3 text-muted-foreground">
                <p className="line-clamp-2 min-w-0 break-words [overflow-wrap:anywhere]">
                  {row.reason || "—"}
                </p>
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={row.status} />
                <ReviewDetails request={row} />
              </td>
              {showActions ? (
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    {onApprove && row.status === "PENDING" ? (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          className="bg-[#188433] text-white hover:bg-[#14732c]"
                          disabled={reviewing}
                          onClick={() => onApprove(row)}
                        >
                          <Check className="size-3.5" />
                          Approve
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={reviewing}
                          onClick={() => onReject?.(row)}
                        >
                          <X className="size-3.5" />
                          Reject
                        </Button>
                      </>
                    ) : null}
                    {onDelete && canEmployeeDeleteLeave(row) ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={deleting}
                        onClick={() => onDelete(row)}
                      >
                        <Trash2 className="size-3.5" />
                        Delete
                      </Button>
                    ) : null}
                    {onApprove &&
                    row.status !== "PENDING" &&
                    !(onDelete && canEmployeeDeleteLeave(row)) ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : null}
                    {onDelete &&
                    !onApprove &&
                    !canEmployeeDeleteLeave(row) ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : null}
                  </div>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DaysCell({ request }: { request: LeaveRequest }) {
  const edited =
    request.status !== "PENDING" &&
    Math.abs(request.days - request.requestedDays) > 1e-9;

  return (
    <div className="tabular-nums">
      <span className="font-medium">{request.days}</span>
      {edited ? (
        <p className="text-xs text-muted-foreground">
          Requested {request.requestedDays}
        </p>
      ) : null}
    </div>
  );
}

function ReviewDetails({ request }: { request: LeaveRequest }) {
  if (request.status === "PENDING") {
    return null;
  }

  return (
    <div className="mt-2 max-w-[16rem] space-y-1 text-xs text-muted-foreground">
      {request.status === "REJECTED" && request.reviewNote ? (
        <p className="min-w-0 break-words [overflow-wrap:anywhere]">
          <span className="font-medium text-foreground">Rejected: </span>
          {request.reviewNote}
        </p>
      ) : null}
      {request.status === "APPROVED" &&
      request.daysEditReason &&
      Math.abs(request.days - request.requestedDays) > 1e-9 ? (
        <p className="min-w-0 break-words [overflow-wrap:anywhere]">
          <span className="font-medium text-foreground">Days changed: </span>
          {request.daysEditReason}
        </p>
      ) : null}
      {request.status === "APPROVED" && request.reviewNote ? (
        <p className="min-w-0 break-words [overflow-wrap:anywhere]">
          <span className="font-medium text-foreground">Note: </span>
          {request.reviewNote}
        </p>
      ) : null}
    </div>
  );
}

function StatusBadge({ status }: { status: LeaveStatus }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
        status === "PENDING" &&
          "bg-amber-500/15 text-amber-700 dark:text-amber-300",
        status === "APPROVED" &&
          "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
        status === "REJECTED" && "bg-destructive/10 text-destructive",
      )}
    >
      {status}
    </span>
  );
}
