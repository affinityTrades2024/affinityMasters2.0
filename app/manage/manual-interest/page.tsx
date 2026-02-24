import { supabase } from "@/lib/supabase/server";
import ManualInterestClient from "./manual-interest-client";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminCard from "@/components/admin/AdminCard";

export default async function ManageManualInterestPage() {
  const { data: clientRows } = await supabase
    .from("clients")
    .select("investment_account_id")
    .not("investment_account_id", "is", null);
  const accountIds = (clientRows || [])
    .map((c) => Number(c.investment_account_id))
    .filter((id) => Number.isFinite(id));
  let accountList: { account_id: number; account_number: string | null; client_name: string | null }[] = [];
  if (accountIds.length > 0) {
    const { data } = await supabase
      .from("accounts")
      .select("account_id, account_number, client_name")
      .in("account_id", accountIds)
      .not("platform", "ilike", "%demo%")
      .order("account_number");
    accountList = (data || []) as { account_id: number; account_number: string | null; client_name: string | null }[];
  }
  return (
    <div>
      <AdminPageHeader
        title="Manual daily interest"
        description="Credit daily interest for a specific date and selected investment accounts. Use when backfilling or correcting."
      />
      <AdminCard>
        <ManualInterestClient
          accounts={accountList.map((a) => ({
            account_id: Number(a.account_id),
            account_number: String(a.account_number),
            client_name: (a.client_name as string) || "",
          }))}
        />
      </AdminCard>
    </div>
  );
}
