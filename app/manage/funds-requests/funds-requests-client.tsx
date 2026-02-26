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
  requestedAt: string | null;
  isAutoWithdrawal?: boolean;
}

const btnPrimary =
  "rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:opacity-50";
const btnDanger =
  "rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50";
const btnSecondary =
  "rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:opacity-50";

function formatUsd(n: number) {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function formatInr(n: number) {
  return "₹ " + n.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export default function FundsRequestsClient() {
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [approvingDepositId, setApprovingDepositId] = useState<number | null>(null);
  const [approveNotes, setApproveNotes] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkAction, setBulkAction] = useState<"idle" | "approve" | "reject">("idle");
  const [bulkNotes, setBulkNotes] = useState("");
  const [bulkResult, setBulkResult] = useState<{ approved: number; rejected: number; errors?: { id: number; message: string }[] } | null>(null);

  async function fetchList() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/funds-requests");
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

  async function handleAction(id: number, action: "approve" | "reject", adminNotes?: string | null) {
    setActingId(id);
    setError(null);
    if (action === "approve" && approvingDepositId === id) setApprovingDepositId(null);
    try {
      const res = await fetch("/api/admin/funds-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          action,
          ...(adminNotes !== undefined && { admin_notes: adminNotes || null }),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Action failed");
      await fetchList();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setActingId(null);
    }
  }

  function startApproveDeposit(id: number) {
    setApprovingDepositId(id);
    setApproveNotes("");
  }

  const allIds = requests.map((r) => r.id);
  const allSelected = allIds.length > 0 && allIds.every((id) => selectedIds.has(id));
  const someSelected = selectedIds.size > 0;
  const selectedIncludeDeposit = requests.some((r) => selectedIds.has(r.id) && r.type === "deposit");

  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setBulkResult(null);
  }

  function toggleSelectAll() {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(allIds));
    setBulkResult(null);
  }

  async function handleBulkAction(action: "approve" | "reject") {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setBulkAction(action);
    setError(null);
    setBulkResult(null);
    try {
      const res = await fetch("/api/admin/funds-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids,
          action,
          ...(action === "approve" && selectedIncludeDeposit && { admin_notes: bulkNotes.trim() || null }),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Bulk action failed");
      setBulkResult({
        approved: data.approved ?? 0,
        rejected: data.rejected ?? 0,
        errors: data.errors,
      });
      setSelectedIds(new Set());
      await fetchList();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bulk action failed");
    } finally {
      setBulkAction("idle");
    }
  }

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
      <p className="text-sm text-slate-500">No pending fund requests.</p>
    );
  }

  return (
    <div className="space-y-3">
      {someSelected && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <span className="text-sm font-medium text-amber-900">
            {selectedIds.size} selected
          </span>
          {selectedIncludeDeposit && (
            <input
              type="text"
              value={bulkNotes}
              onChange={(e) => setBulkNotes(e.target.value)}
              placeholder="Notes for deposits (optional)"
              className="rounded border border-amber-300 bg-white px-2 py-1.5 text-sm max-w-[220px]"
            />
          )}
          <button
            type="button"
            disabled={bulkAction !== "idle"}
            onClick={() => handleBulkAction("approve")}
            className={btnPrimary}
          >
            {bulkAction === "approve" ? "…" : "Bulk approve"}
          </button>
          <button
            type="button"
            disabled={bulkAction !== "idle"}
            onClick={() => handleBulkAction("reject")}
            className={btnDanger}
          >
            {bulkAction === "reject" ? "…" : "Bulk reject"}
          </button>
          <button
            type="button"
            onClick={() => { setSelectedIds(new Set()); setBulkResult(null); }}
            className={btnSecondary}
          >
            Clear selection
          </button>
        </div>
      )}
      {bulkResult && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700">
          {bulkResult.approved > 0 && <span>{bulkResult.approved} approved.</span>}
          {bulkResult.rejected > 0 && <span className="ml-2">{bulkResult.rejected} rejected.</span>}
          {bulkResult.errors && bulkResult.errors.length > 0 && (
            <span className="ml-2 text-amber-700">
              {bulkResult.errors.length} failed: {bulkResult.errors.slice(0, 3).map((e) => `#${e.id}`).join(", ")}
              {bulkResult.errors.length > 3 && " …"}
            </span>
          )}
        </div>
      )}
      <div className="overflow-hidden rounded-lg border border-slate-200">
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50">
          <tr>
            <th className="w-10 px-2 py-3 text-left">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleSelectAll}
                aria-label="Select all"
                className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
              />
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
              Requested
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 bg-white">
          {requests.map((r) => (
            <tr key={r.id} className="hover:bg-slate-50/50">
              <td className="w-10 px-2 py-3">
                <input
                  type="checkbox"
                  checked={selectedIds.has(r.id)}
                  onChange={() => toggleSelect(r.id)}
                  aria-label={`Select request ${r.id}`}
                  className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                />
              </td>
              <td className="px-4 py-3">
                <div className="text-sm font-medium text-slate-900">{r.clientEmail}</div>
                {r.clientName && (
                  <div className="text-xs text-slate-500">{r.clientName}</div>
                )}
              </td>
              <td className="px-4 py-3 text-sm text-slate-700">
                <span className="capitalize">{r.type}</span>
                {r.isAutoWithdrawal && (
                  <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800">
                    Auto
                  </span>
                )}
              </td>
              <td className="px-4 py-3 text-sm text-slate-700">{r.accountLabel}</td>
              <td className="px-4 py-3 text-sm text-slate-700">{formatUsd(r.amountUsd)}</td>
              <td className="px-4 py-3 text-sm text-slate-700">{formatInr(r.amountInr)}</td>
              <td className="px-4 py-3 text-sm text-slate-600">
                {r.requestedAt
                  ? new Date(r.requestedAt).toLocaleString("en-US")
                  : "—"}
              </td>
              <td className="px-4 py-3 flex gap-2 flex-wrap items-center">
                {r.type === "deposit" && approvingDepositId === r.id ? (
                  <>
                    <input
                      type="text"
                      value={approveNotes}
                      onChange={(e) => setApproveNotes(e.target.value)}
                      placeholder="Transaction details (optional)"
                      className="rounded border border-slate-300 px-2 py-1.5 text-sm max-w-[200px]"
                    />
                    <button
                      type="button"
                      disabled={actingId !== null}
                      onClick={() => handleAction(r.id, "approve", approveNotes)}
                      className={btnPrimary}
                    >
                      {actingId === r.id ? "…" : "Confirm"}
                    </button>
                    <button
                      type="button"
                      disabled={actingId !== null}
                      onClick={() => setApprovingDepositId(null)}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                  </>
                ) : r.type === "deposit" ? (
                  <>
                    <button
                      type="button"
                      disabled={actingId !== null || approvingDepositId != null}
                      onClick={() => startApproveDeposit(r.id)}
                      className={btnPrimary}
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={actingId !== null || approvingDepositId != null}
                      onClick={() => handleAction(r.id, "reject")}
                      className={btnDanger}
                    >
                      {actingId === r.id ? "…" : "Reject"}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      disabled={actingId !== null}
                      onClick={() => handleAction(r.id, "approve")}
                      className={btnPrimary}
                    >
                      {actingId === r.id ? "…" : "Approve"}
                    </button>
                    <button
                      type="button"
                      disabled={actingId !== null}
                      onClick={() => handleAction(r.id, "reject")}
                      className={btnDanger}
                    >
                      {actingId === r.id ? "…" : "Reject"}
                    </button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}
