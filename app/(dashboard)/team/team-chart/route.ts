import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getProfileByEmail } from "@/lib/profile";
import { getInvestmentAccountId } from "@/lib/investment-account";
import { supabase } from "@/lib/supabase/server";
import {
  LEVEL_0,
  LEVEL_1,
  LEVEL_2,
  LEVEL_3,
  LEVEL_NAMES,
} from "@/lib/config";

export interface TeamChartNode {
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

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const profile = await getProfileByEmail(session.email);
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accountData = request.nextUrl.searchParams.get("accountData");
  if (!accountData) {
    return NextResponse.json(
      { error: "Missing accountData (id,num)" },
      { status: 400 }
    );
  }
  const [idStr, accountNumber] = accountData.split(",").map((s) => s.trim());
  const masterAccountId = parseInt(idStr, 10);
  if (!Number.isFinite(masterAccountId) || !accountNumber) {
    return NextResponse.json(
      { error: "Invalid accountData" },
      { status: 400 }
    );
  }

  const investmentAccountId = await getInvestmentAccountId(profile.id);
  if (investmentAccountId === null || investmentAccountId !== masterAccountId) {
    return NextResponse.json(
      { error: "Investment account not found" },
      { status: 404 }
    );
  }

  const { data: pammRow } = await supabase
    .from("pamm_master")
    .select("name")
    .eq("id", masterAccountId)
    .eq("client_id", profile.id)
    .maybeSingle();
  let rootName: string;
  if (pammRow?.name != null) {
    rootName = String(pammRow.name);
  } else {
    const { data: accRow } = await supabase
      .from("accounts")
      .select("client_name")
      .eq("account_id", masterAccountId)
      .maybeSingle();
    rootName = (accRow?.client_name as string) || "Investment Account";
  }

  const { data: childrenRows } = await supabase.rpc("get_child_accounts", {
    myid: masterAccountId,
  });
  const childrenList = (childrenRows || []) as Array<{
    account_id: number;
    account_number: string;
    name: string;
    client_id: number;
  }>;

  const accountIds = [
    masterAccountId,
    ...childrenList.map((c) => c.account_id),
  ];
  const { data: accountBalances } = await supabase
    .from("accounts")
    .select("account_id, balance, equity")
    .in("account_id", accountIds);
  const balanceByAccountId = new Map<number, number>();
  for (const a of accountBalances || []) {
    const id = Number(a.account_id);
    const bal = Number(a.equity ?? a.balance ?? 0);
    balanceByAccountId.set(id, bal);
  }
  const pammIds = accountIds.filter((id) => !balanceByAccountId.has(id));
  if (pammIds.length > 0) {
    const { data: pammRows } = await supabase
      .from("pamm_master")
      .select("id")
      .in("id", pammIds);
    for (const p of pammRows || []) {
      const pid = Number(p.id);
      if (!balanceByAccountId.has(pid)) balanceByAccountId.set(pid, 0);
    }
  }

  const accountNumbers = [
    accountNumber,
    ...childrenList.map((c) => String(c.account_number || "")),
  ];
  const { data: partnershipTxs } = await supabase
    .from("transactions")
    .select("source_account_id, destination_amount")
    .eq("type", "fees");
  const partnershipByDebitAccount = new Map<string, number>();
  for (const t of partnershipTxs || []) {
    const srcId = t.source_account_id;
    const key = String(srcId ?? "");
    const amt = Number(t.destination_amount ?? 0);
    partnershipByDebitAccount.set(
      key,
      (partnershipByDebitAccount.get(key) || 0) + amt
    );
  }
  const { data: accountsByNumber } = await supabase
    .from("accounts")
    .select("account_id, account_number")
    .in("account_number", accountNumbers);
  const accountIdByNumber = new Map<string, number>();
  for (const a of accountsByNumber || []) {
    accountIdByNumber.set(String(a.account_number), Number(a.account_id));
  }
  for (const p of childrenList || []) {
    const num = String(p.account_number);
    if (!accountIdByNumber.has(num)) accountIdByNumber.set(num, p.account_id);
  }
  function getPartnershipFees(accountNumber: string): number {
    const id = accountIdByNumber.get(accountNumber);
    if (id == null) return 0;
    return (
      partnershipByDebitAccount.get(String(id)) ||
      partnershipByDebitAccount.get(accountNumber) ||
      0
    );
  }

  const rootBalance = balanceByAccountId.get(masterAccountId) ?? 0;
  const rootPartnership = getPartnershipFees(accountNumber);
  const childrenSum = childrenList.reduce(
    (s, c) => s + (balanceByAccountId.get(c.account_id) ?? 0),
    0
  );
  const rootLevel = computeLevel(rootBalance, childrenSum);

  const childNodes: TeamChartNode[] = childrenList.map((c) => {
    const bal = balanceByAccountId.get(c.account_id) ?? 0;
    const pf = getPartnershipFees(String(c.account_number));
    return {
      accountId: c.account_id,
      accountNumber: String(c.account_number),
      name: (c.name as string) || "—",
      balance: bal,
      partnershipFees: pf,
      balanceLabel: formatMoney(bal),
      partnershipLabel: formatMoney(pf),
      tags: bal === 0 ? ["zero"] : [],
      level: -1,
      levelName: "",
    };
  });

  const root: TeamChartNode = {
    accountId: masterAccountId,
    accountNumber,
    name: rootName,
    balance: rootBalance,
    partnershipFees: rootPartnership,
    balanceLabel: formatMoney(rootBalance),
    partnershipLabel: formatMoney(rootPartnership),
    tags: rootBalance === 0 ? ["zero"] : ["parent"],
    level: rootLevel,
    levelName: rootLevel >= 0 ? LEVEL_NAMES[rootLevel] ?? "" : "",
    children: childNodes.length > 0 ? childNodes : undefined,
  };

  return NextResponse.json({ root });
}

function formatMoney(n: number): string {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function computeLevel(parentBalance: number, childrenBalanceSum: number): number {
  if (parentBalance < LEVEL_0) return -1;
  if (childrenBalanceSum >= LEVEL_1 && childrenBalanceSum < LEVEL_2) return 1;
  if (childrenBalanceSum >= LEVEL_2 && childrenBalanceSum < LEVEL_3) return 2;
  if (childrenBalanceSum >= LEVEL_3) return 3;
  return 0;
}
