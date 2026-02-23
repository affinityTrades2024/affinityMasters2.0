# Affinity Trades CRM (Next.js)

Client-facing dashboard for PAMM investors. Uses the same Supabase backend as the legacy Flask app, with new business logic (daily interest, admin portal, partnership earnings).

## Setup

1. Copy env and set Supabase and secrets:

   ```bash
   cp .env.local.example .env.local
   ```

   Edit `.env.local` and set:

   - `SUPABASE_URL` – Supabase project URL
   - `SUPABASE_SERVICE_ROLE_KEY` – Service role key (server-only)
   - `SESSION_SECRET` – Secret for signing session cookies
   - `CRON_SECRET` – Secret for the daily interest cron (Vercel sends this)
   - `USD_INR_RATE` – Optional; default 84
   - `MANAGER_EMAILS` – Optional fallback if `admin_users` table is empty; comma-separated emails.

2. Run Supabase migrations (in Supabase SQL editor):

   - `supabase/migrations/001_interest_schema.sql` – `interest_rate_monthly` on `accounts`, `interest_credit_log` table.
   - `supabase/migrations/002_admin_users.sql` – `admin_users` table (email, role). Uncomment the seed `INSERT` in that file to add your first admin, or insert manually.

3. Install and run:

   ```bash
   npm install
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000). Log in with existing `auth_users` email/password (no password change).

## Build

```bash
npm run build
```

Requires `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in the environment (or `.env.local`) so the app can connect at runtime. Build uses a lazy Supabase client so it will succeed even without env; requests will fail until env is set.

## Deploy (Vercel)

- Set the same env vars in the Vercel project.
- Add `CRON_SECRET` and configure Vercel Cron to call `/api/cron/daily-interest` with `Authorization: Bearer <CRON_SECRET>` (schedule: `1 0 * * *` = 00:01 UTC daily). The repo includes `vercel.json` with the cron entry.

## Routes

- `/` → redirects to `/auth/login`
- `/auth/login` – Login (email + password via `auth_users`)
- `/dashboard` – Balance, profit, returns, Daily Profit
- `/transactions` – History; `/transactions/export` – CSV
- `/team` – PAMM dropdown and org tree
- `/team/referral` – Referral (same PAMM dropdown)
- `/pamm/accounts` – PAMM Investor accounts
- `/profile` – Profile and nickname update
- `/wallets`, `/funds`, `/register` – Upgrading placeholders
- **Admin portal** (requires entry in `admin_users` table; `/admin` redirects to `/manage`):
  - `/manage` – Admin dashboard
  - `/manage/pamm` – PAMM master CRUD
  - `/manage/interest-rates` – Set monthly interest % per account
  - `/manage/partnership-earnings` – Grant partnership fee (recipient + referral + %)
  - `/manage/manual-interest` – Credit daily interest for selected date/accounts
  - `/manage/skip-review` – Approve/reject skipped interest credits

## Spec

See [docs/NEXT_APP_SPEC.md](docs/NEXT_APP_SPEC.md).
