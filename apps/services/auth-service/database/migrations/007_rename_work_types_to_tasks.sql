DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'work_types'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'tasks'
  ) THEN
    ALTER TABLE work_types RENAME TO tasks;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'work_types_project_name_unique'
  ) THEN
    ALTER TABLE tasks RENAME CONSTRAINT work_types_project_name_unique TO tasks_project_name_unique;
  END IF;
END $$;

ALTER INDEX IF EXISTS work_types_project_id_idx RENAME TO tasks_project_id_idx;
