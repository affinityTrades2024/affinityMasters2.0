"use client";

import { useState, useEffect } from "react";

interface EntryRow {
  id: number;
  clientId: number;
  clientEmail: string;
  clientName: string;
  amountUsd: number;
  sourceRequestId: number;
  sourceRequestAmount?: number;
  sourceRequestedAt: string | null;
  adminComments: string;
  createdAt: string | null;
}

const btnPrimary =
  "rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:opacity-50";
const btnSecondary =
  "rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:opacity-50";

function formatUsd(n: number) {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function PartialDisbursalRequestsClient() {
  const [entries, setEntries] = useState<EntryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [settleModal, setSettleModal] = useState<EntryRow | null>(null);
  const [settlementComments, setSettlementComments] = useState("");

  async function fetchList() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/partial-disbursal-requests");
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setEntries(data.entries ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchList();
  }, []);

  function openSettleModal(entry: EntryRow) {
    setSettleModal(entry);
    setSettlementComments("");
  }

  async function handleSettle() {
    if (!settleModal) return;
    const comment = settlementComments.trim();
    if (!comment) {
      setError("Settlement comments are mandatory.");
      return;
    }
    setActingId(settleModal.id);
    setError(null);
    try {
      const res = await fetch("/api/admin/partial-disbursal-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: settleModal.id, settlement_comments: comment }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Settle failed");
      setSettleModal(null);
      await fetchList();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Settle failed");
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

  if (entries.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        No pending partial disbursal requests.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-lg border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                Client
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                Amount (USD)
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                Source request
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                Partial comment
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                Created
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {entries.map((e) => (
              <tr key={e.id} className="hover:bg-slate-50/50">
                <td className="px-4 py-3">
                  <div className="text-sm font-medium text-slate-900">{e.clientEmail}</div>
                  {e.clientName && (
                    <div className="text-xs text-slate-500">{e.clientName}</div>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-slate-700 font-medium">
                  {formatUsd(e.amountUsd)}
                </td>
                <td className="px-4 py-3 text-sm text-slate-700">
                  {e.sourceRequestAmount != null
                    ? `#${e.sourceRequestId} (${formatUsd(e.sourceRequestAmount)})`
                    : `#${e.sourceRequestId}`}
                  {e.sourceRequestedAt && (
                    <span className="ml-1 text-slate-500">
                      {new Date(e.sourceRequestedAt).toLocaleDateString("en-US")}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-slate-700 max-w-xs truncate" title={e.adminComments}>
                  {e.adminComments || "—"}
                </td>
                <td className="px-4 py-3 text-sm text-slate-600">
                  {e.createdAt
                    ? new Date(e.createdAt).toLocaleString("en-US")
                    : "—"}
                </td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    disabled={actingId !== null}
                    onClick={() => openSettleModal(e)}
                    className={btnPrimary}
                  >
                    {actingId === e.id ? "…" : "Settle"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {settleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-slate-900">Settle pending disbursal</h3>
            <p className="mt-2 text-sm text-slate-600">
              Credit <strong>{formatUsd(settleModal.amountUsd)}</strong> to{" "}
              <strong>{settleModal.clientEmail}</strong>. This will add the amount to their
              investment account and close the entry.
            </p>
            <div className="mt-4">
              <label className="block text-sm font-medium text-slate-700">
                Settlement comments (mandatory)
              </label>
              <textarea
                value={settlementComments}
                onChange={(e) => setSettlementComments(e.target.value)}
                placeholder="e.g. Bank transfer ref / UTR"
                rows={3}
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSettleModal(null)}
                className={btnSecondary}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actingId !== null || !settlementComments.trim()}
                onClick={handleSettle}
                className={btnPrimary}
              >
                {actingId === settleModal.id ? "…" : "Settle"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
