"use client";

import { useState, useEffect } from "react";

const IST_OFFSET = "06:30 AM IST";
const UTC_TIME = "01:00 UTC";

interface DefaultBank {
  id: number;
  bank: string;
  accountNumberMasked: string;
  ifscCode: string;
}

interface AutoWithdrawalState {
  enabled: boolean;
  enabledAt: string | null;
  defaultBankAccount: DefaultBank | null;
}

const btnPrimary =
  "rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:opacity-50";
const btnSecondary =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50";

export default function AutoWithdrawalBlock() {
  const [state, setState] = useState<AutoWithdrawalState | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchState() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auto-withdrawal");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Failed to load");
        setState(null);
        return;
      }
      setState({
        enabled: Boolean(data.enabled),
        enabledAt: data.enabledAt ?? null,
        defaultBankAccount: data.defaultBankAccount ?? null,
      });
    } catch {
      setError("Failed to load");
      setState(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchState();
  }, []);

  async function handleEnable() {
    if (!confirmChecked) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auto-withdrawal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enable: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Failed to enable");
        return;
      }
      setModalOpen(false);
      setConfirmChecked(false);
      await fetchState();
    } catch {
      setError("Failed to enable");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDisable() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auto-withdrawal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enable: false }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Failed to disable");
        return;
      }
      await fetchState();
    } catch {
      setError("Failed to disable");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm text-slate-600">Loading auto withdrawal…</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="text-sm font-medium text-slate-700">Auto withdrawal</h3>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      {state?.enabled ? (
        <div className="mt-2 space-y-2">
          <p className="text-sm text-slate-600">
            Auto withdrawal is enabled. Every month&apos;s profit will be sent as a withdrawal request on the{" "}
            <strong>1st of each month at {UTC_TIME}</strong> ({IST_OFFSET}) to your default bank account.
            Requests go to admin for approval.
          </p>
          <button
            type="button"
            onClick={handleDisable}
            disabled={submitting}
            className={btnSecondary}
          >
            {submitting ? "Disabling…" : "Disable auto withdrawal"}
          </button>
        </div>
      ) : (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className={btnPrimary}
          >
            Setup for Auto withdrawal
          </button>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Setup for Auto withdrawal</h3>
            <p className="mt-2 text-sm text-slate-600">
              By enabling, you agree that <strong>every month&apos;s profit</strong> will be automatically sent as a
              withdrawal request on the <strong>1st of every month at {UTC_TIME}</strong> ({IST_OFFSET}) to your
              default bank account selected in Bank Accounts.
            </p>
            {state?.defaultBankAccount ? (
              <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                <p className="font-medium">Default bank account</p>
                <p>
                  {state.defaultBankAccount.bank} — {state.defaultBankAccount.accountNumberMasked} — IFSC:{" "}
                  {state.defaultBankAccount.ifscCode}
                </p>
              </div>
            ) : (
              <p className="mt-3 text-sm text-amber-700">
                Please set a default bank account in Settings → Bank Accounts first. You cannot enable auto
                withdrawal without a default bank account.
              </p>
            )}
            <div className="mt-4 flex items-start gap-2">
              <input
                id="auto-withdrawal-confirm"
                type="checkbox"
                checked={confirmChecked}
                onChange={(e) => setConfirmChecked(e.target.checked)}
                disabled={!state?.defaultBankAccount}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
              />
              <label htmlFor="auto-withdrawal-confirm" className="text-sm text-slate-700">
                I read and confirm.
              </label>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setModalOpen(false);
                  setConfirmChecked(false);
                }}
                className={btnSecondary}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleEnable}
                disabled={!confirmChecked || !state?.defaultBankAccount || submitting}
                className={btnPrimary}
              >
                {submitting ? "Enabling…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
