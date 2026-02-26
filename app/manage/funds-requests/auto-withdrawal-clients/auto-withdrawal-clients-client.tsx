"use client";

import { useState, useEffect } from "react";

interface ClientRow {
  clientId: number;
  email: string | null;
  name: string | null;
  enabledAt: string | null;
  accountId: number | null;
  accountNumber: string | number;
  availableBalanceUsd: number;
  defaultBank: string | null;
}

function formatUsd(n: number) {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(s: string | null) {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleString();
  } catch {
    return s;
  }
}

export default function AutoWithdrawalClientsClient() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchList() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/auto-withdrawal-clients");
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setClients(data.clients ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setClients([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchList();
  }, []);

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

  if (clients.length === 0) {
    return <p className="text-sm text-slate-500">No clients have enabled auto withdrawal.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-4 py-2.5 text-left font-medium text-slate-700">Client ID</th>
            <th className="px-4 py-2.5 text-left font-medium text-slate-700">Name</th>
            <th className="px-4 py-2.5 text-left font-medium text-slate-700">Email</th>
            <th className="px-4 py-2.5 text-left font-medium text-slate-700">Account</th>
            <th className="px-4 py-2.5 text-left font-medium text-slate-700">Default bank</th>
            <th className="px-4 py-2.5 text-right font-medium text-slate-700">Available balance (USD)</th>
            <th className="px-4 py-2.5 text-left font-medium text-slate-700">Enabled at</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 bg-white">
          {clients.map((row) => (
            <tr key={row.clientId}>
              <td className="px-4 py-2.5 text-slate-900">{row.clientId}</td>
              <td className="px-4 py-2.5 text-slate-900">{row.name ?? "—"}</td>
              <td className="px-4 py-2.5 text-slate-600">{row.email ?? "—"}</td>
              <td className="px-4 py-2.5 text-slate-600">
                {row.accountNumber} {row.accountId ? `(#${row.accountId})` : ""}
              </td>
              <td className="px-4 py-2.5 text-slate-600 max-w-xs truncate" title={row.defaultBank ?? undefined}>
                {row.defaultBank ?? "—"}
              </td>
              <td className="px-4 py-2.5 text-right font-medium text-slate-900">
                {formatUsd(row.availableBalanceUsd)}
              </td>
              <td className="px-4 py-2.5 text-slate-600">{formatDate(row.enabledAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
