import { supabase } from "@/lib/supabase/server";

const PAGE_SIZE = 1000;

export interface AdminDashboardData {
  totalDeposits: number;
  totalBusiness: number;
  totalAccounts: number;
  dailyProfitGiven: number;
  dailyProfitDate: string;
  totalProfitGiven: number;
  totalWithdrawals: number;
  activeInterestAccounts: number;
  totalPendingDisbursalUsd: number;
  updatedAt: string;
}

let cached: AdminDashboardData | null = null;

/** Fetch all "Our" accounts with pagination (avoids 1000 row limit) */
async function fetchAllOurAccounts(): Promise<
  { account_id: number; balance: number; interest_credit_enabled: boolean }[]
> {
  const out: { account_id: number; balance: number; interest_credit_enabled: boolean }[] = [];
  let from = 0;
  while (true) {
    const { data } = await supabase
      .from("accounts")
      .select("account_id, balance, interest_credit_enabled")
      .or("type.eq.investment,type.is.null,product.eq.PAMM Investor")
      .not("platform", "ilike", "%demo%")
      .order("account_id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    const rows = data ?? [];
    out.push(
      ...rows.map((r: { account_id: number; balance?: number; interest_credit_enabled?: boolean }) => ({
        account_id: Number(r.account_id),
        balance: Number(r.balance ?? 0),
        interest_credit_enabled: r.interest_credit_enabled === true,
      }))
    );
    if (rows.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return out;
}

/**
 * Fetch all account IDs that count as deposit destinations for Total Deposits:
 * "Our" accounts (PAMM Investor / investment) OR product = eWallet.
 * Used only for the deposit sum; other metrics still use "Our" accounts only.
 */
async function fetchDepositDestinationAccountIds(): Promise<number[]> {
  const out: number[] = [];
  let from = 0;
  while (true) {
    const { data } = await supabase
      .from("accounts")
      .select("account_id")
      .or("type.eq.investment,type.is.null,product.eq.PAMM Investor,product.eq.eWallet")
      .not("platform", "ilike", "%demo%")
      .order("account_id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    const rows = data ?? [];
    for (const r of rows) {
      const id = Number((r as { account_id: number }).account_id);
      if (Number.isFinite(id)) out.push(id);
    }
    if (rows.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return out;
}

/** Sum deposits where destination_account_id IN accountIds, paginating both by account chunks and by result rows */
async function sumDepositsToAccountIds(accountIds: number[]): Promise<number> {
  if (accountIds.length === 0) return 0;
  let total = 0;
  const CHUNK = 100;
  for (let i = 0; i < accountIds.length; i += CHUNK) {
    const chunk = accountIds.slice(i, i + CHUNK);
    let from = 0;
    while (true) {
      const { data } = await supabase
        .from("transactions")
        .select("destination_amount")
        .eq("type", "deposit")
        .in("destination_account_id", chunk)
        .order("id", { ascending: true })
        .range(from, from + PAGE_SIZE - 1);
      const rows = data ?? [];
      total += rows.reduce((s: number, r: { destination_amount?: number }) => s + Number(r.destination_amount ?? 0), 0);
      if (rows.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }
  }
  return total;
}

/** Sum withdrawals where source_account_id IN accountIds, paginating both by account chunks and by result rows */
async function sumWithdrawalsFromAccountIds(accountIds: number[]): Promise<number> {
  if (accountIds.length === 0) return 0;
  let total = 0;
  const CHUNK = 100;
  for (let i = 0; i < accountIds.length; i += CHUNK) {
    const chunk = accountIds.slice(i, i + CHUNK);
    let from = 0;
    while (true) {
      const { data } = await supabase
        .from("transactions")
        .select("source_amount")
        .in("type", ["withdrawal", "payout"])
        .in("source_account_id", chunk)
        .order("id", { ascending: true })
        .range(from, from + PAGE_SIZE - 1);
      const rows = data ?? [];
      total += rows.reduce((s: number, r: { source_amount?: number }) => s + Number(r.source_amount ?? 0), 0);
      if (rows.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }
  }
  return total;
}

/** Sum all daily_interest destination_amount with pagination */
async function sumAllDailyInterest(): Promise<number> {
  let total = 0;
  let from = 0;
  while (true) {
    const { data } = await supabase
      .from("transactions")
      .select("destination_amount")
      .eq("type", "daily_interest")
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    const rows = data ?? [];
    total += rows.reduce((s: number, r: { destination_amount?: number }) => s + Number(r.destination_amount ?? 0), 0);
    if (rows.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return total;
}

/** Sum daily_interest for a single date with pagination */
async function sumDailyInterestForDate(date: string): Promise<number> {
  let total = 0;
  let from = 0;
  while (true) {
    const { data } = await supabase
      .from("transactions")
      .select("destination_amount")
      .eq("type", "daily_interest")
      .eq("operation_date", date)
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    const rows = data ?? [];
    total += rows.reduce((s: number, r: { destination_amount?: number }) => s + Number(r.destination_amount ?? 0), 0);
    if (rows.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return total;
}

/** Sum pending disbursal amounts (partial withdrawal remainders) across all users */
async function sumPendingDisbursalUsd(): Promise<number> {
  const { data } = await supabase
    .from("pending_disbursal_entries")
    .select("amount_usd")
    .eq("status", "pending");
  const rows = data ?? [];
  return rows.reduce((s: number, r: { amount_usd?: number }) => s + Number(r.amount_usd ?? 0), 0);
}

/** Fetch fresh data from DB, store in cache, return it */
export async function refreshAdminDashboard(): Promise<AdminDashboardData> {
  const today = new Date().toISOString().slice(0, 10);

  const [accounts, depositDestinationAccountIds] = await Promise.all([
    fetchAllOurAccounts(),
    fetchDepositDestinationAccountIds(),
  ]);
  const ourAccountIds = accounts.map((a) => a.account_id);

  const totalAccounts = accounts.length;
  const totalBusiness = accounts.reduce((sum, r) => sum + r.balance, 0);
  const activeInterestAccounts = accounts.filter((r) => r.interest_credit_enabled).length;

  const [dailyProfitGiven, totalProfitGiven, totalDeposits, totalWithdrawals, totalPendingDisbursalUsd] =
    await Promise.all([
      sumDailyInterestForDate(today),
      sumAllDailyInterest(),
      sumDepositsToAccountIds(depositDestinationAccountIds),
      sumWithdrawalsFromAccountIds(ourAccountIds),
      sumPendingDisbursalUsd(),
    ]);

  const data: AdminDashboardData = {
    totalDeposits,
    totalBusiness,
    totalAccounts,
    dailyProfitGiven,
    dailyProfitDate: today,
    totalProfitGiven,
    totalWithdrawals,
    activeInterestAccounts,
    totalPendingDisbursalUsd,
    updatedAt: new Date().toISOString(),
  };

  cached = data;
  return data;
}

/** Return cached data if available, otherwise fetch fresh */
export async function getAdminDashboard(): Promise<AdminDashboardData> {
  if (cached) return cached;
  return refreshAdminDashboard();
}
