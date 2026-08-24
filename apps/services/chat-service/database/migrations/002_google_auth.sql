ALTER TABLE users
  ALTER COLUMN password_hash DROP NOT NULL;

ALTER TABLE users
  ADD COLUMN google_id TEXT,
  ADD COLUMN auth_provider TEXT NOT NULL DEFAULT 'LOCAL';

ALTER TABLE users
  ADD CONSTRAINT users_google_id_unique UNIQUE (google_id);

ALTER TABLE users
  ADD CONSTRAINT users_auth_provider_check CHECK (auth_provider IN ('LOCAL', 'GOOGLE'));

ALTER TABLE users
  ADD CONSTRAINT users_password_or_google CHECK (
    password_hash IS NOT NULL OR google_id IS NOT NULL
  );
