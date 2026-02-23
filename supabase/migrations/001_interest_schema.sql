-- Run these in your Supabase SQL editor to enable daily interest and admin features.
-- 1. Add interest rate to accounts (default 3% monthly)
ALTER TABLE accounts
ADD COLUMN IF NOT EXISTS interest_rate_monthly DECIMAL(5,2) DEFAULT 3;

-- 2. Allow new transaction types (no schema change needed if type is VARCHAR)
-- Use type 'daily_interest' and 'partnership_fee_admin' in application.

-- 3. Log for daily interest credits and skip/review
CREATE TABLE IF NOT EXISTS interest_credit_log (
    id BIGSERIAL PRIMARY KEY,
    account_id INTEGER NOT NULL REFERENCES accounts(account_id),
    for_date DATE NOT NULL,
    transaction_id INTEGER REFERENCES transactions(id),
    status TEXT NOT NULL CHECK (status IN ('credited', 'skipped', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(account_id, for_date)
);

CREATE INDEX IF NOT EXISTS idx_interest_credit_log_account_date
ON interest_credit_log(account_id, for_date);

CREATE INDEX IF NOT EXISTS idx_interest_credit_log_status
ON interest_credit_log(status) WHERE status = 'skipped';
