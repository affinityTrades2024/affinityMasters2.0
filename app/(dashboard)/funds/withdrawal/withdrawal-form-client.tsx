"use client";

import { useState } from "react";
import Link from "next/link";

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500";
const btnPrimary =
  "rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:opacity-50";

interface Props {
  account: {
    accountId: number;
    label: string;
    accountNumber: string;
    availableUsd: number;
  } | null;
  withdrawalInrPerUsd: number;
}

export default function WithdrawalFormClient({
  account,
  withdrawalInrPerUsd,
}: Props) {
  const [amountUsd, setAmountUsd] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const available = account?.availableUsd ?? 0;
  const amount = parseFloat(amountUsd) || 0;
  const amountInr = amount * withdrawalInrPerUsd;
  const exceedsBalance = amount > available;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!account) {
      setError("No investment account linked.");
      return;
    }
    const amt = parseFloat(amountUsd);
    if (Number.isNaN(amt) || amt <= 0) {
      setError("Enter a valid amount (USD).");
      return;
    }
    if (amt > available) {
      setError("Amount exceeds available balance.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/funds/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountUsd: amt, accountId: account.accountId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Request failed.");
        return;
      }
      setSuccess(true);
      setAmountUsd("");
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-800">
        <p className="font-medium">Withdrawal request submitted.</p>
        <p className="mt-1 text-sm">
          It is pending with admin. You will see it under Funds with status &quot;Pending with
          Admin&quot;. Balance will update after approval.
        </p>
        <Link
          href="/funds"
          className="mt-4 inline-block text-sm font-medium text-emerald-700 hover:underline"
        >
          Back to Funds
        </Link>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-800">
        <p className="font-medium">No investment account linked.</p>
        <p className="mt-1 text-sm">
          Contact support to link your investment account before requesting a withdrawal.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
      <div>
        <p className="text-sm font-medium text-slate-700">From account</p>
        <p className="mt-0.5 text-sm text-slate-600">
          {account.label} ({account.accountNumber}) — Investment Account
        </p>
        <p className="mt-1 text-sm text-slate-600">
          Available: $
          {available.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Amount (USD)
        </label>
        <input
          type="number"
          min={0.01}
          max={available}
          step={0.01}
          value={amountUsd}
          onChange={(e) => setAmountUsd(e.target.value)}
          className={inputClass}
          placeholder="0.00"
        />
        {amount > 0 && (
          <p className="mt-1 text-sm text-slate-600">
            ≈ ₹ {amountInr.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{" "}
            (at ₹ {withdrawalInrPerUsd} per 1 USD)
          </p>
        )}
        {exceedsBalance && amount > 0 && (
          <p className="mt-1 text-sm text-red-600">Amount exceeds available balance.</p>
        )}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={submitting || exceedsBalance || amount <= 0}
        className={btnPrimary}
      >
        {submitting ? "Submitting…" : "Submit withdrawal request"}
      </button>
    </form>
  );
}
