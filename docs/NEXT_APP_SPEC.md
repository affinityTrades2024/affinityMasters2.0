# Affinity CRM – Spec for Next.js App

This document describes the **current Flask app** (data structure, UI, business logic) so an AI agent or developer can build the **new Next.js app** against the same Supabase backend, with **new/simpler business logic** and **no forced password change** for existing users.

---

## 1. What This App Is Today

- **Product:** Affinity Trades CRM – client-facing dashboard for PAMM (Percentage Allocation Management Module) investors.
- **Current stack:** Flask (Python), server-rendered Jinja templates, Supabase (PostgreSQL) as the only data source. Third-party APIs are disabled; all user-facing flows use Supabase.
- **Users:** End clients (investors) and a small set of “managers” (admin-style access to edit `pamm_master`).
- **Core flows:** Login → Dashboard (balances, profit, returns) → Transactions history → Team org chart (referral tree) → PAMM accounts. Wallets, Deposit, Transfer, Withdrawal, and Registration show an “upgrading” notice.

---

## 2. Supabase Schema (Single Source of Truth)

The Next.js app must use the **same Supabase project**. Schema below.

### 2.1 Tables

```sql
-- clients: one row per user/person (linked to auth by email)
CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY,
    name TEXT,
    email TEXT,
    nickname TEXT,
    status TEXT,
    phone TEXT,
    country TEXT,
    jurisdiction TEXT,
    city TEXT,
    birthday DATE,
    tags TEXT,
    manager TEXT,
    types TEXT,
    internal_client_type TEXT,
    verification_level TEXT,
    company_short TEXT,
    company_full TEXT,
    risk_level TEXT,
    last_login TIMESTAMPTZ,
    created TIMESTAMPTZ
);

-- accounts: trading/wallet accounts; client_id → clients(id)
CREATE TABLE IF NOT EXISTS accounts (
    account_id INTEGER PRIMARY KEY,
    account_number TEXT,
    client_id INTEGER REFERENCES clients(id),
    client_name TEXT,
    client_status TEXT,
    email TEXT,
    country TEXT,
    company TEXT,
    product TEXT,
    platform TEXT,
    type TEXT,
    currency TEXT,
    leverage INTEGER,
    balance DECIMAL(20, 6),
    balance_usd DECIMAL(20, 6),
    balance_eur DECIMAL(20, 6),
    credit DECIMAL(20, 6),
    hold_amount DECIMAL(20, 6),
    free_funds DECIMAL(20, 6),
    equity DECIMAL(20, 6),
    equity_excl_credit DECIMAL(20, 6),
    equity_excl_credit_usd DECIMAL(20, 6),
    created TIMESTAMPTZ,
    internal_client_type TEXT,
    verification_level TEXT
);

-- transactions: all operations; client_id = “owner” of the transaction for filtering
CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY,
    client_id INTEGER REFERENCES clients(id),
    type VARCHAR(50),
    source_account_id INTEGER,
    destination_account_id INTEGER,
    source_amount DECIMAL(20, 6),
    source_currency VARCHAR(10),
    source_commission DECIMAL(20, 6),
    destination_amount DECIMAL(20, 6),
    destination_currency VARCHAR(10),
    destination_commission DECIMAL(20, 6),
    status VARCHAR(50),
    operation_date DATE
);

-- pamm_master: referral/hierarchy tree; pid = parent id (same table), ref_id used for referral
CREATE TABLE IF NOT EXISTS pamm_master (
    id INTEGER PRIMARY KEY,
    pid INTEGER,
    account_number TEXT,
    client_id INTEGER,
    name TEXT,
    email TEXT,
    nickname TEXT,
    parent_account_number TEXT,
    parent_client_id INTEGER,
    ref_id INTEGER
);

-- auth_users: local login (temporary); email stored LOWERCASE for case-insensitive login
CREATE TABLE IF NOT EXISTS auth_users (
    id SERIAL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Indexes (existing):**  
`idx_accounts_client_id`, `idx_accounts_product`, `idx_transactions_client_id`, `idx_transactions_operation_date`, `idx_clients_email`, `idx_pamm_master_pid`, `idx_pamm_master_account_number`, `idx_auth_users_email_lower` (on `LOWER(email)`).

### 2.2 RPCs

- **`get_client_by_email(p_email TEXT)`**  
  Returns one row from `clients` where `LOWER(TRIM(email)) = LOWER(TRIM(p_email))`. Use for profile lookup after login (emails may be mixed case in `clients`).

- **`get_child_accounts(myid INTEGER)`**  
  Returns all descendants of `myid` in `pamm_master` (recursive: `pid = myid` then `a.pid = ca.id`). Columns: `account_id` (alias for `id`), `pid`, `account_number`, `client_id`, `name`, `email`, `nickname`, `parent_account_number`, `parent_client_id`. Used for team org tree.

---

## 3. Authentication (Critical for Migration)

- **Current:** Login uses table `auth_users`. Email is stored and compared in **lowercase** (case-insensitive). Password is plain text (temporary).
- **Requirement for Next.js:**  
  **End users must NOT be forced to change password.** Use the existing `auth_users` table as the starting point: same email (lowercase) + same password must continue to work. Options:
  - **Option A:** Next.js backend (API route or serverless) that checks `auth_users` (email lowercased, password compare) and issues a session/JWT. No migration of passwords.
  - **Option B:** One-time migration: create Supabase Auth users (or your new auth system) from `auth_users` with the **same passwords** (e.g. set password in Supabase Auth from current plain text), then use Supabase Auth going forward. Either way, **passwords must remain valid** so users are not forced to reset.

**Login flow today:**  
1. User submits email + password.  
2. Normalize email: `email_clean = strip().lower()`.  
3. Query `auth_users` where `email = email_clean`, get one row.  
4. If row exists and `row.password == password`, set session `user_email = row.email` (lowercase).  
5. Profile is loaded via `get_client_by_email(session.user_email)` so that mixed-case emails in `clients` still match.

---

## 4. Profile (User Identity After Login)

- **Source:** `clients` row matched by email (case-insensitive) via RPC `get_client_by_email(p_email)`.
- **Session identity:** `profile.id` = `clients.id` = **client_id** used everywhere (accounts, transactions, team, PAMM).
- **Shape returned to UI:**
  - `id`, `email`, `nickname`
  - `info.givenName`, `info.familyName` (from splitting `clients.name`), `info.birthday`
  - `phone`, `country_code`, `initials`

---

## 5. Wallets / Accounts (Balance Summary)

- **Source:** `accounts` where `client_id = profile.id`. Exclude demo: `platform` not like `%demo%`.
- **Per account:** `account_id`, `account_number`, `caption` (product or account number), `platform`, `statement.currentBalance` (balance), `statement.availableBalance` (free_funds or balance), `statement.hold` (hold_amount), `currency.alphabeticCode`.
- **Aggregates:**
  - **Estimated Total Balance (USD):** Sum of `statement.currentBalance` across user’s accounts, formatted (e.g. `"12,345.67"`).
  - **INR equivalent:** Total balance × conversion rate (e.g. 84); same for other currency displays where used.

---

## 6. Transactions (How We Show Them)

### 6.1 Data Source

- **Primary:** `transactions` where `client_id = profile.id`, ordered by `operation_date` desc.
- **Extra:** Rows from `transactions` where `type = 'fees'` and `destination_account_id` is in the set of this user’s **PAMM account IDs only** (from `pamm_master.id` where `client_id = current user`). Do not use `accounts` or any account numbers in this set. Merge by transaction `id` to avoid duplicates.

### 6.2 Account Resolution (From / To)

- `source_account_id` and `destination_account_id` in DB can be:
  - `accounts.account_id`
  - `pamm_master.id`
  - Or in some exports, account numbers (as int).  
- **Resolution:** Build maps from: (1) `accounts` → by `account_id`, by `account_number`; (2) `pamm_master` → by `id`, by `account_number`. For each transaction, resolve source and destination to a display row: `accountId`, `accountNumber`, `clientName` (from account/client or pamm_master name). If not found, use known internal accounts (e.g. id 129 → “Master Account”); else show “External account”. On-demand lookup for missing ids (e.g. from `accounts` or `pamm_master` by id or account_number) is used so “External account” is avoided when data exists.

### 6.3 Type Normalization (DB → Display)

- DB `type` can be: `deposit`, `withdrawal`, `payout`, `Rewards`, `fee`/`fees`, `performance_fee`, etc.
- **Mapping:**  
  - `payout` → display as `withdrawal`.  
  - `Rewards`, `fee`, `fees`, `performance_fee` (case-insensitive) → display as `fees` first, then reclassified (see below).  
  - Else keep as-is (e.g. `deposit`, `transfer`).

### 6.4 Fee Reclassification (Performance vs Partnership)

- **self_wallets:** List of this user’s account numbers from `accounts` and `pamm_master` (for current client_id).
- For each transaction with type `fees`:
  - If **credit (To) account number = "129"** → **Performance Fees**.
  - Else if **debit (From) account number is in self_wallets** → **Performance Fees**.
  - Else if debit is not in self_wallets → **Partnership Fees**.
  - Else if credit in self_wallets and debit not in self_wallets → **Partnership Fees**.
  - Else → **Partnership Fees**.
- Display type is either **Performance Fees** or **Partnership Fees** (or other types like deposit, withdrawal).

### 6.5 Transaction Object Shape (for UI / API)

Each transaction has:

- `transactionId`, `type` (display type), `createTime` (ISO date from `operation_date`), `status`
- `creditDetails`: `amount`, `currency.alphabeticCode`, `account`: `accountId`, `accountNumber`, `clientName`, `caption`, `platform`
- `debitDetails`: `amount`, `account`: same structure

Amount for display typically comes from `creditDetails.amount` (or `destination_amount`/`source_amount` in DB).

### 6.6 Transactions Table Columns (Current UI)

| Column         | Source                                                                 |
|----------------|------------------------------------------------------------------------|
| Transaction ID | `transactionId`                                                        |
| Date & Time    | `createTime`                                                           |
| Type           | `type` (Performance Fees, Partnership Fees, deposit, withdrawal, etc.)  |
| Amount         | `creditDetails.amount`                                                 |
| Currency       | `creditDetails.currency.alphabeticCode`                                |
| From Account   | `debitDetails.account.clientName`, caption, accountNumber              |
| To Account     | `creditDetails.account.clientName`, caption, accountNumber             |
| Platform       | `creditDetails.account.platform.caption`                               |
| Status         | `status`                                                               |

---

## 7. Dashboard Metrics (Current Logic – Can Simplify in Next.js)

All of these are derived from the **transactions** list (after reclassification) and **wallets** (balances).

### 7.1 Balance

- **Estimated Total Balance:** Sum of current user’s account balances (see §5). Shown in USD and INR.

### 7.2 Profit and Fees

- **Partnership Fees (Partnership Earnings):** Sum of `creditDetails.amount` for all transactions with `type === "Partnership Fees"`.
- **Performance Fees (for profit):** Only those with `type === "Performance Fees"` and **operation_date is the 1st of the month** are summed (current app uses “1st of month only” for Total/Own Profit and return %).
- **Total Profit:** `performance_fees_first_of_month * 2` (rounded).  
- **Own Profit:** `performance_fees_first_of_month` (rounded).  
  *(You may simplify in Next.js, e.g. use all performance fees or a different formula.)*

### 7.3 Deposits (for Return %)

- **Total deposits:** Sum of `creditDetails.amount` for `type === "deposit"`.
- **Current app quirk:** For return calculations it uses the **single largest deposit** as the denominator (to avoid duplicate deposits in DB inflating the denominator). So: `total_deposits = max(deposit amounts)`; and for weighted-average age (WAA), it uses one deposit with that amount and its date.

### 7.4 Return Percentages

- **Gross Profit Return %:** `(Total Profit / total_deposits) * 100` (total_deposits from above).
- **Net Profit Returns %:** `(Own Profit / total_deposits) * 100`.
- **Annualized Net Return %:** Uses **weighted average age (WAA)** of deposits in days:  
  `(individual_profit / total_deposit) * 100 * (365 / waa_days)`.  
  WAA = sum(amount × days_since(deposit_date)) / sum(amount).
- **CAGR:** `(final_value / initial_value)^(1/t_years) - 1` where `final_value = total_deposit + individual_profit`, `initial_value = total_deposit`, `t_years = waa_days / 365`. (Currently shown in UI but commented out in one place.)

### 7.5 Conversion and Labels

- **INR conversion:** USD × 84 (configurable rate).
- **Dashboard labels:**  
  Estimated Total Balance, Total Profit, Own Profit, Partnership Earnings, Gross Profit Return, Net Profit Returns, Annualized Net Return (and optionally Net CAGR).

---

## 8. Team / Org Chart

- **PAMM dropdown:** Options from `pamm_master` where `client_id = profile.id`; show `account_number` and `name` (or caption). Value passed: e.g. `accountId,accountNumber`.
- **Tree data:** For selected PAMM account id `master_account_id` and number `master_account_number`:
  - **Children:** RPC `get_child_accounts(master_account_id)` (or equivalent recursive query on `pamm_master` where `pid = master_account_id`).
  - **Root node:** Row from `pamm_master` where `account_number = master_account_number` (get_master_account).
- **Per node:** `accountId`, `accountNumber`, `name`, `balance` (from `accounts`: balance/equity by account_id or pamm id), `partnershipFees` (sum of Partnership Fees where debit account = this node’s account number), `balanceLabel`, `partnershipLabel`, `tags` (e.g. `["zero"]` if balance 0, `["parent"]` for root), `level` (see below).
- **Level (parent only):** Based on **parent’s balance** and **sum of direct children’s balances** (balance_sum):
  - If parent balance &lt; 5952.38 → no level / -1.
  - Else: level 0 = Star; if 29761.90 ≤ balance_sum ≤ 59523.81 → level 1 (Double Star); if 59523.81 ≤ balance_sum ≤ 119047.62 → level 2 (Diamond); if balance_sum &gt; 119047.62 → level 3 (Platinum).  
  *(Constants: LEVEL_0 = 5952.38, LEVEL_1 = 29761.90, LEVEL_2 = 59523.81, LEVEL_3 = 119047.62; names Star, Double Star, Diamond, Platinum.)*

---

## 9. PAMM Accounts Page

- **Source:** `accounts` where `client_id = profile.id` and `product = 'PAMM Investor'`.
- **Columns:** account id/number, account name (client_name or product), subscription status (e.g. “Subscribed”), profit (e.g. “-”), maxDD (“-”), currency, balance, equity.

---

## 10. Manager-Only (Optional for Next.js)

- **Who:** Users whose email (lowercase) is in the managers list: e.g. `skarkhanis95@gmail.com`, `sagar@affinitytrades.com`, `contact@affinitytrades.com`.
- **What:** Can view/edit `pamm_master`: list all rows, update columns (e.g. pid, account_number, client_id, name, email, nickname, parent_*, ref_id), add new row. API: GET data (all pamm_master), POST update (by id + column + value), POST add (one row).

---

## 11. Config / Constants (Reference)

- **Conversion:** USD→INR rate = 84 (e.g. `WITHDRAWL_INR_USD_RATE`).
- **Levels (team):** LEVEL_0 = 5952.38, LEVEL_1 = 29761.90, LEVEL_2 = 59523.81, LEVEL_3 = 119047.62; names Star, Double Star, Diamond, Platinum.
- **Managers:** List of manager emails (lowercase for comparison).
- **Internal accounts:** e.g. 129 = “Master Account” for display when source/destination is 129.

---

## 12. Routes (Current App)

| Path | Purpose |
|------|--------|
| `/` | Redirect to `/auth/login` |
| `/auth/login` | GET: login form; POST: authenticate (auth_users), set session, redirect to dashboard |
| `/auth/logout` | Clear session, redirect to login |
| `/dashboard` | Dashboard (balances, profit, returns) |
| `/transactions` | Transactions history table |
| `/transactions/export-transactions` | Export |
| `/wallets` | Upgrading page |
| `/funds/*` | Upgrading or 503 |
| `/team` | Team page; PAMM dropdown; team chart loaded via `/team/team-chart?accountData=id,num` |
| `/team/referral` | Referral page; same PAMM dropdown |
| `/team/referral-data`, `/team/generate-refId` | Referral data / refId |
| `/pamm/accounts` | PAMM Investor accounts list |
| `/profile/profile-info`, `/profile/update-nick-name`, `/profile/verification`, `/profile/upload-documents` | Profile and docs |
| `/register`, `/register/client` | Upgrading / 503 |
| `/manager/relationship`, `/manager/data`, `/manager/update`, `/manager/add` | Manager-only pamm_master CRUD |

---

## 13. What the Next.js App Must Do (Checklist)

1. **Same Supabase:** Connect to the same project; use tables `clients`, `accounts`, `transactions`, `pamm_master`, `auth_users` and RPCs `get_client_by_email`, `get_child_accounts`.
2. **Auth:** Support existing users without password change: authenticate using `auth_users` (email lowercase, same password) or migrate passwords into your new auth system so they remain valid.
3. **Profile:** Resolve user by email (case-insensitive) via `get_client_by_email`; use `clients.id` as `client_id` everywhere.
4. **Dashboard:** Implement same (or simplified) metrics: total balance, total profit, own profit, partnership earnings, return %, annualized return; **plus new “Daily Profit” card** (see §16). You can simplify the “1st of month only” and “largest deposit” rules for legacy metrics.
5. **Transactions:** Same data source and account resolution; same display types; **include new transaction type(s)** for daily interest and admin-granted partnership fees (see §16). Same table columns (or subset).
6. **Team:** Same PAMM dropdown and org tree from `pamm_master` + `get_child_accounts`; same level logic or a simpler variant.
7. **Wallets / PAMM:** Same account and balance sources; same or simplified UI.
8. **New business logic:** Implement all of §16 (daily interest, per-account rate, admin portal, partnership earnings flow, admin dashboard, manual credit, skip/review).

This spec gives an AI agent in the Next.js repo everything needed to start coding against the same data and behavior, then apply new, simpler business logic where desired.

---

## 14. Authentication Migration (Must-Have)

- **Objective:** End users must **not** be forced to change their password when moving to the Next.js app.
- **Current state:** Passwords are stored in `auth_users.password` in **plain text** (temporary). Emails are stored in **lowercase**; login is case-insensitive (user can type Email@Example.com or email@example.com).
- **Requirement:** Whatever auth system the Next.js app uses (Supabase Auth, NextAuth, custom JWT, etc.), existing users must be able to sign in with their **current email and current password**. Options:
  1. **Keep using `auth_users`:** Next.js (API route or server action) looks up `auth_users` by lowercase email, compares password, then issues session/JWT. No data migration; same table.
  2. **Migrate to Supabase Auth (or other):** One-time script: for each row in `auth_users`, create the corresponding user in the new system and set their password to the **same** value (e.g. Supabase Auth admin API or your provider’s “set password” so users don’t get a reset link). Then use the new auth for login; you can deprecate `auth_users` later.
- **Do not:** Require “reset password” or “set new password on first login” for existing users; treat `auth_users` as the source of truth for “same password” until migrated.

---

## 15. Quick Start for AI Agent (Next.js Repo)

1. **Supabase:** Same project; env `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (or anon key with RLS if you prefer). Use tables and RPCs in §2.
2. **Auth:** Implement login that accepts email + password and validates against `auth_users` (lowercase email, same password). Session or JWT; then load profile via `get_client_by_email`.
3. **Profile:** After login, call `get_client_by_email(session_email)`; use returned `id` as `client_id` for all data (accounts, transactions, team).
4. **Dashboard:** Fetch accounts (by client_id) for balance; fetch transactions (by client_id + fee-destination merge), apply fee reclassification, then compute Total Profit, Own Profit, Partnership Earnings, return % (simplify “1st of month” / “largest deposit” if desired).
5. **Transactions:** Same query + resolution + reclassification; render table with columns in §6.6.
6. **Team:** PAMM options from `pamm_master` by client_id; tree from `get_child_accounts(selected_id)`; balances and partnership fees per node; level from config constants.
7. **Config:** LEVEL_0/1/2/3, level names, manager list, conversion rate – from env or config module.
8. **New business logic:** Implement **§16** in full: Daily Profit card, daily interest job, per-account interest rate (default 3%), Admin portal (manager port + interest + Partnership Earnings + manual credit + skip review), admin dashboard totals.

---

## 16. New Business Logic (Next.js App)

The new app introduces the following behavior. Implement these in addition to (or as replacements for) the current logic where noted.

### 16.1 Daily Profit (Dashboard + Backend)

- **New dashboard card:** "Daily Profit" – show the user's daily interest amount (see below).
- **How it works:**
  - Each account has an **interest rate** expressed as a **monthly %** (e.g. 3% per month). Default for all accounts and new signups: **3%**.
  - **No daily compounding.** Interest is always calculated on a **single “balance for interest”** for the month (see below), not on a running balance that includes same-day interest.
  - **Balance for interest (within a month):**
    - **From 1st of the month:** “Balance for interest” = **closing balance of the previous month** (i.e. balance at end of last month after all credits and withdrawals).  
      Example: Last month you had $100, got $3 interest → closing balance $103. From 1st of this month, interest is calculated on **$103** for the whole month until any withdrawal.
    - **When the user withdraws:** From the **next day** after the withdrawal, “balance for interest” is reduced by the withdrawal amount for the **rest of that month**.  
      Example: Started month at $103. User withdraws $2 on the 5th. So:  
      - **Days 1–5:** daily interest = $103 × (3% / 100) / days_in_month.  
      - **Days 6–end of month:** daily interest = ($103 − $2) = **$101** × (3% / 100) / days_in_month.  
      So we use $103 until withdrawal, then $103 − withdrawal for the remaining days.
  - **Daily credit:** Each day you credit: (balance for interest for that day) × (monthly rate / 100) / (days in that month). The “balance for interest for that day” is the same for the whole month until a withdrawal, then it becomes (start-of-month balance − sum of withdrawals so far) for the rest of the month.
  - **Crediting:** Daily interest is **credited to the account every day at 12:01 AM UTC** by an automatic job. Each credit creates a **transaction** (so it appears in transactions and updates balance).
  - **Next month:** Closing balance of current month = opening balance of month + all interest credited this month − all withdrawals this month. That closing balance becomes next month’s “balance for interest” from the 1st.
  - **Data:** Store **interest_rate_monthly** per account (see Admin below). The job needs, per account: (1) “balance for interest” for today ( = start-of-month balance minus withdrawals so far this month; start-of-month balance = closing balance of previous month), (2) days in current month. Then credit (that balance × rate / 100) / days_in_month and record the transaction.

### 16.2 Interest Rate Per Account (Admin)

- **Default:** Every account (and new signups) gets **3% monthly** interest rate unless changed.
- **Admin control:** In the **Admin portal**, admin can set the **interest rate (monthly %)** **per account**. Rate is **effective immediately** (next daily run uses the new rate).
- **Storage:** Add a field (e.g. on `accounts` or a separate `account_settings` table) such as `interest_rate_monthly` (decimal, e.g. 3.00 for 3%). Default 3.

### 16.3 Admin Portal

- **Purpose:** Single place for all admin actions (replacing/porting current "manager" functionality and adding new features).
- **Access control:** Only users designated as **admin** (e.g. same list as current managers or a new "admin" role) can access the Admin portal.
- **Port from current app:** Manager functionality (view/edit/add `pamm_master` rows, relationship tree data) should be available inside the Admin portal.
- **New features in Admin (see below):** Set interest rate per account; Partnership Earnings flow; manual daily interest credit; review/approve/reject automatic credit skips; admin dashboard (totals).

### 16.4 Partnership Earnings (Simplified – Admin-Driven)

- **All control with admin.** No automatic calculation from referral tree; admin explicitly grants partnership fees.
- **Flow:**
  1. Admin opens an option/window **"Partnership Earnings"** in the Admin portal.
  2. **Select account:** Dropdown (or search) to choose **the account that will receive** the partnership fee (credit).
  3. **Select referral:** Another dropdown to select **"referral" account** – list all accounts (or all accounts that can be chosen as referral). Admin picks one.
  4. **System fetches:** For the selected **referral** account, compute **total deposits** (sum of deposit transactions) and **display** that total deposit value to the admin.
  5. **Admin enters %:** A text box: "Enter % of total deposit value to be given." Admin enters e.g. 5 (for 5%).
  6. **Submit:** Amount = (total deposits of referral account) × (entered % / 100). Create a **transaction** that **credits** this amount to the **account selected in step 2** (and optionally debit from a system/ledger account or leave as "partnership fee" type). Transaction must be reflected in the recipient account and in transactions list.
- **No automatic tree-based calculation;** only what admin submits.

### 16.5 Admin Dashboard

- **Metrics to show (at least):**
  - **Total deposits** (across all accounts or all clients).
  - **Total accounts** (count).
  - **Total profit given** (e.g. total interest credited to date, or total partnership fees credited – define clearly).
- **Reporting:** More reporting will be specified later; leave room for extra metrics and exports.

### 16.6 Daily Interest: Automatic Job + Manual Override

- **Automatic trigger:** A scheduled job runs daily (e.g. at 12:01 AM UTC). For each account, it uses the **balance for interest** for that day (start-of-month balance minus withdrawals so far this month; see §16.1 – no daily compounding), the account’s monthly rate, and days in month to compute that day’s interest, credits it, and creates a transaction. Use the **previous calendar day** as the “interest for” date if needed (e.g. interest “for” yesterday credited today).
- **Intelligence:** Before crediting, the job must check: **"Has interest for this account for the previous day already been credited?"** (e.g. by a transaction type like "Daily Interest" with a reference date).
  - If **yes** → **do not credit again**. Record this (e.g. "skipped – already credited") and **send details to the Admin portal** for **review**. Admin can **approve** (accept the skip) or **reject** (e.g. trigger a manual correction or re-credit).
  - If **no** → credit as normal.
- **Manual credit (admin):** In the Admin portal, provide a **button/action**: "Credit daily interest" with options:
  - **Single account:** Select one account, credit that day's (or selected day's) interest.
  - **Multiple accounts:** Select several accounts, credit for each.
  - **All accounts:** Credit for all accounts in one go.
  - Use case: when the automatic trigger fails or did not run, admin can run interest manually. The automatic job must still respect "already credited" (so manual credit is idempotent with the job's logic).

### 16.7 Summary for Implementation

| Feature | Owner | Notes |
|--------|--------|--------|
| Daily Profit card (dashboard) | End user | Show daily interest amount for the user's account(s). |
| Daily interest crediting | Backend job | 12:01 AM UTC; per-account rate; monthly compounding; create transaction. |
| Interest rate per account | Admin | Default 3%; admin sets per account; effective immediately. |
| Admin portal | Admin | Port manager + new features; access control. |
| Partnership Earnings | Admin | Select recipient account → select referral account → show total deposits → enter % → submit → create credit transaction. |
| Admin dashboard | Admin | Total deposits, total accounts, total profit given; more reporting later. |
| Manual daily interest | Admin | Button: credit for single / multiple / all accounts. |
| Skip + review | Backend + Admin | If interest already credited for that day, skip and send to admin for approve/reject. |
