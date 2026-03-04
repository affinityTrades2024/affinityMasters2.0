"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface ClientOption {
  clientId: number;
  name: string;
  email: string;
  accountNumber: string;
  accountId: number;
}

interface WithdrawalInfo {
  hasDefaultBank: boolean;
  defaultBankAccountId: number | null;
  bankAccounts: { id: number; bank: string; accountNumberMasked: string; ifscCode: string; isDefault: boolean }[];
  investmentAccount: { accountId: number; accountNumber: string; balance: number } | null;
}

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500";
const selectClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500";
const btnPrimary =
  "rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:opacity-50";
const btnSecondary =
  "rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50";

export default function DepositWithdrawalRequestClient({
  depositInrPerUsd,
  withdrawalInrPerUsd,
}: {
  depositInrPerUsd: number;
  withdrawalInrPerUsd: number;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ClientOption[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [comboboxOpen, setComboboxOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClientOption | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [requestType, setRequestType] = useState<"deposit" | "withdrawal">("deposit");
  const [amountInr, setAmountInr] = useState("");
  const [withdrawalInfo, setWithdrawalInfo] = useState<WithdrawalInfo | null>(null);
  const [withdrawalInfoLoading, setWithdrawalInfoLoading] = useState(false);
  const [selectedBankId, setSelectedBankId] = useState<number | null>(null);
  const [bankName, setBankName] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [bankIfsc, setBankIfsc] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const fetchClients = useCallback(async (q: string) => {
    setSearchLoading(true);
    try {
      const res = await fetch(`/api/admin/clients/search?q=${encodeURIComponent(q)}`);
      const data = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(data.clients)) {
        setSearchResults(data.clients);
      } else {
        setSearchResults([]);
      }
    } catch {
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!comboboxOpen) return;
    debounceRef.current = setTimeout(() => {
      fetchClients(searchQuery);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery, comboboxOpen, fetchClients]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setComboboxOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!selectedClient || requestType !== "withdrawal") {
      setWithdrawalInfo(null);
      setSelectedBankId(null);
      setBankName("");
      setBankAccountNumber("");
      setBankIfsc("");
      return;
    }
    setWithdrawalInfoLoading(true);
    setWithdrawalInfo(null);
    fetch(`/api/admin/clients/${selectedClient.clientId}/withdrawal-info`)
      .then((res) => res.json())
      .then((data) => {
        setWithdrawalInfo(data);
        setSelectedBankId(data.defaultBankAccountId ?? (data.bankAccounts?.[0]?.id ?? null));
      })
      .catch(() => setWithdrawalInfo(null))
      .finally(() => setWithdrawalInfoLoading(false));
  }, [selectedClient, requestType]);

  const amountInrNum = parseFloat(amountInr) || 0;
  const rate = requestType === "deposit" ? depositInrPerUsd : withdrawalInrPerUsd;
  const amountUsd = amountInrNum / rate;
  const minInr = 10 * rate;
  const belowMin = amountInrNum > 0 && amountUsd < 10;
  const availableBalance = withdrawalInfo?.investmentAccount?.balance ?? 0;
  const exceedsBalance = requestType === "withdrawal" && amountUsd > availableBalance;

  const canSubmitDeposit =
    selectedClient &&
    amountInrNum > 0 &&
    !belowMin &&
    !submitting;
  const hasBankForWithdrawal =
    withdrawalInfo?.hasDefaultBank && selectedBankId != null ||
    (withdrawalInfo && !withdrawalInfo.hasDefaultBank && bankName.trim() && bankAccountNumber.trim() && bankIfsc.trim());
  const canSubmitWithdrawal =
    selectedClient &&
    requestType === "withdrawal" &&
    amountInrNum > 0 &&
    !belowMin &&
    !exceedsBalance &&
    hasBankForWithdrawal &&
    !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!selectedClient) return;
    const inr = parseFloat(amountInr);
    if (Number.isNaN(inr) || inr <= 0) {
      setError("Enter a valid amount (INR).");
      return;
    }
    const amtUsd = inr / rate;
    if (amtUsd < 10) {
      setError(`Minimum ${requestType} is 10 USD.`);
      return;
    }
    if (requestType === "withdrawal" && amtUsd > availableBalance) {
      setError("Amount exceeds available balance.");
      return;
    }

    setSubmitting(true);
    try {
      if (requestType === "deposit") {
        const res = await fetch("/api/admin/funds/deposit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clientId: selectedClient.clientId, amountUsd: amtUsd }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error || "Request failed.");
          return;
        }
        setSuccess(true);
        setAmountInr("");
      } else {
        const body: { clientId: number; amountUsd: number; bankAccountId?: number; bank?: string; account_number?: string; ifsc_code?: string } = {
          clientId: selectedClient.clientId,
          amountUsd: amtUsd,
        };
        if (withdrawalInfo?.hasDefaultBank && selectedBankId != null) {
          body.bankAccountId = selectedBankId;
        } else {
          body.bank = bankName.trim();
          body.account_number = bankAccountNumber.trim();
          body.ifsc_code = bankIfsc.trim();
        }
        const res = await fetch("/api/admin/funds/withdraw", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error || "Request failed.");
          return;
        }
        setSuccess(true);
        setAmountInr("");
      }
    } finally {
      setSubmitting(false);
    }
  }

  function handleCreateAnother() {
    setSuccess(false);
    setSelectedClient(null);
    setSearchQuery("");
    setSearchResults([]);
    setAmountInr("");
    setRequestType("deposit");
    setWithdrawalInfo(null);
    setSelectedBankId(null);
    setBankName("");
    setBankAccountNumber("");
    setBankIfsc("");
    setError(null);
  }

  if (success) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-800">
        <p className="font-medium">Request submitted successfully.</p>
        <p className="mt-1 text-sm">It will appear under Fund Requests for approval.</p>
        <button
          type="button"
          onClick={handleCreateAnother}
          className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          Create another
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-xl">
      <div ref={containerRef} className="relative">
        <label className="block text-sm font-medium text-slate-700 mb-1">Select user</label>
        <div
          role="combobox"
          aria-expanded={comboboxOpen}
          aria-haspopup="listbox"
          aria-controls={comboboxOpen ? "admin-user-listbox" : undefined}
          className={selectClass}
        >
          {comboboxOpen ? (
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setComboboxOpen(true)}
              placeholder="Search by name, email, or account number…"
              className="w-full border-0 p-0 text-sm focus:ring-0"
              autoFocus
            />
          ) : (
            <div
              onClick={() => setComboboxOpen(true)}
              className="cursor-pointer text-sm"
            >
              {selectedClient ? (
                <span>{selectedClient.email} – {selectedClient.name} ({selectedClient.accountNumber})</span>
              ) : (
                <span className="text-slate-400">Click to search…</span>
              )}
            </div>
          )}
        </div>
        {comboboxOpen && (
          <ul
            id="admin-user-listbox"
            role="listbox"
            className="absolute z-10 mt-1 max-h-60 w-full max-w-xl overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
          >
            {searchLoading ? (
              <li className="px-3 py-2 text-sm text-slate-500">Loading…</li>
            ) : searchResults.length === 0 ? (
              <li className="px-3 py-2 text-sm text-slate-500">
                {searchQuery ? "No matches" : "Type to search"}
              </li>
            ) : (
              searchResults.map((c) => (
                <li
                  key={`${c.clientId}-${c.accountId}`}
                  role="option"
                  aria-selected={selectedClient?.clientId === c.clientId}
                  onClick={() => {
                    setSelectedClient(c);
                    setSearchQuery("");
                    setComboboxOpen(false);
                  }}
                  className="cursor-pointer px-3 py-2 text-sm hover:bg-amber-50"
                >
                  {c.email} – {c.name} ({c.accountNumber})
                </li>
              ))
            )}
          </ul>
        )}
        {selectedClient && (
          <button
            type="button"
            onClick={() => setSelectedClient(null)}
            className="mt-1 text-xs text-slate-500 hover:underline"
          >
            Clear selection
          </button>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">Request type</label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="requestType"
              checked={requestType === "deposit"}
              onChange={() => setRequestType("deposit")}
              className="rounded-full border-slate-300 text-amber-600 focus:ring-amber-500"
            />
            <span className="text-sm">Deposit</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="requestType"
              checked={requestType === "withdrawal"}
              onChange={() => setRequestType("withdrawal")}
              className="rounded-full border-slate-300 text-amber-600 focus:ring-amber-500"
            />
            <span className="text-sm">Withdrawal</span>
          </label>
        </div>
      </div>

      {requestType === "withdrawal" && selectedClient && (
        <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 space-y-3">
          <p className="text-sm font-medium text-slate-700">Withdrawal details</p>
          {withdrawalInfoLoading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : withdrawalInfo?.investmentAccount ? (
            <p className="text-sm text-slate-600">
              Available balance: $
              {withdrawalInfo.investmentAccount.balance.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
          ) : (
            <p className="text-sm text-amber-600">No investment account or failed to load.</p>
          )}
          {withdrawalInfo && !withdrawalInfoLoading && (
            <>
              {withdrawalInfo.hasDefaultBank && withdrawalInfo.bankAccounts.length > 0 ? (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Bank account</label>
                  <select
                    value={selectedBankId ?? ""}
                    onChange={(e) => setSelectedBankId(parseInt(e.target.value, 10))}
                    className={selectClass}
                  >
                    {withdrawalInfo.bankAccounts.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.bank} ({b.accountNumberMasked}) {b.isDefault ? "— Default" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-slate-600">No default bank. Enter bank details (will be saved to user profile):</p>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-0.5">Bank name</label>
                    <input
                      type="text"
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      className={inputClass}
                      placeholder="e.g. HDFC Bank"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-0.5">Account number</label>
                    <input
                      type="text"
                      value={bankAccountNumber}
                      onChange={(e) => setBankAccountNumber(e.target.value)}
                      className={inputClass}
                      placeholder="Account number"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-0.5">IFSC code</label>
                    <input
                      type="text"
                      value={bankIfsc}
                      onChange={(e) => setBankIfsc(e.target.value.toUpperCase())}
                      className={inputClass}
                      placeholder="e.g. HDFC0001234"
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Amount (INR)</label>
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
          <p className="mt-1 text-sm text-slate-600">
            ≈ ${amountUsd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{" "}
            USD (at ₹ {rate} per 1 USD)
          </p>
        )}
        {belowMin && (
          <p className="mt-1 text-sm text-amber-600">Minimum is 10 USD.</p>
        )}
        {requestType === "withdrawal" && exceedsBalance && amountInrNum > 0 && (
          <p className="mt-1 text-sm text-red-600">Amount exceeds available balance.</p>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={
            !selectedClient ||
            (requestType === "deposit" ? !canSubmitDeposit : !canSubmitWithdrawal)
          }
          className={btnPrimary}
        >
          {submitting ? "Submitting…" : requestType === "deposit" ? "Submit deposit request" : "Submit withdrawal request"}
        </button>
      </div>
    </form>
  );
}
