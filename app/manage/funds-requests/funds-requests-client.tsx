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
}

const btnPrimary =
  "rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:opacity-50";
const btnDanger =
  "rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50";

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
    <div className="overflow-hidden rounded-lg border border-slate-200">
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50">
          <tr>
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
  );
}
