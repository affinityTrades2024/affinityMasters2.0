import { supabase } from "@/lib/supabase/server";
import PartnershipEarningsClient from "./partnership-earnings-client";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminCard from "@/components/admin/AdminCard";

export default async function ManagePartnershipEarningsPage() {
  const { data: accounts } = await supabase
    .from("accounts")
    .select("account_id, account_number, client_name")
    .not("platform", "ilike", "%demo%")
    .order("account_number");
  return (
    <div>
      <AdminPageHeader
        title="Partnership earnings"
        description="Credit a partnership fee to a recipient based on a referral account’s total deposits."
      />
      <AdminCard>
        <PartnershipEarningsClient
          accounts={
            (accounts || []).map((a) => ({
              account_id: Number(a.account_id),
              account_number: String(a.account_number),
              client_name: (a.client_name as string) || "",
            }))
          }
        />
      </AdminCard>
    </div>
  );
}
