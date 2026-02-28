import { getSession } from "@/lib/auth";
import { getProfileByEmail } from "@/lib/profile";
import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase/server";
import {
  buildAccountMaps,
  getTransactionsForClient,
  toDisplayTransactions,
} from "@/lib/transactions";
import { computeDashboardMetrics, computeMonthlySeries } from "@/lib/dashboard-metrics";
import { getFundsRates } from "@/lib/funds-rates";
import { getInvestmentAccount } from "@/lib/investment-account";
import InfoBox from "@/components/InfoBox";
import DashboardChartsClient from "./dashboard-charts-client";
import {
  BiDollar,
  BiTrendingUp,
  BiWallet,
  BiBarChartSquare,
  BiCalendar,
  BiUpArrowCircle,
  BiRepeat,
} from "react-icons/bi";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/auth/login");
  const profile = await getProfileByEmail(session.email);
  if (!profile) redirect("/auth/login");

  const clientId = profile.id;

  const investmentAccount = await getInvestmentAccount(clientId);
  const totalBalanceUsd = investmentAccount
    ? investmentAccount.balance
    : 0;

  const { transactions: rawTxs } = await getTransactionsForClient(clientId);
  const { byId, selfAccountNumbers } =
    await buildAccountMaps(clientId, rawTxs);
  const transactions = toDisplayTransactions(
    rawTxs,
    byId,
    selfAccountNumbers
  );
  const rates = await getFundsRates();
  const depositRate = rates.depositInrPerUsd;
  const withdrawalRate = rates.withdrawalInrPerUsd;
  const metrics = computeDashboardMetrics(
    transactions,
    totalBalanceUsd,
    depositRate
  );
  const monthlySeries = computeMonthlySeries(transactions, 12);

  const formatUsd = (n: number) =>
    "$" +
    n.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  const formatInr = (n: number) =>
    "₹ " +
    n.toLocaleString("en-IN", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-1 text-gray-500">
            Welcome back, {profile.nickname || profile.info.givenName || profile.email}.
          </p>
        </div>
        <img
          src="/images/rectangle_logo.svg"
          alt="Affinity Trades"
          className="h-10 w-auto object-contain"
        />
      </div>

      {/* Row 1: Balance, Own Profit, Partnership (Total Profit hidden per spec) */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <InfoBox
          icon={<BiDollar className="h-7 w-7" />}
          title="Estimated Total Balance"
          linkHref="/funds"
          linkLabel="↗"
          value={formatUsd(metrics.totalBalanceUsd)}
          subValue={formatInr(metrics.totalBalanceInr)}
          variant="primary"
        />
        <InfoBox
          icon={<BiWallet className="h-7 w-7" />}
          title="Own Profit"
          linkHref="/transactions"
          linkLabel="↗"
          value={formatUsd(metrics.ownProfit)}
          subValue={formatInr(metrics.ownProfit * withdrawalRate)}
          variant="warning"
        />
        <InfoBox
          icon={<BiBarChartSquare className="h-7 w-7" />}
          title="Partnership Earnings"
          linkHref="/team"
          linkLabel="↗"
          value={formatUsd(metrics.partnershipEarnings)}
          subValue={formatInr(metrics.partnershipEarnings * withdrawalRate)}
          variant="primary"
        />
      </div>

      {/* Row 2: Daily Profit + Return % cards (filled style like template second row) */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <InfoBox
          icon={<BiCalendar className="h-7 w-7" />}
          title="Daily Profit"
          value={formatUsd(metrics.dailyProfit)}
          variant="info"
          filled
        />
        <InfoBox
          icon={<BiUpArrowCircle className="h-7 w-7" />}
          title="Gross Profit Return"
          value={`${metrics.grossProfitReturnPct.toFixed(2)}%`}
          variant="primary"
          filled
        />
        <InfoBox
          icon={<BiRepeat className="h-7 w-7" />}
          title="Net Profit Returns"
          value={`${metrics.netProfitReturnPct.toFixed(2)}%`}
          variant="success"
          filled
        />
        <InfoBox
          icon={<BiCalendar className="h-7 w-7" />}
          title="Annualized Net Return"
          value={`${metrics.annualizedNetReturnPct.toFixed(2)}%`}
          variant="warning"
          filled
        />
      </div>

      {/* Month-wise charts */}
      <DashboardChartsClient
        ownProfitByMonth={monthlySeries}
        partnershipEarningsByMonth={monthlySeries}
        dailyProfitByMonth={monthlySeries}
      />
    </div>
  );
}
