-- Admin portal: separate table for admin users (replaces manager email list in config).
-- Run in Supabase SQL editor after 001_interest_schema.sql.

CREATE TABLE IF NOT EXISTS admin_users (
    id SERIAL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'super_admin')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookup by lowercase email (match auth_users style)
CREATE INDEX IF NOT EXISTS idx_admin_users_email_lower ON admin_users (LOWER(TRIM(email)));

-- Optional: seed with previous managers (run once; adjust emails as needed)
-- INSERT INTO admin_users (email, role) VALUES
--   ('skarkhanis95@gmail.com', 'admin'),
--   ('sagar@affinitytrades.com', 'admin'),
--   ('contact@affinitytrades.com', 'admin')
-- ON CONFLICT (email) DO NOTHING;
