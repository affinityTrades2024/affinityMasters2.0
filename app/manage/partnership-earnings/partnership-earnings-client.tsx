"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import AdminAlert from "@/components/admin/AdminAlert";

interface AccountOption {
  account_id: number;
  account_number: string;
  client_name: string;
  email: string;
}

const selectClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500";
const inputClass =
  "w-24 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500";
const btnSecondary =
  "rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50";
const btnPrimary =
  "rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50";

function SearchableAccountSelect({
  accounts,
  value,
  onChange,
  placeholder = "Select account",
  "aria-label": ariaLabel,
}: {
  accounts: AccountOption[];
  value: number | "";
  onChange: (accountId: number | "") => void;
  placeholder?: string;
  "aria-label"?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = value !== "" ? accounts.find((a) => a.account_id === value) : null;
  const displayLabel = selected
    ? `${selected.email || "—"} – ${selected.client_name || "—"} (${selected.account_number})`
    : "";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return accounts;
    return accounts.filter(
      (a) =>
        (a.email || "").toLowerCase().includes(q) ||
        (a.account_number || "").toLowerCase().includes(q) ||
        (a.client_name || "").toLowerCase().includes(q)
    );
  }, [accounts, query]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <div
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        aria-controls={open ? "account-list" : undefined}
        tabIndex={0}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setOpen(false);
            setQuery("");
          }
        }}
        className={selectClass}
      >
        {open ? (
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
            placeholder="Type to search…"
            className="w-full border-0 p-0 text-sm focus:ring-0"
            autoFocus
          />
        ) : (
          <span className={value === "" ? "text-slate-400" : ""}>
            {displayLabel || placeholder}
          </span>
        )}
      </div>
      {open && (
        <ul
          id="account-list"
          role="listbox"
          className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-sm text-slate-500">No matches</li>
          ) : (
            filtered.map((a) => (
              <li
                key={a.account_id}
                role="option"
                aria-selected={value === a.account_id}
                onClick={() => {
                  onChange(a.account_id);
                  setQuery("");
                  setOpen(false);
                }}
                className="cursor-pointer px-3 py-2 text-sm hover:bg-amber-50 data-[selected]:bg-amber-100"
                data-selected={value === a.account_id ? true : undefined}
              >
                {a.email || "—"} – {a.client_name || "—"} ({a.account_number})
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

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
          <SearchableAccountSelect
            accounts={accounts}
            value={recipientId}
            onChange={setRecipientId}
            placeholder="Select account"
            aria-label="Recipient account"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Referral account (deposits used for %)
          </label>
          <SearchableAccountSelect
            accounts={accounts}
            value={referralId}
            onChange={(id) => {
              setReferralId(id);
              setTotalDeposits(null);
            }}
            placeholder="Select account"
            aria-label="Referral account"
          />
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
