"use client";

import { useState, useEffect, useCallback } from "react";
import AdminStatCard from "@/components/admin/AdminStatCard";
import {
  BiDollar,
  BiUser,
  BiTrendingUp,
  BiTrendingDown,
  BiCalendar,
  BiWallet,
  BiCheckCircle,
  BiRefresh,
  BiTime,
} from "react-icons/bi";

/** Dashboard metrics response shape (matches API JSON) */
interface AdminDashboardData {
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

function formatUsd(n: number): string {
  return (
    "$" +
    n.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

function formatUsdShort(n: number): { display: string; full: string } {
  const full = formatUsd(n);
  if (n >= 1e9) return { display: "$" + (n / 1e9).toFixed(2) + "B", full };
  if (n >= 1e6) return { display: "$" + (n / 1e6).toFixed(2) + "M", full };
  if (n >= 1e3) return { display: "$" + (n / 1e3).toFixed(2) + "K", full };
  return { display: full, full };
}

function formatDateLabel(isoDate: string): string {
  if (!isoDate) return "—";
  return new Date(isoDate + "T00:00:00").toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatLastUpdated(isoTimestamp: string): string {
  if (!isoTimestamp) return "—";
  const d = new Date(isoTimestamp);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} min ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hr ago`;
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

export default function DashboardCardsClient() {
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/dashboard-metrics", {
        method: "GET",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/dashboard-metrics", {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to refresh");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading && !data) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-xl border border-slate-200 bg-slate-100"
            />
          ))}
        </div>
        <p className="text-sm text-slate-500">Loading…</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4">
        <p className="text-sm font-medium text-red-800">{error}</p>
        <button
          type="button"
          onClick={() => fetchData()}
          className="mt-2 text-sm text-red-600 underline hover:no-underline"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  const totalDepositsFmt = formatUsdShort(data.totalDeposits);
  const totalBusinessFmt = formatUsdShort(data.totalBusiness);
  const totalProfitFmt = formatUsdShort(data.totalProfitGiven);
  const totalWithdrawalsFmt = formatUsdShort(data.totalWithdrawals);

  const profitLoss = data.totalBusiness - data.totalDeposits;
  const profitLossFmt = formatUsdShort(Math.abs(profitLoss));
  const profitLossDisplay = profitLoss < 0 ? `-${profitLossFmt.display}` : profitLossFmt.display;
  const profitLossFull = profitLoss < 0 ? `-${profitLossFmt.full}` : profitLossFmt.full;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          Last updated: {formatLastUpdated(data.updatedAt)}
        </p>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 disabled:pointer-events-none"
          aria-label="Refresh dashboard data"
        >
          <BiRefresh
            className={`h-5 w-5 ${refreshing ? "animate-spin" : ""}`}
          />
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>
      {error && (
        <p className="text-sm text-amber-600">{error}</p>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <AdminStatCard
          title="Total Deposits"
          value={totalDepositsFmt.display}
          valueTitle={totalDepositsFmt.full}
          icon={<BiDollar className="h-6 w-6" />}
          variant="primary"
        />
        <AdminStatCard
          title="Total Business"
          value={totalBusinessFmt.display}
          valueTitle={totalBusinessFmt.full}
          subValue="sum of all balances"
          icon={<BiTrendingUp className="h-6 w-6" />}
          variant="success"
        />
        <AdminStatCard
          title="Total Accounts"
          value={String(data.totalAccounts)}
          subValue="investment accounts"
          icon={<BiUser className="h-6 w-6" />}
          variant="slate"
        />
        <AdminStatCard
          title="Daily Profit Given"
          value={formatUsd(data.dailyProfitGiven)}
          subValue={formatDateLabel(data.dailyProfitDate)}
          icon={<BiCalendar className="h-6 w-6" />}
          variant="warning"
        />
        <AdminStatCard
          title="Total Profit Given"
          value={totalProfitFmt.display}
          valueTitle={totalProfitFmt.full}
          subValue="all time"
          icon={<BiTrendingUp className="h-6 w-6" />}
          variant="success"
        />
        <AdminStatCard
          title="Total Withdrawals"
          value={totalWithdrawalsFmt.display}
          valueTitle={totalWithdrawalsFmt.full}
          icon={<BiWallet className="h-6 w-6" />}
          variant="slate"
        />
        <AdminStatCard
          title="Active Interest Accounts"
          value={String(data.activeInterestAccounts)}
          subValue="interest enabled"
          icon={<BiCheckCircle className="h-6 w-6" />}
          variant="primary"
        />
        <AdminStatCard
          title="Profit/Loss"
          value={profitLossDisplay}
          valueTitle={profitLossFull}
          subValue={profitLoss < 0 ? "Loss (Business − Deposits)" : "Profit (Business − Deposits)"}
          icon={profitLoss < 0 ? <BiTrendingDown className="h-6 w-6" /> : <BiTrendingUp className="h-6 w-6" />}
          variant={profitLoss < 0 ? "warning" : "success"}
        />
        <AdminStatCard
          title="Total Pending Disbursal"
          value={formatUsdShort(data.totalPendingDisbursalUsd).display}
          valueTitle={formatUsdShort(data.totalPendingDisbursalUsd).full}
          subValue="partial withdrawal remainders"
          icon={<BiTime className="h-6 w-6" />}
          variant="warning"
          href="/manage/partial-disbursal-requests"
        />
      </div>
    </div>
  );
}
