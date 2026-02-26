"use client";

import { useState, useEffect } from "react";
import AutoWithdrawalBlock from "@/components/AutoWithdrawalBlock";

interface BankAccount {
  id: number;
  bank: string;
  accountNumberMasked: string;
  ifscCode: string;
  isDefault: boolean;
  created_at: string;
}

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500";
const btnPrimary =
  "rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:opacity-50";
const btnSecondary =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2";

export default function BankAccountsTab() {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bank, setBank] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [confirmAccountNumber, setConfirmAccountNumber] = useState("");
  const [ifscCode, setIfscCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function fetchAccounts() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/bank-accounts");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Failed to load bank accounts");
        setAccounts([]);
        return;
      }
      setAccounts(data.accounts || []);
    } catch {
      setError("Failed to load bank accounts");
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAccounts();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    if (accountNumber !== confirmAccountNumber) {
      setMessage({ type: "error", text: "Account number and confirmation do not match." });
      return;
    }
    if (!bank.trim() || !accountNumber.trim() || !ifscCode.trim()) {
      setMessage({ type: "error", text: "Please fill all fields." });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/bank-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bank: bank.trim(),
          account_number: accountNumber,
          confirm_account_number: confirmAccountNumber,
          ifsc_code: ifscCode.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "Failed to add bank account." });
        return;
      }
      setMessage({ type: "success", text: "Bank account added." });
      setBank("");
      setAccountNumber("");
      setConfirmAccountNumber("");
      setIfscCode("");
      fetchAccounts();
    } catch {
      setMessage({ type: "error", text: "Failed to add bank account." });
    } finally {
      setSubmitting(false);
    }
  }

  async function setDefault(id: number) {
    try {
      const res = await fetch("/api/bank-accounts/default", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) return;
      fetchAccounts();
    } catch {
      // ignore
    }
  }

  async function remove(id: number) {
    if (!confirm("Remove this bank account?")) return;
    try {
      const res = await fetch(`/api/bank-accounts/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setMessage({ type: "error", text: data.error || "Failed to remove." });
        return;
      }
      setMessage({ type: "success", text: "Bank account removed." });
      fetchAccounts();
    } catch {
      setMessage({ type: "error", text: "Failed to remove." });
    }
  }

  if (loading) {
    return (
      <div>
        <h2 className="text-sm font-medium text-gray-500 mb-2">Bank Accounts</h2>
        <p className="text-sm text-gray-600">Loading…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-sm font-medium text-gray-500">Bank Accounts</h2>
      <p className="text-sm text-gray-600">
        Add bank accounts for withdrawals. Account numbers are stored securely and shown masked.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
        <div>
          <label htmlFor="bank" className="block text-sm font-medium text-slate-700 mb-1">
            Bank name
          </label>
          <input
            id="bank"
            type="text"
            value={bank}
            onChange={(e) => setBank(e.target.value)}
            className={inputClass}
            placeholder="e.g. HDFC Bank"
          />
        </div>
        <div>
          <label htmlFor="accountNumber" className="block text-sm font-medium text-slate-700 mb-1">
            Account number
          </label>
          <input
            id="accountNumber"
            type="password"
            autoComplete="off"
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value)}
            className={inputClass}
            placeholder="••••••••"
          />
        </div>
        <div>
          <label htmlFor="confirmAccountNumber" className="block text-sm font-medium text-slate-700 mb-1">
            Confirm account number
          </label>
          <input
            id="confirmAccountNumber"
            type="password"
            autoComplete="off"
            value={confirmAccountNumber}
            onChange={(e) => setConfirmAccountNumber(e.target.value)}
            className={inputClass}
            placeholder="••••••••"
          />
        </div>
        <div>
          <label htmlFor="ifscCode" className="block text-sm font-medium text-slate-700 mb-1">
            IFSC code
          </label>
          <input
            id="ifscCode"
            type="text"
            value={ifscCode}
            onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
            className={inputClass}
            placeholder="e.g. HDFC0001234"
          />
        </div>
        {message && (
          <p
            className={
              message.type === "success"
                ? "text-sm text-green-600"
                : "text-sm text-red-600"
            }
          >
            {message.text}
          </p>
        )}
        <button type="submit" disabled={submitting} className={btnPrimary}>
          {submitting ? "Adding…" : "Add bank account"}
        </button>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {accounts.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-slate-700 mb-2">Saved accounts</h3>
          <ul className="space-y-3">
            {accounts.map((acc) => (
              <li
                key={acc.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3"
              >
                <div>
                  <span className="font-medium text-slate-900">{acc.bank}</span>
                  <span className="mx-2 text-slate-400">·</span>
                  <span className="text-slate-600">{acc.accountNumberMasked}</span>
                  <span className="mx-2 text-slate-400">·</span>
                  <span className="text-slate-600">{acc.ifscCode}</span>
                  {acc.isDefault && (
                    <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                      Default
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  {!acc.isDefault && (
                    <button
                      type="button"
                      onClick={() => setDefault(acc.id)}
                      className={btnSecondary}
                    >
                      Set as default
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => remove(acc.id)}
                    className="rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-8">
        <AutoWithdrawalBlock />
      </div>
    </div>
  );
}
