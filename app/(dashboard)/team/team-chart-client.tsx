"use client";

import { useState, useEffect, useRef } from "react";
import Script from "next/script";

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

function toTwoDecimals(n: number): number {
  return Math.round(Number(n) * 100) / 100;
}

function formatTwoDecimals(n: number): string {
  return Number(n).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function flattenToChartNodes(
  node: TeamChartNode,
  parentId: number | null = null
): Array<Record<string, unknown>> {
  const balance = toTwoDecimals(node.balance ?? 0);
  const partnershipFees = toTwoDecimals(node.partnershipFees ?? 0);
  const flat: Array<Record<string, unknown>> = [
    {
      id: node.accountId,
      pid: parentId,
      name: node.name,
      account: node.accountNumber,
      accountNumber: node.accountNumber,
      balance,
      balanceLabel: formatTwoDecimals(balance),
      partnershipFees,
      partnershipLabel: formatTwoDecimals(partnershipFees),
      tags: node.tags ?? [],
    },
  ];
  for (const child of node.children ?? []) {
    flat.push(...flattenToChartNodes(child, node.accountId));
  }
  return flat;
}

function mountBalkanChart(
  container: HTMLDivElement,
  root: TeamChartNode,
  chartRef: React.MutableRefObject<{ destroy: () => void } | null>
): void {
  const win = typeof window !== "undefined" ? window : null;
  const OrgChart = win ? (win as unknown as { OrgChart?: unknown }).OrgChart : undefined;
  if (!OrgChart || !container) return;

  container.innerHTML = "";

  const OC = OrgChart as {
    templates: Record<string, Record<string, string>>;
    none: unknown;
    match?: { boundary?: number };
    new (el: HTMLElement, opts: Record<string, unknown>): { destroy: () => void };
  };

  OC.templates.ana = OC.templates.ana ?? {};
  OC.templates.ana.field_0 =
    '<text class="field_0" style="font-size: 22px;" fill="#ffffff" x="125" y="30" text-anchor="middle">{val}</text>';
  OC.templates.ana.field_1 =
    '<text class="field_1" style="font-size: 16px;" fill="#ffffff" x="125" y="50" text-anchor="middle">#{val}</text>';
  OC.templates.ana.field_2 =
    '<text class="field_3" style="font-size: 14px;" fill="#ffffff" x="55" y="70" text-anchor="middle">{val}</text>';
  OC.templates.ana.field_3 =
    '<text class="field_2" style="font-size: 20px;" fill="#ffffff" x="55" y="90" text-anchor="middle">${val}</text>';
  OC.templates.ana.field_4 =
    '<text class="field_3" style="font-size: 14px;" fill="#ffffff" x="180" y="70" text-anchor="middle">{val}</text>';
  OC.templates.ana.field_5 =
    '<text class="field_3" style="font-size: 20px;" fill="#ffffff" x="180" y="90" text-anchor="middle">${val}</text>';

  const chartData = flattenToChartNodes(root);
  const scaleInitial =
    win && new URLSearchParams(win.location.search).get("fit") === "yes"
      ? OC.match?.boundary ?? 1
      : 1;

  const chart = new OC(container, {
    template: "ana",
    enableSearch: false,
    enableDragDrop: true,
    mouseScrool: OC.none,
    editForm: { readOnly: true },
    scaleInitial,
    tags: { assistant: { template: "ula" } },
    nodeMenu: { details: { text: "Details" } },
    nodeBinding: {
      field_0: "name",
      field_1: "account",
      field_2: "balanceLabel",
      field_3: "balance",
      field_4: "partnershipLabel",
      field_5: "partnershipFees",
    },
    nodes: chartData,
  });
  chartRef.current = chart;
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
  const [level, setLevel] = useState<string | null>(null);
  const [lastModified, setLastModified] = useState<string | null>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const chartRef = useRef<{ destroy: () => void } | null>(null);
  const chartContainerRef = useRef<HTMLDivElement | null>(null);

  function loadTeamData() {
    if (!selected) return;
    const [id, num] = selected.split(",");
    if (!id || !num) return;
    setLoading(true);
    setError(null);
    setLevel(null);
    setLastModified(null);
    fetch(`/team/team-chart?accountData=${encodeURIComponent(id + "," + num)}`)
      .then((res) => {
        if (!res.ok)
          return res.json().then((d) => Promise.reject(new Error(d.error || "Failed")));
        return res.json();
      })
      .then((data) => {
        setRoot(data.root ?? null);
        setLevel(data.level ?? null);
        setLastModified(data.lastModified ?? null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (!selected) {
      setRoot(null);
      setLevel(null);
      setLastModified(null);
    }
  }, [selected]);

  useEffect(() => {
    if (!root || !scriptReady || !chartContainerRef.current) return;
    mountBalkanChart(chartContainerRef.current, root, chartRef);
    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [root, scriptReady]);

  return (
    <div className="space-y-4">
      <link rel="stylesheet" href="/css/org.css" />
      <Script
        src="/js/OrgChart.js"
        strategy="lazyOnload"
        onLoad={() => setScriptReady(true)}
      />
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-[200px]">
          <label htmlFor="account" className="block text-sm font-medium text-gray-700 mb-1">
            Account
          </label>
          <select
            id="account"
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
      {root != null && !loading && (
        <>
          {(level != null || lastModified != null) && (
            <div className="flex flex-wrap items-center gap-4 text-sm">
              {level != null && level !== "" && (
                <span>
                  Investor Level:{" "}
                  <span className="rounded bg-amber-100 px-2 py-0.5 font-medium text-amber-800">
                    {level}
                  </span>
                </span>
              )}
              {lastModified != null && (
                <span className="text-gray-600">
                  As on: <span className="text-gray-900">{lastModified}</span>
                </span>
              )}
            </div>
          )}
          <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-4">
            <div
              ref={chartContainerRef}
              id="tree"
              style={{ width: "100%", minHeight: "70vh" }}
            >
              {!scriptReady && (
                <p className="text-sm text-gray-500 py-4">Loading chart…</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
