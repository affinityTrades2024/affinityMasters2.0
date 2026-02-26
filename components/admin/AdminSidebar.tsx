"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  BiBarChartAlt2,
  BiBox,
  BiPieChartAlt2,
  BiDollar,
  BiCalendar,
  BiCheckCircle,
  BiFile,
  BiLeftArrowAlt,
  BiMenu,
  BiX,
  BiTransferAlt,
  BiWallet,
} from "react-icons/bi";
import { HiOutlineCurrencyDollar } from "react-icons/hi";

const navItems: Array<
  | { href: string; label: string; icon: React.ComponentType<{ className?: string }>; exact?: boolean }
  | { label: string; icon: React.ComponentType<{ className?: string }>; children: { href: string; label: string }[] }
> = [
  { href: "/manage", label: "Dashboard", icon: BiBarChartAlt2, exact: true },
  { href: "/manage/pamm", label: "Investment accounts", icon: BiBox },
  {
    label: "Profit Sharing",
    icon: BiPieChartAlt2,
    children: [
      { href: "/manage/interest-rates", label: "Interest Rates" },
      { href: "/manage/profit-sharing/daily-report", label: "Daily Profit Report" },
      { href: "/manage/profit-sharing/transactions", label: "Profit Sharing Transactions" },
    ],
  },
  { href: "/manage/funds-rates", label: "Funds rates", icon: BiTransferAlt },
  {
    label: "Requests",
    icon: BiWallet,
    children: [
      { href: "/manage/funds-requests", label: "Fund Requests" },
      { href: "/manage/funds-requests/pending-withdrawals", label: "Disbursement Requests" },
      { href: "/manage/funds-requests/history", label: "Request History" },
      { href: "/manage/funds-requests/auto-withdrawal-clients", label: "Auto Withdrawal Clients" },
      { href: "/manage/funds-requests/auto-job-runs", label: "Auto Job Runs" },
    ],
  },
  { href: "/manage/partnership-earnings", label: "Partnership Earnings", icon: BiDollar },
  { href: "/manage/reports", label: "Reports", icon: BiFile },
  { href: "/manage/manual-interest", label: "Manual Interest", icon: BiCalendar },
  { href: "/manage/skip-review", label: "Skip Review", icon: BiCheckCircle },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const navContent = (
    <>
      <div className="flex h-16 items-center gap-3 border-b border-slate-700/50 px-4">
        <Image
          src="/images/square_logo.png"
          alt="Affinity Trades"
          width={36}
          height={36}
          className="h-9 w-9 shrink-0 object-contain"
        />
        <span className="font-semibold text-white">Admin</span>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-0.5">
          {navItems.map((item) => {
            if ("children" in item) {
              const isParentActive = item.children.some((c) => pathname === c.href);
              const Icon = item.icon;
              return (
                <li key={item.label}>
                  <div
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${
                      isParentActive ? "text-amber-400" : "text-slate-300"
                    }`}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    {item.label}
                  </div>
                  <ul className="ml-4 mt-0.5 space-y-0.5 border-l border-slate-600 pl-3">
                    {item.children.map((child) => {
                      const isActive = pathname === child.href;
                      return (
                        <li key={child.href}>
                          <Link
                            href={child.href}
                            onClick={() => setOpen(false)}
                            className={`block rounded py-1.5 pl-2 text-sm ${
                              isActive
                                ? "text-amber-400 font-medium"
                                : "text-slate-400 hover:text-slate-200"
                            }`}
                          >
                            {child.label}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              );
            }
            const isActive = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-amber-500/20 text-amber-400"
                      : "text-slate-300 hover:bg-slate-700/50 hover:text-white"
                  }`}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="border-t border-slate-700/50 px-3 py-3">
        <Link
          href="/dashboard"
          onClick={() => setOpen(false)}
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-400 hover:bg-slate-700/50 hover:text-white transition-colors"
        >
          <HiOutlineCurrencyDollar className="h-5 w-5" />
          Back to App
        </Link>
        <Link
          href="/dashboard"
          onClick={() => setOpen(false)}
          className="mt-1 flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-slate-500 hover:text-slate-400"
        >
          <BiLeftArrowAlt className="h-4 w-4" />
          Exit admin
        </Link>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="fixed left-0 right-0 top-0 z-40 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 shadow-sm lg:hidden">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
          aria-label={open ? "Close menu" : "Open menu"}
        >
          {open ? <BiX className="h-6 w-6" /> : <BiMenu className="h-6 w-6" />}
        </button>
        <span className="font-semibold text-slate-800">Admin</span>
        <div className="w-9" />
      </div>

      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/50 lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      {/* Sidebar: drawer on mobile, fixed on desktop */}
      <aside
        className={`fixed left-0 top-0 z-30 flex h-screen w-64 flex-col border-r border-slate-700/50 bg-slate-800 shadow-xl transition-transform duration-200 lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {navContent}
      </aside>
    </>
  );
}
