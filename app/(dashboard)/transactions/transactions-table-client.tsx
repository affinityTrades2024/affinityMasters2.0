"use client";

import { useState, useMemo } from "react";
import type { TransactionDisplay } from "@/lib/transactions-types";

const PAGE_SIZES = [10, 20, 30, 50, 100] as const;

function getCellValue(t: TransactionDisplay, key: string): string {
  switch (key) {
    case "transactionId":
      return String(t.transactionId);
    case "createTime":
      return t.createTime ? new Date(t.createTime).toLocaleString() : "";
    case "type":
      return t.type;
    case "amount":
      return t.creditDetails.amount.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    case "currency":
      return t.creditDetails.currency.alphabeticCode;
    case "fromAccount":
      return `${t.debitDetails.account.clientName} ${t.debitDetails.account.caption ? `(${t.debitDetails.account.accountNumber})` : ""}`.trim();
    case "toAccount":
      return `${t.creditDetails.account.clientName} ${t.creditDetails.account.caption ? `(${t.creditDetails.account.accountNumber})` : ""}`.trim();
    case "platform":
      return t.creditDetails.account.platform;
    case "status":
      return t.status;
    default:
      return "";
  }
}

const COLUMNS: { key: string; label: string; align: "left" | "right" }[] = [
  { key: "transactionId", label: "Transaction ID", align: "left" },
  { key: "createTime", label: "Date & Time", align: "left" },
  { key: "type", label: "Type", align: "left" },
  { key: "amount", label: "Amount", align: "right" },
  { key: "currency", label: "Currency", align: "left" },
  { key: "fromAccount", label: "From Account", align: "left" },
  { key: "toAccount", label: "To Account", align: "left" },
  { key: "platform", label: "Platform", align: "left" },
  { key: "status", label: "Status", align: "left" },
];

export default function TransactionsTableClient({
  transactions,
}: {
  transactions: TransactionDisplay[];
}) {
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState<Record<string, string>>({});

  const filtered = useMemo(() => {
    return transactions.filter((t) =>
      COLUMNS.every((col) => {
        const q = (filters[col.key] ?? "").trim().toLowerCase();
        if (!q) return true;
        const val = getCellValue(t, col.key).toLowerCase();
        return val.includes(q);
      })
    );
  }, [transactions, filters]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.min(currentPage, totalPages);
  const start = (page - 1) * pageSize;
  const pageRows = filtered.slice(start, start + pageSize);

  const setFilter = (key: string, value: string) => {
    setFilters((p) => ({ ...p, [key]: value }));
    setCurrentPage(1);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <span className="text-sm text-gray-600">Show</span>
        <select
          value={pageSize}
          onChange={(e) => {
            setPageSize(Number(e.target.value));
            setCurrentPage(1);
          }}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        >
          {PAGE_SIZES.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <span className="text-sm text-gray-600">per page</span>
        <span className="text-sm text-gray-500">
          ({filtered.length} transaction{filtered.length !== 1 ? "s" : ""})
        </span>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-md">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {COLUMNS.map((col) => (
                  <th key={col.key} className="px-2 py-1">
                    <div className="flex flex-col gap-1">
                      <span className="text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        {col.label}
                      </span>
                      <input
                        type="text"
                        placeholder="Search..."
                        value={filters[col.key] ?? ""}
                        onChange={(e) => setFilter(col.key, e.target.value)}
                        className="rounded border border-gray-200 bg-white px-2 py-1.5 text-sm placeholder:text-gray-400 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                      />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {pageRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={COLUMNS.length}
                    className="px-4 py-12 text-center text-gray-500"
                  >
                    No transactions match your filters.
                  </td>
                </tr>
              ) : (
                pageRows.map((t) => (
                  <tr
                    key={t.transactionId}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                      {t.transactionId}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                      {t.createTime
                        ? new Date(t.createTime).toLocaleString()
                        : "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">
                      {t.type}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-right font-medium text-gray-900">
                      $
                      {t.creditDetails.amount.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                      {t.creditDetails.currency.alphabeticCode}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {t.debitDetails.account.clientName}{" "}
                      {t.debitDetails.account.caption &&
                        `(${t.debitDetails.account.accountNumber})`}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {t.creditDetails.account.clientName}{" "}
                      {t.creditDetails.account.caption &&
                        `(${t.creditDetails.account.accountNumber})`}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                      {t.creditDetails.account.platform}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                      {t.status}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-gray-600">
            Page {page} of {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50 disabled:pointer-events-none"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() =>
                setCurrentPage((p) => Math.min(totalPages, p + 1))
              }
              disabled={page >= totalPages}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50 disabled:pointer-events-none"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
