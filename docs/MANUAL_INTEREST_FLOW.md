# Manual "Credit daily interest" flow

What happens when you click **Credit daily interest** on the Manual daily interest page.

---

## 1. Client (browser)

- **Scope:** You chose "Single account", "Multiple accounts", or "All accounts".
- **Single:** Uses the first selected account (`selectedIds.slice(0, 1)`).
- **Multiple:** Uses all selected accounts (`selectedIds`).
- **All:** Sends `{ forDate, all: true }` (no `accountIds`).
- **Payload:** `{ forDate: "YYYY-MM-DD", accountIds?: number[], all?: true }`.

---

## 2. API: auth and body

- **Auth:** Session required; user must be admin.
- **Body:** Parse `forDate`, `accountIds` (array), `all` (boolean).
- **Normalize:** `accountIds` is converted to an array of numbers (strings from JSON are coerced).

---

## 3. API: which accounts to process

**If `all: true` (Run all):**

- Load from DB: all investment accounts (type investment / null / product PAMM Investor, platform not demo, `interest_credit_enabled = true`).
- Use that list as `accountIds`.

**If Single/Multiple (specific accounts):**

- Fetch from `accounts`: `account_id`, `interest_credit_enabled` for the given `accountIds`.
- **Interest credit filter:** Keep only accounts where `interest_credit_enabled === true`. Missing or null = disabled (primary rule; do not treat as enabled).
- Replace `accountIds` with this filtered list.
- **Console:** `[Manual Interest] Single/Multiple: lookup rows N enabled accountIds after filter [...]`

---

## 4. API: for each account (in order)

For every `accountId` in the final list:

1. **Already credited?**  
   Check `interest_credit_log` for this `account_id` + `for_date` with `status = 'credited'`.  
   - If yes → **SKIPPED** (increment `skipped`).

2. **Balance for interest**  
   `getBalanceForInterest(accountId, forDate)`:
   - Closing balance at **end of previous month** (sum of credits to account − debits from account, all txs with `operation_date` ≤ last day of previous month).
   - Minus **withdrawals** from this account from **start of current month through `forDate`** (tx types `withdrawal`, `payout`).
   - Result is the balance used for interest; if ≤ 0 we do not credit.

3. **Interest rate**  
   From `accounts.interest_rate_monthly` for this account (default 3% if missing).

4. **Daily amount**  
   `(balanceForInterest * rate% / 100) / daysInMonth`.  
   If amount ≤ 0 → no credit.

5. **Credit**  
   Call `creditDailyInterest(accountId, forDate, amount)`:
   - Insert row in `transactions`: type `daily_interest`, from Master Account (129) to this account, `client_id` from account so it shows in user’s history.
   - Update `accounts.balance` for this account (+ amount).
   - Insert row in `interest_credit_log` (status `credited`).

---

## 5. API: response

- **Response:** `{ credited, skipped, hint? }`.
- If `credited === 0 && skipped === 0` but at least one account was processed, `hint` is returned and shown in the UI (explains that balance or amount may be zero).
