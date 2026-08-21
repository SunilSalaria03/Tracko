import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import type {
  DaySession,
  LeaveBalance,
  LeaveRequest,
  LeaveStatus,
  LeaveType,
} from './leave.types';

type BalanceRow = {
  user_id: string;
  casual_balance: string;
  sick_balance: string;
  last_accrual_month: string;
  updated_at: string;
};

type LeaveRequestRow = {
  id: string;
  user_id: string;
  employee_name: string;
  employee_email: string;
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  start_session: DaySession;
  end_session: DaySession;
  days: string;
  requested_days: string;
  reason: string;
  status: LeaveStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  days_edit_reason: string | null;
  created_at: string;
  updated_at: string;
};

const LEAVE_REQUEST_SELECT = `
  lr.id,
  lr.user_id,
  TRIM(CONCAT(u.first_name, ' ', u.last_name)) AS employee_name,
  u.email AS employee_email,
  lr.leave_type,
  TO_CHAR(lr.start_date, 'YYYY-MM-DD') AS start_date,
  TO_CHAR(lr.end_date, 'YYYY-MM-DD') AS end_date,
  lr.start_session,
  lr.end_session,
  lr.days::text,
  lr.requested_days::text,
  lr.reason,
  lr.status,
  lr.reviewed_by,
  lr.reviewed_at::text,
  lr.review_note,
  lr.days_edit_reason,
  lr.created_at::text,
  lr.updated_at::text
`;

@Injectable()
export class LeaveRepository {
  constructor(private readonly database: DatabaseService) {}

  async findUserCreatedAt(userId: string): Promise<string | null> {
    const result = await this.database.query<{ created_at: string }>(
      `SELECT created_at::text FROM users WHERE id = $1`,
      [userId],
    );
    return result.rows[0]?.created_at ?? null;
  }

  async getBalance(userId: string): Promise<LeaveBalance | null> {
    const result = await this.database.query<BalanceRow>(
      `
        SELECT
          user_id,
          casual_balance::text,
          sick_balance::text,
          last_accrual_month,
          updated_at::text
        FROM leave_balances
        WHERE user_id = $1
      `,
      [userId],
    );
    return result.rows[0] ? this.toBalance(result.rows[0]) : null;
  }

  async upsertBalance(input: {
    userId: string;
    casualBalance: number;
    sickBalance: number;
    lastAccrualMonth: string;
  }): Promise<LeaveBalance> {
    const result = await this.database.query<BalanceRow>(
      `
        INSERT INTO leave_balances (
          user_id, casual_balance, sick_balance, last_accrual_month, updated_at
        )
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT (user_id) DO UPDATE SET
          casual_balance = EXCLUDED.casual_balance,
          sick_balance = EXCLUDED.sick_balance,
          last_accrual_month = EXCLUDED.last_accrual_month,
          updated_at = NOW()
        RETURNING
          user_id,
          casual_balance::text,
          sick_balance::text,
          last_accrual_month,
          updated_at::text
      `,
      [
        input.userId,
        input.casualBalance,
        input.sickBalance,
        input.lastAccrualMonth,
      ],
    );
    return this.toBalance(result.rows[0]);
  }

  async sumPendingDays(
    userId: string,
    leaveType: LeaveType,
  ): Promise<number> {
    const result = await this.database.query<{ total: string }>(
      `
        SELECT COALESCE(SUM(days), 0)::text AS total
        FROM leave_requests
        WHERE user_id = $1
          AND leave_type = $2
          AND status = 'PENDING'
      `,
      [userId, leaveType],
    );
    return Number(result.rows[0]?.total ?? 0);
  }

  async createRequest(input: {
    userId: string;
    leaveType: LeaveType;
    startDate: string;
    endDate: string;
    startSession: DaySession;
    endSession: DaySession;
    days: number;
    reason: string;
  }): Promise<LeaveRequest> {
    const result = await this.database.query<{ id: string }>(
      `
        INSERT INTO leave_requests (
          user_id, leave_type, start_date, end_date,
          start_session, end_session, days, requested_days, reason, status
        )
        VALUES ($1, $2, $3::date, $4::date, $5, $6, $7, $7, $8, 'PENDING')
        RETURNING id
      `,
      [
        input.userId,
        input.leaveType,
        input.startDate,
        input.endDate,
        input.startSession,
        input.endSession,
        input.days,
        input.reason,
      ],
    );
    const created = await this.findRequestById(result.rows[0].id);
    if (!created) {
      throw new Error('Failed to load created leave request');
    }
    return created;
  }

  async findRequestById(id: string): Promise<LeaveRequest | null> {
    const result = await this.database.query<LeaveRequestRow>(
      `
        SELECT ${LEAVE_REQUEST_SELECT}
        FROM leave_requests lr
        JOIN users u ON u.id = lr.user_id
        WHERE lr.id = $1
      `,
      [id],
    );
    return result.rows[0] ? this.toRequest(result.rows[0]) : null;
  }

  async listRequests(input: {
    userId?: string;
    status?: LeaveStatus;
  }): Promise<LeaveRequest[]> {
    const result = await this.database.query<LeaveRequestRow>(
      `
        SELECT ${LEAVE_REQUEST_SELECT}
        FROM leave_requests lr
        JOIN users u ON u.id = lr.user_id
        WHERE ($1::uuid IS NULL OR lr.user_id = $1::uuid)
          AND ($2::text IS NULL OR lr.status = $2::text)
        ORDER BY lr.created_at DESC
      `,
      [input.userId ?? null, input.status ?? null],
    );
    return result.rows.map((row) => this.toRequest(row));
  }

  async reviewRequest(input: {
    id: string;
    status: 'APPROVED' | 'REJECTED';
    reviewedBy: string;
    reviewNote?: string | null;
    days?: number;
    daysEditReason?: string | null;
  }): Promise<LeaveRequest | null> {
    await this.database.query(
      `
        UPDATE leave_requests
        SET
          status = $2,
          reviewed_by = $3,
          reviewed_at = NOW(),
          review_note = $4,
          days = COALESCE($5, days),
          days_edit_reason = $6,
          updated_at = NOW()
        WHERE id = $1 AND status = 'PENDING'
      `,
      [
        input.id,
        input.status,
        input.reviewedBy,
        input.reviewNote?.trim() || null,
        input.days ?? null,
        input.daysEditReason?.trim() || null,
      ],
    );
    return this.findRequestById(input.id);
  }

  async deleteRequest(id: string, userId: string): Promise<boolean> {
    const result = await this.database.query(
      `
        DELETE FROM leave_requests
        WHERE id = $1 AND user_id = $2
      `,
      [id, userId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  private toBalance(row: BalanceRow): LeaveBalance {
    return {
      userId: row.user_id,
      casualBalance: Number(row.casual_balance),
      sickBalance: Number(row.sick_balance),
      lastAccrualMonth: row.last_accrual_month,
      updatedAt: row.updated_at,
    };
  }

  private toRequest(row: LeaveRequestRow): LeaveRequest {
    return {
      id: row.id,
      userId: row.user_id,
      employeeName: row.employee_name,
      employeeEmail: row.employee_email,
      leaveType: row.leave_type,
      startDate: row.start_date,
      endDate: row.end_date,
      startSession: row.start_session,
      endSession: row.end_session,
      days: Number(row.days),
      requestedDays: Number(row.requested_days),
      reason: row.reason,
      status: row.status,
      reviewedBy: row.reviewed_by,
      reviewedAt: row.reviewed_at,
      reviewNote: row.review_note,
      daysEditReason: row.days_edit_reason,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
