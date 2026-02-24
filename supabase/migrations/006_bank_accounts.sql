-- Bank accounts per client (for withdrawal destination).
-- Run after 004_investment_account.sql.

CREATE TABLE IF NOT EXISTS bank_accounts (
    id BIGSERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    bank TEXT NOT NULL,
    account_number TEXT NOT NULL,
    ifsc_code TEXT NOT NULL,
    is_default BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bank_accounts_client_id ON bank_accounts(client_id);

-- Only one default per client: partial unique index
CREATE UNIQUE INDEX IF NOT EXISTS idx_bank_accounts_one_default_per_client
ON bank_accounts (client_id) WHERE is_default = true;

-- Add bank_account_id to funds_requests (nullable for backward compatibility)
ALTER TABLE funds_requests
ADD COLUMN IF NOT EXISTS bank_account_id BIGINT REFERENCES bank_accounts(id);

CREATE INDEX IF NOT EXISTS idx_funds_requests_bank_account_id ON funds_requests(bank_account_id);
