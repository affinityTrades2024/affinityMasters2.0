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
  reviewedAt: string | null;
}

const btnPrimary =
  "rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:opacity-50";
const btnSecondary =
  "rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:opacity-50";

function formatUsd(n: number) {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function formatInr(n: number) {
  return "₹ " + n.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export default function PendingWithdrawalsClient() {
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [disburseNotes, setDisburseNotes] = useState<Record<number, string>>({});
  const [partialModal, setPartialModal] = useState<RequestRow | null>(null);
  const [partialMode, setPartialMode] = useState<"percent" | "amount">("percent");
  const [partialPercent, setPartialPercent] = useState("");
  const [partialAmount, setPartialAmount] = useState("");
  const [partialComment, setPartialComment] = useState("");

  async function fetchList() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/funds-requests/pending-withdrawals");
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

  async function handleDisburse(id: number) {
    setActingId(id);
    setError(null);
    const notes = disburseNotes[id] ?? null;
    try {
      const res = await fetch("/api/admin/funds-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "disburse", admin_notes: notes || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Action failed");
      setDisburseNotes((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      await fetchList();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setActingId(null);
    }
  }

  function openPartialModal(r: RequestRow) {
    setPartialModal(r);
    setPartialMode("percent");
    setPartialPercent("");
    setPartialAmount("");
    setPartialComment("");
  }

  async function handlePartialDisburse() {
    if (!partialModal) return;
    const requested = partialModal.amountUsd;
    const comment = partialComment.trim();
    if (!comment) {
      setError("Comments are mandatory for partial withdrawal.");
      return;
    }
    let body: { id: number; action: string; partial_withdrawal_comment: string; disbursed_amount_usd?: number; disbursed_percent?: number };
    if (partialMode === "percent") {
      const pct = parseFloat(partialPercent);
      if (!Number.isFinite(pct) || pct <= 0 || pct > 100) {
        setError("Enter a valid percentage between 0 and 100.");
        return;
      }
      body = { id: partialModal.id, action: "partial_disburse", partial_withdrawal_comment: comment, disbursed_percent: pct };
    } else {
      const amt = parseFloat(partialAmount);
      if (!Number.isFinite(amt) || amt <= 0 || amt > requested) {
        setError(`Enter an amount between 0 and ${requested.toFixed(2)}.`);
        return;
      }
      body = { id: partialModal.id, action: "partial_disburse", partial_withdrawal_comment: comment, disbursed_amount_usd: amt };
    }
    setActingId(partialModal.id);
    setError(null);
    try {
      const res = await fetch("/api/admin/funds-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Partial disbursement failed");
      setPartialModal(null);
      await fetchList();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Partial disbursement failed");
    } finally {
      setActingId(null);
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
      <p className="text-sm text-slate-500">No pending withdrawal requests (none in Approved – Processing payout).</p>
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
              Approved
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
              Transaction reference (optional)
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
              <td className="px-4 py-3 text-sm text-slate-700">{r.accountLabel}</td>
              <td className="px-4 py-3 text-sm text-slate-700">{formatUsd(r.amountUsd)}</td>
              <td className="px-4 py-3 text-sm text-slate-700">{formatInr(r.amountInr)}</td>
              <td className="px-4 py-3 text-sm text-slate-600">
                {r.requestedAt
                  ? new Date(r.requestedAt).toLocaleString("en-US")
                  : "—"}
              </td>
              <td className="px-4 py-3 text-sm text-slate-600">
                {r.reviewedAt
                  ? new Date(r.reviewedAt).toLocaleString("en-US")
                  : "—"}
              </td>
              <td className="px-4 py-3">
                <input
                  type="text"
                  value={disburseNotes[r.id] ?? ""}
                  onChange={(e) =>
                    setDisburseNotes((prev) => ({ ...prev, [r.id]: e.target.value }))
                  }
                  placeholder="e.g. UTR / ref no"
                  className="rounded border border-slate-300 px-2 py-1.5 text-sm w-40"
                />
              </td>
              <td className="px-4 py-3 flex gap-2 flex-wrap items-center">
                <button
                  type="button"
                  disabled={actingId !== null}
                  onClick={() => handleDisburse(r.id)}
                  className={btnPrimary}
                >
                  {actingId === r.id ? "…" : "Mark as disbursed"}
                </button>
                <button
                  type="button"
                  disabled={actingId !== null}
                  onClick={() => openPartialModal(r)}
                  className={btnSecondary}
                >
                  Partial withdrawal
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {partialModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-slate-900">Partial withdrawal</h3>
            <p className="mt-2 text-sm text-slate-600">
              Requested: <strong>{formatUsd(partialModal.amountUsd)}</strong>
            </p>
            <div className="mt-4 space-y-4">
              <div className="flex gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="partialMode"
                    checked={partialMode === "percent"}
                    onChange={() => setPartialMode("percent")}
                    className="h-4 w-4 text-amber-600"
                  />
                  <span className="text-sm">By %</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="partialMode"
                    checked={partialMode === "amount"}
                    onChange={() => setPartialMode("amount")}
                    className="h-4 w-4 text-amber-600"
                  />
                  <span className="text-sm">By amount</span>
                </label>
              </div>
              {partialMode === "percent" ? (
                <div>
                  <label className="block text-sm font-medium text-slate-700">Percentage to disburse</label>
                  <input
                    type="number"
                    min={0.01}
                    max={100}
                    step={0.01}
                    value={partialPercent}
                    onChange={(e) => setPartialPercent(e.target.value)}
                    placeholder="e.g. 70"
                    className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-slate-700">Amount to disburse (USD)</label>
                  <input
                    type="number"
                    min={0.01}
                    max={partialModal.amountUsd}
                    step={0.01}
                    value={partialAmount}
                    onChange={(e) => setPartialAmount(e.target.value)}
                    placeholder={`Max ${partialModal.amountUsd}`}
                    className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700">Comments (mandatory)</label>
                <textarea
                  value={partialComment}
                  onChange={(e) => setPartialComment(e.target.value)}
                  placeholder="Reason for partial disbursement"
                  rows={3}
                  className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPartialModal(null)}
                className={btnSecondary}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actingId !== null}
                onClick={handlePartialDisburse}
                className={btnPrimary}
              >
                {actingId === partialModal.id ? "…" : "Confirm partial disbursement"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
