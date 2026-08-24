DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'timesheet_entries'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'timesheet_entries'
      AND column_name = 'task_id'
  ) THEN
    DROP TABLE timesheet_entries CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS timesheet_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL,
  hours NUMERIC(5, 2) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT timesheet_entries_hours_check CHECK (hours > 0 AND hours <= 24)
);

CREATE INDEX IF NOT EXISTS timesheet_entries_user_date_idx
  ON timesheet_entries (user_id, entry_date DESC);

CREATE INDEX IF NOT EXISTS timesheet_entries_project_idx
  ON timesheet_entries (project_id);

CREATE INDEX IF NOT EXISTS timesheet_entries_task_idx
  ON timesheet_entries (task_id);
