CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_low UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  user_high UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT conversations_two_users CHECK (user_low <> user_high),
  CONSTRAINT conversations_pair UNIQUE (user_low, user_high)
);

CREATE INDEX IF NOT EXISTS conversations_user_low_idx ON conversations (user_low);
CREATE INDEX IF NOT EXISTS conversations_user_high_idx ON conversations (user_high);

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT messages_body_not_empty CHECK (char_length(btrim(body)) > 0)
);

CREATE INDEX IF NOT EXISTS messages_conversation_created_idx
  ON messages (conversation_id, created_at);
