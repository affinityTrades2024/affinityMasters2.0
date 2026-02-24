import { supabase } from "@/lib/supabase/server";
import Link from "next/link";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminStatCard from "@/components/admin/AdminStatCard";
import {
  BiDollar,
  BiUser,
  BiTrendingUp,
  BiBox,
  BiPieChartAlt2,
  BiCalendar,
  BiCheckCircle,
  BiTransferAlt,
  BiWallet,
} from "react-icons/bi";

export default async function ManageDashboardPage() {
  const { data: depositData } = await supabase
    .from("transactions")
    .select("destination_amount")
    .eq("type", "deposit");
  const totalDeposits = (depositData || []).reduce(
    (s, r) => s + Number(r.destination_amount ?? 0),
    0
  );

  const { count: accountsCount } = await supabase
    .from("accounts")
    .select("account_id", { count: "exact", head: true })
    .not("platform", "ilike", "%demo%");

  const { data: interestData } = await supabase
    .from("transactions")
    .select("destination_amount")
    .eq("type", "daily_interest");
  const { data: partnershipData } = await supabase
    .from("transactions")
    .select("destination_amount")
    .eq("type", "partnership_fee_admin");
  const totalInterest = (interestData || []).reduce(
    (s, r) => s + Number(r.destination_amount ?? 0),
    0
  );
  const totalPartnership = (partnershipData || []).reduce(
    (s, r) => s + Number(r.destination_amount ?? 0),
    0
  );
  const totalProfitGiven = totalInterest + totalPartnership;

  const formatUsd = (n: number) =>
    "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  /** Abbreviated USD for large numbers (e.g. $100K, $10M), full value for tooltip */
  function formatUsdShort(n: number): { display: string; full: string } {
    const full = formatUsd(n);
    if (n >= 1e9) return { display: "$" + (n / 1e9).toFixed(2) + "B", full };
    if (n >= 1e6) return { display: "$" + (n / 1e6).toFixed(2) + "M", full };
    if (n >= 1e3) return { display: "$" + (n / 1e3).toFixed(2) + "K", full };
    return { display: full, full };
  }

  const totalDepositsFormatted = formatUsdShort(totalDeposits);

  const quickLinks = [
    { href: "/manage/pamm", label: "Investment accounts", icon: BiBox },
    { href: "/manage/interest-rates", label: "Interest Rates", icon: BiPieChartAlt2 },
    { href: "/manage/funds-rates", label: "Funds rates", icon: BiTransferAlt },
    { href: "/manage/funds-requests", label: "Funds requests", icon: BiWallet },
    { href: "/manage/partnership-earnings", label: "Partnership Earnings", icon: BiDollar },
    { href: "/manage/manual-interest", label: "Manual Interest", icon: BiCalendar },
    { href: "/manage/skip-review", label: "Skip Review", icon: BiCheckCircle },
  ];

  return (
    <div>
      <AdminPageHeader
        title="Admin Dashboard"
        description="Overview and quick access to admin tools."
      />

      <section className="mb-8">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-3">
          Overview
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <AdminStatCard
            title="Total deposits"
            value={totalDepositsFormatted.display}
            valueTitle={totalDepositsFormatted.full}
            icon={<BiDollar className="h-6 w-6" />}
            variant="primary"
          />
          <AdminStatCard
            title="Total accounts"
            value={String(accountsCount ?? 0)}
            subValue="excluding demo"
            icon={<BiUser className="h-6 w-6" />}
            variant="slate"
          />
          <AdminStatCard
            title="Total profit given"
            value={formatUsd(totalProfitGiven)}
            subValue="interest + partnership"
            icon={<BiTrendingUp className="h-6 w-6" />}
            variant="success"
          />
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-3">
          Quick actions
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {quickLinks.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:border-amber-300 hover:shadow-md"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="font-medium text-slate-800">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
