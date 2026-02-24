import { supabase } from "@/lib/supabase/server";

export interface BankAccountRow {
  id: number;
  client_id: number;
  bank: string;
  account_number: string;
  ifsc_code: string;
  is_default: boolean;
  created_at: string;
}

export interface BankAccountPublic {
  id: number;
  bank: string;
  accountNumberMasked: string;
  ifscCode: string;
  isDefault: boolean;
  created_at: string;
}

const MASK = "****";

function maskAccountNumber(accountNumber: string): string {
  const s = (accountNumber || "").trim();
  if (s.length <= 4) return MASK;
  return MASK + s.slice(-4);
}

function toPublic(row: BankAccountRow): BankAccountPublic {
  return {
    id: row.id,
    bank: row.bank,
    accountNumberMasked: maskAccountNumber(row.account_number),
    ifscCode: row.ifsc_code,
    isDefault: row.is_default,
    created_at: row.created_at,
  };
}

export async function getBankAccounts(clientId: number): Promise<BankAccountPublic[]> {
  const { data, error } = await supabase
    .from("bank_accounts")
    .select("id, client_id, bank, account_number, ifsc_code, is_default, created_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data || []).map((row) => toPublic(row as BankAccountRow));
}

export async function getDefaultBankAccount(
  clientId: number
): Promise<BankAccountPublic | null> {
  const { data, error } = await supabase
    .from("bank_accounts")
    .select("id, client_id, bank, account_number, ifsc_code, is_default, created_at")
    .eq("client_id", clientId)
    .eq("is_default", true)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return toPublic(data as BankAccountRow);
}

export async function getBankAccountById(
  clientId: number,
  bankAccountId: number
): Promise<BankAccountRow | null> {
  const { data, error } = await supabase
    .from("bank_accounts")
    .select("id, client_id, bank, account_number, ifsc_code, is_default, created_at")
    .eq("id", bankAccountId)
    .eq("client_id", clientId)
    .maybeSingle();

  if (error) throw error;
  return data as BankAccountRow | null;
}
