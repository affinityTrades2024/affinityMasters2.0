-- Registration: sequences for client_id and account_id (if not SERIAL), unique nickname, and register_new_user RPC.
-- Run after 004_investment_account.sql.

-- 1. Sequences for new client and account IDs (used when tables were created without SERIAL).
-- PostgreSQL SERIAL creates {table}_{column}_seq; we create only if missing and sync from current max.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_sequences WHERE schemaname = 'public' AND sequencename = 'clients_id_seq') THEN
    CREATE SEQUENCE clients_id_seq;
    PERFORM setval('clients_id_seq', COALESCE((SELECT MAX(id) FROM clients), 0) + 1);
  ELSE
    PERFORM setval('clients_id_seq', (SELECT COALESCE(MAX(id), 0) + 1 FROM clients));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_sequences WHERE schemaname = 'public' AND sequencename = 'accounts_account_id_seq') THEN
    CREATE SEQUENCE accounts_account_id_seq;
    PERFORM setval('accounts_account_id_seq', COALESCE((SELECT MAX(account_id) FROM accounts), 0) + 1);
  ELSE
    PERFORM setval('accounts_account_id_seq', (SELECT COALESCE(MAX(account_id), 0) + 1 FROM accounts));
  END IF;
END $$;

-- 2. Unique nickname: skipped because existing clients may have duplicate nicknames.
-- Uniqueness for new registrations is enforced in register_new_user() (SELECT before INSERT).

-- 3. RPC: register new user and create investment account in one transaction
CREATE OR REPLACE FUNCTION register_new_user(
  p_email TEXT,
  p_password TEXT,
  p_name TEXT,
  p_nickname TEXT,
  p_phone TEXT,
  p_country TEXT,
  p_birthday DATE
)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  v_email_clean TEXT;
  v_nickname_trim TEXT;
  v_client_id INTEGER;
  v_account_id INTEGER;
  v_account_number TEXT;
BEGIN
  v_email_clean := LOWER(TRIM(p_email));
  v_nickname_trim := NULLIF(TRIM(p_nickname), '');

  IF v_email_clean = '' THEN
    RAISE EXCEPTION 'Email is required';
  END IF;

  IF v_nickname_trim IS NULL THEN
    RAISE EXCEPTION 'Nickname is required';
  END IF;

  -- Check email not already registered
  IF EXISTS (SELECT 1 FROM auth_users WHERE LOWER(TRIM(email)) = v_email_clean) THEN
    RAISE EXCEPTION 'Email already registered';
  END IF;

  -- Check nickname unique
  IF EXISTS (SELECT 1 FROM clients WHERE nickname = v_nickname_trim) THEN
    RAISE EXCEPTION 'Nickname already taken';
  END IF;

  -- Reserve IDs from sequences
  v_client_id := nextval('clients_id_seq');
  v_account_id := nextval('accounts_account_id_seq');
  v_account_number := v_account_id::TEXT;

  -- Insert auth_users (login)
  INSERT INTO auth_users (email, password)
  VALUES (v_email_clean, p_password);

  -- Insert clients
  INSERT INTO clients (id, name, email, nickname, phone, country, birthday, created)
  VALUES (v_client_id, NULLIF(TRIM(p_name), ''), v_email_clean, v_nickname_trim, NULLIF(TRIM(p_phone), ''), NULLIF(TRIM(p_country), ''), p_birthday, NOW());

  -- Insert pamm_master (one top-level row per client; pid NULL)
  INSERT INTO pamm_master (id, pid, account_number, client_id, name, email, nickname)
  VALUES (v_account_id, NULL, v_account_number, v_client_id, NULLIF(TRIM(p_name), ''), v_email_clean, v_nickname_trim);

  -- Insert accounts (investment account)
  INSERT INTO accounts (
    account_id, account_number, client_id, client_name, email, country,
    product, platform, type, balance, free_funds, equity, created
  )
  VALUES (
    v_account_id, v_account_number, v_client_id, NULLIF(TRIM(p_name), ''),
    v_email_clean, NULLIF(TRIM(p_country), ''),
    'PAMM', 'Investment Account', 'investment',
    0, 0, 0, NOW()
  );

  -- Link client to investment account
  UPDATE clients
  SET investment_account_id = v_account_id
  WHERE id = v_client_id;

  RETURN json_build_object(
    'clientId', v_client_id,
    'accountId', v_account_id,
    'accountNumber', v_account_number
  );
END;
$$;
