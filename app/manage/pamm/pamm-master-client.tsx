"use client";

import { useState, useMemo } from "react";

const COLS = [
  "id",
  "pid",
  "account_number",
  "client_id",
  "name",
  "email",
  "nickname",
  "parent_account_number",
  "parent_client_id",
  "ref_id",
] as const;

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500";
const filterInputClass =
  "w-full min-w-0 rounded border border-slate-200 bg-white px-2 py-1 text-xs placeholder:text-slate-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500";
const btnPrimary =
  "rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:opacity-50";
const btnSecondary =
  "rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50";

function matchFilter(value: string, filter: string): boolean {
  if (!filter.trim()) return true;
  return String(value ?? "").toLowerCase().includes(filter.trim().toLowerCase());
}

export default function PammMasterClient({
  initialRows,
}: {
  initialRows: Record<string, unknown>[];
}) {
  const [rows, setRows] = useState(initialRows);
  const [editing, setEditing] = useState<{ id: number; col: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newRow, setNewRow] = useState<Record<string, string>>({});
  const [filters, setFilters] = useState<Record<string, string>>({});

  const filteredRows = useMemo(() => {
    return rows.filter((r) =>
      COLS.every((col) => matchFilter(String(r[col] ?? ""), filters[col] ?? ""))
    );
  }, [rows, filters]);

  const setFilter = (col: string, value: string) => {
    setFilters((p) => ({ ...p, [col]: value }));
  };

  async function handleUpdate(id: number, col: string, value: string) {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/pamm/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, column: col, value: value || null }),
      });
      if (!res.ok) throw new Error("Update failed");
      setRows((prev) =>
        prev.map((r) => (Number(r.id) === id ? { ...r, [col]: value } : r))
      );
      setEditing(null);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Update failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleAdd() {
    const payload: Record<string, unknown> = {};
    for (const col of COLS) {
      if (col === "id") continue;
      const v = newRow[col];
      if (v === "" || v == null) payload[col] = null;
      else if (["pid", "client_id", "parent_client_id", "ref_id"].includes(col))
        payload[col] = parseInt(String(v), 10) || null;
      else payload[col] = v;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/pamm/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Add failed");
      const data = await res.json();
      setRows((prev) => [...prev, data.row]);
      setAdding(false);
      setNewRow({});
    } catch (e) {
      alert(e instanceof Error ? e.message : "Add failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {filteredRows.length} of {rows.length} row{rows.length !== 1 ? "s" : ""}. Type in filter boxes to narrow. Click a cell to edit.
        </p>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className={btnPrimary}
        >
          Add row
        </button>
      </div>

      {adding && (
        <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">New PAMM master row</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-4">
            {COLS.filter((c) => c !== "id").map((col) => (
              <div key={col}>
                <label className="block text-xs font-medium text-slate-500 mb-1">{col}</label>
                <input
                  value={newRow[col] ?? ""}
                  onChange={(e) => setNewRow((p) => ({ ...p, [col]: e.target.value }))}
                  className={inputClass}
                  placeholder={col}
                />
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={handleAdd} disabled={saving} className={btnPrimary}>
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => { setAdding(false); setNewRow({}); }}
              className={btnSecondary}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-slate-200">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                {COLS.map((c) => (
                  <th
                    key={c}
                    className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-500"
                  >
                    {c}
                  </th>
                ))}
                <th className="px-2 py-2 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 w-20">
                  Actions
                </th>
              </tr>
              <tr className="bg-slate-100/80">
                {COLS.map((c) => (
                  <th key={c} className="px-2 py-1">
                    <input
                      type="text"
                      placeholder="Filter..."
                      value={filters[c] ?? ""}
                      onChange={(e) => setFilter(c, e.target.value)}
                      className={filterInputClass}
                    />
                  </th>
                ))}
                <th className="px-2 py-1" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {filteredRows.map((r) => (
                <tr key={r.id as number} className="hover:bg-slate-50/50">
                  {COLS.map((col) => (
                    <td key={col} className="whitespace-nowrap px-4 py-2 text-sm text-slate-700">
                      {editing?.id === r.id && editing?.col === col ? (
                        <input
                          autoFocus
                          defaultValue={String(r[col] ?? "")}
                          onBlur={(e) => handleUpdate(Number(r.id), col, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                          }}
                          className={`max-w-[140px] ${inputClass}`}
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => setEditing({ id: Number(r.id), col })}
                          className="text-left hover:bg-amber-50 rounded px-2 py-1 -mx-1 min-w-[80px]"
                        >
                          {r[col] != null ? String(r[col]) : "—"}
                        </button>
                      )}
                    </td>
                  ))}
                  <td className="px-4 py-2 text-right">
                    {editing?.id === r.id ? (
                      <span className="text-xs text-slate-400">editing</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setEditing({ id: Number(r.id), col: COLS[1] })}
                        className="text-amber-600 text-sm font-medium hover:text-amber-700 hover:underline"
                      >
                        Edit
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
