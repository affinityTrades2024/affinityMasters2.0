"use client";

import { useState, useEffect, useCallback } from "react";

interface RunRow {
  id: number;
  jobType: string;
  startedAt: string | null;
  finishedAt: string | null;
  status: string;
  summary: Record<string, number | string> | null;
  errorMessage: string | null;
}

function formatDate(s: string | null) {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleString();
  } catch {
    return s;
  }
}

function summaryText(summary: Record<string, number | string> | null): string {
  if (!summary || typeof summary !== "object") return "—";
  const parts: string[] = [];
  if (typeof summary.processed === "number") parts.push(`${summary.processed} processed`);
  if (typeof summary.created === "number") parts.push(`${summary.created} created`);
  if (typeof summary.credited === "number") parts.push(`${summary.credited} credited`);
  if (typeof summary.skipped === "number") parts.push(`${summary.skipped} skipped`);
  if (typeof summary.errors === "number") parts.push(`${summary.errors} errors`);
  if (typeof summary.errorCount === "number") parts.push(`${summary.errorCount} errors`);
  if (summary.forDate) parts.push(`for ${summary.forDate}`);
  return parts.length > 0 ? parts.join(", ") : JSON.stringify(summary);
}

export default function AutoJobRunsClient() {
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [jobTypeFilter, setJobTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (jobTypeFilter !== "all") params.set("job_type", jobTypeFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await fetch(`/api/admin/cron-job-runs?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setRuns(data.runs ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setRuns([]);
    } finally {
      setLoading(false);
    }
  }, [jobTypeFilter, statusFilter]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  if (loading) {
    return <p className="text-sm text-slate-500">Loading…</p>;
  }

  if (error) {
    return (
      <div>
        <p className="text-sm text-red-600">{error}</p>
        <button
          type="button"
          onClick={() => fetchList()}
          className="mt-2 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4">
        <div>
          <label className="mr-2 text-sm text-slate-600">Job type</label>
          <select
            value={jobTypeFilter}
            onChange={(e) => setJobTypeFilter(e.target.value)}
            className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm"
          >
            <option value="all">All</option>
            <option value="daily_interest">Daily interest</option>
            <option value="auto_withdrawal">Auto withdrawal</option>
          </select>
        </div>
        <div>
          <label className="mr-2 text-sm text-slate-600">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm"
          >
            <option value="all">All</option>
            <option value="success">Success</option>
            <option value="failed">Failed</option>
            <option value="partial">Partial</option>
          </select>
        </div>
      </div>

      {runs.length === 0 ? (
        <p className="text-sm text-slate-500">No job runs found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium text-slate-700">Job type</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-700">Started at</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-700">Finished at</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-700">Status</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-700">Summary</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-700">Error</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {runs.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-2.5 text-slate-900">
                    {row.jobType === "auto_withdrawal" ? "Auto withdrawal" : "Daily interest"}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{formatDate(row.startedAt)}</td>
                  <td className="px-4 py-2.5 text-slate-600">{formatDate(row.finishedAt)}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={
                        row.status === "success"
                          ? "text-green-700"
                          : row.status === "failed"
                            ? "text-red-700"
                            : "text-amber-700"
                      }
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-600 max-w-xs">
                    {summaryText(row.summary)}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600 max-w-xs truncate" title={row.errorMessage ?? undefined}>
                    {row.errorMessage ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
