import { supabase } from "@/lib/supabase/server";
import InterestRatesClient from "./interest-rates-client";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminCard from "@/components/admin/AdminCard";

export default async function ManageInterestRatesPage() {
  const pageSize = 1000;
  let from = 0;
  type AccountRow = {
    account_id: number;
    account_number: string | null;
    client_name: string | null;
    interest_rate_monthly: number | null;
    client_id: number | null;
  };
  const allAccounts: AccountRow[] = [];

  while (true) {
    const { data: chunk } = await supabase
      .from("accounts")
      .select("account_id, account_number, client_name, interest_rate_monthly, client_id")
      .not("platform", "ilike", "%demo%")
      .order("account_id")
      .range(from, from + pageSize - 1);
    if (!chunk?.length) break;
    allAccounts.push(...(chunk as AccountRow[]));
    if (chunk.length < pageSize) break;
    from += pageSize;
  }

  const accounts = allAccounts;

  const clientIds = [...new Set(accounts.map((a) => a.client_id).filter(Boolean))];
  const clientChunkSize = 500;
  const clientRows: { id: number; email?: string }[] = [];
  for (let i = 0; i < clientIds.length; i += clientChunkSize) {
    const ids = clientIds.slice(i, i + clientChunkSize);
    const { data } = await supabase.from("clients").select("id, email").in("id", ids);
    if (data?.length) clientRows.push(...(data as { id: number; email?: string }[]));
  }
  const emailByClientId = new Map(clientRows.map((c) => [Number(c.id), c.email ?? "—"]));

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
              account_number: String(a.account_number),
              client_name: (a.client_name as string) || "",
              interest_rate_monthly: a.interest_rate_monthly != null ? Number(a.interest_rate_monthly) : 3,
              email: emailByClientId.get(Number(a.client_id)) ?? "—",
            }))
          }
        />
      </AdminCard>
    </div>
  );
}
