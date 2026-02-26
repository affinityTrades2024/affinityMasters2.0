"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  BiBarChartAlt2,
  BiTransferAlt,
  BiHistory,
  BiBox,
  BiGroup,
  BiUserCircle,
} from "react-icons/bi";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: BiBarChartAlt2 },
  {
    href: "/funds",
    label: "Funds",
    icon: BiTransferAlt,
    children: [
      { href: "/funds/deposit", label: "Deposit" },
      { href: "/funds/withdrawal", label: "Withdraw" },
    ],
  },
  { href: "/transactions", label: "Transaction History", icon: BiHistory },
  { href: "/pamm/accounts", label: "Investment Account", icon: BiBox },
  { href: "/team", label: "My Team", icon: BiGroup },
  { href: "/team/referral", label: "Referrals", icon: BiGroup },
];

function NavLink({
  href,
  label,
  icon: Icon,
  subItems,
  onClick,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  subItems?: { href: string; label: string }[];
  onClick?: () => void;
}) {
  const pathname = usePathname();
  const isActive = pathname === href || (subItems?.some((c) => pathname === c.href) ?? false);

  return (
    <li className="nav-item">
      {subItems?.length ? (
        <>
          <Link
            href={href}
            onClick={onClick}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
              isActive
                ? "bg-slate-600/50 text-white"
                : "text-slate-300 hover:bg-slate-700/50 hover:text-white"
            }`}
          >
            {Icon && <Icon className="h-5 w-5 shrink-0" />}
            {label}
          </Link>
          <ul className="ml-4 mt-1 space-y-0.5 border-l border-slate-600 pl-3">
            {subItems.map((c) => (
              <li key={c.href}>
                <Link
                  href={c.href}
                  onClick={onClick}
                  className={`block rounded py-1.5 pl-2 text-sm ${
                    pathname === c.href
                      ? "text-amber-400 font-medium"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {c.label}
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <Link
          href={href}
          onClick={onClick}
          className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
            isActive
              ? "bg-slate-600/50 text-white"
              : "text-slate-300 hover:bg-slate-700/50 hover:text-white"
          }`}
        >
          {Icon && <Icon className="h-5 w-5 shrink-0" />}
          {label}
        </Link>
      )}
    </li>
  );
}

interface SidebarProps {
  isAdmin: boolean;
  open?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ isAdmin, open, onClose }: SidebarProps) {
  const isOpen = open ?? true;

  return (
    <>
      {/* Mobile overlay */}
      {onClose && isOpen && (
        <div
          className="fixed inset-0 z-20 bg-slate-900/50 lg:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}

      {/* Sidebar: drawer on mobile, fixed on desktop */}
      <aside
        className={`fixed left-0 top-0 z-30 flex h-screen w-64 flex-col border-r border-slate-700/50 bg-slate-800 shadow-xl transition-transform duration-200 lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="flex h-16 items-center gap-3 border-b border-slate-700/50 px-4">
          <Image
            src="/images/square_logo.png"
            alt="Affinity Trades"
            width={36}
            height={36}
            className="h-9 w-9 shrink-0 object-contain"
          />
          <span className="font-semibold text-white">Affinity Trades</span>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.href}
                href={item.href}
                label={item.label}
                icon={item.icon}
                subItems={item.children}
                onClick={onClose}
              />
            ))}
            {isAdmin && (
              <li className="mt-4 border-t border-slate-700/50 pt-4">
                <Link
                  href="/manage"
                  onClick={onClose}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-amber-400 hover:bg-slate-700/50 hover:text-amber-300"
                >
                  <BiUserCircle className="h-5 w-5" />
                  Admin
                </Link>
              </li>
            )}
          </ul>
        </nav>
        <div className="border-t border-slate-700/50 px-4 py-3 text-center text-xs text-slate-500">
          Affinity Trades CRM v2.0
        </div>
      </aside>
    </>
  );
}
