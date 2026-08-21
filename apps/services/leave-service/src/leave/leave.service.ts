import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PublicUser } from '../users/user.types';
import { ApplyLeaveDto, ReviewLeaveDto } from './dto/leave.dto';
import { LeaveRepository } from './leave.repository';
import {
  CASUAL_ACCRUAL_PER_MONTH,
  CASUAL_MIN_ADVANCE_DAYS,
  SICK_ACCRUAL_PER_MONTH,
  calculateLeaveDays,
  getContinuousLeaveError,
  type LeaveBalance,
  type LeaveRequest,
} from './leave.types';

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function addMonths(yearMonth: string, amount: number): string {
  const [year, month] = yearMonth.split('-').map(Number);
  const date = new Date(year, month - 1 + amount, 1);
  return monthKey(date);
}

function monthsBetweenInclusive(fromMonth: string, toMonth: string): number {
  const [fromY, fromM] = fromMonth.split('-').map(Number);
  const [toY, toM] = toMonth.split('-').map(Number);
  return (toY - fromY) * 12 + (toM - fromM) + 1;
}

@Injectable()
export class LeaveService {
  constructor(private readonly leaveRepository: LeaveRepository) {}

  async getMyBalance(user: PublicUser): Promise<{
    casualBalance: number;
    sickBalance: number;
    availableCasual: number;
    availableSick: number;
    lastAccrualMonth: string;
  }> {
    const balance = await this.ensureAccruedBalance(user.id);
    const pendingCasual = await this.leaveRepository.sumPendingDays(
      user.id,
      'CASUAL',
    );
    const pendingSick = await this.leaveRepository.sumPendingDays(
      user.id,
      'SICK',
    );

    return {
      casualBalance: balance.casualBalance,
      sickBalance: balance.sickBalance,
      availableCasual: round2(balance.casualBalance - pendingCasual),
      availableSick: round2(balance.sickBalance - pendingSick),
      lastAccrualMonth: balance.lastAccrualMonth,
    };
  }

  async listMyRequests(user: PublicUser): Promise<LeaveRequest[]> {
    return this.leaveRepository.listRequests({ userId: user.id });
  }

  async listAllRequests(
    user: PublicUser,
    status?: LeaveRequest['status'],
  ): Promise<LeaveRequest[]> {
    this.ensureAdmin(user);
    return this.leaveRepository.listRequests({ status });
  }

  async apply(user: PublicUser, dto: ApplyLeaveDto): Promise<LeaveRequest> {
    if (dto.endDate < dto.startDate) {
      throw new BadRequestException('End date must be on or after start date');
    }

    const today = toIsoDate(new Date());
    if (dto.startDate < today) {
      throw new BadRequestException('Cannot apply leave for past dates');
    }

    const continuityError = getContinuousLeaveError(
      dto.startDate,
      dto.endDate,
      dto.startSession,
      dto.endSession,
    );
    if (continuityError) {
      throw new BadRequestException(continuityError);
    }

    const days = calculateLeaveDays(
      dto.startDate,
      dto.endDate,
      dto.startSession,
      dto.endSession,
    );
    if (days < 0.5) {
      throw new BadRequestException('Leave duration must be at least 0.5 day');
    }

    if (dto.leaveType === 'CASUAL') {
      const minStart = toIsoDate(
        addDays(new Date(), CASUAL_MIN_ADVANCE_DAYS),
      );
      if (dto.startDate < minStart) {
        throw new BadRequestException(
          `Casual leave must be applied at least ${CASUAL_MIN_ADVANCE_DAYS} days in advance`,
        );
      }
    }

    if (dto.leaveType !== 'UNPAID') {
      const balance = await this.ensureAccruedBalance(user.id);
      const pending = await this.leaveRepository.sumPendingDays(
        user.id,
        dto.leaveType,
      );
      const available =
        dto.leaveType === 'CASUAL'
          ? balance.casualBalance - pending
          : balance.sickBalance - pending;

      if (days > available + 1e-9) {
        throw new BadRequestException(
          `Insufficient ${dto.leaveType.toLowerCase()} leave balance. Available: ${round2(available)} day(s)`,
        );
      }
    }

    return this.leaveRepository.createRequest({
      userId: user.id,
      leaveType: dto.leaveType,
      startDate: dto.startDate,
      endDate: dto.endDate,
      startSession: dto.startSession,
      endSession: dto.endSession,
      days,
      reason: dto.reason.trim(),
    });
  }

  async review(
    admin: PublicUser,
    id: string,
    dto: ReviewLeaveDto,
  ): Promise<LeaveRequest> {
    this.ensureAdmin(admin);

    const existing = await this.leaveRepository.findRequestById(id);
    if (!existing) {
      throw new NotFoundException('Leave request not found');
    }
    if (existing.status !== 'PENDING') {
      throw new BadRequestException('Only pending leave can be reviewed');
    }

    if (dto.status === 'REJECTED') {
      const note = dto.reviewNote?.trim();
      if (!note) {
        throw new BadRequestException('Rejection reason is required');
      }

      const updated = await this.leaveRepository.reviewRequest({
        id,
        status: 'REJECTED',
        reviewedBy: admin.id,
        reviewNote: note,
        daysEditReason: null,
      });

      if (!updated || updated.status !== 'REJECTED') {
        throw new BadRequestException('Unable to reject leave request');
      }
      return updated;
    }

    const approvedDays =
      dto.approvedDays !== undefined
        ? round2(Number(dto.approvedDays))
        : existing.days;

    if (!Number.isFinite(approvedDays) || approvedDays < 0.5) {
      throw new BadRequestException('Approved days must be at least 0.5');
    }
    if (approvedDays > existing.requestedDays + 1e-9) {
      throw new BadRequestException(
        'Approved days cannot exceed requested days',
      );
    }

    const daysChanged =
      Math.abs(approvedDays - existing.requestedDays) > 1e-9;
    const daysEditReason = dto.daysEditReason?.trim() || '';

    if (daysChanged && !daysEditReason) {
      throw new BadRequestException(
        'Reason is required when changing approved days',
      );
    }

    if (existing.leaveType !== 'UNPAID') {
      const balance = await this.ensureAccruedBalance(existing.userId);
      if (existing.leaveType === 'CASUAL') {
        if (approvedDays > balance.casualBalance + 1e-9) {
          throw new BadRequestException(
            'Employee no longer has enough casual leave balance',
          );
        }
        await this.leaveRepository.upsertBalance({
          userId: existing.userId,
          casualBalance: round2(balance.casualBalance - approvedDays),
          sickBalance: balance.sickBalance,
          lastAccrualMonth: balance.lastAccrualMonth,
        });
      } else if (existing.leaveType === 'SICK') {
        if (approvedDays > balance.sickBalance + 1e-9) {
          throw new BadRequestException(
            'Employee no longer has enough sick leave balance',
          );
        }
        await this.leaveRepository.upsertBalance({
          userId: existing.userId,
          casualBalance: balance.casualBalance,
          sickBalance: round2(balance.sickBalance - approvedDays),
          lastAccrualMonth: balance.lastAccrualMonth,
        });
      }
    }

    const updated = await this.leaveRepository.reviewRequest({
      id,
      status: 'APPROVED',
      reviewedBy: admin.id,
      reviewNote: dto.approveNote?.trim() || dto.reviewNote?.trim() || null,
      days: approvedDays,
      daysEditReason: daysChanged ? daysEditReason : null,
    });

    if (!updated || updated.status !== 'APPROVED') {
      throw new BadRequestException('Unable to approve leave request');
    }

    return updated;
  }

  async deleteMyRequest(
    user: PublicUser,
    id: string,
  ): Promise<{ ok: true }> {
    const existing = await this.leaveRepository.findRequestById(id);
    if (!existing || existing.userId !== user.id) {
      throw new NotFoundException('Leave request not found');
    }

    if (existing.status !== 'PENDING' && existing.status !== 'APPROVED') {
      throw new BadRequestException(
        'Only pending or approved leave can be deleted',
      );
    }

    const today = toIsoDate(new Date());
    if (existing.startDate < today) {
      throw new BadRequestException(
        'Only upcoming leave (starting today or later) can be deleted',
      );
    }

    if (
      existing.status === 'APPROVED' &&
      existing.leaveType !== 'UNPAID'
    ) {
      const balance = await this.ensureAccruedBalance(user.id);
      if (existing.leaveType === 'CASUAL') {
        await this.leaveRepository.upsertBalance({
          userId: user.id,
          casualBalance: round2(balance.casualBalance + existing.days),
          sickBalance: balance.sickBalance,
          lastAccrualMonth: balance.lastAccrualMonth,
        });
      } else if (existing.leaveType === 'SICK') {
        await this.leaveRepository.upsertBalance({
          userId: user.id,
          casualBalance: balance.casualBalance,
          sickBalance: round2(balance.sickBalance + existing.days),
          lastAccrualMonth: balance.lastAccrualMonth,
        });
      }
    }

    const deleted = await this.leaveRepository.deleteRequest(id, user.id);
    if (!deleted) {
      throw new BadRequestException('Unable to delete leave request');
    }

    return { ok: true };
  }

  /** Accrue 1 casual + 0.5 sick for each month since last accrual (or join month). */
  private async ensureAccruedBalance(userId: string): Promise<LeaveBalance> {
    const createdAt = await this.leaveRepository.findUserCreatedAt(userId);
    if (!createdAt) {
      throw new NotFoundException('User not found');
    }

    const joinMonth = monthKey(new Date(createdAt));
    const currentMonth = monthKey(new Date());
    const existing = await this.leaveRepository.getBalance(userId);

    if (!existing) {
      const months = monthsBetweenInclusive(joinMonth, currentMonth);
      return this.leaveRepository.upsertBalance({
        userId,
        casualBalance: round2(months * CASUAL_ACCRUAL_PER_MONTH),
        sickBalance: round2(months * SICK_ACCRUAL_PER_MONTH),
        lastAccrualMonth: currentMonth,
      });
    }

    if (existing.lastAccrualMonth >= currentMonth) {
      return existing;
    }

    const firstMissing = addMonths(existing.lastAccrualMonth, 1);
    const monthsToAdd = monthsBetweenInclusive(firstMissing, currentMonth);
    if (monthsToAdd <= 0) {
      return existing;
    }

    return this.leaveRepository.upsertBalance({
      userId,
      casualBalance: round2(
        existing.casualBalance + monthsToAdd * CASUAL_ACCRUAL_PER_MONTH,
      ),
      sickBalance: round2(
        existing.sickBalance + monthsToAdd * SICK_ACCRUAL_PER_MONTH,
      ),
      lastAccrualMonth: currentMonth,
    });
  }

  private ensureAdmin(user: PublicUser): void {
    if (user.role !== 'ADMIN') {
      throw new ForbiddenException('Admin access required');
    }
  }
}

function addDays(date: Date, amount: number): Date {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + amount);
  return next;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
