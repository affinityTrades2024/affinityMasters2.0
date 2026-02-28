-- Partial withdrawal: pending disbursal entries and funds_requests columns.

-- 1. Add columns to funds_requests for partial disbursement
ALTER TABLE funds_requests
ADD COLUMN IF NOT EXISTS disbursed_amount_usd DECIMAL(20,6);

ALTER TABLE funds_requests
ADD COLUMN IF NOT EXISTS partial_withdrawal_comment TEXT;

COMMENT ON COLUMN funds_requests.disbursed_amount_usd IS 'Amount actually disbursed; NULL or equal to amount_usd means full disbursement.';
COMMENT ON COLUMN funds_requests.partial_withdrawal_comment IS 'Mandatory admin comment when doing partial disbursement.';

-- 2. Pending disbursal entries (difference from partial withdrawal; settled later by admin)
CREATE TABLE IF NOT EXISTS pending_disbursal_entries (
  id BIGSERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES clients(id),
  amount_usd DECIMAL(20,6) NOT NULL CHECK (amount_usd > 0),
  source_funds_request_id BIGINT NOT NULL REFERENCES funds_requests(id),
  admin_comments TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'settled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  settled_at TIMESTAMPTZ,
  settled_by_admin_id INTEGER REFERENCES admin_users(id),
  settlement_comments TEXT
);

CREATE INDEX IF NOT EXISTS idx_pending_disbursal_entries_client_id ON pending_disbursal_entries(client_id);
CREATE INDEX IF NOT EXISTS idx_pending_disbursal_entries_status ON pending_disbursal_entries(status);
CREATE INDEX IF NOT EXISTS idx_pending_disbursal_entries_created_at ON pending_disbursal_entries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pending_disbursal_entries_source_request ON pending_disbursal_entries(source_funds_request_id);

COMMENT ON TABLE pending_disbursal_entries IS 'Amounts owed to users from partial withdrawals; admin settles to credit account and close entry.';
