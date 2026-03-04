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
  if (t === "deposit_by_admin") return "deposit";
  if (t === "withdrawal_by_admin") return "withdrawal";
  if (t === "payout") return "withdrawal";
  if (t === "pending_disbursal_settlement") return "withdrawal";
  if (["rewards", "fee", "fees", "performance_fee"].includes(t)) return "fees";
  if (t === "daily_interest") return "Daily Profit";
  if (t === "partnership_fee_admin") return "Partnership Fees";
  return type || "unknown";
}

/** Resolve source/destination for display only by account ID (never by account_number). */
function resolveAccount(
  accountId: number | null,
  byId: Map<number, AccountMapEntry>
): AccountDisplay {
  const id = accountId != null ? accountId : null;
  const entry = id != null ? byId.get(id) : undefined;
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
    accountNumber: "—",
    clientName: "External account",
    caption: "—",
    platform: "—",
  };
}

/** Build byId from transaction source/dest IDs; selfAccountNumbers for fee reclassification only. */
export async function buildAccountMaps(
  clientId: number,
  transactionRows: RawTransactionRow[]
): Promise<{
  byId: Map<number, AccountMapEntry>;
  selfAccountNumbers: Set<string>;
}> {
  const byId = new Map<number, AccountMapEntry>();
  const selfAccountNumbers = new Set<string>();

  const allIds = new Set<number>();
  for (const r of transactionRows) {
    if (r.source_account_id != null) allIds.add(Number(r.source_account_id));
    if (r.destination_account_id != null)
      allIds.add(Number(r.destination_account_id));
  }
  if (129 in INTERNAL_ACCOUNTS) allIds.add(129);

  const idList = Array.from(allIds);
  if (idList.length > 0) {
    const [accountsRes, pammRes] = await Promise.all([
      supabase
        .from("accounts")
        .select("account_id, account_number, client_name, platform")
        .in("account_id", idList),
      supabase
        .from("pamm_master")
        .select("id, account_number, name")
        .in("id", idList),
    ]);
    for (const a of accountsRes.data ?? []) {
      const id = Number(a.account_id);
      const num = String(a.account_number ?? "").trim();
      byId.set(id, {
        account_id: id,
        account_number: num,
        client_name: (a.client_name as string) || "",
        platform: (a.platform as string) || "Investment Account",
      });
    }
    for (const p of pammRes.data ?? []) {
      const id = Number(p.id);
      if (byId.has(id)) continue;
      const num = String(p.account_number ?? "").trim();
      byId.set(id, {
        account_id: id,
        account_number: num,
        client_name: (p.name as string) || "",
        platform: "PAMM",
      });
    }
  }

  const { data: selfAccounts } = await supabase
    .from("accounts")
    .select("account_id, account_number, client_name, platform")
    .eq("client_id", clientId);
  const { data: selfPamm } = await supabase
    .from("pamm_master")
    .select("id, account_number, name")
    .eq("client_id", clientId);

  for (const a of selfAccounts ?? []) {
    const id = Number(a.account_id);
    const num = String(a.account_number ?? "").trim();
    if (num) selfAccountNumbers.add(num);
    if (!byId.has(id))
      byId.set(id, {
        account_id: id,
        account_number: num,
        client_name: (a.client_name as string) || "",
        platform: (a.platform as string) || "Investment Account",
      });
  }
  for (const p of selfPamm ?? []) {
    const id = Number(p.id);
    const num = String(p.account_number ?? "").trim();
    if (num) selfAccountNumbers.add(num);
    if (!byId.has(id))
      byId.set(id, {
        account_id: id,
        account_number: num,
        client_name: (p.name as string) || "",
        platform: "PAMM",
      });
  }

  return { byId, selfAccountNumbers };
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

/** Fetch all transactions of a given type (admin use). Paginates to get full list. */
export async function getTransactionsByType(
  type: string
): Promise<RawTransactionRow[]> {
  const result: RawTransactionRow[] = [];
  const pageSize = 1000;
  let from = 0;
  while (true) {
    const { data: chunk } = await supabase
      .from("transactions")
      .select("*")
      .eq("type", type)
      .order("operation_date", { ascending: false })
      .range(from, from + pageSize - 1);
    if (!chunk?.length) break;
    result.push(...(chunk as RawTransactionRow[]));
    if (chunk.length < pageSize) break;
    from += pageSize;
  }
  return result;
}

export async function getTransactionsForClient(clientId: number): Promise<{
  transactions: RawTransactionRow[];
  accountIds: number[];
}> {
  const pageSize = 1000;

  // Step 1 – Get user's account IDs: investment accounts (type = 'investment' or type IS NULL or product = 'PAMM Investor' or 'eWallet'), plus pamm_master.id for this client.
  const myAccountIds: number[] = [];
  let from = 0;
  while (true) {
    const { data } = await supabase
      .from("accounts")
      .select("account_id")
      .eq("client_id", clientId)
      .or("type.eq.investment,type.is.null,product.eq.PAMM Investor,product.eq.eWallet")
      .range(from, from + pageSize - 1);
    if (!data?.length) break;
    for (const r of data) {
      const id = Number((r as { account_id: number }).account_id);
      if (Number.isFinite(id)) myAccountIds.push(id);
    }
    if (data.length < pageSize) break;
    from += pageSize;
  }
  const { data: pammData } = await supabase
    .from("pamm_master")
    .select("id")
    .eq("client_id", clientId);
  for (const r of pammData ?? []) {
    const id = Number((r as { id: number }).id);
    if (Number.isFinite(id)) myAccountIds.push(id);
  }

  if (myAccountIds.length === 0) {
    return { transactions: [], accountIds: [] };
  }

  // Step 2 – Fetch ALL transactions where source_account_id or destination_account_id is in myAccountIds (paginated).
  // Use deterministic order (operation_date desc, id desc) so pagination does not skip/duplicate rows when dates tie.
  const idStr = myAccountIds.join(",");
  const all: RawTransactionRow[] = [];
  from = 0;
  while (true) {
    const { data: chunk } = await supabase
      .from("transactions")
      .select("*")
      .or(`source_account_id.in.(${idStr}),destination_account_id.in.(${idStr})`)
      .order("operation_date", { ascending: false })
      .order("id", { ascending: false })
      .range(from, from + pageSize - 1);
    if (!chunk?.length) break;
    all.push(...(chunk as RawTransactionRow[]));
    if (chunk.length < pageSize) break;
    from += pageSize;
  }

  // Step 3 – Deduplicate by transaction id and sort by operation_date descending.
  const seenIds = new Set<number>();
  const transactions = all.filter((r) => {
    if (seenIds.has(r.id)) return false;
    seenIds.add(r.id);
    return true;
  });
  transactions.sort((a, b) =>
    (b.operation_date || "").localeCompare(a.operation_date || "")
  );

  return { transactions, accountIds: myAccountIds };
}

const MASK = "****";

function maskAccountNumber(accountNumber: string): string {
  const s = (accountNumber || "").trim();
  if (s.length <= 4) return MASK;
  return MASK + s.slice(-4);
}

/** For withdrawal transactions, get withdrawal-request bank account display by transaction ID (client's funds_requests + bank_accounts).
 * Includes pending_disbursal_settlement via pending_disbursal_entries -> source_funds_request -> bank_account_id. */
export async function getWithdrawalToAccountMap(
  clientId: number,
  transactionRows: RawTransactionRow[]
): Promise<Map<number, AccountDisplay>> {
  const withdrawalIds = transactionRows
    .filter((r) => {
      const t = (r.type || "").toLowerCase().trim();
      return t === "withdrawal" || t === "withdrawal_by_admin" || t === "payout";
    })
    .map((r) => r.id);
  const settlementIds = transactionRows
    .filter((r) => (r.type || "").toLowerCase().trim() === "pending_disbursal_settlement")
    .map((r) => r.id);
  const allIds = [...withdrawalIds, ...settlementIds];
  if (allIds.length === 0) return new Map();

  const batchSize = 500;
  const out = new Map<number, AccountDisplay>();

  for (let i = 0; i < withdrawalIds.length; i += batchSize) {
    const batch = withdrawalIds.slice(i, i + batchSize);
    const { data: frRows } = await supabase
      .from("funds_requests")
      .select("transaction_id, bank_account_id")
      .eq("client_id", clientId)
      .in("transaction_id", batch)
      .not("bank_account_id", "is", null);
    const bankIds = [...new Set((frRows ?? []).map((fr) => Number(fr.bank_account_id)).filter(Number.isFinite))];
    if (bankIds.length === 0) continue;
    const { data: bankRows } = await supabase
      .from("bank_accounts")
      .select("id, bank, account_number, ifsc_code")
      .eq("client_id", clientId)
      .in("id", bankIds);
    const bankById = new Map<number, { bank: string; accountNumberMasked: string }>();
    for (const b of bankRows ?? []) {
      const id = Number(b.id);
      bankById.set(id, {
        bank: (b.bank as string) || "",
        accountNumberMasked: maskAccountNumber((b.account_number as string) || ""),
      });
    }
    for (const fr of frRows ?? []) {
      const txId = Number(fr.transaction_id);
      const baId = Number(fr.bank_account_id);
      const entry = bankById.get(baId);
      if (entry) {
        out.set(txId, {
          accountId: baId,
          accountNumber: entry.accountNumberMasked,
          clientName: "Self Bank Account",
          caption: `${entry.bank} ${entry.accountNumberMasked}`,
          platform: "—",
        });
      }
    }
  }

  for (let i = 0; i < settlementIds.length; i += batchSize) {
    const batch = settlementIds.slice(i, i + batchSize);
    const { data: pdeRows } = await supabase
      .from("pending_disbursal_entries")
      .select("settlement_transaction_id, source_funds_request_id")
      .eq("client_id", clientId)
      .in("settlement_transaction_id", batch)
      .not("settlement_transaction_id", "is", null);
    if (!pdeRows?.length) continue;
    const requestIds = [...new Set((pdeRows ?? []).map((p) => Number(p.source_funds_request_id)).filter(Number.isFinite))];
    const { data: frRows } = await supabase
      .from("funds_requests")
      .select("id, bank_account_id")
      .eq("client_id", clientId)
      .in("id", requestIds)
      .not("bank_account_id", "is", null);
    if (!frRows?.length) continue;
    const bankIds = [...new Set((frRows ?? []).map((fr) => Number(fr.bank_account_id)).filter(Number.isFinite))];
    const { data: bankRows } = await supabase
      .from("bank_accounts")
      .select("id, bank, account_number, ifsc_code")
      .eq("client_id", clientId)
      .in("id", bankIds);
    const bankById = new Map<number, { bank: string; accountNumberMasked: string }>();
    for (const b of bankRows ?? []) {
      const id = Number(b.id);
      bankById.set(id, {
        bank: (b.bank as string) || "",
        accountNumberMasked: maskAccountNumber((b.account_number as string) || ""),
      });
    }
    const frById = new Map<number, number>();
    for (const fr of frRows) {
      frById.set(Number(fr.id), Number(fr.bank_account_id));
    }
    for (const pde of pdeRows) {
      const txId = Number(pde.settlement_transaction_id);
      const reqId = Number(pde.source_funds_request_id);
      const baId = frById.get(reqId);
      if (baId == null) continue;
      const entry = bankById.get(baId);
      if (entry) {
        out.set(txId, {
          accountId: baId,
          accountNumber: entry.accountNumberMasked,
          clientName: "Self Bank Account",
          caption: `${entry.bank} ${entry.accountNumberMasked}`,
          platform: "—",
        });
      }
    }
  }

  return out;
}

export function toDisplayTransactions(
  rows: RawTransactionRow[],
  byId: Map<number, AccountMapEntry>,
  selfAccountNumbers: Set<string>,
  withdrawalToAccount?: Map<number, AccountDisplay>
): TransactionDisplay[] {
  return rows.map((r) => {
    const destId = r.destination_account_id;
    const srcId = r.source_account_id;
    let creditAcc = resolveAccount(destId, byId);
    const debitAcc = resolveAccount(srcId, byId);
    const rawType = (r.type || "").toLowerCase().trim();
    const normalizedType = normalizeDbType(r.type);
    let displayType = reclassifyFees(
      normalizedType,
      creditAcc.accountNumber,
      debitAcc.accountNumber,
      selfAccountNumbers
    );
    if (rawType === "deposit_by_admin") {
      displayType = "Deposit by Admin";
    } else if (rawType === "withdrawal_by_admin") {
      displayType = "Withdrawal by Admin";
    }
    // For withdrawal/payout: if we have bank account from withdrawal request, use it for To Account; else "Self Bank Account"
    if ((normalizedType === "withdrawal" || normalizedType === "payout") && withdrawalToAccount?.has(r.id)) {
      creditAcc = withdrawalToAccount.get(r.id)!;
    } else if (normalizedType === "withdrawal" || normalizedType === "payout") {
      creditAcc = {
        accountId: 0,
        accountNumber: "—",
        clientName: "Self Bank Account",
        caption: "—",
        platform: "—",
      };
    }
    const destAmt = Number(r.destination_amount ?? 0);
    const srcAmt = Number(r.source_amount ?? 0);
    const displayAmount = destAmt > 0 ? destAmt : srcAmt;
    const creditAccount =
      displayType === "Daily Profit"
        ? { ...creditAcc, platform: "Investment Account" }
        : creditAcc;
    return {
      transactionId: r.id,
      type: displayType,
      createTime: r.operation_date ? `${r.operation_date}T00:00:00.000Z` : "",
      status: (r.status as string) || "—",
      operationDate: r.operation_date || "",
      creditDetails: {
        amount: displayAmount,
        currency: { alphabeticCode: (r.destination_currency as string) || "USD" },
        account: creditAccount,
      },
      debitDetails: {
        amount: srcAmt,
        account: debitAcc,
      },
    };
  });
}
