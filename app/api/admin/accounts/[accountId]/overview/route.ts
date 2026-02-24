import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { supabase } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";

function maskAccountNumber(accountNumber: string): string {
  const s = (accountNumber || "").trim();
  if (s.length <= 4) return "****";
  return "****" + s.slice(-4);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ accountId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAdmin(session.email))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { accountId: accountIdParam } = await params;
  const accountId = parseInt(accountIdParam, 10);
  if (!Number.isFinite(accountId) || accountId <= 0) {
    return NextResponse.json({ error: "Invalid account ID" }, { status: 400 });
  }

  const { data: account, error: accountError } = await supabase
    .from("accounts")
    .select(
      "account_id, account_number, client_id, client_name, email, balance, free_funds, interest_rate_monthly, product, platform, type, created"
    )
    .eq("account_id", accountId)
    .maybeSingle();

  if (accountError || !account) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  const clientId = account.client_id != null ? Number(account.client_id) : null;
  let client: Record<string, unknown> | null = null;
  let fundsRequests: Record<string, unknown>[] = [];
  let verificationDocuments: Record<string, unknown>[] = [];
  let bankAccounts: Record<string, unknown>[] = [];
  let recentInterestLog: Record<string, unknown>[] = [];

  if (clientId != null) {
    const [clientRes, requestsRes, docsRes, bankRes] = await Promise.all([
      supabase.from("clients").select("*").eq("id", clientId).maybeSingle(),
      supabase
        .from("funds_requests")
        .select(
          "id, type, account_id, amount_usd, amount_inr, status, requested_at, reviewed_at, disbursed_at, admin_notes, transaction_id"
        )
        .eq("client_id", clientId)
        .order("requested_at", { ascending: false }),
      supabase
        .from("verification_documents")
        .select("id, description, file_path, file_size_bytes, mime_type, created_at")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false }),
      supabase
        .from("bank_accounts")
        .select("id, bank, account_number, ifsc_code, is_default, created_at")
        .eq("client_id", clientId)
        .order("created_at", { ascending: true }),
    ]);

    if (clientRes.data) client = clientRes.data as Record<string, unknown>;
    fundsRequests = (requestsRes.data || []) as Record<string, unknown>[];
    verificationDocuments = (docsRes.data || []) as Record<string, unknown>[];
    bankAccounts = (bankRes.data || []).map((row) => {
      const r = row as { account_number?: string; [k: string]: unknown };
      return {
        ...r,
        account_number_masked: maskAccountNumber(String(r.account_number ?? "")),
      };
    }) as Record<string, unknown>[];
  }

  const { data: interestLog } = await supabase
    .from("interest_credit_log")
    .select("id, for_date, status, transaction_id, created_at")
    .eq("account_id", accountId)
    .order("for_date", { ascending: false })
    .limit(20);
  recentInterestLog = (interestLog || []) as Record<string, unknown>[];

  const DEFAULT_RATE = 3;
  const interestRate =
    account.interest_rate_monthly != null && Number(account.interest_rate_monthly) >= 0
      ? Number(account.interest_rate_monthly)
      : DEFAULT_RATE;

  return NextResponse.json({
    account: {
      account_id: account.account_id,
      account_number: account.account_number,
      client_id: account.client_id,
      client_name: account.client_name,
      email: account.email,
      balance: Number(account.balance ?? 0),
      free_funds: account.free_funds != null ? Number(account.free_funds) : null,
      interest_rate_monthly: interestRate,
      product: account.product,
      platform: account.platform,
      type: account.type,
      created: account.created,
    },
    client,
    fundsRequests,
    verificationDocuments,
    bankAccounts,
    recentInterestLog,
  });
}
