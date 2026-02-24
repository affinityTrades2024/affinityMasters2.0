import { supabase } from "@/lib/supabase/server";
import { DEFAULT_INTEREST_RATE_MONTHLY } from "@/lib/config";

const MASTER_ACCOUNT_ID = 129;

/**
 * Get closing balance of an account at end of a given month (last day of month).
 * Balance = sum(credits to account) - sum(debits from account) for all txs up to end of month.
 */
export async function getClosingBalanceForMonth(
  accountId: number,
  year: number,
  month: number
): Promise<number> {
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const { data: credits } = await supabase
    .from("transactions")
    .select("destination_amount")
    .eq("destination_account_id", accountId)
    .lte("operation_date", endDate);
  const { data: debits } = await supabase
    .from("transactions")
    .select("source_amount")
    .eq("source_account_id", accountId)
    .lte("operation_date", endDate);

  const creditSum = (credits || []).reduce((s, r) => s + Number(r.destination_amount ?? 0), 0);
  const debitSum = (debits || []).reduce((s, r) => s + Number(r.source_amount ?? 0), 0);
  return creditSum - debitSum;
}

/**
 * Sum of withdrawals from an account from start of month through forDate (inclusive).
 */
export async function getWithdrawalsInMonthThroughDate(
  accountId: number,
  year: number,
  month: number,
  throughDate: string
): Promise<number> {
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const { data } = await supabase
    .from("transactions")
    .select("source_amount")
    .eq("source_account_id", accountId)
    .gte("operation_date", startDate)
    .lte("operation_date", throughDate)
    .in("type", ["withdrawal", "payout"]);
  return (data || []).reduce((s, r) => s + Number(r.source_amount ?? 0), 0);
}

/**
 * Balance for interest on a given date for an account.
 * = closing balance of previous month - withdrawals from start of current month through forDate.
 */
export async function getBalanceForInterest(
  accountId: number,
  forDate: string
): Promise<number> {
  const [y, m] = forDate.split("-").map(Number);
  const prevMonth = m === 1 ? 12 : m - 1;
  const prevYear = m === 1 ? y - 1 : y;
  const closingPrev = await getClosingBalanceForMonth(accountId, prevYear, prevMonth);
  const withdrawals = await getWithdrawalsInMonthThroughDate(
    accountId,
    y,
    m,
    forDate
  );
  return Math.max(0, closingPrev - withdrawals);
}

/**
 * Get interest rate for account (from accounts.interest_rate_monthly or default).
 */
export async function getInterestRateForAccount(
  accountId: number
): Promise<number> {
  const { data } = await supabase
    .from("accounts")
    .select("interest_rate_monthly")
    .eq("account_id", accountId)
    .maybeSingle();
  const rate = data?.interest_rate_monthly;
  if (rate != null && Number(rate) >= 0) return Number(rate);
  return DEFAULT_INTEREST_RATE_MONTHLY;
}

/**
 * Daily interest amount = (balance for interest) * (monthly rate / 100) / days_in_month.
 */
export function computeDailyInterestAmount(
  balanceForInterest: number,
  monthlyRate: number,
  year: number,
  month: number
): number {
  const daysInMonth = new Date(year, month, 0).getDate();
  return (balanceForInterest * (monthlyRate / 100)) / daysInMonth;
}

/**
 * Check if interest for this account for forDate was already credited (or skipped).
 */
export async function alreadyCreditedForDate(
  accountId: number,
  forDate: string
): Promise<{ credited: boolean; logId?: number; status?: string }> {
  const { data } = await supabase
    .from("interest_credit_log")
    .select("id, status")
    .eq("account_id", accountId)
    .eq("for_date", forDate)
    .maybeSingle();
  if (!data) return { credited: false };
  return {
    credited: (data.status as string) === "credited",
    logId: data.id,
    status: data.status as string,
  };
}

/**
 * Get next transaction id for insert (max id + 1). Supabase might use sequence; we use a simple approach.
 */
async function getNextTransactionId(): Promise<number> {
  const { data } = await supabase
    .from("transactions")
    .select("id")
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.id != null ? Number(data.id) + 1 : 1;
}

/**
 * Credit daily interest to one account for forDate. Creates transaction and updates account balance.
 * Caller should have checked alreadyCreditedForDate first.
 */
export async function creditDailyInterest(
  accountId: number,
  forDate: string,
  amount: number
): Promise<{ transactionId: number }> {
  const nextId = await getNextTransactionId();
  const { error: txError } = await supabase.from("transactions").insert({
    id: nextId,
    client_id: null,
    type: "daily_interest",
    source_account_id: MASTER_ACCOUNT_ID,
    destination_account_id: accountId,
    source_amount: amount,
    source_currency: "USD",
    destination_amount: amount,
    destination_currency: "USD",
    status: "completed",
    operation_date: forDate,
  });
  if (txError) throw new Error(`Insert transaction: ${txError.message}`);

  const { data: acc } = await supabase
    .from("accounts")
    .select("balance")
    .eq("account_id", accountId)
    .single();
  const newBalance = (Number(acc?.balance ?? 0)) + amount;
  const { error: updError } = await supabase
    .from("accounts")
    .update({ balance: newBalance })
    .eq("account_id", accountId);
  if (updError) throw new Error(`Update balance: ${updError.message}`);

  const { error: logError } = await supabase.from("interest_credit_log").insert({
    account_id: accountId,
    for_date: forDate,
    transaction_id: nextId,
    status: "credited",
  });
  if (logError) throw new Error(`Insert log: ${logError.message}`);

  return { transactionId: nextId };
}

/**
 * Record a skip (interest for this date was already credited; do not overwrite existing 'credited').
 */
export async function recordSkip(
  accountId: number,
  forDate: string
): Promise<void> {
  const { data: existing } = await supabase
    .from("interest_credit_log")
    .select("status")
    .eq("account_id", accountId)
    .eq("for_date", forDate)
    .maybeSingle();
  if (existing?.status === "credited") return;
  await supabase.from("interest_credit_log").upsert(
    {
      account_id: accountId,
      for_date: forDate,
      transaction_id: null,
      status: "skipped",
    },
    { onConflict: "account_id,for_date" }
  );
}

/**
 * Run daily interest for a given date (e.g. yesterday). Returns summary.
 * Only runs for designated investment accounts (one per client).
 */
export interface DailyInterestResult {
  credited: number;
  skipped: number;
  errors: string[];
}

export async function runDailyInterestForDate(
  forDate: string
): Promise<DailyInterestResult> {
  const result: DailyInterestResult = { credited: 0, skipped: 0, errors: [] };

  const { data: accountRows } = await supabase
    .from("accounts")
    .select("account_id")
    .not("platform", "ilike", "%demo%");
  const allAccountIds = new Set((accountRows || []).map((r) => Number(r.account_id)));

  const { data: clients } = await supabase
    .from("clients")
    .select("investment_account_id")
    .not("investment_account_id", "is", null);
  const investmentAccountIds = (clients || [])
    .map((c) => Number(c.investment_account_id))
    .filter((id) => Number.isFinite(id) && allAccountIds.has(id));

  const [y, m] = forDate.split("-").map(Number);

  for (const accountId of investmentAccountIds) {
    try {
      const existing = await alreadyCreditedForDate(accountId, forDate);
      if (existing.credited) {
        await recordSkip(accountId, forDate);
        result.skipped++;
        continue;
      }
      const balanceForInterest = await getBalanceForInterest(accountId, forDate);
      if (balanceForInterest <= 0) continue;
      const rate = await getInterestRateForAccount(accountId);
      const amount = computeDailyInterestAmount(
        balanceForInterest,
        rate,
        y,
        m
      );
      if (amount <= 0) continue;
      await creditDailyInterest(accountId, forDate, amount);
      result.credited++;
    } catch (e) {
      result.errors.push(
        `Account ${accountId}: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }
  return result;
}
