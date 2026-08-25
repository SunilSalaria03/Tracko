-- Leave balances and leave requests

CREATE TABLE IF NOT EXISTS leave_balances (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  casual_balance NUMERIC(8, 2) NOT NULL DEFAULT 0
    CHECK (casual_balance >= 0),
  sick_balance NUMERIC(8, 2) NOT NULL DEFAULT 0
    CHECK (sick_balance >= 0),
  last_accrual_month TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  leave_type TEXT NOT NULL
    CHECK (leave_type IN ('SICK', 'CASUAL', 'UNPAID')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days NUMERIC(8, 2) NOT NULL CHECK (days > 0),
  reason TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT leave_requests_dates_check CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS leave_requests_user_id_idx
  ON leave_requests (user_id);

CREATE INDEX IF NOT EXISTS leave_requests_status_idx
  ON leave_requests (status);

CREATE INDEX IF NOT EXISTS leave_requests_start_date_idx
  ON leave_requests (start_date);
