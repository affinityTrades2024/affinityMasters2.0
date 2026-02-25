import Link from "next/link";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import DashboardCardsClient from "./dashboard-cards-client";
import {
  BiBox,
  BiPieChartAlt2,
  BiDollar,
  BiCalendar,
  BiCheckCircle,
  BiTransferAlt,
  BiWallet,
} from "react-icons/bi";

const quickLinks = [
  { href: "/manage/pamm", label: "Investment accounts", icon: BiBox },
  { href: "/manage/interest-rates", label: "Interest Rates", icon: BiPieChartAlt2 },
  { href: "/manage/profit-sharing/transactions", label: "Profit Sharing Transactions", icon: BiPieChartAlt2 },
  { href: "/manage/profit-sharing/daily-report", label: "Daily Profit Report", icon: BiPieChartAlt2 },
  { href: "/manage/funds-rates", label: "Funds rates", icon: BiTransferAlt },
  { href: "/manage/funds-requests", label: "Funds requests", icon: BiWallet },
  { href: "/manage/partnership-earnings", label: "Partnership Earnings", icon: BiDollar },
  { href: "/manage/manual-interest", label: "Manual Interest", icon: BiCalendar },
  { href: "/manage/skip-review", label: "Skip Review", icon: BiCheckCircle },
];

export default function ManageDashboardPage() {
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
        <DashboardCardsClient />
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
