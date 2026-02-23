"use client";

import { useState, useMemo } from "react";

interface SkipRow {
  id: number;
  account_id: number;
  for_date: string;
  status: string;
  created_at: string;
  account_number: string;
  client_name: string;
}

const filterInputClass =
  "w-full min-w-0 rounded border border-slate-200 bg-white px-2 py-1 text-xs placeholder:text-slate-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500";
const btnApprove =
  "rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50";
const btnReject =
  "rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50";

function matchFilter(value: string, filter: string): boolean {
  if (!filter.trim()) return true;
  return value.toLowerCase().includes(filter.trim().toLowerCase());
}

export default function SkipReviewClient({ rows }: { rows: SkipRow[] }) {
  const [list, setList] = useState(rows);
  const [loading, setLoading] = useState<number | null>(null);
  const [filters, setFilters] = useState({ account_number: "", client_name: "", for_date: "" });

  const filteredList = useMemo(() => {
    return list.filter(
      (r) =>
        matchFilter(r.account_number, filters.account_number) &&
        matchFilter(r.client_name, filters.client_name) &&
        matchFilter(r.for_date, filters.for_date)
    );
  }, [list, filters]);

  const setFilter = (key: keyof typeof filters, value: string) => {
    setFilters((p) => ({ ...p, [key]: value }));
  };

  async function approve(id: number) {
    setLoading(id);
    try {
      const res = await fetch("/api/admin/skip-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logId: id, action: "approve" }),
      });
      if (!res.ok) throw new Error("Failed");
      setList((p) => p.filter((r) => r.id !== id));
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(null);
    }
  }

  async function reject(id: number) {
    setLoading(id);
    try {
      const res = await fetch("/api/admin/skip-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logId: id, action: "reject" }),
      });
      if (!res.ok) throw new Error("Failed");
      setList((p) => p.filter((r) => r.id !== id));
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(null);
    }
  }

  if (list.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50/50 py-12 text-center">
        <p className="text-slate-500 font-medium">No skipped entries to review</p>
        <p className="mt-1 text-sm text-slate-400">
          New skip events will appear here when they occur.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200">
      <p className="mb-2 text-sm text-slate-500">
        {filteredList.length} of {list.length} entr{list.length !== 1 ? "ies" : "y"}. Type in filter boxes to narrow.
      </p>
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
              Account
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
              Client
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
              For date
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
              Actions
            </th>
          </tr>
          <tr className="bg-slate-100/80">
            <th className="px-4 py-2">
              <input
                type="text"
                placeholder="Filter..."
                value={filters.account_number}
                onChange={(e) => setFilter("account_number", e.target.value)}
                className={filterInputClass}
              />
            </th>
            <th className="px-4 py-2">
              <input
                type="text"
                placeholder="Filter..."
                value={filters.client_name}
                onChange={(e) => setFilter("client_name", e.target.value)}
                className={filterInputClass}
              />
            </th>
            <th className="px-4 py-2">
              <input
                type="text"
                placeholder="Filter..."
                value={filters.for_date}
                onChange={(e) => setFilter("for_date", e.target.value)}
                className={filterInputClass}
              />
            </th>
            <th className="px-4 py-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 bg-white">
          {filteredList.map((r) => (
            <tr key={r.id} className="hover:bg-slate-50/50">
              <td className="px-4 py-3 text-sm font-medium text-slate-900">
                {r.account_number}
              </td>
              <td className="px-4 py-3 text-sm text-slate-600">{r.client_name}</td>
              <td className="px-4 py-3 text-sm text-slate-600">{r.for_date}</td>
              <td className="px-4 py-3 text-right">
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    disabled={loading === r.id}
                    onClick={() => approve(r.id)}
                    className={btnApprove}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={loading === r.id}
                    onClick={() => reject(r.id)}
                    className={btnReject}
                  >
                    Reject
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
