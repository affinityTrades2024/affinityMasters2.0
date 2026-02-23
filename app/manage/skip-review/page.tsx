import { supabase } from "@/lib/supabase/server";
import SkipReviewClient from "./skip-review-client";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminCard from "@/components/admin/AdminCard";

export default async function ManageSkipReviewPage() {
  const { data: skipped } = await supabase
    .from("interest_credit_log")
    .select("id, account_id, for_date, status, created_at")
    .eq("status", "skipped")
    .order("for_date", { ascending: false });
  const accountIds = [...new Set((skipped || []).map((s) => s.account_id))];
  const { data: accounts } =
    accountIds.length > 0
      ? await supabase
          .from("accounts")
          .select("account_id, account_number, client_name")
          .in("account_id", accountIds)
      : { data: [] };
  const accountMap = new Map(
    (accounts || []).map((a) => [
      Number(a.account_id),
      { account_number: a.account_number, client_name: a.client_name },
    ])
  );
  const rows = (skipped || []).map((s) => ({
    id: s.id,
    account_id: s.account_id,
    for_date: s.for_date,
    status: s.status,
    created_at: s.created_at,
    account_number: accountMap.get(Number(s.account_id))?.account_number ?? String(s.account_id),
    client_name: accountMap.get(Number(s.account_id))?.client_name ?? "—",
  }));
  return (
    <div>
      <AdminPageHeader
        title="Skip review"
        description="Interest for these entries was skipped (e.g. already credited). Approve to accept or reject to allow manual correction."
      />
      <AdminCard>
        <SkipReviewClient rows={rows} />
      </AdminCard>
    </div>
  );
}
