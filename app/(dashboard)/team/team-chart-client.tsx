"use client";

import { useState, useEffect } from "react";

interface PammOption {
  id: number;
  accountNumber: string;
  name: string;
}

interface TeamChartNode {
  accountId: number;
  accountNumber: string;
  name: string;
  balance: number;
  partnershipFees: number;
  balanceLabel: string;
  partnershipLabel: string;
  tags: string[];
  level: number;
  levelName: string;
  children?: TeamChartNode[];
}

export default function TeamChartClient({
  options,
}: {
  options: PammOption[];
}) {
  const [selected, setSelected] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [root, setRoot] = useState<TeamChartNode | null>(null);

  function loadTeamData() {
    if (!selected) return;
    const [id, num] = selected.split(",");
    if (!id || !num) return;
    setLoading(true);
    setError(null);
    fetch(`/team/team-chart?accountData=${encodeURIComponent(id + "," + num)}`)
      .then((res) => {
        if (!res.ok) return res.json().then((d) => Promise.reject(new Error(d.error || "Failed")));
        return res.json();
      })
      .then((data) => {
        setRoot(data.root);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (!selected) setRoot(null);
  }, [selected]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-[200px]">
          <label htmlFor="pamm" className="block text-sm font-medium text-gray-700 mb-1">
            Account
          </label>
          <select
            id="pamm"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="">Select Account</option>
            {options.map((o) => (
              <option key={o.id} value={`${o.id},${o.accountNumber}`}>
                {o.accountNumber} – {o.name}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={loadTeamData}
          disabled={!selected || loading}
          className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Loading…" : "Get Team Data"}
        </button>
      </div>
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {root && !loading && (
        <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-4">
          <TreeNode node={root} depth={0} />
        </div>
      )}
    </div>
  );
}

function TreeNode({
  node,
  depth,
}: {
  node: TeamChartNode;
  depth: number;
}) {
  return (
    <div className={depth > 0 ? "ml-6 mt-2 border-l-2 border-gray-200 pl-4" : ""}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <span className="font-medium text-gray-900">{node.name}</span>
        <span className="text-gray-500">#{node.accountNumber}</span>
        <span className="text-gray-600">Balance: {node.balanceLabel}</span>
        <span className="text-gray-600">Partnership: {node.partnershipLabel}</span>
        {node.levelName && (
          <span className="rounded bg-amber-100 px-2 py-0.5 text-amber-800">
            {node.levelName}
          </span>
        )}
        {node.tags.map((t) => (
          <span key={t} className="rounded bg-gray-100 px-2 py-0.5 text-gray-600">
            {t}
          </span>
        ))}
      </div>
      {node.children?.map((child) => (
        <TreeNode key={child.accountId} node={child} depth={depth + 1} />
      ))}
    </div>
  );
}
