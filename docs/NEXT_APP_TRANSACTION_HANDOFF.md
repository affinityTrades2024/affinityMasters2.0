# Transaction History & Partnership Earnings — Next.js Implementation Guide

**Purpose:** This document describes critical bugs that existed in the Flask app around transaction history and partnership earnings, and the **correct** logic so the Next.js app does not replicate them. Give this to your Next.js app AI agent or developers.

---

## 1. The Bugs (Do Not Replicate)

### Bug A: Wrong destination set for fetching partnership fees

When building the set of IDs used to fetch **extra** fee transactions (partnership fees paid *to* the user but stored under another user's `client_id`), the app must not:

1. **Add account numbers to the set.** The column `transactions.destination_account_id` stores **account IDs only** (e.g. `accounts.account_id` or `pamm_master.id`), **not** account numbers. If you add `int(account_number)` to the set, then when user A's `account_number` (e.g. `2435`) equals user B's `account_id` (e.g. `2435`), the app will pull B's fee transactions into A's list → wrong partnership earnings and wrong transaction history.

2. **Use only `pamm_master.id`.** In the actual data, **~99.98%** of fee transactions (excluding master account 129) have the recipient's **eWallet `account_id`** as `destination_account_id`, not `pamm_master.id`. So if the destination set contains only `pamm_master.id`, almost all partnership fees paid to the user will be **missed**.

**Correct rule:** The destination set must include **both**:
- `pamm_master.id` for the current user (where `client_id = current user`), and  
- `accounts.account_id` for the current user (where `client_id = current user`).

**Never** add `accounts.account_number` or `pamm_master.account_number` (as number or string) to this set.

### Bug B: Resolving source/destination by account number

When displaying "From" and "To" account names for each transaction, the app resolves `source_account_id` and `destination_account_id` to get `client_name` and `account_number` for display. If you resolve by **account_number** (e.g. a lookup like "find account where account_number = 2435"), you will show the **wrong person**: there are thousands of collisions where one user's `account_id` equals another user's `account_number`.

**Correct rule:** Resolve **only** by:
1. `accounts.account_id` (primary key), then  
2. `pamm_master.id`.

**Never** resolve by `account_number` (string or int). All transaction IDs in the DB are either `accounts.account_id` or `pamm_master.id`; there are no "missing" IDs that require an account_number fallback.

### Real-world example

- **vashinde123@gmail.com (Vijay):** `accounts.account_id = 2435` (PAMM Investor), `account_number = 11418`; also has eWallet `account_id = 2436`, `account_number = 1276`.
- **hitixabrahmbhatt@yahoo.in (Hitixa):** `accounts.account_id = 4758` (eWallet only), `account_number = 2435`.

If the app added `2435` as an account_number to the destination set, or resolved ID `2435` by account_number, it could show Hitixa’s name for Vijay’s transactions. Partnership fees paid to Vijay actually use `destination_account_id = 2436` (his eWallet); if the set contained only `pamm_master.id` (2435), those 17 fees would never be fetched.

---

## 2. Correct Logic (Implement This in Next.js)

### 2.1 Transaction list for a user

- **Primary:** Fetch all rows from `transactions` where `client_id = current_user_client_id`, ordered by `operation_date` desc.
- **Extra (partnership fees):** Fetch rows from `transactions` where:
  - `type = 'fees'`, and  
  - `destination_account_id IN (list of this user's account IDs — see below)`.

**Destination ID set (for the extra query only):**

- Query `pamm_master` where `client_id = current_user_client_id` → take all `id` values.
- Query `accounts` where `client_id = current_user_client_id` → take all `account_id` values.
- Union these into one set. **Do not** add any `account_number` (from either table).

```ts
// ✅ Correct: pamm_master.id + accounts.account_id (never account_number)
const [pammRows, accountRows] = await Promise.all([
  supabase.from('pamm_master').select('id').eq('client_id', clientId),
  supabase.from('accounts').select('account_id').eq('client_id', clientId),
]);

const myDestinationIds = new Set<number>();
(pammRows.data ?? []).forEach((r) => { if (r.id != null) myDestinationIds.add(r.id); });
(accountRows.data ?? []).forEach((r) => { if (r.account_id != null) myDestinationIds.add(r.account_id); });

// Primary transactions
let txRows = await supabase
  .from('transactions')
  .select('*')
  .eq('client_id', clientId)
  .order('operation_date', { ascending: false });

// Extra: partnership fees paid TO this user (stored under sender's client_id)
if (myDestinationIds.size > 0) {
  const destList = [...myDestinationIds].slice(0, 100);
  const { data: feeExtra } = await supabase
    .from('transactions')
    .select('*')
    .eq('type', 'fees')
    .in('destination_account_id', destList)
    .order('operation_date', { ascending: false })
    .limit(500);

  const seenIds = new Set((txRows.data ?? []).map((t) => t.id));
  for (const t of feeExtra ?? []) {
    if (!seenIds.has(t.id) && myDestinationIds.has(t.destination_account_id)) {
      txRows.data.push(t);
      seenIds.add(t.id);
    }
  }
}
```

### 2.2 Resolving source/destination for display (From / To account names)

For each transaction, you need to show who the source and destination accounts belong to. The transaction row has `source_account_id` and `destination_account_id` (integers).

**Resolve only by ID:**

1. Build a map: `account_id or pamm_master.id → { account_id, account_number, client_name }` from:
   - `accounts` (key = `account_id`), and  
   - `pamm_master` (key = `id`).
2. For a given `source_account_id` or `destination_account_id`, look up **only** in that map (by integer ID).
3. **Do not** add a second lookup by `account_number` (e.g. "if not found by id, find by account_number"). That causes wrong-user display when another user’s account_number equals this id.

You can optionally handle the known internal account `129` (Master Account) in code if it’s not in `pamm_master`.

### 2.3 Fee reclassification (Performance vs Partnership)

After you have the full transaction list (primary + extra), reclassify `type === 'fees'`:

- **self_wallets:** List of **account numbers** (strings) for the current user from both `accounts` and `pamm_master` (where `client_id = current user`). Used **only** for this reclassification step, not for resolving display names.
- For each transaction with `type === 'fees'`:
  1. If **credit** (To) account number is `"129"` → **Performance Fees**.
  2. Else if **debit** (From) account number is in **self_wallets** → **Performance Fees**.
  3. Else if debit account number is set and not in self_wallets → **Partnership Fees**.
  4. Else if credit in self_wallets and debit not in self_wallets → **Partnership Fees**.
  5. Else (catch-all) → **Partnership Fees**.

### 2.4 Partnership earnings (dashboard)

- **Partnership Earnings** = sum of **credit** amounts (amount received) for all transactions reclassified as **Partnership Fees**.
- Do not use debit-side amount for this total.

### 2.5 Optional: Restrict transaction history to PAMM products

If product requirements say transaction history should show only **PAMM Investor** and **PAMM Master** activity:

- After fetching transactions (primary + extra), filter so that each transaction’s source and destination accounts (resolved via the ID-based map above) belong to accounts that are PAMM Investor or PAMM Master (e.g. by joining to `accounts` / `pamm_master` and checking `product` or type). Exclude transactions that involve only eWallet or other non-PAMM products if that matches your product spec.

(Flask currently shows all transactions; this is an optional product-level filter for Next.js.)

---

## 3. Summary table

| What | Correct approach |
|------|------------------|
| **Extra fee query: destination ID set** | `pamm_master.id` + `accounts.account_id` for current user. **Never** any `account_number`. |
| **Resolving source/destination for display** | Look up only by `account_id` (from `accounts`) or `pamm_master.id`. **Never** by `account_number`. |
| **Partnership earnings** | Sum of **credit** amount for transactions classified as Partnership Fees. |
| **self_wallets** | Account **numbers** (strings) from `accounts` + `pamm_master` for current user; used **only** for fee reclassification, not for display resolution. |

---

## 4. Checklist for Next.js

- [ ] Extra fee query uses a destination set built from **both** `pamm_master.id` and `accounts.account_id` where `client_id = current user`.
- [ ] No `account_number` (from `accounts` or `pamm_master`) is ever added to that destination set.
- [ ] When resolving `source_account_id` / `destination_account_id` for display, you use only a map keyed by `account_id` and `pamm_master.id` — no fallback lookup by `account_number`.
- [ ] Partnership Earnings = sum of **credit** amounts for transactions classified as Partnership Fees.
- [ ] Fee reclassification uses **self_wallets** (account numbers as strings) and the rules in §2.3.
- [ ] If required by product, transaction history can be filtered to PAMM Investor / PAMM Master only after fetch and resolution.

---

## 5. Reference (Flask implementation)

- **Repo:** affinityMasters (Flask).
- **File:** `app/models/wallets.py`.
- **Destination set:** `my_destination_ids` is built from `my_pamm_list` (add `pamm_master.id`) and `my_accounts_list` (add `accounts.account_id`). No `account_number` is used.
- **Display resolution:** `acc_info(aid)` resolves only via `by_account_id` and `by_pamm_id`; there is no `by_account_number` lookup.
- **Handoff doc (earlier version):** `docs/PARTNERSHIP_EARNINGS_FIX_HANDOFF.md` — superseded by this document for the “destination set” and “resolve by ID only” behavior.
