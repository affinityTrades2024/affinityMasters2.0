-- Link settlement transaction to pending_disbursal_entries so transaction history can show the same bank account.
ALTER TABLE pending_disbursal_entries
ADD COLUMN IF NOT EXISTS settlement_transaction_id BIGINT;

CREATE INDEX IF NOT EXISTS idx_pending_disbursal_entries_settlement_tx
ON pending_disbursal_entries(settlement_transaction_id) WHERE settlement_transaction_id IS NOT NULL;

COMMENT ON COLUMN pending_disbursal_entries.settlement_transaction_id IS 'Transaction id created when this entry was settled; used to show bank account in history.';
