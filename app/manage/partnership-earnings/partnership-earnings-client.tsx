"use client";

import { useState } from "react";
import AdminAlert from "@/components/admin/AdminAlert";

interface AccountOption {
  account_id: number;
  account_number: string;
  client_name: string;
}

const selectClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500";
const inputClass =
  "w-24 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500";
const btnSecondary =
  "rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50";
const btnPrimary =
  "rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50";

export default function PartnershipEarningsClient({
  accounts,
}: {
  accounts: AccountOption[];
}) {
  const [recipientId, setRecipientId] = useState<number | "">("");
  const [referralId, setReferralId] = useState<number | "">("");
  const [totalDeposits, setTotalDeposits] = useState<number | null>(null);
  const [pct, setPct] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function fetchTotalDeposits() {
    if (referralId === "") return;
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(
        `/api/admin/partnership-deposits?accountId=${referralId}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setTotalDeposits(data.totalDeposits ?? 0);
    } catch (e) {
      setMessage({
        type: "error",
        text: e instanceof Error ? e.message : "Failed to fetch deposits",
      });
      setTotalDeposits(null);
    } finally {
      setLoading(false);
    }
  }

  async function submit() {
    if (recipientId === "" || referralId === "" || totalDeposits == null || !pct) {
      setMessage({ type: "error", text: "Fill all fields and fetch deposits first." });
      return;
    }
    const p = parseFloat(pct);
    if (Number.isNaN(p) || p <= 0 || p > 100) {
      setMessage({ type: "error", text: "Enter a valid % (0–100)." });
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/partnership-earnings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientAccountId: recipientId,
          referralAccountId: referralId,
          totalDeposits,
          percent: p,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Submit failed");
      setMessage({ type: "success", text: "Partnership fee credited successfully." });
      setPct("");
      setTotalDeposits(null);
    } catch (e) {
      setMessage({
        type: "error",
        text: e instanceof Error ? e.message : "Submit failed",
      });
    } finally {
      setLoading(false);
    }
  }

  const amount =
    totalDeposits != null && pct
      ? (totalDeposits * (parseFloat(pct) || 0)) / 100
      : null;

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
            Recipient account (receives the fee)
          </label>
          <select
            value={recipientId}
            onChange={(e) => setRecipientId(e.target.value ? Number(e.target.value) : "")}
            className={selectClass}
          >
            <option value="">Select account</option>
            {accounts.map((a) => (
              <option key={a.account_id} value={a.account_id}>
                {a.account_number} – {a.client_name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Referral account (deposits used for %)
          </label>
          <select
            value={referralId}
            onChange={(e) => {
              setReferralId(e.target.value ? Number(e.target.value) : "");
              setTotalDeposits(null);
            }}
            className={selectClass}
          >
            <option value="">Select account</option>
            {accounts.map((a) => (
              <option key={a.account_id} value={a.account_id}>
                {a.account_number} – {a.client_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div>
          <button
            type="button"
            onClick={fetchTotalDeposits}
            disabled={referralId === "" || loading}
            className={btnSecondary}
          >
            {loading && totalDeposits == null ? "Loading…" : "Fetch total deposits"}
          </button>
          {totalDeposits != null && (
            <p className="mt-2 text-sm text-slate-600">
              Total deposits:{" "}
              <span className="font-medium">
                {totalDeposits.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </p>
          )}
        </div>
        <div className="flex items-end gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              % of deposit to credit
            </label>
            <input
              type="number"
              min={0}
              max={100}
              step={0.01}
              value={pct}
              onChange={(e) => setPct(e.target.value)}
              className={inputClass}
              placeholder="0"
            />
          </div>
          {amount != null && (
            <p className="text-sm text-slate-600 pb-2">
              Amount:{" "}
              <span className="font-semibold text-slate-900">
                {amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </p>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={submit}
        disabled={
          loading ||
          recipientId === "" ||
          referralId === "" ||
          totalDeposits == null ||
          !pct
        }
        className={btnPrimary}
      >
        Credit partnership fee
      </button>
    </div>
  );
}
