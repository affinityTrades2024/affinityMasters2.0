-- Mark funds_requests created by admin so resulting transactions can be labeled
-- "Deposit by Admin" / "Withdrawal by Admin" in transaction history.

ALTER TABLE funds_requests
ADD COLUMN IF NOT EXISTS is_admin_initiated BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN funds_requests.is_admin_initiated IS 'True when the funds request was created by an admin on behalf of the user.';

