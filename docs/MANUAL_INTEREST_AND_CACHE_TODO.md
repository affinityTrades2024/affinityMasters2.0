# Tomorrow’s To-Do: Manual Interest Fix + Account Search Cache

**Date:** Plan for next session.

---

## 1. Manual Interest: “Credited 0, Skipped 0” when account is selected

### Problem
When an account is selected and “Credit daily interest” is run, the UI shows **Credited 0, Skipped 0** even though an account was chosen.

### Likely areas to check

- **Request payload**
  - In **Manual Interest** client: confirm `idsToRun` is set when “Single” or “Multiple” is selected (from `selectedIds` / `selectedIds.slice(0, 1)`).
  - In **Network tab**: verify POST to `/api/admin/manual-interest` sends `{ forDate: "YYYY-MM-DD", accountIds: [ number, ... ] }` with at least one numeric `account_id`. Ensure `accountIds` is not empty, not strings, and not from a different page’s selection.

- **API route** (`app/api/admin/manual-interest/route.ts`)
  - Ensure `accountIds` is normalized to an array of numbers (e.g. `accountIds = (body?.accountIds || []).map(Number).filter(Number.isFinite)` when `!runAll`), so type/parsing is not the issue.

- **Why credited/skipped stay 0**
  - In the loop over `accountIds`, for each `accountId` one of these happens:
    1. `alreadyCreditedForDate(accountId, forDate).credited` → `skipped++`
    2. `getBalanceForInterest(accountId, forDate) <= 0` → no credit, no skip
    3. `getInterestRateForAccount(accountId)` or `computeDailyInterestAmount(...)` → amount 0 → no credit, no skip
    4. Otherwise → `creditDailyInterest(...)` and `credited++`
  - Add temporary logging (or step through in debugger): log for each `accountId` whether it was skipped (already credited), balance, rate, amount, or credited. That will show which condition is firing (e.g. “already credited” vs “balance 0” vs “amount 0”).

- **Data**
  - Confirm for the chosen account and `forDate`: balance &gt; 0, interest rate &gt; 0, and that the account is not already credited for that date in the interest log/table used by `alreadyCreditedForDate`.

### Definition of done
- With one account selected and a valid date/balance/rate, the run shows **Credited 1** (or the correct count) and the interest log shows the new credit.

---

## 2. Account search cache (search cache first, DB only on miss)

### Goal
Accounts are not added every day. Use a **cache** for account search so we don’t hit the DB on every search; only query the DB when the requested data is not in cache.

### Plan

1. **Define cache scope**
   - Decide what “account search” means in the app:
     - **PAMM (Investment Accounts)** list: filter by `q`, pagination (page, pageSize).
     - **Manual Interest** account list: same filter + pagination.
     - **Interest Rates** account list: same filter + pagination.
   - Cache key could be: e.g. `accounts:list:${hashOrSerialized({ q, page, pageSize })}` or per-page keys like `accounts:page:${page}:size:${pageSize}:q:${q}`.

2. **Choose cache layer**
   - **In-memory (Node):** e.g. a global `Map` or LRU (e.g. `lru-cache`) in the server process. Simple, no extra infra; lost on restart; not shared across multiple server instances.
   - **Redis (or similar):** if the app runs on multiple instances or you want persistence/TTL across deploys.
   - **Next.js unstable_cache / fetch cache:** use Next’s data cache for the server-side fetch that loads the accounts list (with a stable key and revalidate strategy).

3. **Cache content**
   - Store the **result of the current server query**: e.g. `{ accounts: AccountRow[], totalCount: number }` for the given `(q, page, pageSize)`.
   - TTL: e.g. 5–15 minutes or longer since “accounts are not added daily.” Invalidate or reduce TTL if you add an “add/edit account” flow later.

4. **Flow**
   - On each request that needs the account list (PAMM, Manual Interest, Interest Rates):
     1. Compute cache key from `q`, `page`, `pageSize` (and any other filters).
     2. Look up cache; if hit, return cached `{ accounts, totalCount }`.
     3. On miss: run existing Supabase query (same filter/pagination as today), then set cache and return.

5. **Implementation steps**
   - Add a small cache module (e.g. `lib/accounts-search-cache.ts`) with `get(key)` and `set(key, value, ttl?)`.
   - In the **server** code that currently runs the accounts query (e.g. in `app/manage/pamm/page.tsx`, `app/manage/manual-interest/page.tsx`, `app/manage/interest-rates/page.tsx`), wrap the fetch in “get from cache → on miss run query and set cache.”
   - Use the same filter (e.g. PAMM Investor, type, not demo) and pagination so cached data matches what the DB would return.
   - Optionally: add a way to invalidate cache when an account is created/updated (e.g. admin action or API that clears or updates the cache).

6. **Edge cases**
   - Empty `q` vs “all” can share the same cache key or be normalized (e.g. `q = q?.trim() || ""`).
   - Ensure cache key encoding is safe (no injection, bounded length). Prefer a short hash or a strict key format.

### Definition of done
- Search (and pagination) for PAMM / Manual Interest / Interest Rates uses cache when the same `(q, page, pageSize)` was requested recently; DB is only queried on cache miss.
- No regression in “exact number of accounts” or pagination (20/30/50, pages).

---

## 3. Commit before starting tomorrow

Before making the above changes, **commit all currently pending work** so tomorrow’s branch starts from a clean state. Pending changes include (among others):

- PAMM / Manual Interest / Interest Rates: pagination, “PAMM Investor” filter, dynamic search, manual-interest API `all: true`.
- Other modified and untracked files under `app/`, `lib/`, `docs/`, `supabase/migrations/`, etc.

Run from repo root:

```bash
git add -A
git status   # review
git commit -m "PAMM pagination, dynamic search, manual interest run-all, interest rates pagination; handoff doc for manual interest fix and account search cache"
```

Then create a new branch for tomorrow’s work (e.g. `fix/manual-interest-and-accounts-cache`) and implement items 1 and 2 above.
