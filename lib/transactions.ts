import { supabase } from "@/lib/supabase/server";
import { INTERNAL_ACCOUNTS } from "@/lib/config";
import { getInvestmentAccountId } from "@/lib/investment-account";
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

  const investmentAccountId = await getInvestmentAccountId(clientId);
  if (investmentAccountId != null) {
    const { data: account } = await supabase
      .from("accounts")
      .select("account_id, account_number, client_name, platform")
      .eq("account_id", investmentAccountId)
      .eq("client_id", clientId)
      .maybeSingle();
    if (account) {
      const id = Number(account.account_id);
      const num = String(account.account_number || "").trim();
      const entry: AccountMapEntry = {
        account_id: id,
        account_number: num,
        client_name: (account.client_name as string) || "",
        platform: (account.platform as string) || "Investment Account",
      };
      byId.set(id, entry);
      if (num) byNumber.set(num, entry);
      if (num) selfAccountNumbers.add(num);
    }
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
  // Step 1 – Primary: all transactions where client_id = this user (no limit; paginate to get all)
  const primary: RawTransactionRow[] = [];
  const pageSize = 1000;
  let from = 0;
  while (true) {
    const { data: chunk } = await supabase
      .from("transactions")
      .select("*")
      .eq("client_id", clientId)
      .order("operation_date", { ascending: false })
      .range(from, from + pageSize - 1);
    if (!chunk?.length) break;
    primary.push(...(chunk as RawTransactionRow[]));
    if (chunk.length < pageSize) break;
    from += pageSize;
  }

  const seenIds = new Set(primary.map((r) => r.id));

  // Step 2 – My account ids: from accounts + pamm_master for this client (for fee-destination merge)
  const myDestinationIds = new Set<number>();
  const { data: accountRows } = await supabase
    .from("accounts")
    .select("account_id, account_number")
    .eq("client_id", clientId);
  for (const r of accountRows || []) {
    myDestinationIds.add(Number(r.account_id));
    const num = r.account_number;
    if (num != null) {
      const n = Number(num);
      if (Number.isFinite(n)) myDestinationIds.add(n);
    }
  }
  const { data: pammRows } = await supabase
    .from("pamm_master")
    .select("id, account_number")
    .eq("client_id", clientId);
  for (const r of pammRows || []) {
    myDestinationIds.add(Number(r.id));
    const num = r.account_number;
    if (num != null) {
      const n = Number(num);
      if (Number.isFinite(n)) myDestinationIds.add(n);
    }
  }

  // Step 3 – Extra: fee transactions where destination is one of my accounts (cap 100 ids, limit 500)
  const merged: RawTransactionRow[] = [...primary];
  if (myDestinationIds.size > 0) {
    const destList = Array.from(myDestinationIds).slice(0, 100);
    const { data: feeExtra } = await supabase
      .from("transactions")
      .select("*")
      .eq("type", "fees")
      .in("destination_account_id", destList)
      .order("operation_date", { ascending: false })
      .limit(500);
    for (const row of feeExtra || []) {
      const id = Number(row.id);
      const destId = row.destination_account_id != null ? Number(row.destination_account_id) : null;
      if (!seenIds.has(id) && destId != null && myDestinationIds.has(destId)) {
        seenIds.add(id);
        merged.push(row as RawTransactionRow);
      }
    }
  }

  merged.sort((a, b) => (b.operation_date || "").localeCompare(a.operation_date || ""));

  const accountIds = Array.from(myDestinationIds);
  return {
    transactions: merged,
    accountIds,
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
    const destAmt = Number(r.destination_amount ?? 0);
    const srcAmt = Number(r.source_amount ?? 0);
    const displayAmount = destAmt > 0 ? destAmt : srcAmt;
    return {
      transactionId: r.id,
      type: displayType,
      createTime: r.operation_date ? `${r.operation_date}T00:00:00.000Z` : "",
      status: (r.status as string) || "—",
      operationDate: r.operation_date || "",
      creditDetails: {
        amount: displayAmount,
        currency: { alphabeticCode: (r.destination_currency as string) || "USD" },
        account: creditAcc,
      },
      debitDetails: {
        amount: srcAmt,
        account: debitAcc,
      },
    };
  });
}
