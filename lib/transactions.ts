import { supabase } from "@/lib/supabase/server";
import { INTERNAL_ACCOUNTS } from "@/lib/config";
import type { TransactionDisplay, AccountDisplay } from "@/lib/transactions-types";

export interface AccountMapEntry {
  account_id: number;
  account_number: string;
  client_name: string;
  platform: string;
}

function normalizeDbType(type: string): string {
  const t = (type || "").toLowerCase().trim();
  if (t === "payout") return "withdrawal";
  if (["rewards", "fee", "fees", "performance_fee"].includes(t)) return "fees";
  if (t === "daily_interest") return "Daily Interest";
  if (t === "partnership_fee_admin") return "Partnership Fees";
  return type || "unknown";
}

function resolveAccount(
  accountId: number | null,
  accountNumber: string | null,
  byId: Map<number, AccountMapEntry>,
  byNumber: Map<string, AccountMapEntry>
): AccountDisplay {
  const id = accountId != null ? accountId : null;
  const num = accountNumber != null ? String(accountNumber).trim() : null;
  let entry: AccountMapEntry | undefined;
  if (id != null) entry = byId.get(id);
  if (!entry && num) entry = byNumber.get(num);
  if (entry) {
    return {
      accountId: entry.account_id,
      accountNumber: entry.account_number,
      clientName: entry.client_name || "—",
      caption: entry.account_number || entry.client_name || "—",
      platform: entry.platform || "—",
    };
  }
  if (id != null && INTERNAL_ACCOUNTS[id]) {
    return {
      accountId: id,
      accountNumber: String(id),
      clientName: INTERNAL_ACCOUNTS[id],
      caption: INTERNAL_ACCOUNTS[id],
      platform: "—",
    };
  }
  return {
    accountId: id ?? 0,
    accountNumber: num ?? "—",
    clientName: "External account",
    caption: num ?? "—",
    platform: "—",
  };
}

export async function buildAccountMaps(clientId: number): Promise<{
  byId: Map<number, AccountMapEntry>;
  byNumber: Map<string, AccountMapEntry>;
  selfAccountNumbers: Set<string>;
}> {
  const byId = new Map<number, AccountMapEntry>();
  const byNumber = new Map<string, AccountMapEntry>();
  const selfAccountNumbers = new Set<string>();

  const { data: accounts } = await supabase
    .from("accounts")
    .select("account_id, account_number, client_name, platform")
    .eq("client_id", clientId);
  for (const a of accounts || []) {
    const id = Number(a.account_id);
    const num = String(a.account_number || "").trim();
    const entry: AccountMapEntry = {
      account_id: id,
      account_number: num,
      client_name: (a.client_name as string) || "",
      platform: (a.platform as string) || "",
    };
    byId.set(id, entry);
    if (num) byNumber.set(num, entry);
    if (num) selfAccountNumbers.add(num);
  }

  const { data: pamm } = await supabase
    .from("pamm_master")
    .select("id, account_number, name")
    .eq("client_id", clientId);
  for (const p of pamm || []) {
    const id = Number(p.id);
    const num = String(p.account_number || "").trim();
    const entry: AccountMapEntry = {
      account_id: id,
      account_number: num,
      client_name: (p.name as string) || "",
      platform: "PAMM",
    };
    if (!byId.has(id)) byId.set(id, entry);
    if (num && !byNumber.has(num)) byNumber.set(num, entry);
    if (num) selfAccountNumbers.add(num);
  }

  return { byId, byNumber, selfAccountNumbers };
}

/**
 * Fee reclassification: fees → Performance Fees vs Partnership Fees.
 * - Credit (To) account number = "129" → Performance Fees.
 * - Debit (From) in self_wallets → Performance Fees.
 * - Else → Partnership Fees.
 */
function reclassifyFees(
  type: string,
  creditAccountNumber: string,
  debitAccountNumber: string,
  selfAccountNumbers: Set<string>
): string {
  if (type !== "fees") return type;
  if (creditAccountNumber === "129") return "Performance Fees";
  if (selfAccountNumbers.has(debitAccountNumber)) return "Performance Fees";
  return "Partnership Fees";
}

export interface RawTransactionRow {
  id: number;
  client_id: number;
  type: string;
  source_account_id: number | null;
  destination_account_id: number | null;
  source_amount: number;
  source_currency: string;
  destination_amount: number;
  destination_currency: string;
  status: string;
  operation_date: string;
}

export async function getTransactionsForClient(clientId: number): Promise<{
  transactions: RawTransactionRow[];
  accountIds: number[];
}> {
  const { data: primary } = await supabase
    .from("transactions")
    .select("*")
    .eq("client_id", clientId)
    .order("operation_date", { ascending: false });

  const { data: accounts } = await supabase
    .from("accounts")
    .select("account_id")
    .eq("client_id", clientId);
  const { data: pamm } = await supabase
    .from("pamm_master")
    .select("id")
    .eq("client_id", clientId);
  const myAccountIds = new Set<number>();
  for (const a of accounts || []) myAccountIds.add(Number(a.account_id));
  for (const p of pamm || []) myAccountIds.add(Number(p.id));

  const { data: feeToMe } = await supabase
    .from("transactions")
    .select("*")
    .eq("type", "fees")
    .in("destination_account_id", Array.from(myAccountIds));
  const seenIds = new Set((primary || []).map((r) => r.id));
  const merged: RawTransactionRow[] = [...(primary || [])];
  for (const row of feeToMe || []) {
    if (!seenIds.has(row.id)) {
      seenIds.add(row.id);
      merged.push(row as RawTransactionRow);
    }
  }
  merged.sort((a, b) => (b.operation_date || "").localeCompare(a.operation_date || ""));

  return {
    transactions: merged,
    accountIds: Array.from(myAccountIds),
  };
}

export function toDisplayTransactions(
  rows: RawTransactionRow[],
  byId: Map<number, AccountMapEntry>,
  byNumber: Map<string, AccountMapEntry>,
  selfAccountNumbers: Set<string>
): TransactionDisplay[] {
  return rows.map((r) => {
    const destId = r.destination_account_id;
    const srcId = r.source_account_id;
    const destNum = r.destination_account_id != null ? String(r.destination_account_id) : null;
    const srcNum = r.source_account_id != null ? String(r.source_account_id) : null;
    const creditAcc = resolveAccount(destId, destNum, byId, byNumber);
    const debitAcc = resolveAccount(srcId, srcNum, byId, byNumber);
    const normalizedType = normalizeDbType(r.type);
    const displayType = reclassifyFees(
      normalizedType,
      creditAcc.accountNumber,
      debitAcc.accountNumber,
      selfAccountNumbers
    );
    return {
      transactionId: r.id,
      type: displayType,
      createTime: r.operation_date ? `${r.operation_date}T00:00:00.000Z` : "",
      status: (r.status as string) || "—",
      operationDate: r.operation_date || "",
      creditDetails: {
        amount: Number(r.destination_amount ?? 0),
        currency: { alphabeticCode: (r.destination_currency as string) || "USD" },
        account: creditAcc,
      },
      debitDetails: {
        amount: Number(r.source_amount ?? 0),
        account: debitAcc,
      },
    };
  });
}
