import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminCard from "@/components/admin/AdminCard";
import FundsRequestsClient from "./funds-requests-client";

export default function ManageFundsRequestsPage() {
  return (
    <div>
      <AdminPageHeader
        title="Funds requests"
        description="Approve or reject pending deposit and withdrawal requests. Approved requests create a transaction and update account balance."
      />
      <AdminCard>
        <FundsRequestsClient />
      </AdminCard>
    </div>
  );
}
