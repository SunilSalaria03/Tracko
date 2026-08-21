-- Track original requested days and admin day-edit reason

ALTER TABLE leave_requests
  ADD COLUMN IF NOT EXISTS requested_days NUMERIC(8, 2);

UPDATE leave_requests
SET requested_days = days
WHERE requested_days IS NULL;

ALTER TABLE leave_requests
  ALTER COLUMN requested_days SET NOT NULL;

ALTER TABLE leave_requests
  DROP CONSTRAINT IF EXISTS leave_requests_requested_days_check;

ALTER TABLE leave_requests
  ADD CONSTRAINT leave_requests_requested_days_check
  CHECK (requested_days > 0);

ALTER TABLE leave_requests
  ADD COLUMN IF NOT EXISTS days_edit_reason TEXT;
