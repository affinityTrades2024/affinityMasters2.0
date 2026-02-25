"use client";

import { useState, useMemo } from "react";
import type { DailyProfitRow } from "./page";

const PAGE_SIZES = [10, 20, 30, 50, 100] as const;

function formatDate(dateStr: string): string {
  if (!dateStr) return "—";
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getCellValue(row: DailyProfitRow, key: string): string {
  switch (key) {
    case "date":
      return formatDate(row.date);
    case "totalProfitShared":
      return row.totalProfitShared.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    case "numberOfAccounts":
      return String(row.numberOfAccounts);
    default:
      return "";
  }
}

const COLUMNS: { key: keyof DailyProfitRow; label: string; align: "left" | "right" }[] = [
  { key: "date", label: "Date", align: "left" },
  { key: "totalProfitShared", label: "Total Profit Shared", align: "right" },
  { key: "numberOfAccounts", label: "Number of Accounts", align: "right" },
];

export default function DailyReportTableClient({
  rows,
}: {
  rows: DailyProfitRow[];
}) {
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState<Record<string, string>>({});

  const filtered = useMemo(() => {
    return rows.filter((row) =>
      COLUMNS.every((col) => {
        const q = (filters[col.key] ?? "").trim().toLowerCase();
        if (!q) return true;
        const val = getCellValue(row, col.key).toLowerCase();
        return val.includes(q);
      })
    );
  }, [rows, filters]);

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
        <span className="text-sm text-slate-600">Show</span>
        <select
          value={pageSize}
          onChange={(e) => {
            setPageSize(Number(e.target.value));
            setCurrentPage(1);
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
        <span className="text-sm text-slate-500">
          ({filtered.length} date{filtered.length !== 1 ? "s" : ""})
        </span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              {COLUMNS.map((col) => (
                <th key={col.key} className="px-2 py-1">
                  <div className="flex flex-col gap-1">
                    <span className="text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                      {col.label}
                    </span>
                    <input
                      type="text"
                      placeholder="Search..."
                      value={filters[col.key] ?? ""}
                      onChange={(e) => setFilter(col.key, e.target.value)}
                      className="rounded border border-slate-200 bg-white px-2 py-1.5 text-sm placeholder:text-slate-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {pageRows.length === 0 ? (
              <tr>
                <td
                  colSpan={COLUMNS.length}
                  className="px-4 py-12 text-center text-slate-500"
                >
                  No dates match your filters.
                </td>
              </tr>
            ) : (
              pageRows.map((row) => (
                <tr key={row.date} className="hover:bg-slate-50 transition-colors">
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-900">
                    {formatDate(row.date)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-right font-medium text-slate-900">
                    $
                    {row.totalProfitShared.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-right text-slate-600">
                    {row.numberOfAccounts}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-slate-600">
            Page {page} of {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 disabled:pointer-events-none"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 disabled:pointer-events-none"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
