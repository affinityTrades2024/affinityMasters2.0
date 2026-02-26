"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";

const REPORT_TYPES = [
  { value: "deposits", label: "All Deposits" },
  { value: "payouts", label: "All Payouts (Withdrawals)" },
  { value: "bank-details", label: "Bank Details" },
  { value: "daily-profit", label: "Daily Profit" },
  { value: "partnership-earnings", label: "Partnership Earnings" },
  { value: "pending-disbursement", label: "Pending Disbursement" },
] as const;

export type ReportType = (typeof REPORT_TYPES)[number]["value"];

const PAGE_SIZES = [20, 50, 100] as const;

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    ...(iso.includes("T") ? { hour: "numeric", minute: "2-digit" } : {}),
  });
}

function formatUsd(n: number): string {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatInr(n: number): string {
  return "₹ " + n.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function formatCell(reportType: ReportType, key: string, value: unknown): string {
  if (value == null) return "—";
  if (typeof value === "number") {
    if (key === "amountUsd" || key === "amountInr" || key === "totalProfitShared" || key === "amount") {
      return key === "amountInr" ? formatInr(value) : formatUsd(value);
    }
    if (key === "numberOfAccounts") return String(value);
    return String(value);
  }
  if (typeof value === "string") {
    if (
      key.endsWith("At") ||
      key === "requestedAt" ||
      key === "reviewedAt" ||
      key === "disbursedAt" ||
      key === "createTime" ||
      key === "createdAt" ||
      key === "date"
    ) {
      return formatDate(value);
    }
    if (key === "isDefault") return value ? "Yes" : "No";
    return value;
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

const COLUMNS: Record<
  ReportType,
  { key: string; label: string; align?: "left" | "right" }[]
> = {
  deposits: [
    { key: "transactionId", label: "Transaction ID", align: "right" },
    { key: "date", label: "Date", align: "left" },
    { key: "clientEmail", label: "Client Email", align: "left" },
    { key: "clientName", label: "Client Name", align: "left" },
    { key: "toAccount", label: "To Account", align: "left" },
    { key: "amount", label: "Amount", align: "right" },
    { key: "currency", label: "Currency", align: "left" },
    { key: "status", label: "Status", align: "left" },
    { key: "depositRemark", label: "Deposit Remark", align: "left" },
  ],
  payouts: [
    { key: "transactionId", label: "Transaction ID", align: "right" },
    { key: "date", label: "Date", align: "left" },
    { key: "clientEmail", label: "Client Email", align: "left" },
    { key: "clientName", label: "Client Name", align: "left" },
    { key: "fromAccount", label: "From Account", align: "left" },
    { key: "amount", label: "Amount", align: "right" },
    { key: "currency", label: "Currency", align: "left" },
    { key: "status", label: "Status", align: "left" },
    { key: "disbursedAt", label: "Disbursed At", align: "left" },
    { key: "payoutRemark", label: "Payout Remark", align: "left" },
  ],
  "bank-details": [
    { key: "id", label: "ID", align: "right" },
    { key: "clientId", label: "Client ID", align: "right" },
    { key: "clientEmail", label: "Client Email", align: "left" },
    { key: "clientName", label: "Client Name", align: "left" },
    { key: "bank", label: "Bank", align: "left" },
    { key: "accountNumber", label: "Account Number", align: "left" },
    { key: "ifscCode", label: "IFSC Code", align: "left" },
    { key: "isDefault", label: "Is Default", align: "left" },
    { key: "createdAt", label: "Created At", align: "left" },
  ],
  "daily-profit": [
    { key: "date", label: "Date", align: "left" },
    { key: "totalProfitShared", label: "Total Profit Shared (USD)", align: "right" },
    { key: "numberOfAccounts", label: "Number of Accounts", align: "right" },
  ],
  "partnership-earnings": [
    { key: "transactionId", label: "Transaction ID", align: "right" },
    { key: "createTime", label: "Date & Time", align: "left" },
    { key: "type", label: "Type", align: "left" },
    { key: "amount", label: "Amount", align: "right" },
    { key: "currency", label: "Currency", align: "left" },
    { key: "fromAccount", label: "From Account", align: "left" },
    { key: "toAccount", label: "To Account", align: "left" },
    { key: "platform", label: "Platform", align: "left" },
    { key: "status", label: "Status", align: "left" },
  ],
  "pending-disbursement": [
    { key: "id", label: "ID", align: "right" },
    { key: "clientEmail", label: "Client Email", align: "left" },
    { key: "clientName", label: "Client Name", align: "left" },
    { key: "accountLabel", label: "Account", align: "left" },
    { key: "amountUsd", label: "Amount (USD)", align: "right" },
    { key: "amountInr", label: "Amount (INR)", align: "right" },
    { key: "requestedAt", label: "Requested At", align: "left" },
    { key: "reviewedAt", label: "Reviewed At", align: "left" },
    { key: "adminNotes", label: "Payout Remark", align: "left" },
  ],
};

export default function ReportsClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const reportParam = searchParams.get("report") ?? "deposits";
  const reportType: ReportType = REPORT_TYPES.some((r) => r.value === reportParam)
    ? (reportParam as ReportType)
    : "deposits";

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = useCallback(
    async (type: ReportType, p: number, size: number) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/admin/reports/${type}?page=${p}&pageSize=${size}`
        );
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to load report");
        }
        const data = await res.json();
        setRows(data.rows ?? []);
        setTotalCount(data.totalCount ?? 0);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
        setRows([]);
        setTotalCount(0);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchReport(reportType, page, pageSize);
  }, [reportType, page, pageSize, fetchReport]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const columns = COLUMNS[reportType];

  const setReportType = (type: ReportType) => {
    router.replace(`/manage/reports?report=${type}`);
    setPage(1);
  };

  const exportCsv = () => {
    window.open(
      `/api/admin/reports/${reportType}?format=csv`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <p className="text-sm text-red-700">{error}</p>
        <button
          type="button"
          onClick={() => fetchReport(reportType, page, pageSize)}
          className="mt-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          Report
          <select
            value={reportType}
            onChange={(e) => setReportType(e.target.value as ReportType)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
          >
            {REPORT_TYPES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={exportCsv}
          className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-700"
        >
          Export CSV
        </button>
        <span className="text-sm text-slate-500">
          {totalCount} row{totalCount !== 1 ? "s" : ""} total
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <span className="text-sm text-slate-600">Show</span>
        <select
          value={pageSize}
          onChange={(e) => {
            setPageSize(Number(e.target.value) as 20 | 50 | 100);
            setPage(1);
          }}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
        >
          {PAGE_SIZES.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <span className="text-sm text-slate-600">per page</span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-sm text-slate-500">Loading…</p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={`whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 ${
                      col.align === "right" ? "text-right" : ""
                    }`}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="px-4 py-12 text-center text-slate-500"
                  >
                    No data for this report.
                  </td>
                </tr>
              ) : (
                rows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={`whitespace-nowrap px-4 py-3 text-sm text-slate-700 ${
                          col.align === "right" ? "text-right" : ""
                        } ${col.key === "adminNotes" ? "max-w-[220px] truncate" : ""}`}
                        title={
                          col.key === "adminNotes" && row[col.key]
                            ? String(row[col.key])
                            : undefined
                        }
                      >
                        {formatCell(reportType, col.key, row[col.key])}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {!loading && totalCount > 0 && totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-slate-600">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:pointer-events-none"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:pointer-events-none"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
