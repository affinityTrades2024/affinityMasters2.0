"use client";

import { useState, useEffect } from "react";

const inputClass =
  "w-32 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500";
const btnPrimary =
  "rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:opacity-50";

interface Props {
  initialDepositInrPerUsd: number;
  initialWithdrawalInrPerUsd: number;
}

export default function FundsRatesClient({
  initialDepositInrPerUsd,
  initialWithdrawalInrPerUsd,
}: Props) {
  const [depositInrPerUsd, setDepositInrPerUsd] = useState(initialDepositInrPerUsd);
  const [withdrawalInrPerUsd, setWithdrawalInrPerUsd] = useState(
    initialWithdrawalInrPerUsd
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );

  useEffect(() => {
    setDepositInrPerUsd(initialDepositInrPerUsd);
    setWithdrawalInrPerUsd(initialWithdrawalInrPerUsd);
  }, [initialDepositInrPerUsd, initialWithdrawalInrPerUsd]);

  async function handleSave() {
    const d = parseFloat(String(depositInrPerUsd));
    const w = parseFloat(String(withdrawalInrPerUsd));
    if (Number.isNaN(d) || d <= 0 || Number.isNaN(w) || w <= 0) {
      setMessage({ type: "error", text: "Both rates must be positive numbers." });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/funds-rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          depositInrPerUsd: d,
          withdrawalInrPerUsd: w,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Save failed");
      }
      setMessage({ type: "success", text: "Rates saved successfully." });
    } catch (e) {
      setMessage({
        type: "error",
        text: e instanceof Error ? e.message : "Save failed",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 max-w-xl">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Deposit (₹ per 1 USD)
          </label>
          <input
            type="number"
            min={0.0001}
            step={0.01}
            value={depositInrPerUsd}
            onChange={(e) =>
              setDepositInrPerUsd(parseFloat(e.target.value) || 0)
            }
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Withdrawal (₹ per 1 USD)
          </label>
          <input
            type="number"
            min={0.0001}
            step={0.01}
            value={withdrawalInrPerUsd}
            onChange={(e) =>
              setWithdrawalInrPerUsd(parseFloat(e.target.value) || 0)
            }
            className={inputClass}
          />
        </div>
      </div>
      {message && (
        <p
          className={
            message.type === "success"
              ? "text-sm text-emerald-600"
              : "text-sm text-red-600"
          }
        >
          {message.text}
        </p>
      )}
      <button
        type="button"
        disabled={saving}
        onClick={handleSave}
        className={btnPrimary}
      >
        {saving ? "Saving…" : "Save rates"}
      </button>
    </div>
  );
}
