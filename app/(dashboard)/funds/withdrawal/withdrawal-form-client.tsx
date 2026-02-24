"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500";
const btnPrimary =
  "rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:opacity-50";
const btnSecondary =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50";

interface BankAccountOption {
  id: number;
  bank: string;
  accountNumberMasked: string;
  ifscCode: string;
  isDefault: boolean;
  created_at: string;
}

interface Props {
  account: {
    accountId: number;
    label: string;
    accountNumber: string;
    availableUsd: number;
  } | null;
  withdrawalInrPerUsd: number;
  bankAccounts: BankAccountOption[];
  defaultBankAccount: BankAccountOption | null;
}

export default function WithdrawalFormClient({
  account,
  withdrawalInrPerUsd,
  bankAccounts,
  defaultBankAccount,
}: Props) {
  const router = useRouter();
  const [amountUsd, setAmountUsd] = useState("");
  const [selectedBankId, setSelectedBankId] = useState<number | null>(
    defaultBankAccount?.id ?? (bankAccounts.length === 1 ? bankAccounts[0].id : null)
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [addBankModalOpen, setAddBankModalOpen] = useState(false);
  const [addBankBank, setAddBankBank] = useState("");
  const [addBankAccountNumber, setAddBankAccountNumber] = useState("");
  const [addBankConfirmAccountNumber, setAddBankConfirmAccountNumber] = useState("");
  const [addBankIfsc, setAddBankIfsc] = useState("");
  const [addBankSubmitting, setAddBankSubmitting] = useState(false);
  const [addBankError, setAddBankError] = useState<string | null>(null);

  const available = account?.availableUsd ?? 0;
  const amount = parseFloat(amountUsd) || 0;
  const amountInr = amount * withdrawalInrPerUsd;
  const exceedsBalance = amount > available;
  const effectiveBankId = selectedBankId ?? defaultBankAccount?.id ?? bankAccounts[0]?.id ?? null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!account) {
      setError("No investment account linked.");
      return;
    }
    if (!effectiveBankId) {
      setError("Please add and select a bank account for withdrawal.");
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
        body: JSON.stringify({
          amountUsd: amt,
          accountId: account.accountId,
          bankAccountId: effectiveBankId,
        }),
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

  async function handleAddBank(e: React.FormEvent) {
    e.preventDefault();
    setAddBankError(null);
    if (addBankAccountNumber !== addBankConfirmAccountNumber) {
      setAddBankError("Account number and confirmation do not match.");
      return;
    }
    if (!addBankBank.trim() || !addBankAccountNumber.trim() || !addBankIfsc.trim()) {
      setAddBankError("Please fill all fields.");
      return;
    }
    setAddBankSubmitting(true);
    try {
      const res = await fetch("/api/bank-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bank: addBankBank.trim(),
          account_number: addBankAccountNumber,
          confirm_account_number: addBankConfirmAccountNumber,
          ifsc_code: addBankIfsc.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAddBankError(data.error || "Failed to add bank account.");
        return;
      }
      setAddBankModalOpen(false);
      setAddBankBank("");
      setAddBankAccountNumber("");
      setAddBankConfirmAccountNumber("");
      setAddBankIfsc("");
      router.refresh();
    } finally {
      setAddBankSubmitting(false);
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

  const needsBankAccount = bankAccounts.length === 0;

  return (
    <>
      {needsBankAccount && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-800">
          <p className="font-medium">No bank account added.</p>
          <p className="mt-1 text-sm">
            Add a bank account below to receive withdrawal amounts. You can manage bank accounts in{" "}
            <Link href="/profile?tab=bank" className="font-medium underline">
              Settings → Bank Accounts
            </Link>
            .
          </p>
          <button
            type="button"
            onClick={() => setAddBankModalOpen(true)}
            className={btnPrimary + " mt-3"}
          >
            Add bank account
          </button>
        </div>
      )}

      {addBankModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">Add bank account</h3>
            <p className="mt-1 text-sm text-gray-600">
              Add a bank account to receive withdrawal amounts.
            </p>
            <form onSubmit={handleAddBank} className="mt-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700">Bank name</label>
                <input
                  type="text"
                  value={addBankBank}
                  onChange={(e) => setAddBankBank(e.target.value)}
                  className={inputClass}
                  placeholder="e.g. HDFC Bank"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Account number</label>
                <input
                  type="password"
                  autoComplete="off"
                  value={addBankAccountNumber}
                  onChange={(e) => setAddBankAccountNumber(e.target.value)}
                  className={inputClass}
                  placeholder="••••••••"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Confirm account number</label>
                <input
                  type="password"
                  autoComplete="off"
                  value={addBankConfirmAccountNumber}
                  onChange={(e) => setAddBankConfirmAccountNumber(e.target.value)}
                  className={inputClass}
                  placeholder="••••••••"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">IFSC code</label>
                <input
                  type="text"
                  value={addBankIfsc}
                  onChange={(e) => setAddBankIfsc(e.target.value.toUpperCase())}
                  className={inputClass}
                  placeholder="e.g. HDFC0001234"
                />
              </div>
              {addBankError && <p className="text-sm text-red-600">{addBankError}</p>}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setAddBankModalOpen(false);
                    setAddBankError(null);
                  }}
                  className={btnSecondary}
                >
                  Cancel
                </button>
                <button type="submit" disabled={addBankSubmitting} className={btnPrimary}>
                  {addBankSubmitting ? "Adding…" : "Add bank account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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

        {bankAccounts.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Withdraw to (bank account)
            </label>
            {bankAccounts.length === 1 ? (
              <p className="text-sm text-slate-600">
                {bankAccounts[0].bank} ({bankAccounts[0].accountNumberMasked})
              </p>
            ) : (
              <select
                value={effectiveBankId ?? ""}
                onChange={(e) => setSelectedBankId(parseInt(e.target.value, 10))}
                className={inputClass}
              >
                {bankAccounts.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.bank} ({b.accountNumberMasked}) {b.isDefault ? "— Default" : ""}
                  </option>
                ))}
              </select>
            )}
            <p className="mt-1 text-xs text-slate-500">
              Manage in <Link href="/profile?tab=bank" className="underline">Settings → Bank Accounts</Link>
            </p>
          </div>
        )}

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
          disabled={submitting || exceedsBalance || amount <= 0 || !effectiveBankId}
          className={btnPrimary}
        >
          {submitting ? "Submitting…" : "Submit withdrawal request"}
        </button>
      </form>
    </>
  );
}
