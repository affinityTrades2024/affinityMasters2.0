import { supabase } from "@/lib/supabase/server";
import InvestmentAccountsClient from "./investment-accounts-client";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminCard from "@/components/admin/AdminCard";

const PAGE_SIZE_OPTIONS = [20, 30, 50] as const;
const DEFAULT_PAGE_SIZE = 20;

export interface InvestmentAccountRow {
  account_id: number;
  account_number: string;
  client_name: string;
  email: string;
  nickname: string;
  available_balance: number;
  client_id: number | null;
}

function getInvestmentAccountsFilter(q: string | null) {
  const base = supabase
    .from("accounts")
    .select("account_id, account_number, client_name, email, client_id, balance", { count: "exact" })
    .or("type.eq.investment,type.is.null,product.eq.PAMM Investor")
    .not("platform", "ilike", "%demo%")
    .order("account_number");
  if (q && q.trim()) {
    const term = q.trim().replace(/\*/g, "");
    if (term) {
      return base.or(`account_number.ilike.*${term}*,client_name.ilike.*${term}*,email.ilike.*${term}*`);
    }
  }
  return base;
}

export default async function ManagePammPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; pageSize?: string; q?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const pageSizeParam = params.pageSize ?? String(DEFAULT_PAGE_SIZE);
  const pageSize = PAGE_SIZE_OPTIONS.includes(Number(pageSizeParam) as (typeof PAGE_SIZE_OPTIONS)[number])
    ? (Number(pageSizeParam) as (typeof PAGE_SIZE_OPTIONS)[number])
    : DEFAULT_PAGE_SIZE;
  const q = typeof params.q === "string" ? params.q : null;

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const query = getInvestmentAccountsFilter(q).range(from, to);
  const { data: accountRows, error, count } = await query;

  if (error) {
    return (
      <div>
        <AdminPageHeader title="Investment accounts" description="View and manage investment accounts." />
        <AdminCard>
          <p className="text-red-600">Failed to load accounts.</p>
        </AdminCard>
      </div>
    );
  }

  const rows = (accountRows || []) as {
    account_id: number;
    account_number: string | null;
    client_name: string | null;
    email: string | null;
    client_id: number | null;
    balance: number | null;
  }[];

  const totalCount = count ?? 0;
  const clientIds = [...new Set(rows.map((r) => r.client_id).filter(Boolean))] as number[];
  let nicknameByClientId = new Map<number, string>();
  if (clientIds.length > 0) {
    const { data: clients } = await supabase
      .from("clients")
      .select("id, nickname")
      .in("id", clientIds);
    nicknameByClientId = new Map(
      (clients || []).map((c) => [c.id as number, (c.nickname as string) ?? ""])
    );
  }

  const list: InvestmentAccountRow[] = rows.map((r) => {
    const available_balance = Number(r.balance ?? 0);
    return {
      account_id: r.account_id,
      account_number: String(r.account_number ?? r.account_id),
      client_name: (r.client_name as string) ?? "",
      email: (r.email as string) ?? "",
      nickname: (r.client_id != null ? nicknameByClientId.get(r.client_id) : null) ?? "",
      available_balance,
      client_id: r.client_id,
    };
  });

  return (
    <div>
      <AdminPageHeader
        title="Investment accounts"
        description="View and manage investment accounts. Use the eye icon to view full details, or the pencil to edit."
      />
      <AdminCard>
        <InvestmentAccountsClient
          accounts={list}
          totalCount={totalCount}
          page={page}
          pageSize={pageSize}
          searchQuery={q ?? ""}
        />
      </AdminCard>
    </div>
  );
}
