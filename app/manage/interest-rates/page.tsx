import { supabase } from "@/lib/supabase/server";
import InterestRatesClient from "./interest-rates-client";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminCard from "@/components/admin/AdminCard";

const PAGE_SIZES = [20, 30, 50] as const;

function getInterestRatesFilter(q: string | null) {
  const base = supabase
    .from("accounts")
    .select("account_id, account_number, client_name, interest_rate_monthly, email", { count: "exact" })
    .or("type.eq.investment,type.is.null,product.eq.PAMM Investor")
    .not("platform", "ilike", "%demo%")
    .order("account_id");
  if (q && q.trim()) {
    const term = q.trim().replace(/\*/g, "");
    if (term) {
      return base.or(`account_number.ilike.*${term}*,client_name.ilike.*${term}*,email.ilike.*${term}*`);
    }
  }
  return base;
}

export default async function ManageInterestRatesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; pageSize?: string; q?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const pageSizeNum = parseInt(params.pageSize ?? "20", 10);
  const pageSize: (typeof PAGE_SIZES)[number] = PAGE_SIZES.includes(pageSizeNum as (typeof PAGE_SIZES)[number]) ? (pageSizeNum as (typeof PAGE_SIZES)[number]) : 20;
  const searchQuery = typeof params.q === "string" ? params.q : null;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  type AccountRow = {
    account_id: number;
    account_number: string | null;
    client_name: string | null;
    interest_rate_monthly: number | null;
    email: string | null;
  };
  const base = getInterestRatesFilter(searchQuery);
  const { data: rows, count: totalCount } = await base.range(from, to);
  const accounts = (rows || []) as AccountRow[];

  return (
    <div>
      <AdminPageHeader
        title="Interest rates"
        description="Set monthly interest rate (%) per account. Changes take effect for future daily interest runs."
      />
      <AdminCard>
        <InterestRatesClient
          accounts={
            accounts.map((a) => ({
              account_id: Number(a.account_id),
              account_number: String(a.account_number ?? ""),
              client_name: (a.client_name as string) || "",
              interest_rate_monthly: a.interest_rate_monthly != null ? Number(a.interest_rate_monthly) : 3,
              email: (a.email as string) || "—",
            }))
          }
          totalCount={totalCount ?? 0}
          page={page}
          pageSize={pageSize}
          searchQuery={searchQuery ?? ""}
        />
      </AdminCard>
    </div>
  );
}
