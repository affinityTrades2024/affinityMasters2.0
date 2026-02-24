# Partnership Earnings & Transaction Fetch Fix (Next.js Handoff)

**Purpose:** The Flask app had a critical bug in how it fetched transactions and calculated dashboard "Partnership Earnings." This document describes the bug and the **correct** logic so the Next.js app does not replicate it.

---

## 1. The Bug (Do Not Replicate)

### What went wrong

When building the set of "destination account IDs" used to fetch **extra** fee transactions (partnership fees paid *to* the user but stored under another user's `client_id`), the Flask app:

1. **Mixed two different concepts in one set:** It added both **account IDs** (`accounts.account_id`, `pamm_master.id`) and **account numbers** (e.g. `accounts.account_number` cast to int) into the same set. The `transactions.destination_account_id` column stores **IDs only** (e.g. `pamm_master.id` or `accounts.account_id`), **not** account numbers. So when user A's **account_number** (e.g. `1280`) equaled user B's **account_id** (`1280`), the app pulled B's fee transactions into A's list → wrong partnership earnings and wrong transaction history.

2. **Included non-PAMM accounts:** The set included IDs from the **accounts** table (eWallet, personal, PAMM investor). Partnership fees in this business flow only through **PAMM** accounts. Including eWallet/personal IDs pulled in unrelated fee transactions and showed "Partnership Earnings" for users who should have zero (e.g. users with no PAMM referral structure).

### Real-world example

- **nakulwad82@rediffmail.com:** `accounts.account_id = 2444`, `accounts.account_number = 1280`; `pamm_master.id = 2443`.
- **bharat.mote007@gmail.com:** `accounts.account_id = 1280`, `accounts.account_number = 700`.

The old code added `int(1280)` (nakulwad82's account_number) to the destination set. The extra query then matched `destination_account_id = 1280` (bharat's account_id). So bharat's fee transactions appeared in nakulwad82's transaction list and were counted as nakulwad82's partnership earnings.

---

## 2. Correct Logic (Implement This in Next.js)

### 2.1 Transaction list for a user

- **Primary:** Fetch all rows from `transactions` where `client_id = current_user_client_id`, ordered by `operation_date` desc (no limit, or a high limit).
- **Extra (partnership fees):** Fetch rows from `transactions` where:
  - `type = 'fees'`, and
  - `destination_account_id IN (list of this user's PAMM account IDs only)`.

**Critical:** The list of IDs for the extra query must be built **only** from **`pamm_master`** for the current user:

- Query: `pamm_master` where `client_id = current_user_client_id`.
- Use **only** the `id` column (i.e. `pamm_master.id`) as the set of destination IDs.
- **Do not** add:
  - Any value from the `accounts` table (no `accounts.account_id`, no `accounts.account_number`).
  - Any `account_number` (string or int) from `pamm_master` or `accounts`.

Pseudocode:

```ts
// ✅ Correct: only PAMM ids
const myPammRows = await supabase.from('pamm_master').select('id').eq('client_id', clientId);
const myDestinationIds = new Set(
  (myPammRows.data ?? []).map((r) => r.id).filter((id) => id != null)
);

// Primary transactions
let txRows = await supabase.from('transactions').select('*').eq('client_id', clientId).order('operation_date', { ascending: false });

// Extra: only if user has PAMM accounts
if (myDestinationIds.size > 0) {
  const destList = [...myDestinationIds].slice(0, 100);
  const feeExtra = await supabase
    .from('transactions')
    .select('*')
    .eq('type', 'fees')
    .in('destination_account_id', destList)
    .order('operation_date', { ascending: false })
    .limit(500);
  // Merge by transaction id, dedupe
  const seenIds = new Set(txRows.data?.map((t) => t.id) ?? []);
  for (const t of feeExtra.data ?? []) {
    if (!seenIds.has(t.id) && myDestinationIds.has(t.destination_account_id)) {
      txRows.data.push(t);
      seenIds.add(t.id);
    }
  }
}
```

### 2.2 Fee reclassification (Performance vs Partnership)

After building the full transaction list (primary + extra), reclassify `type === 'fees'`:

- **self_wallets:** List of **account numbers** (strings) for the current user from both `accounts` and `pamm_master` (where `client_id = current user`). Used only for reclassification.
- For each transaction with `type === 'fees'`:
  1. If **credit** (To) account number is `"129"` → **Performance Fees**.
  2. Else if **debit** (From) account number is in **self_wallets** → **Performance Fees**.
  3. Else if debit account number is set and not in self_wallets → **Partnership Fees**.
  4. Else if credit in self_wallets and debit not in self_wallets → **Partnership Fees**.
  5. Else (catch-all) → **Partnership Fees**.

### 2.3 Partnership earnings (dashboard)

- **Partnership Earnings** = sum of **`creditDetails.amount`** (or your equivalent “amount received” field) for all transactions that were reclassified as **Partnership Fees**.
- Do **not** use debit-side amount for this total; partnership earnings = amount **received** (credit).

### 2.4 Summary table

| What | Correct approach |
|------|------------------|
| **Extra fee query destination list** | Only `pamm_master.id` for current user. Never `accounts`, never `account_number`. |
| **Partnership earnings** | Sum of credit amount for transactions classified as Partnership Fees. |
| **self_wallets** | Account **numbers** (strings) from `accounts` + `pamm_master` for current user; used only for reclassification. |

---

## 3. Reference (Flask fix)

- **Repo:** affinityMasters (Flask).
- **File:** `app/models/wallets.py`.
- **Fix:** `my_destination_ids` is built only from `my_pamm_list` and only `pamm_master.id` is added (no `my_accounts_list`, no `int(account_number)`). See lines 157–164 and the comment block above them.

---

## 4. Checklist for Next.js

- [ ] Extra fee query uses a destination-ID set built **only** from `pamm_master.id` where `client_id = current user`.
- [ ] No `accounts.account_id` or `accounts.account_number` in that set.
- [ ] No `pamm_master.account_number` (or any account number as int/string) in that set.
- [ ] Partnership Earnings = sum of **credit** amounts for transactions classified as Partnership Fees.
- [ ] Fee reclassification uses **self_wallets** (account numbers) and the rules in §2.2.
