-- Verification documents (metadata); files stored in Supabase Storage bucket 'verification-docs'.
-- Run after 006_bank_accounts.sql.

CREATE TABLE IF NOT EXISTS verification_documents (
    id BIGSERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    mime_type TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(client_id, description)
);

CREATE INDEX IF NOT EXISTS idx_verification_documents_client_id ON verification_documents(client_id);

-- Note: Create Storage bucket 'verification-docs' (private) in Supabase Dashboard or via API.
-- Application enforces 10MB total size per client and uploads via server-side Supabase client.
