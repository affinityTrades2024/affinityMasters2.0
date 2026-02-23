"use client";

import { useState } from "react";
import AdminAlert from "@/components/admin/AdminAlert";

interface AccountOption {
  account_id: number;
  account_number: string;
  client_name: string;
}

const inputClass =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500";
const btnPrimary =
  "rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:opacity-50";

export default function ManualInterestClient({
  accounts,
}: {
  accounts: AccountOption[];
}) {
  const [forDate, setForDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [mode, setMode] = useState<"single" | "multiple" | "all">("single");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const idsToRun =
    mode === "all"
      ? accounts.map((a) => a.account_id)
      : mode === "multiple"
        ? selectedIds
        : selectedIds.slice(0, 1);

  async function run() {
    if (idsToRun.length === 0) {
      setMessage({ type: "error", text: "Select at least one account." });
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/manual-interest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ forDate, accountIds: idsToRun }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setMessage({
        type: "success",
        text: `Credited: ${data.credited ?? 0}, skipped: ${data.skipped ?? 0}.`,
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
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Accounts ({selectedIds.length} selected)
          </label>
          <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50/50 p-3">
            <div className="grid gap-2 sm:grid-cols-2">
              {accounts.map((a) => (
                <label
                  key={a.account_id}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-white cursor-pointer"
                >
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
                  <span className="font-medium">{a.account_number}</span>
                  <span className="text-slate-500 truncate">{a.client_name}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={run}
        disabled={loading || idsToRun.length === 0}
        className={btnPrimary}
      >
        {loading ? "Running…" : "Credit daily interest"}
      </button>
    </div>
  );
}
