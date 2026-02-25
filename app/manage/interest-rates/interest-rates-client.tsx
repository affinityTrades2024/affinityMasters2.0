"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

interface AccountRow {
  account_id: number;
  account_number: string;
  client_name: string;
  interest_rate_monthly: number;
  email?: string;
  interest_credit_enabled: boolean;
}

const PAGE_SIZE_OPTIONS = [20, 30, 50] as const;

const inputClass =
  "w-24 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500";
const filterInputClass =
  "min-w-0 rounded border border-slate-200 bg-white px-2 py-1 text-xs placeholder:text-slate-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500";
const btnPrimary =
  "rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:opacity-50";
const pageBtnClass =
  "rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed";

function buildUrl(params: { page?: number; pageSize?: number; q?: string }) {
  const sp = new URLSearchParams();
  if (params.page != null && params.page > 1) sp.set("page", String(params.page));
  if (params.pageSize != null && params.pageSize !== 20) sp.set("pageSize", String(params.pageSize));
  if (params.q != null && params.q.trim()) sp.set("q", params.q.trim());
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export default function InterestRatesClient({
  accounts,
  totalCount,
  page,
  pageSize,
  searchQuery: initialSearch,
}: {
  accounts: AccountRow[];
  totalCount: number;
  page: number;
  pageSize: number;
  searchQuery: string;
}) {
  const router = useRouter();
  const [rates, setRates] = useState<Record<number, number>>(
    Object.fromEntries(accounts.map((a) => [a.account_id, a.interest_rate_monthly]))
  );
  const [interestEnabled, setInterestEnabled] = useState<Record<number, boolean>>(
    Object.fromEntries(accounts.map((a) => [a.account_id, a.interest_credit_enabled]))
  );
  const [saving, setSaving] = useState<number | null>(null);
  const [toggling, setToggling] = useState<number | null>(null);
  const [searchInput, setSearchInput] = useState(initialSearch);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setSearchInput(initialSearch);
  }, [initialSearch]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function applySearch(q: string) {
    router.push(buildUrl({ page: 1, pageSize, q: q.trim() || undefined }));
  }

  function handleSearchChange(value: string) {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => applySearch(value), 300);
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const from = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalCount);

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

  async function toggleInterestCredit(accountId: number) {
    const current = interestEnabled[accountId] ?? true;
    const next = !current;
    setToggling(accountId);
    try {
      const res = await fetch("/api/admin/interest-credit-enable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId, enabled: next }),
      });
      if (!res.ok) throw new Error("Update failed");
      setInterestEnabled((p) => ({ ...p, [accountId]: next }));
    } catch (e) {
      alert(e instanceof Error ? e.message : "Update failed");
    } finally {
      setToggling(null);
    }
  }

  const COLUMNS = [
    { key: "account_number", label: "Account number" },
    { key: "client_name", label: "Client" },
    { key: "email", label: "Email" },
    { key: "rate", label: "Monthly %" },
  ] as const;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <input
          type="text"
          placeholder="Search by account, name, email…"
          value={searchInput}
          onChange={(e) => handleSearchChange(e.target.value)}
          className={`${filterInputClass} flex-1 min-w-0 max-w-sm`}
          aria-label="Search accounts"
        />
        <p className="text-sm text-slate-500">
          Showing {from}–{to} of {totalCount}
        </p>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-600">Per page:</span>
          <div className="flex gap-1">
            {PAGE_SIZE_OPTIONS.map((size) => (
              <a
                key={size}
                href={buildUrl({ page: 1, pageSize: size, q: initialSearch.trim() || undefined })}
                className={`${pageBtnClass} ${pageSize === size ? "border-amber-500 bg-amber-50 text-amber-800" : ""}`}
              >
                {size}
              </a>
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
                Interest credit
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {accounts.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                  {initialSearch
                    ? "No accounts match your search. Try a different term."
                    : "No investment accounts available."}
                </td>
              </tr>
            ) : (
              accounts.map((a) => (
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
                    disabled={toggling === a.account_id}
                    onClick={() => toggleInterestCredit(a.account_id)}
                    className={
                      (interestEnabled[a.account_id] ?? true)
                        ? "rounded-lg border border-slate-300 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
                        : "rounded-lg border border-slate-300 bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-200 disabled:opacity-50"
                    }
                  >
                    {toggling === a.account_id
                      ? "…"
                      : (interestEnabled[a.account_id] ?? true)
                        ? "On"
                        : "Off"}
                  </button>
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
            ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-500">
          Showing {from}–{to} of {totalCount}
        </p>
        <div className="flex items-center gap-2">
          <a
            href={buildUrl({ page: page - 1, pageSize, q: initialSearch.trim() || undefined })}
            className={page <= 1 ? "pointer-events-none text-slate-400 " + pageBtnClass : pageBtnClass}
            aria-disabled={page <= 1}
          >
            Previous
          </a>
          <span className="text-sm text-slate-600">
            Page {page} of {totalPages}
          </span>
          <a
            href={buildUrl({ page: page + 1, pageSize, q: initialSearch.trim() || undefined })}
            className={page >= totalPages ? "pointer-events-none text-slate-400 " + pageBtnClass : pageBtnClass}
            aria-disabled={page >= totalPages}
          >
            Next
          </a>
        </div>
      </div>
    </div>
  );
}
