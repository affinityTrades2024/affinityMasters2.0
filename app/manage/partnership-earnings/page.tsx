import { supabase } from "@/lib/supabase/server";
import PartnershipEarningsClient from "./partnership-earnings-client";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminCard from "@/components/admin/AdminCard";

export const dynamic = "force-dynamic";

async function fetchAllAccounts() {
  const all: { account_id: number; account_number: string; client_name: string; email: string }[] = [];
  const batchSize = 1000;
  let from = 0;
  while (true) {
    const { data } = await supabase
      .from("accounts")
      .select("account_id, account_number, client_name, email")
      .or("type.eq.investment,type.is.null,product.eq.PAMM Investor")
      .not("platform", "ilike", "%demo%")
      .order("account_id")
      .range(from, from + batchSize - 1);
    if (!data || data.length === 0) break;
    for (const a of data) {
      all.push({
        account_id: Number(a.account_id),
        account_number: String(a.account_number ?? ""),
        client_name: (a.client_name as string) || "",
        email: (a.email as string) || "",
      });
    }
    if (data.length < batchSize) break;
    from += batchSize;
  }
  return all;
}

export default async function ManagePartnershipEarningsPage() {
  const accounts = await fetchAllAccounts();
  return (
    <div>
      <AdminPageHeader
        title="Partnership earnings"
        description="Credit a partnership fee to a recipient based on a referral account’s total deposits."
      />
      <AdminCard>
        <PartnershipEarningsClient accounts={accounts} />
      </AdminCard>
    </div>
  );
}
