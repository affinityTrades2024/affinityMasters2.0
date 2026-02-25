"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import AdminAlert from "@/components/admin/AdminAlert";

interface AccountOption {
  account_id: number;
  account_number: string;
  client_name: string;
  email: string;
}

const inputClass =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500";
const btnPrimary =
  "rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:opacity-50";

function buildUrl(params: { page?: number; pageSize?: number; q?: string }) {
  const sp = new URLSearchParams();
  if (params.page != null && params.page > 1) sp.set("page", String(params.page));
  if (params.pageSize != null && params.pageSize !== 20) sp.set("pageSize", String(params.pageSize));
  if (params.q != null && params.q.trim()) sp.set("q", params.q.trim());
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export default function ManualInterestClient({
  accounts,
  totalCount,
  page,
  pageSize,
  searchQuery: initialSearch,
}: {
  accounts: AccountOption[];
  totalCount: number;
  page: number;
  pageSize: number;
  searchQuery: string;
}) {
  const router = useRouter();
  const [forDate, setForDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [mode, setMode] = useState<"single" | "multiple" | "all">("single");
  const [searchInput, setSearchInput] = useState(initialSearch);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
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

  const displayAccounts = accounts;
  const idsToRun =
    mode === "all"
      ? []
      : mode === "multiple"
        ? selectedIds
        : selectedIds.slice(0, 1);

  async function run() {
    if (mode !== "all" && idsToRun.length === 0) {
      setMessage({ type: "error", text: "Select at least one account." });
      return;
    }
    const payload = mode === "all" ? { forDate, all: true } : { forDate, accountIds: idsToRun };
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/manual-interest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      let text = `Credited: ${data.credited ?? 0}, skipped: ${data.skipped ?? 0}.`;
      if (data.hint) text += ` ${data.hint}`;
      setMessage({
        type: "success",
        text,
      });
    } catch (e) {
      setMessage({
        type: "error",
        text: e instanceof Error ? e.message : "Failed",
      });
    } finally {
      setLoading(false);
    }
  }

  const filteredIds = new Set(displayAccounts.map((a) => a.account_id));
  const selectedInFiltered = selectedIds.filter((id) => filteredIds.has(id));
  const allFilteredSelected =
    displayAccounts.length > 0 &&
    selectedInFiltered.length === displayAccounts.length;

  const headerCheckRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const el = headerCheckRef.current;
    if (!el) return;
    el.indeterminate = selectedInFiltered.length > 0 && !allFilteredSelected;
  }, [selectedInFiltered.length, allFilteredSelected]);

  function toggleAllFiltered() {
    if (allFilteredSelected) {
      setSelectedIds((prev) => prev.filter((id) => !filteredIds.has(id)));
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        displayAccounts.forEach((a) => next.add(a.account_id));
        return Array.from(next);
      });
    }
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const from = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalCount);

  return (
    <div className="space-y-6">
      {message && (
        <AdminAlert
          type={message.type}
          message={message.text}
          onDismiss={() => setMessage(null)}
        />
      )}

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Interest for date
          </label>
          <input
            type="date"
            value={forDate}
            onChange={(e) => setForDate(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Scope
          </label>
          <div className="flex flex-wrap gap-4">
            {[
              { value: "single" as const, label: "Single account" },
              { value: "multiple" as const, label: "Multiple accounts" },
              { value: "all" as const, label: "All accounts" },
            ].map((opt) => (
              <label
                key={opt.value}
                className="flex items-center gap-2 cursor-pointer text-sm text-slate-700"
              >
                <input
                  type="radio"
                  name="mode"
                  checked={mode === opt.value}
                  onChange={() => setMode(opt.value)}
                  className="h-4 w-4 border-slate-300 text-amber-600 focus:ring-amber-500"
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>
      </div>

      {mode !== "all" && (
        <div className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <label className="text-sm font-medium text-slate-700">
              Accounts
            </label>
            <span className="text-sm text-slate-500">
              {selectedIds.length} selected · Showing {from}–{to} of {totalCount}
            </span>
          </div>

          <div className="flex flex-wrap gap-2 items-center justify-between">
            <input
              type="text"
              placeholder="Search by name, email or account number…"
              value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
              className={`${inputClass} flex-1 min-w-0 max-w-sm`}
              aria-label="Search accounts"
            />
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <span>Per page:</span>
              {([20, 30, 50] as const).map((size) => (
                <a
                  key={size}
                  href={buildUrl({ page: 1, pageSize: size, q: initialSearch.trim() || undefined })}
                  className={pageSize === size ? "font-medium text-amber-600" : "hover:text-amber-600"}
                >
                  {size}
                </a>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between text-sm text-slate-600">
            <span>
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <a
                href={buildUrl({ page: page - 1, pageSize, q: initialSearch.trim() || undefined })}
                className={page <= 1 ? "pointer-events-none text-slate-400" : "hover:text-amber-600"}
              >
                Previous
              </a>
              <a
                href={buildUrl({ page: page + 1, pageSize, q: initialSearch.trim() || undefined })}
                className={page >= totalPages ? "pointer-events-none text-slate-400" : "hover:text-amber-600"}
              >
                Next
              </a>
            </div>
          </div>

          {mode === "multiple" && displayAccounts.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={toggleAllFiltered}
                className="text-sm font-medium text-amber-600 hover:text-amber-700"
              >
                {allFilteredSelected ? "Deselect all shown" : "Select all shown"}
              </button>
              {selectedIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedIds([])}
                  className="text-sm text-slate-500 hover:text-slate-700"
                >
                  Clear selection
                </button>
              )}
            </div>
          )}

          {displayAccounts.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50/50 px-4 py-8 text-center text-sm text-slate-500">
              {initialSearch
                ? "No accounts match your search. Try a different term."
                : "No accounts available."}
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <div className="max-h-72 overflow-y-auto bg-white">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50">
                    <tr>
                      <th className="w-10 px-3 py-2.5">
                        {mode === "multiple" && (
                          <input
                            ref={headerCheckRef}
                            type="checkbox"
                            checked={allFilteredSelected}
                            onChange={toggleAllFiltered}
                            className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                            aria-label={allFilteredSelected ? "Deselect all" : "Select all shown"}
                          />
                        )}
                      </th>
                      <th className="px-3 py-2.5 font-medium text-slate-700">Account #</th>
                      <th className="px-3 py-2.5 font-medium text-slate-700">Name</th>
                      <th className="px-3 py-2.5 font-medium text-slate-700">Email</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayAccounts.map((a) => (
                      <tr
                        key={a.account_id}
                        className="border-b border-slate-100 last:border-0 hover:bg-slate-50/80"
                      >
                        <td className="w-10 px-3 py-2">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(a.account_id)}
                            onChange={(e) => {
                              if (e.target.checked)
                                setSelectedIds((p) => [...p, a.account_id]);
                              else
                                setSelectedIds((p) => p.filter((id) => id !== a.account_id));
                            }}
                            className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                          />
                        </td>
                        <td className="px-3 py-2 font-medium text-slate-800">{a.account_number}</td>
                        <td className="px-3 py-2 text-slate-600">{a.client_name || "—"}</td>
                        <td className="px-3 py-2 text-slate-600">{a.email || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={run}
        disabled={loading || (mode !== "all" && idsToRun.length === 0)}
        className={btnPrimary}
      >
        {loading ? "Running…" : "Credit daily interest"}
      </button>
    </div>
  );
}
