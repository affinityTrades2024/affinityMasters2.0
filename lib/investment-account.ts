import { supabase } from "@/lib/supabase/server";

/**
 * Get the designated investment account id for a client (one per client).
 * Returns null if not set (e.g. no account linked yet).
 */
export async function getInvestmentAccountId(
  clientId: number
): Promise<number | null> {
  const { data, error } = await supabase
    .from("clients")
    .select("investment_account_id")
    .eq("id", clientId)
    .maybeSingle();

  if (error || data?.investment_account_id == null) {
    return null;
  }
  const id = Number(data.investment_account_id);
  return Number.isFinite(id) ? id : null;
}

export interface InvestmentAccountRow {
  account_id: number;
  account_number: string;
  balance: number;
  /** @deprecated Use balance for available/withdrawable amount. Kept for backward compat. */
  free_funds: number;
  platform: string;
  product: string | null;
}

/**
 * Get the full investment account row for a client (from accounts table).
 * Returns null if client has no investment account linked or row not found.
 */
export async function getInvestmentAccount(
  clientId: number
): Promise<InvestmentAccountRow | null> {
  const accountId = await getInvestmentAccountId(clientId);
  if (accountId == null) return null;

  const { data, error } = await supabase
    .from("accounts")
    .select("account_id, account_number, balance, platform, product")
    .eq("account_id", accountId)
    .eq("client_id", clientId)
    .maybeSingle();

  if (error || !data) return null;

  const balance = Number(data.balance ?? 0);
  return {
    account_id: Number(data.account_id),
    account_number: String(data.account_number ?? ""),
    balance,
    free_funds: balance,
    platform: String(data.platform ?? ""),
    product: data.product != null ? String(data.product) : null,
  };
}
