-- Single Investment Account per client: designate one account for balance, deposit, withdrawal, interest.
-- Run in Supabase SQL editor after 003_funds_rates_and_requests.sql.

-- 1. Add column (nullable for clients with no account yet)
ALTER TABLE clients
ADD COLUMN IF NOT EXISTS investment_account_id INTEGER REFERENCES accounts(account_id);

-- 2. Backfill: set to one existing account per client (preserve current state, no new accounts).
-- Prefer the account that matches their single pamm_master row if it exists in accounts;
-- otherwise use the account with smallest account_id for that client.
UPDATE clients c
SET investment_account_id = (
  SELECT COALESCE(
    (
      SELECT p.id
      FROM pamm_master p
      WHERE p.client_id = c.id
        AND EXISTS (SELECT 1 FROM accounts a WHERE a.account_id = p.id AND a.client_id = c.id)
      ORDER BY p.id
      LIMIT 1
    ),
    (SELECT MIN(a.account_id) FROM accounts a WHERE a.client_id = c.id)
  )
)
WHERE EXISTS (SELECT 1 FROM accounts a WHERE a.client_id = c.id);

-- 3. One account can only be the investment account for one client
ALTER TABLE clients
ADD CONSTRAINT clients_investment_account_id_unique UNIQUE (investment_account_id);

-- Note: If the above unique constraint fails (one account linked to multiple clients), run:
-- UPDATE clients SET investment_account_id = NULL WHERE id IN (...);
-- then assign investment_account_id per client manually and re-add the constraint.
