-- In-app notifications: table and indexes for bell dropdown.
-- recipient_type 'user' => recipient_id = client_id; 'admin' => recipient_id NULL (all admins).

CREATE TABLE IF NOT EXISTS notifications (
  id BIGSERIAL PRIMARY KEY,
  recipient_type TEXT NOT NULL CHECK (recipient_type IN ('user', 'admin')),
  recipient_id BIGINT,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT NOT NULL,
  payload JSONB,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread_created
  ON notifications (recipient_type, recipient_id, read_at, created_at DESC);

COMMENT ON TABLE notifications IS 'In-app notifications for users and admins; read_at NULL = unread';
