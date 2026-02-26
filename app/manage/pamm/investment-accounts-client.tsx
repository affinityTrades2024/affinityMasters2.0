"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BiShow, BiPencil } from "react-icons/bi";
import type { InvestmentAccountRow } from "./page";
import AdminAlert from "@/components/admin/AdminAlert";

const inputClass =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500";
const btnPrimary =
  "rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:opacity-50";
const btnSecondary =
  "rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50";

type TabId = "profile" | "account" | "requests" | "documents" | "bank" | "interest";

const TABS: { id: TabId; label: string }[] = [
  { id: "profile", label: "Profile" },
  { id: "account", label: "Account" },
  { id: "requests", label: "Requests" },
  { id: "documents", label: "Documents" },
  { id: "bank", label: "Bank accounts" },
  { id: "interest", label: "Funds & interest" },
];

interface OverviewData {
  account: {
    account_id: number;
    account_number: string;
    client_id: number | null;
    client_name: string;
    email: string;
    balance: number;
    free_funds: number | null;
    interest_rate_monthly: number;
    product: string | null;
    platform: string | null;
    type: string | null;
    created: string | null;
  };
  client: Record<string, unknown> | null;
  fundsRequests: Record<string, unknown>[];
  verificationDocuments: Record<string, unknown>[];
  bankAccounts: Record<string, unknown>[];
  recentInterestLog: Record<string, unknown>[];
}

function formatUsd(n: number) {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(s: string | null) {
  if (!s) return "—";
  try {
    return new Date(s).toISOString().slice(0, 10);
  } catch {
    return s;
  }
}

function formatDateTime(s: string | null) {
  if (!s) return "—";
  try {
    const d = new Date(s);
    return d.toLocaleString();
  } catch {
    return s;
  }
}

const PAGE_SIZE_OPTIONS = [20, 30, 50] as const;

export default function InvestmentAccountsClient({
  accounts,
  totalCount,
  page,
  pageSize,
  searchQuery: initialSearch = "",
}: {
  accounts: InvestmentAccountRow[];
  totalCount: number;
  page: number;
  pageSize: number;
  searchQuery?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setSearchQuery(initialSearch);
  }, [initialSearch]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function applySearch(q: string) {
    router.push(buildUrl({ q: q.trim() || undefined, page: 1 }));
  }

  function handleSearchChange(value: string) {
    setSearchQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => applySearch(value), 300);
  }
  const [modalMode, setModalMode] = useState<"view" | "edit">("view");
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("profile");
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState<{
    account: Partial<OverviewData["account"]>;
    client: Record<string, unknown>;
  } | null>(null);

  function buildUrl(updates: { page?: number; pageSize?: number; q?: string }) {
    const p = new URLSearchParams(searchParams.toString());
    if (updates.page != null) p.set("page", String(updates.page));
    if (updates.pageSize != null) p.set("pageSize", String(updates.pageSize));
    if (updates.q !== undefined) {
      if (updates.q) p.set("q", updates.q);
      else p.delete("q");
    }
    return `/manage/pamm?${p.toString()}`;
  }

  const [modalOpen, setModalOpen] = useState(false);

  function goToPage(newPage: number) {
    router.push(buildUrl({ page: newPage }));
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const showingStart = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const showingEnd = Math.min(page * pageSize, totalCount);

  async function openModal(accountId: number, mode: "view" | "edit") {
    setSelectedAccountId(accountId);
    setModalMode(mode);
    setActiveTab("profile");
    setOverview(null);
    setEditForm(null);
    setSaveMessage(null);
    setModalOpen(true);
    setOverviewLoading(true);
    try {
      const res = await fetch(`/api/admin/accounts/${accountId}/overview`);
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setOverview(data);
      if (mode === "edit") {
        setEditForm({
          account: { ...data.account },
          client: data.client ? { ...data.client } : {},
        });
      }
    } catch {
      setSaveMessage({ type: "error", text: "Failed to load account details." });
    } finally {
      setOverviewLoading(false);
    }
  }

  function closeModal() {
    setModalOpen(false);
    setSelectedAccountId(null);
    setOverview(null);
    setEditForm(null);
    setSaveMessage(null);
  }

  async function handleSave() {
    if (!selectedAccountId || !editForm || !overview) return;
    setSaving(true);
    setSaveMessage(null);
    try {
      const accountPayload: Record<string, unknown> = {};
      const accountFields = ["client_name", "email", "interest_rate_monthly", "balance"] as const;
      for (const f of accountFields) {
        if (editForm.account[f] !== undefined) accountPayload[f] = editForm.account[f];
      }
      if (Object.keys(accountPayload).length > 0) {
        const r = await fetch(`/api/admin/accounts/${selectedAccountId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(accountPayload),
        });
        if (!r.ok) throw new Error("Failed to update account");
      }
      const clientId = overview.account.client_id ?? editForm.client.id;
      if (clientId != null && typeof clientId === "number") {
        const clientPayload: Record<string, unknown> = {};
        const clientFields = ["name", "email", "nickname", "phone", "country"] as const;
        for (const f of clientFields) {
          if (editForm.client[f] !== undefined) clientPayload[f] = editForm.client[f];
        }
        if (Object.keys(clientPayload).length > 0) {
          const r = await fetch(`/api/admin/clients/${clientId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(clientPayload),
          });
          if (!r.ok) throw new Error("Failed to update client");
        }
      }
      setSaveMessage({ type: "success", text: "Saved." });
      const res = await fetch(`/api/admin/accounts/${selectedAccountId}/overview`);
      if (res.ok) {
        const updated = await res.json();
        setOverview(updated);
        setEditForm({
          account: { ...updated.account },
          client: updated.client ? { ...updated.client } : {},
        });
      }
    } catch (e) {
      setSaveMessage({ type: "error", text: e instanceof Error ? e.message : "Save failed" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <input
          type="text"
          placeholder="Search by account #, name, email, nickname…"
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          className={`${inputClass} max-w-md`}
          aria-label="Search accounts"
        />
        <span className="text-sm text-slate-500">
          {totalCount} account{totalCount !== 1 ? "s" : ""} total
        </span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-600">
          Showing {showingStart}–{showingEnd} of {totalCount}
        </p>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-600">Per page:</span>
          {PAGE_SIZE_OPTIONS.map((size) => (
            <button
              key={size}
              type="button"
              onClick={() => router.push(buildUrl({ pageSize: size, page: 1 }))}
              className={`rounded border px-2 py-1 text-sm ${pageSize === size ? "border-amber-500 bg-amber-50 text-amber-800" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`}
            >
              {size}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium text-slate-700">Account #</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-700">Name</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-700">Email</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-700">Nickname</th>
                <th className="px-4 py-2.5 text-right font-medium text-slate-700">Available balance</th>
                <th className="px-4 py-2.5 text-right font-medium text-slate-700 w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {accounts.map((row) => (
                <tr key={row.account_id} className="hover:bg-slate-50/80">
                  <td className="whitespace-nowrap px-4 py-2 font-medium text-slate-800">{row.account_number}</td>
                  <td className="px-4 py-2 text-slate-700">{row.client_name || "—"}</td>
                  <td className="px-4 py-2 text-slate-700">{row.email || "—"}</td>
                  <td className="px-4 py-2 text-slate-700">{row.nickname || "—"}</td>
                  <td className="whitespace-nowrap px-4 py-2 text-right font-medium text-slate-800">
                    {formatUsd(row.available_balance)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => openModal(row.account_id, "view")}
                        className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                        title="View"
                        aria-label="View"
                      >
                        <BiShow className="h-5 w-5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => openModal(row.account_id, "edit")}
                        className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-amber-600"
                        title="Edit"
                        aria-label="Edit"
                      >
                        <BiPencil className="h-5 w-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {accounts.length === 0 && (
        <p className="rounded-lg border border-slate-200 bg-slate-50/50 px-4 py-8 text-center text-sm text-slate-500">
          {initialSearch ? "No accounts match your search." : "No accounts."}
        </p>
      )}

      {totalCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3">
          <p className="text-sm text-slate-500">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => goToPage(page - 1)}
              disabled={page <= 1}
              className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => goToPage(page + 1)}
              disabled={page >= totalPages}
              className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
        >
          <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h2 id="modal-title" className="text-lg font-semibold text-slate-800">
                {modalMode === "edit" ? "Edit" : "View"} account
                {overview ? ` — ${overview.account.account_number}` : ""}
              </h2>
              <button
                type="button"
                onClick={closeModal}
                className="rounded p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {overviewLoading && !overview && (
              <div className="flex flex-1 items-center justify-center p-12 text-slate-500">
                Loading…
              </div>
            )}

            {overview && !overviewLoading && (
              <>
                {saveMessage && (
                  <div className="px-6 pt-2">
                    <AdminAlert
                      type={saveMessage.type}
                      message={saveMessage.text}
                      onDismiss={() => setSaveMessage(null)}
                    />
                  </div>
                )}

                <div className="flex border-b border-slate-200 px-6">
                  {TABS.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={`border-b-2 px-4 py-3 text-sm font-medium ${
                        activeTab === tab.id
                          ? "border-amber-500 text-amber-600"
                          : "border-transparent text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto p-6">
                  {activeTab === "profile" && (
                    <ProfileTab overview={overview} editForm={editForm} setEditForm={setEditForm} isEdit={modalMode === "edit"} />
                  )}
                  {activeTab === "account" && (
                    <AccountTab overview={overview} editForm={editForm} setEditForm={setEditForm} isEdit={modalMode === "edit"} />
                  )}
                  {activeTab === "requests" && <RequestsTab overview={overview} />}
                  {activeTab === "documents" && <DocumentsTab overview={overview} />}
                  {activeTab === "bank" && <BankTab overview={overview} />}
                  {activeTab === "interest" && (
                    <InterestTab overview={overview} editForm={editForm} setEditForm={setEditForm} isEdit={modalMode === "edit"} />
                  )}
                </div>

                {modalMode === "edit" && (
                  <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4">
                    <button type="button" onClick={closeModal} className={btnSecondary}>
                      Cancel
                    </button>
                    <button type="button" onClick={handleSave} disabled={saving} className={btnPrimary}>
                      {saving ? "Saving…" : "Save"}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ProfileTab({
  overview,
  editForm,
  setEditForm,
  isEdit,
}: {
  overview: OverviewData;
  editForm: { account: Partial<OverviewData["account"]>; client: Record<string, unknown> } | null;
  setEditForm: (f: typeof editForm) => void;
  isEdit: boolean;
}) {
  const c = overview.client;
  if (!c && !editForm?.client) {
    return <p className="text-slate-500">No client linked.</p>;
  }
  const client = editForm?.client ?? c ?? {};
  const fields = [
    { key: "id", label: "Client ID", value: client.id },
    { key: "name", label: "Name", value: client.name },
    { key: "email", label: "Email", value: client.email },
    { key: "nickname", label: "Nickname", value: client.nickname },
    { key: "phone", label: "Phone", value: client.phone },
    { key: "country", label: "Country", value: client.country },
    { key: "birthday", label: "Birthday", value: client.birthday },
    { key: "created", label: "Created", value: client.created },
    { key: "investment_account_id", label: "Investment account ID", value: client.investment_account_id },
  ];
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {fields.map(({ key, label, value }) => (
        <div key={key}>
          <dt className="text-xs font-medium text-slate-500">{label}</dt>
          {isEdit && ["name", "email", "nickname", "phone", "country"].includes(key) ? (
            <input
              className={inputClass}
              value={String(value ?? "")}
              onChange={(e) =>
                setEditForm(
                  editForm
                    ? { ...editForm, client: { ...editForm.client, [key]: e.target.value } }
                    : null
                )
              }
            />
          ) : (
            <dd className="text-slate-800">{value != null ? String(value) : "—"}</dd>
          )}
        </div>
      ))}
    </dl>
  );
}

function AccountTab({
  overview,
  editForm,
  setEditForm,
  isEdit,
}: {
  overview: OverviewData;
  editForm: { account: Partial<OverviewData["account"]>; client: Record<string, unknown> } | null;
  setEditForm: (f: typeof editForm) => void;
  isEdit: boolean;
}) {
  const a = editForm?.account ?? overview.account;
  const fields = [
    { key: "account_id", label: "Account ID", value: a.account_id },
    { key: "account_number", label: "Account number", value: a.account_number },
    { key: "client_name", label: "Client name", value: a.client_name },
    { key: "email", label: "Email", value: a.email },
    { key: "balance", label: "Balance", value: formatUsd(Number(a.balance ?? 0)) },
    { key: "product", label: "Product", value: a.product },
    { key: "platform", label: "Platform", value: a.platform },
    { key: "type", label: "Type", value: a.type },
    { key: "created", label: "Created", value: formatDateTime(a.created ?? null) },
  ];
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {fields.map(({ key, label, value }) => (
        <div key={key}>
          <dt className="text-xs font-medium text-slate-500">{label}</dt>
          {isEdit && ["client_name", "email", "balance"].includes(key) && editForm ? (
            <input
              type={key === "balance" ? "number" : "text"}
              step={key === "balance" ? "0.01" : undefined}
              className={inputClass}
              value={
                key === "balance"
                  ? (editForm.account[key as keyof typeof editForm.account] ?? "")
                  : String(value ?? "")
              }
              onChange={(e) =>
                setEditForm({
                  ...editForm,
                  account: {
                    ...editForm.account,
                    [key]:
                      key === "balance"
                        ? parseFloat(e.target.value) || 0
                        : e.target.value,
                  },
                })
              }
            />
          ) : (
            <dd className="text-slate-800">{value ?? "—"}</dd>
          )}
        </div>
      ))}
    </dl>
  );
}

function RequestsTab({ overview }: { overview: OverviewData }) {
  const list = overview.fundsRequests;
  if (list.length === 0) return <p className="text-slate-500">No requests.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200">
            <th className="pb-2 pr-4 text-left font-medium text-slate-600">ID</th>
            <th className="pb-2 pr-4 text-left font-medium text-slate-600">Type</th>
            <th className="pb-2 pr-4 text-right font-medium text-slate-600">USD</th>
            <th className="pb-2 pr-4 text-left font-medium text-slate-600">Status</th>
            <th className="pb-2 pr-4 text-left font-medium text-slate-600">Requested</th>
            <th className="pb-2 text-left font-medium text-slate-600">Notes</th>
          </tr>
        </thead>
        <tbody>
          {list.map((r) => (
            <tr key={r.id as number} className="border-b border-slate-100">
              <td className="py-2 pr-4">{String(r.id)}</td>
              <td className="py-2 pr-4">{String(r.type)}</td>
              <td className="py-2 pr-4 text-right">{formatUsd(Number(r.amount_usd ?? 0))}</td>
              <td className="py-2 pr-4">{String(r.status)}</td>
              <td className="py-2 pr-4">{formatDateTime(r.requested_at as string)}</td>
              <td className="py-2">{r.admin_notes != null ? String(r.admin_notes) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DocumentsTab({ overview }: { overview: OverviewData }) {
  const list = overview.verificationDocuments;
  if (list.length === 0) return <p className="text-slate-500">No documents.</p>;
  return (
    <ul className="space-y-2">
      {list.map((d) => (
        <li key={d.id as number} className="flex items-center justify-between rounded border border-slate-200 px-3 py-2 text-sm">
          <span className="font-medium text-slate-700">{String(d.description)}</span>
          <span className="text-slate-500">
            {[d.file_size_bytes != null ? `${Number(d.file_size_bytes) / 1024} KB` : null, d.mime_type != null ? String(d.mime_type) : null].filter(Boolean).join(" ")}
          </span>
        </li>
      ))}
    </ul>
  );
}

function BankTab({ overview }: { overview: OverviewData }) {
  const list = overview.bankAccounts;
  if (list.length === 0) return <p className="text-slate-500">No bank accounts.</p>;
  return (
    <ul className="space-y-3">
      {list.map((b) => (
        <li key={b.id as number} className="rounded border border-slate-200 p-3 text-sm">
          <div className="font-medium text-slate-800">{String(b.bank)}</div>
          <div className="text-slate-600">Account: {(b as { account_number_masked?: string }).account_number_masked ?? "****"}</div>
          <div className="text-slate-600">IFSC: {String(b.ifsc_code)}</div>
          {b.is_default === true && <span className="text-amber-600">Default</span>}
        </li>
      ))}
    </ul>
  );
}

function InterestTab({
  overview,
  editForm,
  setEditForm,
  isEdit,
}: {
  overview: OverviewData;
  editForm: { account: Partial<OverviewData["account"]>; client: Record<string, unknown> } | null;
  setEditForm: (f: typeof editForm) => void;
  isEdit: boolean;
}) {
  const a = editForm?.account ?? overview.account;
  const rate = a.interest_rate_monthly ?? overview.account.interest_rate_monthly;
  return (
    <div className="space-y-6">
      <div>
        <dt className="text-xs font-medium text-slate-500">Monthly interest rate (%)</dt>
        {isEdit && editForm ? (
          <input
            type="number"
            min={0}
            max={100}
            step="0.01"
            className={inputClass}
            value={rate}
            onChange={(e) =>
              setEditForm({
                ...editForm,
                account: { ...editForm.account, interest_rate_monthly: parseFloat(e.target.value) || 0 },
              })
            }
          />
        ) : (
          <dd className="text-slate-800">{rate}%</dd>
        )}
      </div>
      {overview.recentInterestLog.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-medium text-slate-700">Recent interest credits</h4>
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="pb-1 pr-4 text-left font-medium text-slate-600">Date</th>
                <th className="pb-1 text-left font-medium text-slate-600">Status</th>
              </tr>
            </thead>
            <tbody>
              {overview.recentInterestLog.slice(0, 10).map((log) => (
                <tr key={log.id as number} className="border-b border-slate-100">
                  <td className="py-1 pr-4">{formatDate(log.for_date as string)}</td>
                  <td className="py-1">{String(log.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
