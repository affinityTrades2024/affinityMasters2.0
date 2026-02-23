import { supabase } from "@/lib/supabase/server";
import ManualInterestClient from "./manual-interest-client";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminCard from "@/components/admin/AdminCard";

export default async function ManageManualInterestPage() {
  const { data: accounts } = await supabase
    .from("accounts")
    .select("account_id, account_number, client_name")
    .not("platform", "ilike", "%demo%")
    .order("account_number");
  return (
    <div>
      <AdminPageHeader
        title="Manual daily interest"
        description="Credit daily interest for a specific date and selected accounts. Use when backfilling or correcting."
      />
      <AdminCard>
        <ManualInterestClient
          accounts={(accounts || []).map((a) => ({
            account_id: Number(a.account_id),
            account_number: String(a.account_number),
            client_name: (a.client_name as string) || "",
          }))}
        />
      </AdminCard>
    </div>
  );
}
