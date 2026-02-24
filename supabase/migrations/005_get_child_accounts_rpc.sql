-- get_child_accounts RPC: return all descendants of myid in pamm_master (recursive).
-- Use explicit table/alias in the CTE so "pid" and other columns are not ambiguous.
-- Run after 004_investment_account.sql.

CREATE OR REPLACE FUNCTION get_child_accounts(myid INTEGER)
RETURNS TABLE (
  account_id INTEGER,
  pid INTEGER,
  account_number TEXT,
  client_id INTEGER,
  name TEXT,
  email TEXT,
  nickname TEXT,
  parent_account_number TEXT,
  parent_client_id INTEGER
)
LANGUAGE sql
STABLE
AS $$
  WITH RECURSIVE descendants AS (
    SELECT
      p.id,
      p.pid,
      p.account_number,
      p.client_id,
      p.name,
      p.email,
      p.nickname,
      p.parent_account_number,
      p.parent_client_id
    FROM pamm_master p
    WHERE p.pid = myid
    UNION ALL
    SELECT
      p.id,
      p.pid,
      p.account_number,
      p.client_id,
      p.name,
      p.email,
      p.nickname,
      p.parent_account_number,
      p.parent_client_id
    FROM pamm_master p
    INNER JOIN descendants d ON p.pid = d.id
  )
  SELECT
    d.id AS account_id,
    d.pid,
    d.account_number,
    d.client_id,
    d.name,
    d.email,
    d.nickname,
    d.parent_account_number,
    d.parent_client_id
  FROM descendants d;
$$;
