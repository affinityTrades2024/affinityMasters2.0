-- Withdrawal disbursement: new statuses and admin_notes.
-- Run after 006_bank_accounts.sql.

-- 1. Drop existing status CHECK and add new one (allows approved_pending_disbursement, disbursed)
ALTER TABLE funds_requests
DROP CONSTRAINT IF EXISTS funds_requests_status_check;

ALTER TABLE funds_requests
ADD CONSTRAINT funds_requests_status_check CHECK (
  status IN (
    'pending',
    'approved',
    'rejected',
    'approved_pending_disbursement',
    'disbursed'
  )
);

-- 2. Add disbursement and notes columns
ALTER TABLE funds_requests
ADD COLUMN IF NOT EXISTS disbursed_at TIMESTAMPTZ;

ALTER TABLE funds_requests
ADD COLUMN IF NOT EXISTS admin_notes TEXT;

COMMENT ON COLUMN funds_requests.admin_notes IS 'Optional: transaction details when approving deposit, or reference/comment when marking withdrawal disbursed';
