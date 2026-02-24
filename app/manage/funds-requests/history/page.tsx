import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminCard from "@/components/admin/AdminCard";
import FundsRequestHistoryClient from "./funds-request-history-client";

export default function FundsRequestHistoryPage() {
  return (
    <div>
      <AdminPageHeader
        title="Request history"
        description="All fund requests (deposits and withdrawals) across all statuses."
      />
      <AdminCard>
        <FundsRequestHistoryClient />
      </AdminCard>
    </div>
  );
}
