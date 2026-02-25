-- Per-account flag: only accounts with interest_credit_enabled = true receive daily interest (automatic or manual).
-- Run after 001_interest_schema.sql (accounts table exists).

ALTER TABLE accounts
ADD COLUMN IF NOT EXISTS interest_credit_enabled BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN accounts.interest_credit_enabled IS 'When true, this account receives daily interest (cron or manual credit). When false, interest is skipped.';
