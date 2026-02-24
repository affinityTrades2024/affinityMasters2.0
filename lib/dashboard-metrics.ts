import type { TransactionDisplay } from "@/lib/transactions-types";
import { USD_INR_RATE } from "@/lib/config";

export interface DashboardMetrics {
  totalBalanceUsd: number;
  totalBalanceInr: number;
  partnershipEarnings: number;
  totalProfit: number;
  ownProfit: number;
  totalDeposits: number;
  totalDepositsForReturn: number;
  grossProfitReturnPct: number;
  netProfitReturnPct: number;
  annualizedNetReturnPct: number;
  dailyProfit: number;
}

/**
 * Simplified: use all performance fees for profit (not only 1st of month).
 * total_deposits for return = max(deposit amounts) as per spec quirk.
 * displayRateInr: optional INR per 1 USD for totalBalanceInr (default from config).
 */
export function computeDashboardMetrics(
  transactions: TransactionDisplay[],
  totalBalanceUsd: number,
  displayRateInr?: number
): DashboardMetrics {
  const rate = displayRateInr ?? USD_INR_RATE;
  // Partnership earnings = sum of credit amounts for transactions classified as Partnership Fees.
  const partnershipEarnings = transactions
    .filter((t) => t.type === "Partnership Fees")
    .reduce((s, t) => s + t.creditDetails.amount, 0);

  const performanceFeesFirstOfMonth = transactions
    .filter((t) => {
      if (t.type !== "Performance Fees") return false;
      const d = t.operationDate;
      return d && d.endsWith("-01");
    })
    .reduce((s, t) => s + t.creditDetails.amount, 0);

  const performanceFeesAll = transactions
    .filter((t) => t.type === "Performance Fees")
    .reduce((s, t) => s + t.creditDetails.amount, 0);

  const totalProfit = Math.round(performanceFeesFirstOfMonth * 2);
  const ownProfit = Math.round(performanceFeesFirstOfMonth);
  const totalDeposits = transactions
    .filter((t) => t.type === "deposit")
    .reduce((s, t) => s + t.creditDetails.amount, 0);
  const depositAmounts = transactions
    .filter((t) => t.type === "deposit")
    .map((t) => t.creditDetails.amount);
  const totalDepositsForReturn =
    depositAmounts.length > 0 ? Math.max(...depositAmounts) : 0;

  const grossProfitReturnPct =
    totalDepositsForReturn > 0
      ? (totalProfit / totalDepositsForReturn) * 100
      : 0;
  const netProfitReturnPct =
    totalDepositsForReturn > 0
      ? (ownProfit / totalDepositsForReturn) * 100
      : 0;

  const depositWithDate = transactions
    .filter((t) => t.type === "deposit")
    .map((t) => ({
      amount: t.creditDetails.amount,
      date: t.operationDate ? new Date(t.operationDate).getTime() : 0,
    }));
  const now = Date.now();
  const waaDays =
    depositWithDate.length > 0 && totalDeposits > 0
      ? depositWithDate.reduce(
          (sum, d) =>
            sum +
            (d.amount * (now - d.date)) / (1000 * 60 * 60 * 24),
          0
        ) / totalDeposits
      : 365;
  const annualizedNetReturnPct =
    totalDepositsForReturn > 0 && waaDays > 0
      ? (ownProfit / totalDepositsForReturn) * 100 * (365 / waaDays)
      : 0;

  const today = new Date().toISOString().slice(0, 10);
  const dailyProfit = transactions
    .filter(
      (t) =>
        t.type === "Daily Interest" && t.createTime.startsWith(today)
    )
    .reduce((s, t) => s + t.creditDetails.amount, 0);

  return {
    totalBalanceUsd,
    totalBalanceInr: totalBalanceUsd * rate,
    partnershipEarnings,
    totalProfit,
    ownProfit,
    totalDeposits,
    totalDepositsForReturn,
    grossProfitReturnPct,
    netProfitReturnPct,
    annualizedNetReturnPct,
    dailyProfit,
  };
}
