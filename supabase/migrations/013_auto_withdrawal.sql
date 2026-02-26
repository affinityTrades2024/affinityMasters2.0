-- Auto withdrawal: client opt-in, optional funds_requests flag, and cron job run history.

-- 1. Client auto-withdrawal settings
ALTER TABLE clients
ADD COLUMN IF NOT EXISTS auto_withdrawal_enabled BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE clients
ADD COLUMN IF NOT EXISTS auto_withdrawal_enabled_at TIMESTAMPTZ;

COMMENT ON COLUMN clients.auto_withdrawal_enabled IS 'When true, monthly auto-withdrawal creates a withdrawal request on 1st at 01:00 UTC to default bank.';
COMMENT ON COLUMN clients.auto_withdrawal_enabled_at IS 'When the user confirmed and enabled auto withdrawal.';

-- 2. Optional: mark auto-created withdrawal requests (for admin display)
ALTER TABLE funds_requests
ADD COLUMN IF NOT EXISTS is_auto_withdrawal BOOLEAN NOT NULL DEFAULT false;

-- 3. Cron job run history (daily_interest, auto_withdrawal)
CREATE TABLE IF NOT EXISTS cron_job_runs (
  id BIGSERIAL PRIMARY KEY,
  job_type TEXT NOT NULL CHECK (job_type IN ('daily_interest', 'auto_withdrawal')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'partial')),
  summary JSONB,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_cron_job_runs_job_type ON cron_job_runs(job_type);
CREATE INDEX IF NOT EXISTS idx_cron_job_runs_started_at ON cron_job_runs(started_at DESC);

COMMENT ON TABLE cron_job_runs IS 'History of cron job executions for admin visibility (success/failed/skipped counts).';
