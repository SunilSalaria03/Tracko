DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'projects_name_unique'
  ) THEN
    ALTER TABLE projects ADD CONSTRAINT projects_name_unique UNIQUE (name);
  END IF;
END $$;

INSERT INTO projects (name, color)
SELECT v.name, v.color
FROM (
  VALUES
    ('Internal', '#188433'),
    ('Client Delivery', '#fa5d00')
) AS v(name, color)
WHERE NOT EXISTS (
  SELECT 1 FROM projects p WHERE p.name = v.name
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'tasks'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tasks_project_name_unique'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'work_types_project_name_unique'
  ) THEN
    ALTER TABLE tasks
      ADD CONSTRAINT tasks_project_name_unique UNIQUE (project_id, name);
  END IF;
END $$;

INSERT INTO tasks (project_id, name)
SELECT p.id, v.task_name
FROM (
  VALUES
    ('Internal', 'Development'),
    ('Internal', 'Code Review'),
    ('Internal', 'Team Meeting'),
    ('Internal', 'Documentation'),
    ('Internal', 'Bug Fixing'),
    ('Internal', 'Research'),
    ('Internal', 'Planning'),
    ('Client Delivery', 'Feature Development'),
    ('Client Delivery', 'UI Design'),
    ('Client Delivery', 'QA Testing'),
    ('Client Delivery', 'Client Support'),
    ('Client Delivery', 'Project Management'),
    ('Client Delivery', 'Requirements'),
    ('Client Delivery', 'Deployment'),
    ('Client Delivery', 'UAT')
) AS v(project_name, task_name)
JOIN projects p ON p.name = v.project_name
WHERE NOT EXISTS (
  SELECT 1
  FROM tasks t
  WHERE t.project_id = p.id AND t.name = v.task_name
);
