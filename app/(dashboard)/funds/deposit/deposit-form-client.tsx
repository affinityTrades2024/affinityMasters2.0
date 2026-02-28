"use client";

import { useState } from "react";
import Link from "next/link";

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500";
const btnPrimary =
  "rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:opacity-50";

interface Props {
  account: { accountId: number; label: string; accountNumber: string } | null;
  depositInrPerUsd: number;
}

export default function DepositFormClient({ account, depositInrPerUsd }: Props) {
  const [amountInr, setAmountInr] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const amountInrNum = parseFloat(amountInr) || 0;
  const amountUsd = amountInrNum / depositInrPerUsd;
  const minInr = 10 * depositInrPerUsd;
  const belowMin = amountInrNum > 0 && amountUsd < 10;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!account) {
      setError("No investment account linked.");
      return;
    }
    const inr = parseFloat(amountInr);
    if (Number.isNaN(inr) || inr <= 0) {
      setError("Enter a valid amount (INR).");
      return;
    }
    const amtUsd = inr / depositInrPerUsd;
    if (amtUsd < 10) {
      setError("Minimum deposit is 10 USD (₹ " + Math.ceil(minInr).toLocaleString("en-IN") + " at current rate).");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/funds/deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountUsd: amtUsd, accountId: account.accountId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Request failed.");
        return;
      }
      setSuccess(true);
      setAmountInr("");
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-800">
        <p className="font-medium">Deposit request submitted.</p>
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
          Contact support to link your investment account before requesting a deposit.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Amount (INR)
        </label>
        <input
          type="number"
          min={0.01}
          step="any"
          value={amountInr}
          onChange={(e) => setAmountInr(e.target.value)}
          className={inputClass}
          placeholder="0"
        />
        {amountInrNum > 0 && (
          <p className="mt-1.5 text-sm text-slate-600">
            ≈ $ {amountUsd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{" "}
            USD (at ₹ {depositInrPerUsd} per 1 USD)
          </p>
        )}
        {belowMin && (
          <p className="mt-1 text-sm text-amber-600">Minimum deposit is $10 USD.</p>
        )}
      </div>
      <div>
        <p className="text-sm font-medium text-slate-700">Credit to</p>
        <p className="mt-0.5 text-sm text-slate-600">
          {account.label} ({account.accountNumber}) — Investment Account
        </p>
      </div>
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
      <button type="submit" disabled={submitting || belowMin} className={btnPrimary}>
        {submitting ? "Submitting…" : "Submit deposit request"}
      </button>
    </form>
  );
}
