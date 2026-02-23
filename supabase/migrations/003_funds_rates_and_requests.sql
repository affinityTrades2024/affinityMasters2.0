-- Funds: admin-configurable USD/INR rates and pending deposit/withdrawal requests.
-- Run in Supabase SQL editor after 002_admin_users.sql.

-- 1. Funds rates (single row, id = 1)
CREATE TABLE IF NOT EXISTS funds_rates (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    deposit_inr_per_usd DECIMAL(10,4) NOT NULL DEFAULT 84,
    withdrawal_inr_per_usd DECIMAL(10,4) NOT NULL DEFAULT 82,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO funds_rates (id, deposit_inr_per_usd, withdrawal_inr_per_usd)
VALUES (1, 84, 82)
ON CONFLICT (id) DO NOTHING;

-- 2. Pending funds requests (deposit/withdrawal) – reflected in transactions only when approved
CREATE TABLE IF NOT EXISTS funds_requests (
    id BIGSERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES clients(id),
    type TEXT NOT NULL CHECK (type IN ('deposit', 'withdrawal')),
    account_id INTEGER NOT NULL,
    amount_usd DECIMAL(20,6) NOT NULL,
    amount_inr DECIMAL(20,2) NOT NULL,
    rate_used DECIMAL(10,4) NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    reviewed_by_admin_id INTEGER REFERENCES admin_users(id),
    transaction_id INTEGER REFERENCES transactions(id)
);

CREATE INDEX IF NOT EXISTS idx_funds_requests_client_id ON funds_requests(client_id);
CREATE INDEX IF NOT EXISTS idx_funds_requests_status ON funds_requests(status);
CREATE INDEX IF NOT EXISTS idx_funds_requests_requested_at ON funds_requests(requested_at DESC);
