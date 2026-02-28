-- Verify why transaction IDs 17752, 17249, 17229, 16746, 16743, 16252, 16245, 17618, 17606
-- are missing for client_id = 103.
-- Run in Supabase SQL editor or psql.

-- 1) Account IDs that should be in myAccountIds for client 103:
--    (accounts: type = 'investment' OR type IS NULL OR product = 'PAMM Investor' OR product = 'eWallet'; plus pamm_master ids)
WITH client_accounts AS (
  SELECT account_id AS id FROM accounts
  WHERE client_id = 103
    AND (type = 'investment' OR type IS NULL OR product = 'PAMM Investor' OR product = 'eWallet')
  UNION
  SELECT id FROM pamm_master WHERE client_id = 103
)
SELECT 'Client 103 account IDs (myAccountIds)' AS label, id FROM client_accounts ORDER BY id;

-- 2) The 9 missing transactions: their source/destination and whether those are in client_accounts
WITH client_accounts AS (
  SELECT account_id AS id FROM accounts
  WHERE client_id = 103
    AND (type = 'investment' OR type IS NULL OR product = 'PAMM Investor' OR product = 'eWallet')
  UNION
  SELECT id FROM pamm_master WHERE client_id = 103
)
SELECT
  t.id,
  t.source_account_id,
  t.destination_account_id,
  t.operation_date,
  t.type,
  (t.source_account_id IN (SELECT id FROM client_accounts))   AS source_in_my_accounts,
  (t.destination_account_id IN (SELECT id FROM client_accounts)) AS dest_in_my_accounts
FROM transactions t
WHERE t.id IN (17752, 17249, 17229, 16746, 16743, 16252, 16245, 17618, 17606)
ORDER BY t.id;

-- 3) If both source_in_my_accounts and dest_in_my_accounts are false for any row,
--    that transaction is correctly excluded. If either is true, it should appear in the app;
--    then the issue was likely pagination (fixed by ordering by id as tie-breaker).
