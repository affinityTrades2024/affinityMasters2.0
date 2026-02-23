"use client";

import { useState, useMemo } from "react";

interface AccountRow {
  account_id: number;
  account_number: string;
  client_name: string;
  interest_rate_monthly: number;
  email?: string;
}

const PAGE_SIZE_OPTIONS = [30, 50, 100] as const;

const inputClass =
  "w-24 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500";
const filterInputClass =
  "w-full min-w-0 rounded border border-slate-200 bg-white px-2 py-1 text-xs placeholder:text-slate-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500";
const btnPrimary =
  "rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:opacity-50";
const pageBtnClass =
  "rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed";

function matchFilter(value: string, filter: string): boolean {
  if (!filter.trim()) return true;
  return value.toLowerCase().includes(filter.trim().toLowerCase());
}

const COLUMNS = [
  { key: "account_number", label: "Account number" },
  { key: "client_name", label: "Client" },
  { key: "email", label: "Email" },
  { key: "rate", label: "Monthly %" },
] as const;

export default function InterestRatesClient({ accounts }: { accounts: AccountRow[] }) {
  const [rates, setRates] = useState<Record<number, number>>(
    Object.fromEntries(accounts.map((a) => [a.account_id, a.interest_rate_monthly]))
  );
  const [saving, setSaving] = useState<number | null>(null);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [pageSize, setPageSize] = useState<number>(50);
  const [page, setPage] = useState(1);

  const filteredAccounts = useMemo(() => {
    return accounts.filter((a) =>
      COLUMNS.every((col) => {
        const filter = filters[col.key] ?? "";
        if (!filter.trim()) return true;
        const val =
          col.key === "rate"
            ? String(rates[a.account_id] ?? a.interest_rate_monthly)
            : col.key === "email"
              ? (a.email ?? "—")
              : (a[col.key as keyof AccountRow] ?? "");
        return matchFilter(String(val), filter);
      })
    );
  }, [accounts, filters, rates]);

  const totalFiltered = filteredAccounts.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const start = (currentPage - 1) * pageSize;
  const pageAccounts = useMemo(
    () => filteredAccounts.slice(start, start + pageSize),
    [filteredAccounts, start, pageSize]
  );

  const setFilter = (key: string, value: string) => {
    setFilters((p) => ({ ...p, [key]: value }));
    setPage(1);
  };

  async function save(accountId: number, value: number) {
    setSaving(accountId);
    try {
      const res = await fetch("/api/admin/interest-rate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId, rate: value }),
      });
      if (!res.ok) throw new Error("Save failed");
      setRates((p) => ({ ...p, [accountId]: value }));
    } catch (e) {
      alert(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(null);
    }
  }

  const showingStart = totalFiltered === 0 ? 0 : start + 1;
  const showingEnd = Math.min(start + pageSize, totalFiltered);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-500">
          {totalFiltered === accounts.length
            ? `Total: ${accounts.length} account${accounts.length !== 1 ? "s" : ""}`
            : `Showing ${filteredAccounts.length} of ${accounts.length} (filtered).`}{" "}
          Type in filter boxes to narrow.
        </p>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-600">Rows per page:</span>
          <div className="flex gap-1">
            {PAGE_SIZE_OPTIONS.map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => {
                  setPageSize(size);
                  setPage(1);
                }}
                className={`${pageBtnClass} ${pageSize === size ? "border-amber-500 bg-amber-50 text-amber-800" : ""}`}
              >
                {size}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500"
                >
                  {col.label}
                </th>
              ))}
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                Action
              </th>
            </tr>
            <tr className="bg-slate-100/80">
              {COLUMNS.map((col) => (
                <th key={col.key} className="px-4 py-2">
                  <input
                    type="text"
                    placeholder="Filter..."
                    value={filters[col.key] ?? ""}
                    onChange={(e) => setFilter(col.key, e.target.value)}
                    className={filterInputClass}
                  />
                </th>
              ))}
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {pageAccounts.map((a) => (
              <tr key={a.account_id} className="hover:bg-slate-50/50">
                <td className="px-4 py-3 text-sm font-medium text-slate-900">
                  {a.account_number}
                </td>
                <td className="px-4 py-3 text-sm text-slate-600">{a.client_name}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{a.email ?? "—"}</td>
                <td className="px-4 py-3">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.01}
                    value={rates[a.account_id] ?? 3}
                    onChange={(e) =>
                      setRates((p) => ({ ...p, [a.account_id]: parseFloat(e.target.value) || 0 }))
                    }
                    className={inputClass}
                  />
                </td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    disabled={saving === a.account_id}
                    onClick={() => save(a.account_id, rates[a.account_id] ?? 3)}
                    className={btnPrimary}
                  >
                    {saving === a.account_id ? "Saving…" : "Save"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-500">
          Showing {showingStart}–{showingEnd} of {totalFiltered}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            className={pageBtnClass}
          >
            Previous
          </button>
          <span className="text-sm text-slate-600">
            Page {currentPage} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages}
            className={pageBtnClass}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
