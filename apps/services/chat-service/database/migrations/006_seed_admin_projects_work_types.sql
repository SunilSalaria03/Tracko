INSERT INTO users (
  first_name,
  last_name,
  email,
  password_hash,
  role,
  auth_provider
)
SELECT
  'Tracko',
  'Admin',
  'admin@tracko.local',
  '$2b$12$m.2VsFQGXSAHMpGfgyVff.sktMPfSL3zmdfpBvCmtzwPObaeHMdou',
  'ADMIN',
  'LOCAL'
WHERE NOT EXISTS (
  SELECT 1 FROM users WHERE LOWER(email) = 'admin@tracko.local'
);

INSERT INTO projects (name, color)
SELECT v.name, v.color
FROM (
  VALUES
    ('Internal', '#188433'),
    ('Client Delivery', '#fa5d00')
) AS v(name, color)
WHERE NOT EXISTS (SELECT 1 FROM projects);

INSERT INTO work_types (project_id, name)
SELECT p.id, v.work_type
FROM (
  VALUES
    ('Internal', 'Development'),
    ('Internal', 'Code Review'),
    ('Internal', 'Team Meeting'),
    ('Internal', 'Documentation'),
    ('Client Delivery', 'Feature Development'),
    ('Client Delivery', 'UI Design'),
    ('Client Delivery', 'QA Testing'),
    ('Client Delivery', 'Client Support'),
    ('Client Delivery', 'Project Management')
) AS v(project_name, work_type)
JOIN projects p ON p.name = v.project_name
WHERE NOT EXISTS (SELECT 1 FROM work_types);
