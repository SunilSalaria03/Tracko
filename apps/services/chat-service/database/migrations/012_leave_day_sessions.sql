-- Half-day leave sessions (first half / second half / full)

ALTER TABLE leave_requests
  ADD COLUMN IF NOT EXISTS start_session TEXT NOT NULL DEFAULT 'FULL';

ALTER TABLE leave_requests
  ADD COLUMN IF NOT EXISTS end_session TEXT NOT NULL DEFAULT 'FULL';

ALTER TABLE leave_requests
  DROP CONSTRAINT IF EXISTS leave_requests_start_session_check;

ALTER TABLE leave_requests
  ADD CONSTRAINT leave_requests_start_session_check
  CHECK (start_session IN ('FULL', 'FIRST_HALF', 'SECOND_HALF'));

ALTER TABLE leave_requests
  DROP CONSTRAINT IF EXISTS leave_requests_end_session_check;

ALTER TABLE leave_requests
  ADD CONSTRAINT leave_requests_end_session_check
  CHECK (end_session IN ('FULL', 'FIRST_HALF', 'SECOND_HALF'));
