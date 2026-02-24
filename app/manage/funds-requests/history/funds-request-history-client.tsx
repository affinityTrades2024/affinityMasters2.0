"use client";

import { useState, useEffect } from "react";

interface RequestRow {
  id: number;
  clientId: number;
  clientEmail: string;
  clientName: string;
  type: string;
  accountId: number;
  accountLabel: string;
  amountUsd: number;
  amountInr: number;
  status: string;
  requestedAt: string | null;
  reviewedAt: string | null;
  transactionId: number | null;
  disbursedAt: string | null;
  adminNotes: string | null;
}

function statusLabel(s: string): string {
  switch (s) {
    case "pending":
      return "Pending with Admin";
    case "approved":
      return "Approved";
    case "rejected":
      return "Rejected";
    case "approved_pending_disbursement":
      return "Approved – Processing payout";
    case "disbursed":
      return "Disbursed";
    default:
      return s;
  }
}

function formatUsd(n: number) {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function formatInr(n: number) {
  return "₹ " + n.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export default function FundsRequestHistoryClient() {
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [search, setSearch] = useState("");

  async function fetchList() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/funds-requests/history");
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setRequests(data.requests ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchList();
  }, []);

  const searchLower = search.trim().toLowerCase();
  const filtered =
    requests.filter((r) => {
      if (filterType !== "all" && r.type !== filterType) return false;
      if (filterStatus !== "all" && r.status !== filterStatus) return false;
      if (searchLower) {
        const email = (r.clientEmail ?? "").toLowerCase();
        const name = (r.clientName ?? "").toLowerCase();
        if (!email.includes(searchLower) && !name.includes(searchLower)) return false;
      }
      return true;
    });

  if (loading) {
    return <p className="text-sm text-slate-500">Loading…</p>;
  }

  if (error) {
    return (
      <div>
        <p className="text-sm text-red-600">{error}</p>
        <button
          type="button"
          onClick={() => fetchList()}
          className="mt-2 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
        >
          Retry
        </button>
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <p className="text-sm text-slate-500">No fund requests yet.</p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          Search
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Client email or name"
            className="rounded border border-slate-300 px-2 py-1.5 text-sm w-48"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          Type
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm"
          >
            <option value="all">All</option>
            <option value="deposit">Deposit</option>
            <option value="withdrawal">Withdrawal</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          Status
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm"
          >
            <option value="all">All</option>
            <option value="pending">Pending with Admin</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="approved_pending_disbursement">Approved – Processing payout</option>
            <option value="disbursed">Disbursed</option>
          </select>
        </label>
        <span className="text-sm text-slate-500">
          Showing {filtered.length} of {requests.length}
        </span>
      </div>
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
              Date
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
              Client
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
              Type
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
              Account
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
              Amount (USD)
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
              Amount (INR)
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
              Status
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
              Reviewed
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
              Disbursed
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
              Notes
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 bg-white">
          {filtered.length === 0 ? (
            <tr>
              <td colSpan={10} className="px-4 py-8 text-center text-slate-500 text-sm">
                No requests match your filters.
              </td>
            </tr>
          ) : (
            filtered.map((r) => (
            <tr key={r.id} className="hover:bg-slate-50/50">
              <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">
                {r.requestedAt
                  ? new Date(r.requestedAt).toLocaleString("en-US")
                  : "—"}
              </td>
              <td className="px-4 py-3">
                <div className="text-sm font-medium text-slate-900">{r.clientEmail}</div>
                {r.clientName && (
                  <div className="text-xs text-slate-500">{r.clientName}</div>
                )}
              </td>
              <td className="px-4 py-3 text-sm capitalize text-slate-700">{r.type}</td>
              <td className="px-4 py-3 text-sm text-slate-700">{r.accountLabel}</td>
              <td className="px-4 py-3 text-sm text-slate-700">{formatUsd(r.amountUsd)}</td>
              <td className="px-4 py-3 text-sm text-slate-700">{formatInr(r.amountInr)}</td>
              <td className="px-4 py-3">
                <span
                  className={
                    r.status === "pending"
                      ? "inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800"
                      : r.status === "approved" || r.status === "disbursed"
                        ? "inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800"
                        : r.status === "approved_pending_disbursement"
                          ? "inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800"
                          : r.status === "rejected"
                            ? "inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800"
                            : "inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700"
                  }
                >
                  {statusLabel(r.status)}
                </span>
              </td>
              <td className="px-4 py-3 text-sm text-slate-600">
                {r.reviewedAt
                  ? new Date(r.reviewedAt).toLocaleString("en-US")
                  : "—"}
              </td>
              <td className="px-4 py-3 text-sm text-slate-600">
                {r.disbursedAt
                  ? new Date(r.disbursedAt).toLocaleString("en-US")
                  : "—"}
              </td>
              <td className="px-4 py-3 text-sm text-slate-600 max-w-[220px]" title={r.adminNotes ?? undefined}>
                {r.adminNotes ?? "—"}
              </td>
            </tr>
          ))
          )}
        </tbody>
      </table>
    </div>
    </div>
  );
}
