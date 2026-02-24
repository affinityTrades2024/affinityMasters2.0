-- Create private Storage bucket for verification documents (S3-compatible).
-- Run after 007_verification_documents.sql.
-- Access is server-side only via API. Optional: set file_size_limit and allowed_mime_types in Dashboard.

INSERT INTO storage.buckets (id, name, public)
VALUES ('verification-docs', 'verification-docs', false)
ON CONFLICT (id) DO NOTHING;
